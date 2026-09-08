/**
 * S2-1 — SimilarityScorer
 * Combines character-trigram (Jaccard) and normalized Levenshtein distance
 * to score how similar two texts are (0.0 = completely different, 1.0 = identical).
 *
 * Used by DiffEngine.matchBySimilarity to pair unmatched units.
 * Threshold ≥ 0.7 → UnitRenumbered; < 0.7 → separate UnitAdded + UnitRepealed.
 */

/** Weight given to trigram similarity vs. Levenshtein similarity */
const TRIGRAM_WEIGHT = 0.7;
const LEVENSHTEIN_WEIGHT = 0.3;

/** Maximum characters considered to keep scoring O(n) not O(n²) for huge texts */
const MAX_CHARS = 500;

function trigramSet(s: string): Set<string> {
  const clipped = s.slice(0, MAX_CHARS);
  // Pad with spaces for boundary trigrams
  const padded = `  ${clipped}  `;
  const result = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i++) {
    result.add(padded.slice(i, i + 3));
  }
  return result;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/** Levenshtein edit distance (clipped to MAX_CHARS each) */
function levenshtein(a: string, b: string): number {
  const s1 = a.slice(0, MAX_CHARS);
  const s2 = b.slice(0, MAX_CHARS);
  const m = s1.length;
  const n = s2.length;
  // Use two-row rolling array to save memory
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] =
        s1[i - 1] === s2[j - 1]
          ? prev[j - 1]!
          : 1 + Math.min(prev[j]!, curr[j - 1]!, prev[j - 1]!);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

export class SimilarityScorer {
  /**
   * Returns a score in [0, 1]:
   *   1.0 = identical
   *   0.0 = completely different
   *   ≥ 0.7 → treat as same unit with changed path (UnitRenumbered)
   *   < 0.7 → treat as independent add + remove
   */
  score(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 && b.length === 0) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const trigramScore = jaccardSimilarity(trigramSet(a), trigramSet(b));
    const maxLen = Math.max(
      Math.min(a.length, MAX_CHARS),
      Math.min(b.length, MAX_CHARS),
    );
    const levDistance = levenshtein(a, b);
    const levScore = maxLen === 0 ? 1 : 1 - levDistance / maxLen;

    return TRIGRAM_WEIGHT * trigramScore + LEVENSHTEIN_WEIGHT * levScore;
  }
}
