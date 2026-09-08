import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { DiffEngine, SIMILARITY_THRESHOLD } from "../diffEngine.js";
import { apply } from "../apply.js";
import type { Unit, UnitKind, ChangeEvent } from "../types.js";
import { UNIT_KINDS } from "../schemas.js";
import { ALL_SCENARIOS } from "./fixtures/diff-scenarios.js";
import { createHash } from "node:crypto";

const engine = new DiffEngine();

const BASE_OPTIONS = {
  actEli: "DU/2017/2196",
  effectiveDate: null,
  isConsolidated: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const h = (t: string) => createHash("sha256").update(t).digest("hex");

function u(path: string, text: string | null = null): Unit {
  const last = path.split("/").at(-1)!;
  const eq = last.indexOf("=");
  return {
    path,
    kind: last.slice(0, eq) as UnitKind,
    number: last.slice(eq + 1),
    numberSort: last.slice(eq + 1).padStart(10, "0"),
    parentPath: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : null,
    text,
    textHash: text !== null ? h(text) : null,
  };
}

// fast-check arbitrary for a Unit with a simple path and optional text
const kindArb = fc.constantFrom(...(UNIT_KINDS as readonly string[]));
const numArb = fc.integer({ min: 1, max: 20 }).map(String);
const textArb = fc.option(
  fc.string({ minLength: 5, maxLength: 100 }),
  { nil: null, freq: 3 },
);
const pathArb = fc
  .array(fc.record({ kind: kindArb, num: numArb }), {
    minLength: 1,
    maxLength: 3,
  })
  .map((segs) => segs.map((s) => `${s.kind}=${s.num}`).join("/"));

const unitArb = fc
  .record({ path: pathArb, text: textArb })
  .map(({ path, text }) => u(path, text));

/** Deduplicate by path (keep first occurrence) */
function dedupeByPath(units: Unit[]): Unit[] {
  const seen = new Set<string>();
  return units.filter((u) => {
    if (seen.has(u.path)) return false;
    seen.add(u.path);
    return true;
  });
}

// ── S2-7: Property tests ──────────────────────────────────────────────────────

describe("Property: diff(a, a) === []", () => {
  it("diffing any act against itself produces no events", () => {
    fc.assert(
      fc.property(
        fc.array(unitArb, { minLength: 0, maxLength: 20 }).map(dedupeByPath),
        (units) => {
          const events = engine.diff(units, units, BASE_OPTIONS);
          return events.length === 0;
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("Property: apply(a, diff(a, b)) ≈ b", () => {
  it("applying diff events transforms a to a state equivalent to b (path-only amendments)", () => {
    // Generate pairs where b is derived from a by text-only changes (paths unchanged)
    // This is the cleanest invariant to verify: no renames or structural changes.
    fc.assert(
      fc.property(
        fc
          .array(
            fc.record({ path: pathArb, oldText: textArb, newText: textArb }),
            { minLength: 1, maxLength: 10 },
          )
          .map((rows) => {
            const seen = new Set<string>();
            return rows.filter((r) => {
              if (seen.has(r.path)) return false;
              seen.add(r.path);
              return true;
            });
          }),
        (rows) => {
          const oldUnits = rows.map((r) => u(r.path, r.oldText));
          const newUnits = rows.map((r) => u(r.path, r.newText));

          const events = engine.diff(oldUnits, newUnits, BASE_OPTIONS);
          const result = apply(oldUnits, events);

          // After apply, every path in newUnits must exist in result
          const resultByPath = new Map(result.map((x) => [x.path, x]));
          return newUnits.every((n) => {
            const r = resultByPath.get(n.path);
            if (!r) return false;
            // Text should match (both null → ok, both non-null → compare)
            if (n.text === null) return true; // no text constraint
            return r.text === n.text || n.textHash === (r.textHash ?? null);
          });
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ── Unit tests for specific scenarios ────────────────────────────────────────

describe("DiffEngine — specific scenarios", () => {
  it("no events when units are identical", () => {
    const units = [u("art=1", "text"), u("art=2", "other text")];
    expect(engine.diff(units, units, BASE_OPTIONS)).toEqual([]);
  });

  it("emits UnitAdded for new paths", () => {
    const old = [u("art=1", "existing text")];
    const next = [u("art=1", "existing text"), u("art=2", "new article text")];
    const events = engine.diff(old, next, BASE_OPTIONS);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("UnitAdded");
    expect((events[0] as { path: string }).path).toBe("art=2");
  });

  it("emits UnitRepealed for removed paths", () => {
    const old = [u("art=1", "text"), u("art=2", "to be removed")];
    const next = [u("art=1", "text")];
    const events = engine.diff(old, next, BASE_OPTIONS);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("UnitRepealed");
    expect((events[0] as { path: string }).path).toBe("art=2");
  });

  it("emits UnitAmended when text changes", () => {
    const old = [u("art=1", "original text of the article")];
    const next = [u("art=1", "modified text of the article with changes")];
    const events = engine.diff(old, next, BASE_OPTIONS);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("UnitAmended");
  });

  it("UnitAmended contains before, after, and wordDiff", () => {
    const old = [u("art=1", "The minister issues regulations.")];
    const next = [u("art=1", "The minister issues detailed regulations.")];
    const events = engine.diff(old, next, BASE_OPTIONS);
    const ev = events[0] as {
      type: string;
      before: string;
      after: string;
      wordDiff: Array<{ type: string; text: string }>;
    };
    expect(ev.type).toBe("UnitAmended");
    expect(ev.before).toBe("The minister issues regulations.");
    expect(ev.after).toBe("The minister issues detailed regulations.");
    expect(ev.wordDiff).toBeDefined();
    // wordDiff should contain the inserted word "detailed "
    const inserted = ev.wordDiff.filter((op) => op.type === "insert");
    expect(inserted.some((op) => op.text.includes("detailed"))).toBe(true);
  });

  it("no event when both units have null text", () => {
    const old = [u("art=1", null)];
    const next = [u("art=1", null)];
    expect(engine.diff(old, next, BASE_OPTIONS)).toHaveLength(0);
  });

  it("emits UnitRenumbered when similar text appears at different path", () => {
    const text = "The act regulates software testing procedures in great detail.";
    const old = [u("art=2", text)];
    const next = [u("art=2a", text)]; // same text, different path
    const events = engine.diff(old, next, BASE_OPTIONS);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("UnitRenumbered");
    expect((events[0] as { fromPath: string; toPath: string }).fromPath).toBe("art=2");
    expect((events[0] as { fromPath: string; toPath: string }).toPath).toBe("art=2a");
  });

  it("emits separate UnitAdded + UnitRepealed when texts are too dissimilar", () => {
    const old = [u("art=1", "taxation of motor vehicles road transport fees penalties")];
    const next = [u("art=2", "environmental water protection ecology management")];
    // Scores < SIMILARITY_THRESHOLD → no renumber
    const events = engine.diff(old, next, BASE_OPTIONS);
    const types = events.map((e) => e.type);
    expect(types).toContain("UnitRepealed");
    expect(types).toContain("UnitAdded");
  });

  it("S2-5: emits single ActConsolidated when isConsolidated=true", () => {
    const old = [u("art=1", "text"), u("art=2", "text"), u("art=3", "text")];
    const next = [u("art=1", "new text"), u("art=2", "new text"), u("art=3", "new text")];
    const events = engine.diff(old, next, {
      actEli: "DU/2024/100",
      effectiveDate: null,
      isConsolidated: true,
      consolidatedEli: "DU/2024/100",
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("ActConsolidated");
    expect((events[0] as { tjEli: string }).tjEli).toBe("DU/2024/100");
  });

  it("each event carries a non-empty eventHash", () => {
    const old = [u("art=1", "original text here")];
    const next = [u("art=1", "modified text here"), u("art=2", "added text")];
    const events = engine.diff(old, next, BASE_OPTIONS);
    for (const ev of events) {
      expect(ev.eventHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("same event always produces the same eventHash (idempotent)", () => {
    const old = [u("art=1", "original text content for hashing test")];
    const next = [u("art=1", "modified text content for hashing test")];
    const events1 = engine.diff(old, next, BASE_OPTIONS);
    const events2 = engine.diff(old, next, BASE_OPTIONS);
    expect(events1[0]!.eventHash).toBe(events2[0]!.eventHash);
  });
});

// ── S2-8: Golden snapshot tests — 10 amendment scenarios ─────────────────────

describe("Golden snapshots — 10 amendment scenarios", () => {
  for (const scenario of ALL_SCENARIOS) {
    it(`snapshot: ${scenario.name}`, () => {
      const events = engine.diff(scenario.old, scenario.new, scenario.options);
      // Snapshot event types and paths (not hashes which are deterministic but verbose)
      const summary = events.map((ev) => {
        const base = { type: ev.type, severity: ev.severity };
        switch (ev.type) {
          case "UnitAdded":     return { ...base, path: ev.path };
          case "UnitRepealed":  return { ...base, path: ev.path };
          case "UnitAmended":   return { ...base, path: ev.path, hasWordDiff: ev.wordDiff.length > 0 };
          case "UnitRenumbered":return { ...base, fromPath: ev.fromPath, toPath: ev.toPath };
          case "ActConsolidated": return { ...base, tjEli: ev.tjEli };
          case "ActRepealed":   return { ...base, by: ev.by };
          case "EntryIntoForceSet": return { ...base, unitPath: ev.unitPath };
        }
      });
      expect(summary).toMatchSnapshot();
    });
  }
});

// ── S2-9: Metric — unmatchedRatio < 0.05 on known corpus ─────────────────────

describe("Metric: unmatchedRatio < 0.05 on known corpus", () => {
  it("proportion of truly unmatched old units across all scenarios is below 5 %", () => {
    // Exclude scenario08 (ActConsolidated guard bypasses unit matching entirely)
    const matchingScenarios = ALL_SCENARIOS.filter(
      (s) => !s.options.isConsolidated,
    );

    let totalOldUnits = 0;
    let totalRepealed = 0;

    for (const scenario of matchingScenarios) {
      const events = engine.diff(scenario.old, scenario.new, scenario.options);
      totalOldUnits += scenario.old.length;
      totalRepealed += events.filter((e): e is ChangeEvent & { type: "UnitRepealed" } =>
        e.type === "UnitRepealed",
      ).length;
    }

    const unmatchedRatio = totalOldUnits === 0 ? 0 : totalRepealed / totalOldUnits;
    expect(unmatchedRatio).toBeLessThan(0.05);
  });
});
