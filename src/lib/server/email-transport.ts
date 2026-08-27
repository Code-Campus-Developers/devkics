export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export type EmailTransport = {
  send(message: EmailMessage): Promise<void>;
};

export function getEmailTransport(): EmailTransport | null {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM_EMAIL"];
  if (!apiKey || !from) return null;

  return {
    async send(message) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
      });
      if (!response.ok) throw new Error("Email provider rejected delivery");
    },
  };
}
