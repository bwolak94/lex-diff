// S6-10: Contract tests — verify ELI API fixture shapes pass Zod schemas
// and EliClient correctly maps all response variants without live network.

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  EliActMetadataResponseSchema,
  EliActStructResponseSchema,
  EliChangedActsResponseSchema,
  EliSearchResponseSchema,
} from "../schemas.js";
import { EliClient } from "../eliClient.js";
import { server } from "./server.js";
import {
  ACT_ELI,
  ACT_MP_ELI,
  BASE_URL,
  actMetadataFixture,
  actMetadataNoTextFixture,
  actMetadataStringBoolFixture,
  actMetadataInForceStringFixture,
  actMpFixture,
  actStructFixture,
  actStructWithNameFixture,
  changedActsFixture,
  searchResultsFixture,
} from "./fixtures/eli-api.js";
import { http, HttpResponse } from "msw";

const client = new EliClient({ baseUrl: BASE_URL, requestsPerSecond: 0 });

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

// ── Schema contract tests (no network, parse fixtures directly) ───────────────

describe("EliActMetadataResponseSchema — contract (S6-10)", () => {
  it("parses standard act metadata fixture", () => {
    const result = EliActMetadataResponseSchema.safeParse(actMetadataFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inForce).toBe(true);
      expect(result.data.textHTML).toBe(true);
    }
  });

  it("parses metadata fixture with textHTML=false", () => {
    const result = EliActMetadataResponseSchema.safeParse(actMetadataNoTextFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.textHTML).toBe(false);
    }
  });

  it('coerces inForce string "True" → true', () => {
    const result = EliActMetadataResponseSchema.safeParse(actMetadataStringBoolFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inForce).toBe(true);
      expect(result.data.textHTML).toBe(true);
    }
  });

  it('coerces inForce string "IN_FORCE" → true', () => {
    const result = EliActMetadataResponseSchema.safeParse(actMetadataInForceStringFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inForce).toBe(true);
    }
  });

  it("parses M.P. (Monitor Polski) publisher act", () => {
    const result = EliActMetadataResponseSchema.safeParse(actMpFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.publisher).toBe("MP");
      expect(result.data.textHTML).toBe(false);
    }
  });

  it("defaults missing keywords to []", () => {
    const { keywords: _omit, ...withoutKeywords } = actMetadataFixture;
    const result = EliActMetadataResponseSchema.safeParse(withoutKeywords);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.keywords).toEqual([]);
    }
  });

  it("maps null repealDate to null", () => {
    const result = EliActMetadataResponseSchema.safeParse(actMetadataFixture);
    if (result.success) {
      expect(result.data.repealDate).toBeNull();
    }
  });

  it("rejects payload missing required ELI field", () => {
    const { ELI: _omit, ...withoutEli } = actMetadataFixture;
    expect(EliActMetadataResponseSchema.safeParse(withoutEli).success).toBe(false);
  });

  it("rejects payload with non-integer year", () => {
    expect(
      EliActMetadataResponseSchema.safeParse({ ...actMetadataFixture, year: "2017" }).success,
    ).toBe(false);
  });

  it("rejects payload with missing pos", () => {
    const { pos: _omit, ...withoutPos } = actMetadataFixture as typeof actMetadataFixture & { pos?: number };
    expect(EliActMetadataResponseSchema.safeParse(withoutPos).success).toBe(false);
  });
});

describe("EliActStructResponseSchema — contract (S6-10)", () => {
  it("parses standard struct fixture", () => {
    const result = EliActStructResponseSchema.safeParse(actStructFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(3);
      expect(result.data[0]!.children).toHaveLength(2);
    }
  });

  it('normalises "name" field to "num" (older API variant)', () => {
    const result = EliActStructResponseSchema.safeParse(actStructWithNameFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0]!.num).toBe("1");
      expect(result.data[0]!.children[0]!.num).toBe("1");
    }
  });

  it("parses empty struct array (act with no sub-units)", () => {
    const result = EliActStructResponseSchema.safeParse([]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });

  it("defaults missing children to []", () => {
    const result = EliActStructResponseSchema.safeParse([
      { type: "art", num: "1" },
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0]!.children).toEqual([]);
    }
  });

  it("rejects non-array response", () => {
    expect(EliActStructResponseSchema.safeParse({ eli: ACT_ELI }).success).toBe(false);
  });
});

