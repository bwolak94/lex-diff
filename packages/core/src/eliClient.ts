import type { ActMetadata, ChangedAct } from "./types.js";
import {
  EliActMetadataResponseSchema,
  EliActStructResponseSchema,
  EliChangedActsResponseSchema,
  type EliActStructResponse,
} from "./schemas.js";
import { withSpan } from "./tracer.js";

export interface EliClientOptions {
  /** API base URL. Default: https://api.sejm.gov.pl/eli */
  baseUrl?: string;
  /**
   * S6-7: Rate limit — max requests per second to the ELI API.
   * Default: 10 req/s. Set to 0 to disable throttling.
   */
  requestsPerSecond?: number;
}

export class EliClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EliClientError";
  }
}

// ── S6-7: Token-bucket rate limiter ──────────────────────────────────────────

class RateLimiter {
  private readonly minIntervalMs: number;
  // Queue-based throttle: concurrent callers serialize through this chain
  private queue: Promise<void> = Promise.resolve();
  private lastCallAt = 0;

  constructor(requestsPerSecond: number) {
    this.minIntervalMs = requestsPerSecond > 0 ? 1000 / requestsPerSecond : 0;
  }

  throttle(): Promise<void> {
    if (this.minIntervalMs === 0) return Promise.resolve();
    this.queue = this.queue.then(() => {
      const now = Date.now();
      const wait = this.minIntervalMs - (now - this.lastCallAt);
      if (wait > 0) {
        return new Promise<void>((resolve) => setTimeout(resolve, wait)).then(
          () => { this.lastCallAt = Date.now(); },
        );
      }
      this.lastCallAt = now;
    });
    return this.queue;
  }
}

/**
 * Typed HTTP wrapper for the ELI API (api.sejm.gov.pl/eli).
 * Uses native fetch; validates responses with Zod schemas.
 * The base URL is configurable so tests can point it at an MSW server.
 *
 * S6-2: All public methods are wrapped in OTel spans.
 * S6-7: Built-in rate limiter (default 10 req/s).
 */
export class EliClient {
  readonly baseUrl: string;
  private readonly _limiter: RateLimiter;

  constructor(options: EliClientOptions = {}) {
    this.baseUrl = (
      options.baseUrl ?? "https://api.sejm.gov.pl/eli"
    ).replace(/\/$/, "");
    this._limiter = new RateLimiter(options.requestsPerSecond ?? 10);
  }

  private async fetchJson<T>(
    path: string,
    parse: (json: unknown) => T,
  ): Promise<T> {
    await this._limiter.throttle();
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new EliClientError(`ELI API ${res.status} at ${url}`, res.status);
    }
    return parse(await res.json() as unknown);
  }

  private async fetchHtml(path: string): Promise<string> {
    await this._limiter.throttle();
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url, { headers: { Accept: "text/html" } });
    if (res.status === 404) return "";
    if (!res.ok) {
      throw new EliClientError(`ELI API ${res.status} at ${url}`, res.status);
    }
    return res.text();
  }

  /** GET /acts/{publisher}/{year}/{position} */
  async getAct(eli: string): Promise<ActMetadata> {
    return withSpan("EliClient.getAct", async () => {
      const [publisher, year, position] = eli.split("/");
      const raw = await this.fetchJson(
        `acts/${publisher}/${year}/${position}`,
        (json) => EliActMetadataResponseSchema.parse(json),
      );
      return {
        eli: raw.ELI,
        publisher: raw.publisher,
        year: raw.year,
        position: raw.pos,
        title: raw.title,
        type: raw.type,
        status: raw.status,
        inForce: raw.inForce,
        announcementDate: raw.announcementDate ?? null,
        entryIntoForce: raw.entryIntoForce ?? null,
        repealDate: raw.repealDate ?? null,
        changeDate: raw.changeDate ?? null,
        textHTML: raw.textHTML,
        keywords: raw.keywords,
      };
    }, { "eli": eli });
  }

  /** GET /acts/{publisher}/{year}/{position}/struct */
  async getActStruct(eli: string): Promise<EliActStructResponse> {
    return withSpan("EliClient.getActStruct", async () => {
      const [publisher, year, position] = eli.split("/");
      return this.fetchJson(
        `acts/${publisher}/${year}/${position}/struct`,
        (json) => EliActStructResponseSchema.parse(json),
      );
    }, { "eli": eli });
  }

  /**
   * GET /acts/{publisher}/{year}/{position}/text.html/{unitPath}
   * Returns raw HTML. Returns empty string for 404 (unit has no text).
   */
  async getUnitText(eli: string, unitPath: string): Promise<string> {
    return withSpan("EliClient.getUnitText", async () => {
      const [publisher, year, position] = eli.split("/");
      // Strip path segments whose value (after "=") is empty — these are
      // transparent root wrappers (e.g. "part=") that the text API ignores.
      const cleanPath = unitPath
        .split("/")
        .filter((seg) => (seg.split("=")[1] ?? "") !== "")
        .join("/");
      return this.fetchHtml(
        `acts/${publisher}/${year}/${position}/text.html/${cleanPath}`,
      );
    }, { "eli": eli, "unitPath": unitPath });
  }

  /**
   * GET /changes/acts?since={ISO}&limit=&offset=
   * Returns paginated list of acts changed since the given timestamp.
   */
  async getChangedActs(
    since: string,
    limit = 100,
    offset = 0,
  ): Promise<{ items: ChangedAct[]; count: number }> {
    return withSpan("EliClient.getChangedActs", async () => {
      const qs = new URLSearchParams({
        since,
        limit: String(limit),
        offset: String(offset),
      });
      const raw = await this.fetchJson(
        `changes/acts?${qs.toString()}`,
        (json) => EliChangedActsResponseSchema.parse(json),
      );
      return {
        count: raw.count,
        items: raw.items.map((item) => ({
          eli: item.ELI,
          publisher: item.publisher,
          year: item.year,
          position: item.pos,
          changeDate: item.changeDate,
        })),
      };
    }, { "since": since, "limit": limit, "offset": offset });
  }
}
