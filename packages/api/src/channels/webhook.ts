// S5-12: Webhook channel with SSRF protection.

// Blocks private/loopback ranges: 10.x, 172.16-31.x, 192.168.x, 127.x, localhost, ::1
const PRIVATE_HOST_RE =
  /^(?:10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|127\.\d+\.\d+\.\d+|localhost|::1)$/i;

export interface WebhookSendParams {
  webhookUrl: string;
  payload: unknown;
}

export class WebhookChannel {
  async send(params: WebhookSendParams): Promise<void> {
    const url = new URL(params.webhookUrl);

    if (url.protocol !== "https:") {
      throw new Error("Webhook URL must use HTTPS");
    }

    if (PRIVATE_HOST_RE.test(url.hostname)) {
      throw new Error(
        "Webhook URL cannot target private or loopback addresses",
      );
    }

    const res = await fetch(params.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params.payload),
    });

    if (!res.ok) {
      throw new Error(`Webhook delivery failed: ${res.status} ${res.statusText}`);
    }
  }
}
