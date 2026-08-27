import { afterEach, describe, expect, it, vi } from "vitest";

import { getEmailTransport } from "@/lib/server/email-transport";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe("Resend email transport", () => {
  it("returns null until the required server configuration exists", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_FROM_EMAIL", "");

    expect(getEmailTransport()).toBeNull();
  });

  it("sends mail through the Resend server API", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_FROM_EMAIL", "DevKics <notifications@example.test>");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;

    await getEmailTransport()?.send({
      to: "recipient@devkics.test",
      subject: "Volunteer application updated",
      text: "Your application is approved.",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer re_test_key" }),
        body: JSON.stringify({
          from: "DevKics <notifications@example.test>",
          to: ["recipient@devkics.test"],
          subject: "Volunteer application updated",
          text: "Your application is approved.",
        }),
      }),
    );
  });
});
