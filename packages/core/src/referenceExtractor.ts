/**
 * B-2: Reference extractor — extracts cross-act references from act titles
 * and unit texts, using patterns typical in Polish legal publications.
 *
 * Publisher mapping:
 *   Dz.U. / Dz. U. → publisher "DU"
 *   M.P.  / M. P.  → publisher "MP"
 *
 * Reference patterns matched:
 *   "Dz.U. z 2017 r. poz. 2196"  → DU/2017/2196
 *   "Dz.U. 2017 poz. 2196"       → DU/2017/2196  (modern short form)
 *   "M.P. z 2020 r. poz. 100"    → MP/2020/100
 *
 * Reference type is inferred from Polish context words near each match.
 */

import type { ReferenceType } from "./types.js";

export interface ExtractedReference {
  targetEli: string;
  referenceType: ReferenceType;
}

// ── Regex patterns ────────────────────────────────────────────────────────────

// Matches "Dz.U. z 2017 r. poz. 2196" and "Dz.U. 2017 poz. 2196"
const DZ_U_RE =
  /Dz\.?\s*U\.?\s+(?:z\s+)?(\d{4})\s+(?:r\.\s+)?poz\.\s+(\d+)/gi;

// Matches "M.P. z 2020 r. poz. 100" and "M.P. 2020 poz. 100"
const MP_RE =
  /M\.?\s*P\.?\s+(?:z\s+)?(\d{4})\s+(?:r\.\s+)?poz\.\s+(\d+)/gi;

// Context patterns for reference type classification
const AMENDS_RE =
  /zmieni(?:a|aj[aą]c[aą]?|ono)|o\s+zmianie|nowelizuj/i;
const REPEALS_RE =
  /uchyl(?:a|aj[aą]c[aą]?|ono|ono)|o\s+uchyleniu/i;
const IMPLEMENTS_RE =
  /na\s+podstawie\s+art|rozporządzenie\s+wykonawcze|wydane\s+na\s+podstawie/i;
const EXTENDS_RE =
  /przedłuż(?:a|ono|aj)/i;

function classifyContext(text: string): ReferenceType {
  if (REPEALS_RE.test(text)) return "repeals";
  if (AMENDS_RE.test(text)) return "amends";
  if (IMPLEMENTS_RE.test(text)) return "implements";
  if (EXTENDS_RE.test(text)) return "extends";
  return "amends";
}

function extractFromText(
  text: string,
  fallbackType: ReferenceType,
  sourceEli: string,
  seen: Set<string>,
  out: ExtractedReference[],
): void {
  const localType = classifyContext(text) ?? fallbackType;

  for (const m of text.matchAll(DZ_U_RE)) {
    const eli = `DU/${m[1]}/${m[2]}`;
    if (eli !== sourceEli && !seen.has(eli)) {
      seen.add(eli);
      out.push({ targetEli: eli, referenceType: localType });
    }
  }

  for (const m of text.matchAll(MP_RE)) {
    const eli = `MP/${m[1]}/${m[2]}`;
    if (eli !== sourceEli && !seen.has(eli)) {
      seen.add(eli);
      out.push({ targetEli: eli, referenceType: localType });
    }
  }
}

/**
 * Extract all outgoing references from an act's title and unit texts.
 *
 * @param sourceEli   The ELI of the act being analyzed (excluded from results).
 * @param title       The full act title (primary source for type classification).
 * @param unitTexts   Normalized text of all leaf units.
 */
export function extractReferences(
  sourceEli: string,
  title: string,
  unitTexts: string[],
): ExtractedReference[] {
  const seen = new Set<string>();
  const results: ExtractedReference[] = [];

  const titleType = classifyContext(title);
  extractFromText(title, titleType, sourceEli, seen, results);

  for (const text of unitTexts) {
    extractFromText(text, "amends", sourceEli, seen, results);
  }

  return results;
}
