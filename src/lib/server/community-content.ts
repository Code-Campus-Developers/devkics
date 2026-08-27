import {
  ContentPublishStatus,
  NotificationChannel,
  SponsorshipTier,
  VolunteerApplicationStatus,
  type PrismaClient,
} from "@prisma/client";

export const sponsorshipTierOrder: Record<SponsorshipTier, number> = {
  [SponsorshipTier.HEADLINE]: 0,
  [SponsorshipTier.OFFICIAL]: 1,
  [SponsorshipTier.COMMUNITY]: 2,
};

export function sortSponsorshipsByTier<T extends { tier: SponsorshipTier; sortOrder: number }>(
  sponsorships: T[],
) {
  return [...sponsorships].sort(
    (left, right) =>
      sponsorshipTierOrder[left.tier] - sponsorshipTierOrder[right.tier] ||
      left.sortOrder - right.sortOrder,
  );
}

export function assertAnnouncementTransition(
  current: ContentPublishStatus,
  next: ContentPublishStatus,
) {
  const allowed: Record<ContentPublishStatus, ContentPublishStatus[]> = {
    [ContentPublishStatus.DRAFT]: [ContentPublishStatus.PUBLISHED, ContentPublishStatus.ARCHIVED],
    [ContentPublishStatus.PUBLISHED]: [ContentPublishStatus.DRAFT, ContentPublishStatus.ARCHIVED],
    [ContentPublishStatus.ARCHIVED]: [ContentPublishStatus.DRAFT],
  };

  if (!allowed[current].includes(next)) {
    throw new Error(`Cannot transition announcement from ${current} to ${next}`);
  }
}

export function assertVolunteerApplicationTransition(
  current: VolunteerApplicationStatus,
  next: VolunteerApplicationStatus,
) {
  const allowed: Record<VolunteerApplicationStatus, VolunteerApplicationStatus[]> = {
    [VolunteerApplicationStatus.SUBMITTED]: [
      VolunteerApplicationStatus.UNDER_REVIEW,
      VolunteerApplicationStatus.WITHDRAWN,
    ],
    [VolunteerApplicationStatus.UNDER_REVIEW]: [
      VolunteerApplicationStatus.APPROVED,
      VolunteerApplicationStatus.REJECTED,
      VolunteerApplicationStatus.WITHDRAWN,
    ],
    [VolunteerApplicationStatus.APPROVED]: [],
    [VolunteerApplicationStatus.REJECTED]: [],
    [VolunteerApplicationStatus.WITHDRAWN]: [],
  };

  if (!allowed[current].includes(next)) {
    throw new Error(`Cannot transition volunteer application from ${current} to ${next}`);
  }
}

type DispatchNotificationInput = {
  recipientUserId?: string | null;
  recipientEmail?: string | null;
  createdByUserId?: string | null;
  type: string;
  title: string;
  body: string;
  resourceType?: string;
  resourceId?: string;
  email?: boolean;
};

export type NotificationEmailTransport = {
  send(input: { to: string; subject: string; text: string }): Promise<void>;
};

export async function deliverEmailNotification(
  prisma: Pick<PrismaClient, "notification">,
  transport: NotificationEmailTransport,
  input: { notificationId: string; recipientEmail: string; subject: string; text: string },
) {
  await transport.send({ to: input.recipientEmail, subject: input.subject, text: input.text });
  return prisma.notification.update({
    where: { id: input.notificationId },
    data: { deliveredAt: new Date() },
  });
}

export async function deliverQueuedEmailNotifications(
  prisma: Pick<PrismaClient, "notification">,
  transport: NotificationEmailTransport,
  limit = 50,
) {
  const queued = await prisma.notification.findMany({
    where: {
      channel: NotificationChannel.EMAIL,
      deliveredAt: null,
      recipientEmail: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let delivered = 0;
  for (const notification of queued) {
    if (!notification.recipientEmail) continue;
    try {
      await deliverEmailNotification(prisma, transport, {
        notificationId: notification.id,
        recipientEmail: notification.recipientEmail,
        subject: notification.title,
        text: notification.body,
      });
      delivered += 1;
    } catch {
      // Keep failures queued so a scheduled server job can retry them.
    }
  }
  return { attempted: queued.length, delivered };
}

export async function dispatchNotification(
  prisma: Pick<PrismaClient, "notification">,
  input: DispatchNotificationInput,
  transport?: NotificationEmailTransport | null,
) {
  const inApp = await prisma.notification.create({
    data: {
      recipientUserId: input.recipientUserId ?? null,
      recipientEmail: null,
      createdByUserId: input.createdByUserId ?? null,
      channel: NotificationChannel.IN_APP,
      type: input.type,
      title: input.title,
      body: input.body,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      deliveredAt: new Date(),
    },
  });

  if (!input.email || !input.recipientEmail) return [inApp];

  const email = await prisma.notification.create({
    data: {
      recipientUserId: input.recipientUserId ?? null,
      recipientEmail: input.recipientEmail,
      createdByUserId: input.createdByUserId ?? null,
      channel: NotificationChannel.EMAIL,
      type: input.type,
      title: input.title,
      body: input.body,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      deliveredAt: null,
    },
  });

  if (transport) {
    try {
      await deliverEmailNotification(prisma, transport, {
        notificationId: email.id,
        recipientEmail: input.recipientEmail,
        subject: input.title,
        text: input.body,
      });
    } catch {
      // Keep failed emails queued; notification delivery must not break source workflows.
    }
  }

  return [inApp, email];
}
