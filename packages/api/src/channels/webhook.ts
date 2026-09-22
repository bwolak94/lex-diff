// S5-12 / S6-11: Webhook channel with SSRF protection.

/**
 * Blocked IPv4 ranges:
 *   10.0.0.0/8       — class-A private
 *   172.16.0.0/12    — class-B private
 *   192.168.0.0/16   — class-C private
 *   127.0.0.0/8      — loopback
 *   0.0.0.0/8        — current network (maps to loopback on many stacks)
 *   169.254.0.0/16   — link-local / cloud metadata (AWS 169.254.169.254, etc.)
 *   100.64.0.0/10    — shared address space (CGN, often used internally)
 *
 * Blocked IPv6 ranges:
 *   ::1              — loopback
 *   fc00::/7         — unique local (fc** and fd**)
 *   fe80::/10        — link-local
 *   ::ffff:0:0/96    — IPv4-mapped IPv6 (wraps blocked IPv4 addresses)
 *
 * Blocked hostnames: localhost, *.internal, metadata.google.internal
 */
const PRIVATE_IPV4_RE = new RegExp(
  "^(?:" +
  // 10.x.x.x
  "10\\.\\d+\\.\\d+\\.\\d+|" +
  // 172.16-31.x.x
  "172\\.(?:1[6-9]|2\\d|3[01])\\.\\d+\\.\\d+|" +
  // 192.168.x.x
  "192\\.168\\.\\d+\\.\\d+|" +
  // 127.x.x.x
  "127\\.\\d+\\.\\d+\\.\\d+|" +
  // 0.x.x.x
  "0\\.\\d+\\.\\d+\\.\\d+|" +
  // 169.254.x.x  (link-local / cloud metadata)
  "169\\.254\\.\\d+\\.\\d+|" +
  // 100.64-127.x.x  (CGN / shared address space)
  "100\\.(?:6[4-9]|[7-9]\\d|1(?:[01]\\d|2[0-7]))\\.\\d+\\.\\d+" +
  ")$",
  "i",
);

const PRIVATE_IPV6_RE = new RegExp(
  "^(?:" +
  // loopback ::1 (also handles [::1] after URL parsing)
  "::1|" +
  // fc00::/7 — unique local (fc** or fd**)
  "f[cd][0-9a-f]{2}:|" +
  // fe80::/10 — link-local (fe80–febf)
  "fe[89ab][0-9a-f]:|" +
  // ::ffff: — IPv4-mapped IPv6
  "::ffff:" +
  ")",
  "i",
);

const BLOCKED_HOSTNAME_RE = /(?:^|\.)internal$/i;
const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

/**
 * Throws if `webhookUrl` targets a private/loopback/metadata address or
 * uses a non-HTTPS scheme. Exported so the subscription API route can
 * validate at creation time rather than only at delivery time.
 */
export function assertSafeWebhookUrl(webhookUrl: string): void {
  let url: URL;
  try {
    url = new URL(webhookUrl);
  } catch {
    throw new Error("Webhook URL is not a valid URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS");
  }

  // Block URL credentials — they can be used to bypass host-based checks
  // e.g. https://attacker@127.0.0.1/
  if (url.username || url.password) {
    throw new Error("Webhook URL must not contain credentials");
  }

  const host = url.hostname.toLowerCase();
  // WHATWG URL parser wraps IPv6 addresses in brackets: [fe80::1]
  // Strip them before regex testing.
  const hostForIpv6 = host.startsWith("[") ? host.slice(1, -1) : host;

  if (BLOCKED_HOSTNAMES.has(host) || BLOCKED_HOSTNAME_RE.test(host)) {
    throw new Error("Webhook URL cannot target internal hostnames");
  }

  if (PRIVATE_IPV4_RE.test(host)) {
    throw new Error("Webhook URL cannot target private or loopback addresses");
  }

  if (PRIVATE_IPV6_RE.test(hostForIpv6)) {
    throw new Error("Webhook URL cannot target private or loopback addresses");
  }
}

export interface WebhookSendParams {
  webhookUrl: string;
  payload: unknown;
}

export class WebhookChannel {
  async send(params: WebhookSendParams): Promise<void> {
    assertSafeWebhookUrl(params.webhookUrl);

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
