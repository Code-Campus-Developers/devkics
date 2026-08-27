import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@prisma/client";

import { handleApiRequest } from "@/lib/server/api";
import { hashPassword } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { deleteGalleryMedia } from "@/lib/server/supabase-storage";

const DEFAULT_ENV = {
  DATABASE_URL: "postgresql://abrahamogbu@localhost:5432/devkics?schema=public",
  JWT_ACCESS_SECRET: "test-access-secret-1234567890",
  JWT_REFRESH_SECRET: "test-refresh-secret-1234567890",
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL: "7d",
};

function toCookieHeader(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

describe("Phase 3 volunteer workflow", () => {
  beforeAll(() => {
    Object.assign(process.env, DEFAULT_ENV);
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.announcement.deleteMany();
    await prisma.mediaFile.deleteMany();
    await prisma.gallery.deleteMany();
    await prisma.sponsorshipEnquiry.deleteMany();
    await prisma.sponsorship.deleteMany();
    await prisma.sponsor.deleteMany();
    await prisma.volunteer.deleteMany();
    await prisma.volunteerApplication.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.roleAssignment.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.city.deleteMany();

    await prisma.city.create({
      data: {
        slug: "abuja",
        name: "Abuja",
        country: "Nigeria",
        countryCode: "NG",
        status: "LIVE",
        tagline: "Pilot city",
        accentImage: "abuja",
      },
    });
  });

  it("submits, reviews, assigns, audits, and notifies a volunteer application", async () => {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });
    const organizer = await prisma.user.create({
      data: {
        name: "Abuja Organizer",
        email: "phase3-organizer@devkics.test",
        passwordHash: await hashPassword("devkics123"),
        citySlug: city.slug,
      },
    });
    await prisma.roleAssignment.create({
      data: { userId: organizer.id, role: Role.ORGANIZER, cityId: city.id, countryCode: "NG" },
    });

    const applicantRegister = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Volunteer Applicant",
          email: "phase3-volunteer@devkics.test",
          password: "devkics123",
          role: "player",
          citySlug: city.slug,
        }),
      }),
    );
    expect(applicantRegister?.status).toBe(201);
    const applicantCookie = toCookieHeader(applicantRegister as Response);

    const submit = await handleApiRequest(
      new Request("http://localhost:8080/api/volunteer-applications", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: applicantCookie },
        body: JSON.stringify({
          citySlug: city.slug,
          name: "Volunteer Applicant",
          email: "phase3-volunteer@devkics.test",
          role: "Match official",
          availability: "Available every Saturday morning for the full tournament season.",
        }),
      }),
    );
    expect(submit?.status).toBe(201);
    const { application } = (await submit?.json()) as { application: { id: string } };

    expect(
      (
        await handleApiRequest(
          new Request(`http://localhost:8080/api/volunteer-applications/${application.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "under-review" }),
          }),
        )
      )?.status,
    ).toBe(401);

    const organizerLogin = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: organizer.email, password: "devkics123" }),
      }),
    );
    const organizerCookie = toCookieHeader(organizerLogin as Response);

    const bypass = await handleApiRequest(
      new Request(`http://localhost:8080/api/volunteer-applications/${application.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: organizerCookie },
        body: JSON.stringify({ status: "approved" }),
      }),
    );
    expect(bypass?.status).toBe(409);

    const review = await handleApiRequest(
      new Request(`http://localhost:8080/api/volunteer-applications/${application.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: organizerCookie },
        body: JSON.stringify({ status: "under-review" }),
      }),
    );
    expect(review?.status).toBe(200);

    const approve = await handleApiRequest(
      new Request(`http://localhost:8080/api/volunteer-applications/${application.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: organizerCookie },
        body: JSON.stringify({ status: "approved" }),
      }),
    );
    expect(approve?.status).toBe(200);

    const applicant = await prisma.user.findUniqueOrThrow({
      where: { email: "phase3-volunteer@devkics.test" },
    });
    await expect(
      prisma.volunteer.findUnique({ where: { applicationId: application.id } }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.notification.count({
        where: { recipientUserId: applicant.id, type: "volunteer.application.status" },
      }),
    ).resolves.toBe(4);
    await expect(
      prisma.notification.findFirst({
        where: {
          channel: "EMAIL",
          recipientEmail: "phase3-volunteer@devkics.test",
          type: "volunteer.application.status",
          deliveredAt: null,
        },
      }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.auditLog.findFirst({
        where: { resourceId: application.id, action: "volunteer.application.reviewed" },
      }),
    ).resolves.not.toBeNull();

    const notificationRead = await handleApiRequest(
      new Request("http://localhost:8080/api/notifications", {
        method: "GET",
        headers: { cookie: applicantCookie },
      }),
    );
    expect(notificationRead?.status).toBe(200);
    const notificationPayload = (await notificationRead?.json()) as {
      notifications: Array<{ id: string }>;
      unreadCount: number;
    };
    expect(notificationPayload.unreadCount).toBe(2);

    const markOneRead = await handleApiRequest(
      new Request(
        `http://localhost:8080/api/notifications/${notificationPayload.notifications[0]?.id}`,
        {
          method: "PATCH",
          headers: { cookie: applicantCookie },
        },
      ),
    );
    expect(markOneRead?.status).toBe(200);

    const markAllRead = await handleApiRequest(
      new Request("http://localhost:8080/api/notifications/read", {
        method: "PATCH",
        headers: { cookie: applicantCookie },
      }),
    );
    expect(markAllRead?.status).toBe(200);
    await expect(
      prisma.notification.count({
        where: { recipientUserId: applicant.id, channel: "IN_APP", readAt: null },
      }),
    ).resolves.toBe(0);
  });

  it("routes a sponsorship enquiry into the admin notification queue", async () => {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });
    const admin = await prisma.user.create({
      data: {
        name: "Platform Admin",
        email: "phase3-admin@devkics.test",
        passwordHash: await hashPassword("devkics123"),
      },
    });
    await prisma.roleAssignment.create({
      data: { userId: admin.id, role: Role.ADMIN, cityId: city.id, countryCode: "NG" },
    });

    const unauthenticatedQueue = await handleApiRequest(
      new Request("http://localhost:8080/api/sponsorship-enquiries", { method: "GET" }),
    );
    expect(unauthenticatedQueue?.status).toBe(401);

    const submit = await handleApiRequest(
      new Request("http://localhost:8080/api/sponsorship-enquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          citySlug: city.slug,
          name: "Partner Contact",
          email: "partner@devkics.test",
          organization: "Acme Technologies",
          message: "We would like to discuss an official partnership for the pilot season.",
        }),
      }),
    );
    expect(submit?.status).toBe(201);
    const { enquiry } = (await submit?.json()) as { enquiry: { id: string } };

    await expect(
      prisma.notification.count({
        where: {
          recipientUserId: admin.id,
          resourceId: enquiry.id,
          type: "sponsorship.enquiry.submitted",
        },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.auditLog.findFirst({
        where: { resourceId: enquiry.id, action: "sponsorship.enquiry.submitted" },
      }),
    ).resolves.not.toBeNull();

    const login = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: admin.email, password: "devkics123" }),
      }),
    );
    const queue = await handleApiRequest(
      new Request("http://localhost:8080/api/sponsorship-enquiries?page=1&pageSize=20", {
        method: "GET",
        headers: { cookie: toCookieHeader(login as Response) },
      }),
    );
    expect(queue?.status).toBe(200);
    const { enquiries } = (await queue?.json()) as { enquiries: Array<{ id: string }> };
    expect(enquiries.map((item) => item.id)).toContain(enquiry.id);
  });

  it("manages sponsorship publication, ordering, duration, and tournament linkage", async () => {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });
    const admin = await prisma.user.create({
      data: {
        name: "Sponsor Admin",
        email: "sponsor-admin@devkics.test",
        passwordHash: await hashPassword("devkics123"),
      },
    });
    await prisma.roleAssignment.create({
      data: { userId: admin.id, role: Role.ADMIN, cityId: city.id, countryCode: "NG" },
    });
    const tournament = await prisma.tournament.create({
      data: {
        cityId: city.id,
        name: "Abuja Cup",
        slug: "abuja-cup",
        season: "2026",
        format: "League",
        venue: "Jabi",
        summary: "Cup",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2026-10-01"),
      },
    });
    const login = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: admin.email, password: "devkics123" }),
      }),
    );
    const cookie = toCookieHeader(login as Response);
    const create = await handleApiRequest(
      new Request("http://localhost:8080/api/sponsorships", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          citySlug: "abuja",
          name: "Acme",
          slug: "acme",
          description: "Official partner",
          tier: "official",
          tournamentId: tournament.id,
          startsAt: "2026-09-01",
          endsAt: "2026-10-01",
        }),
      }),
    );
    expect(create?.status).toBe(201);
    const { sponsorship } = (await create?.json()) as { sponsorship: { id: string } };
    const update = await handleApiRequest(
      new Request(`http://localhost:8080/api/sponsorships/${sponsorship.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ isPublished: true, sortOrder: 3, tier: "headline" }),
      }),
    );
    expect(update?.status).toBe(200);
    const publicRead = await handleApiRequest(
      new Request("http://localhost:8080/api/sponsorships?citySlug=abuja"),
    );
    const publicPayload = (await publicRead?.json()) as {
      sponsorships: Array<{ id: string; sortOrder: number }>;
    };
    expect(publicPayload.sponsorships).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: sponsorship.id, sortOrder: 3 })]),
    );
  });

  it("tracks tournament volunteer requirements and attendance", async () => {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });
    const organizer = await prisma.user.create({
      data: {
        name: "Volunteer Ops",
        email: "volunteer-ops@devkics.test",
        passwordHash: await hashPassword("devkics123"),
        citySlug: "abuja",
      },
    });
    await prisma.roleAssignment.create({
      data: { userId: organizer.id, role: Role.ORGANIZER, cityId: city.id, countryCode: "NG" },
    });
    const tournament = await prisma.tournament.create({
      data: {
        cityId: city.id,
        name: "Volunteer Cup",
        slug: "volunteer-cup",
        season: "2026",
        format: "League",
        venue: "Jabi",
        summary: "Cup",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2026-10-01"),
      },
    });
    const volunteer = await prisma.volunteer.create({
      data: {
        city: { connect: { id: city.id } },
        application: {
          create: {
            cityId: city.id,
            name: "Ref",
            email: "ref@devkics.test",
            role: "Match official",
            availability: "Every Saturday morning.",
          },
        },
        role: "Match official",
        tournament: { connect: { id: tournament.id } },
      },
    });
    const login = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: organizer.email, password: "devkics123" }),
      }),
    );
    const cookie = toCookieHeader(login as Response);
    expect(
      (
        await handleApiRequest(
          new Request("http://localhost:8080/api/volunteer-requirements", {
            method: "PUT",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify({
              tournamentId: tournament.id,
              role: "Match official",
              requiredCount: 3,
            }),
          }),
        )
      )?.status,
    ).toBe(200);
    expect(
      (
        await handleApiRequest(
          new Request(`http://localhost:8080/api/volunteers/${volunteer.id}/check-ins`, {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify({ note: "Opening matchday" }),
          }),
        )
      )?.status,
    ).toBe(201);
    await expect(
      prisma.volunteer.findUnique({
        where: { id: volunteer.id },
        select: { attendanceCount: true },
      }),
    ).resolves.toEqual({ attendanceCount: 1 });

    const listVolunteers = await handleApiRequest(
      new Request(
        `http://localhost:8080/api/volunteers?tournamentId=${encodeURIComponent(tournament.id)}`,
        { headers: { cookie } },
      ),
    );
    expect(listVolunteers?.status).toBe(200);
    const volunteersPayload = (await listVolunteers?.json()) as {
      volunteers: Array<{ id: string; attendanceCount: number; applicant: { name: string } }>;
    };
    expect(volunteersPayload.volunteers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: volunteer.id,
          attendanceCount: 1,
          applicant: { name: "Ref", email: "ref@devkics.test" },
        }),
      ]),
    );
  });

  it("keeps organizer drafts private until publication", async () => {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });
    const organizer = await prisma.user.create({
      data: {
        name: "News Organizer",
        email: "phase3-news-organizer@devkics.test",
        passwordHash: await hashPassword("devkics123"),
        citySlug: city.slug,
      },
    });
    await prisma.roleAssignment.create({
      data: { userId: organizer.id, role: Role.ORGANIZER, cityId: city.id, countryCode: "NG" },
    });

    const unauthenticatedCreate = await handleApiRequest(
      new Request("http://localhost:8080/api/announcements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(unauthenticatedCreate?.status).toBe(401);

    const login = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: organizer.email, password: "devkics123" }),
      }),
    );
    const organizerCookie = toCookieHeader(login as Response);

    const createDraft = await handleApiRequest(
      new Request("http://localhost:8080/api/announcements", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: organizerCookie },
        body: JSON.stringify({
          citySlug: city.slug,
          headline: "Abuja matchday briefing",
          excerpt: "Everything teams need before the next matchday.",
          body: "Teams should arrive thirty minutes early and bring their confirmed squad lists.",
          category: "Matchday",
          status: "draft",
        }),
      }),
    );
    expect(createDraft?.status).toBe(201);
    const { announcement } = (await createDraft?.json()) as { announcement: { id: string } };

    const publicDraftRead = await handleApiRequest(
      new Request("http://localhost:8080/api/announcements?citySlug=abuja", { method: "GET" }),
    );
    const publicDraftPayload = (await publicDraftRead?.json()) as {
      announcements: Array<{ id: string }>;
    };
    expect(publicDraftPayload.announcements.map((item) => item.id)).not.toContain(announcement.id);

    const publish = await handleApiRequest(
      new Request(`http://localhost:8080/api/announcements/${announcement.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: organizerCookie },
        body: JSON.stringify({ status: "published" }),
      }),
    );
    expect(publish?.status).toBe(200);

    const publicPublishedRead = await handleApiRequest(
      new Request("http://localhost:8080/api/announcements?citySlug=abuja", { method: "GET" }),
    );
    const publicPublishedPayload = (await publicPublishedRead?.json()) as {
      announcements: Array<{ id: string; headline: string }>;
    };
    expect(publicPublishedPayload.announcements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: announcement.id, headline: "Abuja matchday briefing" }),
      ]),
    );
    await expect(
      prisma.auditLog.findFirst({
        where: { resourceId: announcement.id, action: "announcement.updated" },
      }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.notification.findFirst({
        where: {
          type: "announcement.published",
          resourceId: announcement.id,
          recipientUserId: organizer.id,
        },
      }),
    ).resolves.not.toBeNull();
  });

  it("creates city-scoped galleries and returns Supabase public media URLs", async () => {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });
    const organizer = await prisma.user.create({
      data: {
        name: "Gallery Organizer",
        email: "phase3-gallery-organizer@devkics.test",
        passwordHash: await hashPassword("devkics123"),
        citySlug: city.slug,
      },
    });
    await prisma.roleAssignment.create({
      data: { userId: organizer.id, role: Role.ORGANIZER, cityId: city.id, countryCode: "NG" },
    });

    const login = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: organizer.email, password: "devkics123" }),
      }),
    );
    const organizerCookie = toCookieHeader(login as Response);

    const unauthenticatedCreate = await handleApiRequest(
      new Request("http://localhost:8080/api/galleries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ citySlug: city.slug, title: "Opening matchday" }),
      }),
    );
    expect(unauthenticatedCreate?.status).toBe(401);

    const create = await handleApiRequest(
      new Request("http://localhost:8080/api/galleries", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: organizerCookie },
        body: JSON.stringify({ citySlug: city.slug, title: "Opening matchday" }),
      }),
    );
    expect(create?.status).toBe(201);
    const { gallery } = (await create?.json()) as { gallery: { id: string } };

    await prisma.mediaFile.create({
      data: {
        galleryId: gallery.id,
        fileName: "opening.jpg",
        mimeType: "image/jpeg",
        storagePath: `galleries/${gallery.id}/opening.jpg`,
        caption: "Opening whistle",
        credit: "DevKics media crew",
        isCover: true,
      },
    });

    const publicRead = await handleApiRequest(
      new Request("http://localhost:8080/api/galleries?citySlug=abuja", { method: "GET" }),
    );
    expect(publicRead?.status).toBe(200);
    const payload = (await publicRead?.json()) as {
      galleries: Array<{ id: string; media: Array<{ storagePath: string; publicUrl: string }> }>;
    };
    expect(payload.galleries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: gallery.id,
          media: [
            expect.objectContaining({
              storagePath: `galleries/${gallery.id}/opening.jpg`,
              publicUrl: expect.stringContaining("/storage/v1/object/public/devkics-gallery/"),
            }),
          ],
        }),
      ]),
    );
  });

  it("notifies the city audience and audits real Supabase gallery uploads", async () => {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });
    const organizer = await prisma.user.create({
      data: {
        name: "Upload Organizer",
        email: "phase3-upload-organizer@devkics.test",
        passwordHash: await hashPassword("devkics123"),
        citySlug: city.slug,
      },
    });
    await prisma.roleAssignment.create({
      data: { userId: organizer.id, role: Role.ORGANIZER, cityId: city.id, countryCode: "NG" },
    });
    const login = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: organizer.email, password: "devkics123" }),
      }),
    );
    const cookie = toCookieHeader(login as Response);

    const create = await handleApiRequest(
      new Request("http://localhost:8080/api/galleries", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ citySlug: city.slug, title: "Real upload coverage" }),
      }),
    );
    expect(create?.status).toBe(201);
    const { gallery } = (await create?.json()) as { gallery: { id: string } };

    // 1x1 transparent PNG.
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const pngBytes = Uint8Array.from(atob(pngBase64), (char) => char.charCodeAt(0));
    const formData = new FormData();
    formData.set("file", new File([pngBytes], "pixel.png", { type: "image/png" }));
    formData.set("caption", "Integration test upload");

    const upload = await handleApiRequest(
      new Request(`http://localhost:8080/api/galleries/${gallery.id}/media`, {
        method: "POST",
        headers: { cookie },
        body: formData,
      }),
    );
    expect(upload?.status).toBe(201);
    const { media } = (await upload?.json()) as { media: { id: string; storagePath: string } };

    try {
      await expect(
        prisma.auditLog.findFirst({
          where: { resourceId: media.id, action: "gallery.media.uploaded" },
        }),
      ).resolves.not.toBeNull();
      await expect(
        prisma.notification.findFirst({
          where: {
            type: "gallery.media.uploaded",
            resourceId: media.id,
            recipientUserId: organizer.id,
          },
        }),
      ).resolves.not.toBeNull();
    } finally {
      await deleteGalleryMedia(media.storagePath).catch(() => undefined);
    }
  }, 15_000);
});
