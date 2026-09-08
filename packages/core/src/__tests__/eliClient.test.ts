import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { EliClient, EliClientError } from "../eliClient.js";
import { server } from "./server.js";
import { BASE_URL, ACT_ELI } from "./fixtures/eli-api.js";
import { http, HttpResponse } from "msw";

const client = new EliClient({ baseUrl: BASE_URL });

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe("EliClient.getAct", () => {
  it("returns normalized ActMetadata", async () => {
    const act = await client.getAct(ACT_ELI);
    expect(act.eli).toBe(ACT_ELI);
    expect(act.publisher).toBe("DU");
    expect(act.year).toBe(2017);
    expect(act.position).toBe(2196);
    expect(act.inForce).toBe(true);
    expect(act.textHTML).toBe(true);
    expect(act.keywords).toEqual(["testy", "prawo cywilne"]);
  });

  it("maps nullable fields to null when absent", async () => {
    server.use(
      http.get(`${BASE_URL}/acts/DU/2017/2196`, () =>
        HttpResponse.json({
          ELI: ACT_ELI,
          publisher: "DU",
          year: 2017,
          pos: 2196,
          title: "Test",
          type: "Ustawa",
          status: "uchylony",
          inForce: false,
          textHTML: false,
          keywords: [],
          texts: [],
        }),
      ),
    );
    const act = await client.getAct(ACT_ELI);
    expect(act.entryIntoForce).toBeNull();
    expect(act.repealDate).toBeNull();
    expect(act.changeDate).toBeNull();
  });

  it("throws EliClientError on 404", async () => {
    server.use(
      http.get(`${BASE_URL}/acts/DU/9999/1`, () =>
        new HttpResponse(null, { status: 404 }),
      ),
    );
    await expect(client.getAct("DU/9999/1")).rejects.toBeInstanceOf(
      EliClientError,
    );
  });

  it("EliClientError carries the HTTP status code", async () => {
    server.use(
      http.get(`${BASE_URL}/acts/DU/9999/1`, () =>
        new HttpResponse(null, { status: 503 }),
      ),
    );
    const err = await client.getAct("DU/9999/1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EliClientError);
    expect((err as EliClientError).status).toBe(503);
  });
});

describe("EliClient.getActStruct", () => {
  it("returns parsed struct with recursive children", async () => {
    const struct = await client.getActStruct(ACT_ELI);
    expect(struct.eli).toBe(ACT_ELI);
    expect(struct.content).toHaveLength(3);
    const art1 = struct.content[0]!;
    expect(art1.type).toBe("art");
    expect(art1.num).toBe("1");
    expect(art1.children).toHaveLength(2);
    expect(art1.children[0]!.type).toBe("ustep");
  });
});

describe("EliClient.getUnitText", () => {
  it("returns HTML text for a known unit path", async () => {
    const html = await client.getUnitText(ACT_ELI, "art=1/ustep=1");
    expect(html).toContain("Ustawa reguluje");
  });

  it("returns empty string for unknown unit path (404)", async () => {
    const html = await client.getUnitText(ACT_ELI, "art=99");
    expect(html).toBe("");
  });
});

describe("EliClient.getChangedActs", () => {
  it("returns paginated changed acts", async () => {
    const result = await client.getChangedActs("2024-01-01T00:00:00Z");
    expect(result.count).toBe(1);
    expect(result.items).toHaveLength(1);
    const item = result.items[0]!;
    expect(item.eli).toBe(ACT_ELI);
    expect(item.publisher).toBe("DU");
    expect(item.changeDate).toBe("2024-06-15T10:00:00Z");
  });
});
