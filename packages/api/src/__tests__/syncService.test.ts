/**
 * Unit tests for ActSyncService — B-2 reference extraction integration.
 *
 * @lexdiff/db is mocked to stub the direct `db.insert(schema.actVersions)` call
 * so tests run without a real database.
 * EliClient and ActParser are replaced with vi.fn() stubs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  InMemoryActRepository,
  InMemoryUnitRepository,
  InMemoryChangeEventRepository,
  InMemoryActReferenceRepository,
} from "@lexdiff/db";
import type { EliClient, ActParser } from "@lexdiff/core";
import type { ActMetadata, Unit } from "@lexdiff/core";
import { ActSyncService } from "../syncService.js";

// ── Mock db.insert (used for actVersions table) ───────────────────────────────

vi.mock("@lexdiff/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lexdiff/db")>();
  return {
    ...actual,
    db: {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    },
  };
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ELI = "DU/2024/500";

/** Act whose title references DU/2017/2196 via "Dz.U. z 2017 r. poz. 2196" */
const META_WITH_REF: ActMetadata = {
  eli: ELI,
  publisher: "DU",
  year: 2024,
  position: 500,
  title: "Ustawa zmieniająca ustawę (Dz.U. z 2017 r. poz. 2196)",
  type: "Ustawa",
  status: "obowiązujący",
  inForce: true,
  announcementDate: "2024-03-01",
  entryIntoForce: "2024-04-01",
  repealDate: null,
  changeDate: "2024-03-01",
  textHTML: false,
  keywords: [],
};

/** Act whose title has no journal-of-laws references */
const META_NO_REF: ActMetadata = {
  ...META_WITH_REF,
  title: "Ustawa z dnia 1 stycznia 2024 r. o informatyzacji",
};

/** Minimal unit without text */
const UNIT_NO_TEXT: Unit = {
  path: "art=1",
  kind: "art",
  number: "1",
  numberSort: "0000000001",
  parentPath: null,
  text: null,
  textHash: null,
};

/** Unit with text that references DU/2020/999 */
const UNIT_WITH_REF: Unit = {
  path: "art=2",
  kind: "art",
  number: "2",
  numberSort: "0000000002",
  parentPath: null,
  text: "Na podstawie art. 3 ustawy (Dz.U. z 2020 r. poz. 999) wydaje się przepis.",
  textHash: "hash-2",
};

// ── Stub factory helpers ──────────────────────────────────────────────────────

function makeStubClient(meta: ActMetadata): EliClient {
  return {
    getAct: vi.fn().mockResolvedValue(meta),
  } as unknown as EliClient;
}

function makeStubParser(units: Unit[]): ActParser {
  return {
    parse: vi.fn().mockResolvedValue(units),
  } as unknown as ActParser;
}

function makeRepos() {
  return {
    acts: new InMemoryActRepository(),
    units: new InMemoryUnitRepository(),
    changeEvents: new InMemoryChangeEventRepository(),
    references: new InMemoryActReferenceRepository(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ActSyncService — reference extraction (B-2)", () => {
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
  });

  it("saves references extracted from title on first sync", async () => {
    const svc = new ActSyncService(
      makeStubClient(META_WITH_REF),
      makeStubParser([UNIT_NO_TEXT]),
      repos.acts,
      repos.units,
      repos.changeEvents,
      repos.references,
    );

    await svc.syncAct(ELI);

    const saved = await repos.references.findBySourceEli(ELI);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.targetEli).toBe("DU/2017/2196");
    expect(saved[0]!.referenceType).toBe("amends");
  });

  it("saves references extracted from unit text on first sync", async () => {
    const svc = new ActSyncService(
      makeStubClient(META_NO_REF),
      makeStubParser([UNIT_WITH_REF]),
      repos.acts,
      repos.units,
      repos.changeEvents,
      repos.references,
    );

    await svc.syncAct(ELI);

    const saved = await repos.references.findBySourceEli(ELI);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.targetEli).toBe("DU/2020/999");
  });

  it("combines references from title and unit texts, deduplicating", async () => {
    // Title and unit both reference DU/2017/2196 — should produce 1 entry
    const meta: ActMetadata = {
      ...META_WITH_REF,
      title: "Ustawa zmieniająca (Dz.U. z 2017 r. poz. 2196) oraz (Dz.U. z 2019 r. poz. 100)",
    };
    const unit: Unit = {
      ...UNIT_NO_TEXT,
      text: "Zmiana ustawy (Dz.U. z 2017 r. poz. 2196) polega na...",
      textHash: "h",
    };

    const svc = new ActSyncService(
      makeStubClient(meta),
      makeStubParser([unit]),
      repos.acts,
      repos.units,
      repos.changeEvents,
      repos.references,
    );

    await svc.syncAct(ELI);

    const saved = await repos.references.findBySourceEli(ELI);
    const elis = saved.map((r) => r.targetEli);
    expect(elis).toContain("DU/2017/2196");
    expect(elis).toContain("DU/2019/100");
    expect(elis.filter((e) => e === "DU/2017/2196")).toHaveLength(1);
  });

  it("does NOT save references when title and units have none", async () => {
    const svc = new ActSyncService(
      makeStubClient(META_NO_REF),
      makeStubParser([UNIT_NO_TEXT]),
      repos.acts,
      repos.units,
      repos.changeEvents,
      repos.references,
    );

    await svc.syncAct(ELI);

    const saved = await repos.references.findBySourceEli(ELI);
    expect(saved).toHaveLength(0);
  });

  it("does NOT save references on subsequent (non-first) syncs", async () => {
    // Pre-populate so versionElis.length > 0 → isFirstSync = false
    await repos.acts.save(META_WITH_REF);
    await repos.units.saveAll(ELI, [UNIT_NO_TEXT]);

    const updatedMeta: ActMetadata = {
      ...META_WITH_REF,
      changeDate: "2024-06-01",
    };

    const svc = new ActSyncService(
      makeStubClient(updatedMeta),
      makeStubParser([UNIT_NO_TEXT]),
      repos.acts,
      repos.units,
      repos.changeEvents,
      repos.references,
    );

    await svc.syncAct(ELI);

    const saved = await repos.references.findBySourceEli(ELI);
    expect(saved).toHaveLength(0);
  });

  it("skips sync entirely when changeDate is unchanged", async () => {
    await repos.acts.save(META_WITH_REF);
    await repos.units.saveAll(ELI, [UNIT_NO_TEXT]);

    const parseSpy = vi.fn().mockResolvedValue([UNIT_NO_TEXT]);
    const svc = new ActSyncService(
      makeStubClient(META_WITH_REF), // same changeDate
      { parse: parseSpy } as unknown as ActParser,
      repos.acts,
      repos.units,
      repos.changeEvents,
      repos.references,
    );

    const result = await svc.syncAct(ELI);

    expect(result.newEvents).toBe(0);
    expect(parseSpy).not.toHaveBeenCalled();
    const saved = await repos.references.findBySourceEli(ELI);
    expect(saved).toHaveLength(0);
  });

  it("does not throw when referenceRepo is omitted", async () => {
    const svc = new ActSyncService(
      makeStubClient(META_WITH_REF),
      makeStubParser([UNIT_NO_TEXT]),
      repos.acts,
      repos.units,
      repos.changeEvents,
      // no referenceRepo
    );

    await expect(svc.syncAct(ELI)).resolves.not.toThrow();
  });
});
