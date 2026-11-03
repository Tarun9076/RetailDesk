export interface SmsSender {
  send(toE164: string, body: string): Promise<void>;
}

/** Development only: prints the message to the server console. */
class ConsoleSender implements SmsSender {
  async send(to: string, body: string) {
    console.log(`[sms:console] to ${to}: ${body}`);
  }
}

/** Twilio Programmable Messaging over plain HTTPS (no SDK). */
class TwilioSender implements SmsSender {
  constructor(
    private sid: string,
    private token: string,
    private from: string,
  ) {}

  async send(to: string, body: string) {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.sid}:${this.token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: this.from, Body: body }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) throw new Error(`Twilio responded ${res.status}`);
  }
}

export function getSmsSender(): SmsSender {
  const provider = process.env.SMS_PROVIDER ?? "console";
  if (provider === "twilio") {
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = process.env;
    if (!sid || !token || !from) throw new Error("Twilio is not fully configured");
    return new TwilioSender(sid, token, from);
  }
  if (process.env.NODE_ENV === "production") {
    // Never log one-time codes on a production server.
    throw new Error("SMS_PROVIDER=console is not allowed in production");
  }
  return new ConsoleSender();
}
