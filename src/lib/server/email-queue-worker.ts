import { deliverQueuedEmailNotifications } from "./community-content";
import { getEmailTransport } from "./email-transport";
import { prisma } from "./db";

let started = false;

/**
 * Opt-in background retry loop for queued (undelivered) EMAIL notifications.
 *
 * DevKics runs as a single long-lived Bun process in Docker (`NITRO_PRESET=bun`),
 * so a plain `setInterval` is a safe, dependency-free scheduler for that
 * deployment target — there is no serverless/edge cold-start concern here.
 * It is disabled by default and only starts when `EMAIL_QUEUE_RETRY_INTERVAL_MS`
 * is set to a positive number, and it never runs under the Vitest test runner.
 *
 * Retries are safe to repeat: `deliverQueuedEmailNotifications` only selects
 * notifications where `deliveredAt` is still null, so a notification already
 * delivered by a previous tick (or the manual `/api/notifications/deliver-queued`
 * endpoint) is never re-sent.
 */
export function startEmailQueueRetryWorker(): void {
  if (started) return;
  if (process.env["VITEST"]) return;

  const intervalMs = Number(process.env["EMAIL_QUEUE_RETRY_INTERVAL_MS"] ?? "0");
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;

  started = true;
  const timer = setInterval(() => {
    void runEmailQueueRetryOnce();
  }, intervalMs);
  timer.unref?.();
}

export async function runEmailQueueRetryOnce(): Promise<{
  attempted: number;
  delivered: number;
} | null> {
  const transport = getEmailTransport();
  if (!transport) return null;
  try {
    return await deliverQueuedEmailNotifications(prisma, transport);
  } catch (error) {
    console.error("Email queue retry worker failed", error);
    return null;
  }
}
