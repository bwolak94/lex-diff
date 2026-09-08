import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { ActParser } from "../actParser.js";
import { EliClient } from "../eliClient.js";
import { server } from "./server.js";
import { BASE_URL, ACT_ELI } from "./fixtures/eli-api.js";
import { http, HttpResponse } from "msw";
import { actStructFixture, actMetadataNoTextFixture } from "./fixtures/eli-api.js";

const client = new EliClient({ baseUrl: BASE_URL });
const parser = new ActParser(client);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe("ActParser.parse — structure", () => {
  it("returns all units from the struct tree (flat)", async () => {
    const units = await parser.parse(ACT_ELI, false);
    // art=1, art=1/ustep=1, art=1/ustep=2, art=2, art=2/punkt=1, art=2/punkt=2, art=3
    expect(units).toHaveLength(7);
  });

  it("builds correct paths for top-level units", async () => {
    const units = await parser.parse(ACT_ELI, false);
    const paths = units.map((u) => u.path);
    expect(paths).toContain("art=1");
    expect(paths).toContain("art=2");
    expect(paths).toContain("art=3");
  });

  it("builds correct nested paths", async () => {
    const units = await parser.parse(ACT_ELI, false);
    const paths = units.map((u) => u.path);
    expect(paths).toContain("art=1/ustep=1");
    expect(paths).toContain("art=1/ustep=2");
    expect(paths).toContain("art=2/punkt=1");
    expect(paths).toContain("art=2/punkt=2");
  });

  it("sets parentPath correctly", async () => {
    const units = await parser.parse(ACT_ELI, false);
    const ustep1 = units.find((u) => u.path === "art=1/ustep=1")!;
    expect(ustep1.parentPath).toBe("art=1");

    const art1 = units.find((u) => u.path === "art=1")!;
    expect(art1.parentPath).toBeNull();
  });

  it("sets kind from struct element type", async () => {
    const units = await parser.parse(ACT_ELI, false);
    const art = units.find((u) => u.path === "art=1")!;
    expect(art.kind).toBe("art");

    const ustep = units.find((u) => u.path === "art=1/ustep=1")!;
    expect(ustep.kind).toBe("ustep");
  });

  it("builds numberSort with zero-padded digits", async () => {
    const units = await parser.parse(ACT_ELI, false);
    const art1 = units.find((u) => u.path === "art=1")!;
    expect(art1.numberSort).toBe("0000000001");
  });
});

describe("ActParser.parse — metadata-only mode (textHTML=false)", () => {
  it("returns units with text=null when textHTML=false", async () => {
    const units = await parser.parse(ACT_ELI, false);
    expect(units.every((u) => u.text === null)).toBe(true);
    expect(units.every((u) => u.textHash === null)).toBe(true);
  });

  it("does not call the text.html endpoint when textHTML=false", async () => {
    let textFetched = false;
    server.use(
      http.get(`${BASE_URL}/acts/DU/2017/2196/text.html/:path*`, () => {
        textFetched = true;
        return new HttpResponse("<p>text</p>", {
          headers: { "Content-Type": "text/html" },
        });
      }),
    );
    await parser.parse(ACT_ELI, false);
    expect(textFetched).toBe(false);
  });
});

describe("ActParser.parse — text extraction (textHTML=true)", () => {
  it("populates text on leaf units", async () => {
    const units = await parser.parse(ACT_ELI, true);
    const ustep1 = units.find((u) => u.path === "art=1/ustep=1")!;
    expect(ustep1.text).toBeTruthy();
    expect(ustep1.text).toContain("Ustawa reguluje");
  });

  it("populates textHash on leaf units", async () => {
    const units = await parser.parse(ACT_ELI, true);
    const ustep1 = units.find((u) => u.path === "art=1/ustep=1")!;
    expect(ustep1.textHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("leaves text=null on intermediate (non-leaf) units", async () => {
    const units = await parser.parse(ACT_ELI, true);
    const art1 = units.find((u) => u.path === "art=1")!;
    // art=1 has children (ustep), so it is not a leaf
    expect(art1.text).toBeNull();
  });

  it("normalizes HTML before storing text", async () => {
    const units = await parser.parse(ACT_ELI, true);
    // art=2/punkt=1 fixture has &nbsp; and a legal ref
    const punkt1 = units.find((u) => u.path === "art=2/punkt=1")!;
    expect(punkt1.text).toContain("DzU/2024/1401");
    expect(punkt1.text).not.toContain("&nbsp;");
  });
});
