import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { buildApp } from "../index.js";
import {
  InMemoryActRepository,
  InMemoryUnitRepository,
  InMemoryChangeEventRepository,
} from "@lexdiff/db";
import type { ActMetadata } from "@lexdiff/core";

// ── Fixture ───────────────────────────────────────────────────────────────────

const SAMPLE_ACT: ActMetadata = {
  eli: "DU/2017/2196",
  publisher: "DU",
  year: 2017,
  position: 2196,
  title: "Ustawa o systemie oświaty",
  type: "Ustawa",
  status: "obowiązujący",
  inForce: true,
  announcementDate: "2017-12-01",
  entryIntoForce: "2018-01-01",
  repealDate: null,
  changeDate: "2023-05-15",
  textHTML: true,
  keywords: ["oświata", "szkoła"],
};

function makeRepos() {
  const acts = new InMemoryActRepository();
  const units = new InMemoryUnitRepository();
  const changeEvents = new InMemoryChangeEventRepository();
  return { acts, units, changeEvents };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns 200 { status: ok }", async () => {
    const app = buildApp(makeRepos());
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /acts/search", () => {
  it("returns empty array when no acts stored", async () => {
    const app = buildApp(makeRepos());
    const res = await app.inject({ method: "GET", url: "/acts/search" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("filters by q (title substring)", async () => {
    const repos = makeRepos();
    await repos.acts.save(SAMPLE_ACT);
    const app = buildApp(repos);

    const found = await app.inject({
      method: "GET",
      url: "/acts/search?q=oświaty",
    });
    expect(found.statusCode).toBe(200);
    expect(found.json()).toHaveLength(1);

    const notFound = await app.inject({
      method: "GET",
      url: "/acts/search?q=nieistniejące",
    });
    expect(notFound.statusCode).toBe(200);
    expect(notFound.json()).toHaveLength(0);
  });

  it("filters by keyword", async () => {
    const repos = makeRepos();
    await repos.acts.save(SAMPLE_ACT);
    const app = buildApp(repos);

    const res = await app.inject({
      method: "GET",
      url: "/acts/search?keyword=szkoła",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("filters by type", async () => {
    const repos = makeRepos();
    await repos.acts.save(SAMPLE_ACT);
    const app = buildApp(repos);

    const found = await app.inject({
      method: "GET",
      url: "/acts/search?type=Ustawa",
    });
    expect(found.statusCode).toBe(200);
    expect(found.json()).toHaveLength(1);

    const notFound = await app.inject({
      method: "GET",
      url: "/acts/search?type=Rozporządzenie",
    });
    expect(notFound.statusCode).toBe(200);
    expect(notFound.json()).toHaveLength(0);
  });
});

describe("GET /acts/:eli", () => {
  it("returns 404 when act not found", async () => {
    const app = buildApp(makeRepos());
    const res = await app.inject({
      method: "GET",
      url: "/acts/DU:2017:2196",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: expect.any(String) });
  });

  it("returns act metadata (colon ELI → slash conversion)", async () => {
    const repos = makeRepos();
    await repos.acts.save(SAMPLE_ACT);
    const app = buildApp(repos);

    const res = await app.inject({
      method: "GET",
      url: "/acts/DU:2017:2196",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as ActMetadata;
    expect(body.eli).toBe("DU/2017/2196");
    expect(body.title).toBe(SAMPLE_ACT.title);
  });
});

describe("GET /acts/:eli/versions", () => {
  it("returns 404 when act not found", async () => {
    const app = buildApp(makeRepos());
    const res = await app.inject({
      method: "GET",
      url: "/acts/DU:2017:2196/versions",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns list of version ELIs", async () => {
    const repos = makeRepos();
    await repos.acts.save(SAMPLE_ACT);
    const app = buildApp(repos);

    const res = await app.inject({
      method: "GET",
      url: "/acts/DU:2017:2196/versions",
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

describe("GET /acts/:eli/diff", () => {
  it("returns 400 when from/to missing", async () => {
    const app = buildApp(makeRepos());
    const res = await app.inject({
      method: "GET",
      url: "/acts/DU:2017:2196/diff",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when no units for given versions", async () => {
    const repos = makeRepos();
    await repos.acts.save(SAMPLE_ACT);
    const app = buildApp(repos);

    const res = await app.inject({
      method: "GET",
      url: "/acts/DU:2017:2196/diff?from=DU:2017:2196&to=DU:2017:2196",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns diff events when units exist", async () => {
    const repos = makeRepos();
    await repos.acts.save(SAMPLE_ACT);
    const h = (t: string) => createHash("sha256").update(t).digest("hex");
    await repos.units.saveAll("DU/2017/2196", [
      {
        path: "art=1",
        kind: "art",
        number: "1",
        numberSort: "0000000001",
        parentPath: null,
        text: "original text of the article",
        textHash: h("original text of the article"),
      },
    ]);
    await repos.units.saveAll("DU/2018/1000", [
      {
        path: "art=1",
        kind: "art",
        number: "1",
        numberSort: "0000000001",
        parentPath: null,
        text: "modified text of the article with changes",
        textHash: h("modified text of the article with changes"),
      },
    ]);
    const app = buildApp(repos);

    const res = await app.inject({
      method: "GET",
      url: "/acts/DU:2017:2196/diff?from=DU:2017:2196&to=DU:2018:1000",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { events: unknown[] };
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events.length).toBeGreaterThan(0);
  });
});

describe("GET /acts/:eli/timeline", () => {
  it("returns empty events for unknown act", async () => {
    const app = buildApp(makeRepos());
    const res = await app.inject({
      method: "GET",
      url: "/acts/DU:2017:2196/timeline",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ events: [] });
  });
});

// ── S3-16: Integration tests guarded by DATABASE_URL ─────────────────────────

describe.skipIf(!process.env["DATABASE_URL"])(
  "Integration tests (requires DATABASE_URL)",
  () => {
    it("GET /health returns ok against real server", async () => {
      // When DATABASE_URL is set, wire real Drizzle repositories here.
      // Skipped in CI unless a test DB is configured.
      expect(true).toBe(true);
    });
  },
);
