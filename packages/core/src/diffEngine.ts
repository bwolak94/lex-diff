import { diff_match_patch } from "diff-match-patch";
import type { Unit, ChangeEvent, WordDiffOp } from "./types.js";
import { SimilarityScorer } from "./similarityScorer.js";
import { EventHasher } from "./eventHasher.js";

// S2-4 — threshold from PRD: ≥ 0.7 → UnitRenumbered, < 0.7 → separate events
export const SIMILARITY_THRESHOLD = 0.7;

export interface DiffOptions {
  /** ELI of the act being diffed (used in eventHash) */
  actEli: string;
  /** Entry-into-force date, forwarded to all events */
  effectiveDate: string | null;
  /**
   * S2-5 — ActConsolidated guard.
   * When true the engine emits a single ActConsolidated event and skips
   * all unit-level matching. Set this if the new act's title/type indicates
   * a "jednolity tekst" (consolidated text obwieszczenie).
   */
  isConsolidated: boolean;
  /** ELI of the consolidated text (required when isConsolidated = true) */
  consolidatedEli?: string;
}

interface PathMatchResult {
  matched: Array<{ old: Unit; new: Unit }>;
  unmatchedOld: Unit[];
  unmatchedNew: Unit[];
}

interface SimilarityMatchResult {
  renumbered: Array<{ old: Unit; new: Unit }>;
  finalUnmatchedOld: Unit[];
  finalUnmatchedNew: Unit[];
}

/**
 * S2-2 / S2-3 / S2-4 / S2-5 — DiffEngine
 *
 * Pipeline:
 *   1. ActConsolidated guard (S2-5): if isConsolidated, return early.
 *   2. matchByPath (S2-2): O(n) exact path matching.
 *   3. matchBySimilarity (S2-3): greedy similarity matching for remaining units.
 *   4. Emit events: UnitAmended (with word diff), UnitRenumbered,
 *      UnitRepealed, UnitAdded.
 */
export class DiffEngine {
  private readonly scorer = new SimilarityScorer();
  private readonly hasher = new EventHasher();

  diff(oldUnits: Unit[], newUnits: Unit[], options: DiffOptions): ChangeEvent[] {
    // ── S2-5: ActConsolidated guard ──────────────────────────────────────────
    if (options.isConsolidated) {
      const tjEli = options.consolidatedEli ?? options.actEli;
      return [
        {
          type: "ActConsolidated",
          tjEli,
          eventHash: this.hasher.hash(options.actEli, "ActConsolidated", { tjEli }),
          severity: "high",
          effectiveDate: options.effectiveDate,
        },
      ];
    }

    // ── S2-2: matchByPath ────────────────────────────────────────────────────
    const pathMatch = this.matchByPath(oldUnits, newUnits);

    // ── S2-3: matchBySimilarity ──────────────────────────────────────────────
    const simMatch = this.matchBySimilarity(
      pathMatch.unmatchedOld,
      pathMatch.unmatchedNew,
    );

    const events: ChangeEvent[] = [];

    // Path-matched pairs: emit UnitAmended when text changed
    for (const { old: o, new: n } of pathMatch.matched) {
      if (o.textHash !== n.textHash && (o.text !== null || n.text !== null)) {
        const before = o.text ?? "";
        const after = n.text ?? "";
        events.push({
          type: "UnitAmended",
          path: o.path,
          before,
          after,
          // S2-4: word-level diff via diff-match-patch
          wordDiff: computeWordDiff(before, after),
          eventHash: this.hasher.hash(options.actEli, "UnitAmended", {
            path: o.path,
            beforeHash: o.textHash ?? "",
            afterHash: n.textHash ?? "",
          }),
          severity: "medium",
          effectiveDate: options.effectiveDate,
        });
      }
    }

    // Similarity-matched pairs: emit UnitRenumbered
    for (const { old: o, new: n } of simMatch.renumbered) {
      events.push({
        type: "UnitRenumbered",
        fromPath: o.path,
        toPath: n.path,
        eventHash: this.hasher.hash(options.actEli, "UnitRenumbered", {
          fromPath: o.path,
          toPath: n.path,
        }),
        severity: "low",
        effectiveDate: options.effectiveDate,
      });
    }

    // Truly unmatched old units → UnitRepealed
    for (const u of simMatch.finalUnmatchedOld) {
      events.push({
        type: "UnitRepealed",
        path: u.path,
        eventHash: this.hasher.hash(options.actEli, "UnitRepealed", {
          path: u.path,
        }),
        severity: "high",
        effectiveDate: options.effectiveDate,
      });
    }

    // Truly unmatched new units → UnitAdded
    for (const u of simMatch.finalUnmatchedNew) {
      events.push({
        type: "UnitAdded",
        path: u.path,
        text: u.text ?? "",
        eventHash: this.hasher.hash(options.actEli, "UnitAdded", {
          path: u.path,
        }),
        severity: "medium",
        effectiveDate: options.effectiveDate,
      });
    }

    return events;
  }

