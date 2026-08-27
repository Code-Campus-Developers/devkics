import { ContentPublishStatus, SponsorshipTier, VolunteerApplicationStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  assertAnnouncementTransition,
  assertVolunteerApplicationTransition,
  deliverEmailNotification,
  deliverQueuedEmailNotifications,
  dispatchNotification,
  sortSponsorshipsByTier,
} from "@/lib/server/community-content";

describe("community-content", () => {
  it("orders sponsorships by tier before the configured display order", () => {
    const sponsorships = sortSponsorshipsByTier([
      { id: "community", tier: SponsorshipTier.COMMUNITY, sortOrder: 0 },
      { id: "official-later", tier: SponsorshipTier.OFFICIAL, sortOrder: 2 },
      { id: "headline", tier: SponsorshipTier.HEADLINE, sortOrder: 9 },
      { id: "official-first", tier: SponsorshipTier.OFFICIAL, sortOrder: 1 },
    ]);

    expect(sponsorships.map((sponsorship) => sponsorship.id)).toEqual([
      "headline",
      "official-first",
      "official-later",
      "community",
    ]);
  });

  it("enforces announcement and volunteer workflow transitions", () => {
    expect(() =>
      assertAnnouncementTransition(ContentPublishStatus.DRAFT, ContentPublishStatus.PUBLISHED),
    ).not.toThrow();
    expect(() =>
      assertAnnouncementTransition(ContentPublishStatus.PUBLISHED, ContentPublishStatus.DRAFT),
    ).not.toThrow();
    expect(() =>
      assertAnnouncementTransition(ContentPublishStatus.ARCHIVED, ContentPublishStatus.PUBLISHED),
    ).toThrow();
    expect(() =>
      assertVolunteerApplicationTransition(
        VolunteerApplicationStatus.SUBMITTED,
        VolunteerApplicationStatus.APPROVED,
      ),
    ).toThrow();
  });

  it("persists both in-app and email notifications when email delivery is requested", async () => {
    const create = vi.fn().mockResolvedValue({ id: "notification" });

    await dispatchNotification({ notification: { create } } as never, {
      recipientUserId: "user-1",
      recipientEmail: "user-1@devkics.test",
      type: "volunteer.application.status",
      title: "Volunteer application updated",
      body: "Approved",
      email: true,
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map(([input]) => input.data.channel)).toEqual(["IN_APP", "EMAIL"]);
    expect(create.mock.calls.map(([input]) => input.data.deliveredAt)).toEqual([
      expect.any(Date),
      null,
    ]);
  });

  it("marks an email notification delivered only after a server transport succeeds", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn().mockResolvedValue({ id: "email-notification" });

    await deliverEmailNotification(
      { notification: { update } } as never,
      { send },
      {
        notificationId: "email-notification",
        recipientEmail: "recipient@devkics.test",
        subject: "Volunteer application updated",
        text: "Your application was approved.",
      },
    );

    expect(send).toHaveBeenCalledWith({
      to: "recipient@devkics.test",
      subject: "Volunteer application updated",
      text: "Your application was approved.",
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "email-notification" },
      data: { deliveredAt: expect.any(Date) },
    });
  });

  it("keeps failed email delivery queued and delivers it on a later retry", async () => {
    const emailRecord = {
      id: "queued-email",
      recipientEmail: "public-volunteer@devkics.test",
      title: "Volunteer application updated",
      body: "Approved",
    };
    const create = vi
      .fn()
      .mockResolvedValueOnce({ id: "in-app" })
      .mockResolvedValueOnce(emailRecord);
    const update = vi.fn().mockResolvedValue(emailRecord);
    const failedTransport = { send: vi.fn().mockRejectedValue(new Error("provider unavailable")) };

    await dispatchNotification(
      { notification: { create, update } } as never,
      {
        recipientEmail: emailRecord.recipientEmail,
        type: "volunteer.application.status",
        title: emailRecord.title,
        body: emailRecord.body,
        email: true,
      },
      failedTransport,
    );

    expect(update).not.toHaveBeenCalled();
    const retryTransport = { send: vi.fn().mockResolvedValue(undefined) };
    const result = await deliverQueuedEmailNotifications(
      {
        notification: {
          findMany: vi.fn().mockResolvedValue([emailRecord]),
          update,
        },
      } as never,
      retryTransport,
    );

    expect(result).toEqual({ attempted: 1, delivered: 1 });
    expect(retryTransport.send).toHaveBeenCalledWith({
      to: emailRecord.recipientEmail,
      subject: emailRecord.title,
      text: emailRecord.body,
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: emailRecord.id },
      data: { deliveredAt: expect.any(Date) },
    });
  });
});
