import type { ActMetadata, ChangedAct } from "./types.js";
import {
  EliActMetadataResponseSchema,
  EliActStructResponseSchema,
  EliChangedActsResponseSchema,
  type EliActStructResponse,
} from "./schemas.js";

export interface EliClientOptions {
  /** API base URL. Default: https://api.sejm.gov.pl/eli */
  baseUrl?: string;
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

/**
 * Typed HTTP wrapper for the ELI API (api.sejm.gov.pl/eli).
 * Uses native fetch; validates responses with Zod schemas.
 * The base URL is configurable so tests can point it at an MSW server.
 */
export class EliClient {
  readonly baseUrl: string;

  constructor(options: EliClientOptions = {}) {
    this.baseUrl = (
      options.baseUrl ?? "https://api.sejm.gov.pl/eli"
    ).replace(/\/$/, "");
  }

  private async fetchJson<T>(
    path: string,
    parse: (json: unknown) => T,
  ): Promise<T> {
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new EliClientError(`ELI API ${res.status} at ${url}`, res.status);
    }
    return parse(await res.json() as unknown);
  }

  private async fetchHtml(path: string): Promise<string> {
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
  }

  /** GET /acts/{publisher}/{year}/{position}/struct */
  async getActStruct(eli: string): Promise<EliActStructResponse> {
    const [publisher, year, position] = eli.split("/");
    return this.fetchJson(
      `acts/${publisher}/${year}/${position}/struct`,
      (json) => EliActStructResponseSchema.parse(json),
    );
  }

  /**
   * GET /acts/{publisher}/{year}/{position}/text.html/{unitPath}
   * Returns raw HTML. Returns empty string for 404 (unit has no text).
   */
  async getUnitText(eli: string, unitPath: string): Promise<string> {
    const [publisher, year, position] = eli.split("/");
    return this.fetchHtml(
      `acts/${publisher}/${year}/${position}/text.html/${unitPath}`,
    );
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
  }
}
