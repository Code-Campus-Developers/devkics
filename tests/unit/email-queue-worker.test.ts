import { afterEach, describe, expect, it, vi } from "vitest";

describe("email queue retry worker", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("stays disabled when no interval is configured", async () => {
    vi.stubEnv("EMAIL_QUEUE_RETRY_INTERVAL_MS", "");
    vi.stubEnv("VITEST", "");
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    const { startEmailQueueRetryWorker } = await import("@/lib/server/email-queue-worker");
    startEmailQueueRetryWorker();

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it("schedules exactly one interval when a positive interval is configured, and only starts once", async () => {
    vi.stubEnv("EMAIL_QUEUE_RETRY_INTERVAL_MS", "60000");
    vi.stubEnv("VITEST", "");
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    const { startEmailQueueRetryWorker } = await import("@/lib/server/email-queue-worker");
    startEmailQueueRetryWorker();
    startEmailQueueRetryWorker();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
  });

  it("skips delivery attempts when no email transport is configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_FROM_EMAIL", "");

    const { runEmailQueueRetryOnce } = await import("@/lib/server/email-queue-worker");
    await expect(runEmailQueueRetryOnce()).resolves.toBeNull();
  });
});