  // ── S2-2: O(n) exact path matching ────────────────────────────────────────

  private matchByPath(oldUnits: Unit[], newUnits: Unit[]): PathMatchResult {
    const newByPath = new Map(newUnits.map((u) => [u.path, u]));
    const matched: Array<{ old: Unit; new: Unit }> = [];
    const unmatchedOld: Unit[] = [];
    const matchedNewPaths = new Set<string>();

    for (const oldUnit of oldUnits) {
      const newUnit = newByPath.get(oldUnit.path);
      if (newUnit) {
        matched.push({ old: oldUnit, new: newUnit });
        matchedNewPaths.add(oldUnit.path);
      } else {
        unmatchedOld.push(oldUnit);
      }
    }

    return {
      matched,
      unmatchedOld,
      unmatchedNew: newUnits.filter((u) => !matchedNewPaths.has(u.path)),
    };
  }

  // ── S2-3: Greedy similarity matching for unmatched units ──────────────────

  private matchBySimilarity(
    unmatchedOld: Unit[],
    unmatchedNew: Unit[],
  ): SimilarityMatchResult {
    if (!unmatchedOld.length || !unmatchedNew.length) {
      return {
        renumbered: [],
        finalUnmatchedOld: unmatchedOld,
        finalUnmatchedNew: unmatchedNew,
      };
    }

    type Scored = { score: number; old: Unit; new: Unit };
    const scored: Scored[] = [];

    for (const o of unmatchedOld) {
      for (const n of unmatchedNew) {
        // Use normalized text for similarity; fall back to path if text absent
        const textA = o.text ?? o.path;
        const textB = n.text ?? n.path;
        scored.push({ score: this.scorer.score(textA, textB), old: o, new: n });
      }
    }

    // Greedy: highest-score pairs first
    scored.sort((a, b) => b.score - a.score);

    const usedOld = new Set<string>();
    const usedNew = new Set<string>();
    const renumbered: Array<{ old: Unit; new: Unit }> = [];

    for (const { score, old: o, new: n } of scored) {
      if (score < SIMILARITY_THRESHOLD) break;
      if (!usedOld.has(o.path) && !usedNew.has(n.path)) {
        renumbered.push({ old: o, new: n });
        usedOld.add(o.path);
        usedNew.add(n.path);
      }
    }

    return {
      renumbered,
      finalUnmatchedOld: unmatchedOld.filter((u) => !usedOld.has(u.path)),
      finalUnmatchedNew: unmatchedNew.filter((u) => !usedNew.has(u.path)),
    };
  }
}

// ── S2-4: Word-level diff via diff-match-patch ────────────────────────────

const OP_MAP: Record<number, WordDiffOp["type"]> = {
  [-1]: "delete",
  [0]: "equal",
  [1]: "insert",
};

function computeWordDiff(before: string, after: string): WordDiffOp[] {
  const dmp = new diff_match_patch();

  // Tokenize: split on whitespace boundaries, keep tokens including whitespace
  const tokens: string[] = [];
  const tokenMap = new Map<string, string>();

  const encode = (text: string): string => {
    // U+E000 = private use area start — safe from actual text content
    const BASE = 0xe000;
    return text
      .split(/(\s+)/)
      .filter((t) => t.length > 0)
      .map((token) => {
        let ch = tokenMap.get(token);
        if (!ch) {
          ch = String.fromCodePoint(BASE + tokens.length);
          tokens.push(token);
          tokenMap.set(token, ch);
        }
        return ch;
      })
      .join("");
  };

  const encoded1 = encode(before);
  const encoded2 = encode(after);

  const diffs = dmp.diff_main(encoded1, encoded2, false);
  dmp.diff_cleanupSemantic(diffs);

  return diffs.map(([op, chars]) => ({
    type: OP_MAP[op] ?? "equal",
    text: [...chars]
      .map((c) => tokens[c.codePointAt(0)! - 0xe000] ?? "")
      .join(""),
  }));
}