describe("EliChangedActsResponseSchema — contract (S6-10)", () => {
  it("parses changed acts fixture", () => {
    const result = EliChangedActsResponseSchema.safeParse(changedActsFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.count).toBe(1);
      expect(result.data.items[0]!.changeDate).toBe("2024-06-15T10:00:00Z");
    }
  });

  it("parses empty page (offset > total)", () => {
    const result = EliChangedActsResponseSchema.safeParse({
      offset: 500,
      limit: 100,
      count: 0,
      items: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects item missing changeDate", () => {
    expect(
      EliChangedActsResponseSchema.safeParse({
        offset: 0,
        limit: 100,
        count: 1,
        items: [{ ELI: ACT_ELI, publisher: "DU", year: 2017, pos: 2196 }],
      }).success,
    ).toBe(false);
  });

  it("rejects missing count field", () => {
    const { count: _omit, ...withoutCount } = changedActsFixture;
    expect(EliChangedActsResponseSchema.safeParse(withoutCount).success).toBe(false);
  });
});

describe("EliSearchResponseSchema — contract (S6-10)", () => {
  it("parses search results fixture", () => {
    const result = EliSearchResponseSchema.safeParse(searchResultsFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalCount).toBe(1);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0]!.ELI).toBe(ACT_ELI);
    }
  });

  it("parses empty search results", () => {
    const result = EliSearchResponseSchema.safeParse({
      count: 0,
      offset: 0,
      totalCount: 0,
      items: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing totalCount", () => {
    const { totalCount: _omit, ...withoutTotal } = searchResultsFixture;
    expect(EliSearchResponseSchema.safeParse(withoutTotal).success).toBe(false);
  });
});

// ── EliClient integration tests via MSW (no live network) ────────────────────

describe("EliClient.searchActs — integration contract (S6-10)", () => {
  it("returns normalised results from search fixture", async () => {
    const result = await client.searchActs({ title: "test", limit: 10 });
    expect(result.totalCount).toBe(1);
    expect(result.items).toHaveLength(1);
    const item = result.items[0]!;
    expect(item.eli).toBe(ACT_ELI);
    expect(item.publisher).toBe("DU");
    expect(item.inForce).toBe(true);
  });

  it("maps nullable fields to null", async () => {
    const result = await client.searchActs({ limit: 5 });
    const item = result.items[0]!;
    expect(item.repealDate).toBeNull();
  });
});

describe("EliClient.getAct — M.P. publisher (S6-10)", () => {
  it("parses M.P. act metadata via client", async () => {
    const act = await client.getAct(ACT_MP_ELI);
    expect(act.publisher).toBe("MP");
    expect(act.year).toBe(2023);
    expect(act.position).toBe(512);
    expect(act.textHTML).toBe(false);
  });
});

describe("EliClient.getAct — string bool variants (S6-10)", () => {
  it('handles inForce: "True" string from API', async () => {
    server.use(
      http.get(`${BASE_URL}/acts/DU/2017/2196`, () =>
        HttpResponse.json(actMetadataStringBoolFixture),
      ),
    );
    const act = await client.getAct(ACT_ELI);
    expect(act.inForce).toBe(true);
    expect(act.textHTML).toBe(true);
  });

  it('handles inForce: "IN_FORCE" string from API', async () => {
    server.use(
      http.get(`${BASE_URL}/acts/DU/2017/2196`, () =>
        HttpResponse.json(actMetadataInForceStringFixture),
      ),
    );
    const act = await client.getAct(ACT_ELI);
    expect(act.inForce).toBe(true);
  });
});

describe("EliClient.getActStruct — name vs num variant (S6-10)", () => {
  it("normalises struct nodes with `name` field to `num`", async () => {
    server.use(
      http.get(`${BASE_URL}/acts/DU/2017/2196/struct`, () =>
        HttpResponse.json(actStructWithNameFixture),
      ),
    );
    const struct = await client.getActStruct(ACT_ELI);
    expect(struct[0]!.num).toBe("1");
    expect(struct[0]!.children[0]!.num).toBe("1");
  });
});
