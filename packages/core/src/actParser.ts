import type { Unit, UnitKind } from "./types.js";
import type { EliClient } from "./eliClient.js";
import type { EliActMetadataResponse, EliStructNode } from "./schemas.js";
import { TextNormalizer } from "./textNormalizer.js";
import { extractPdfText } from "./pdfExtractor.js";
import { withSpan } from "./tracer.js";

const normalizer = new TextNormalizer();

/**
 * Parses the ELI struct response into a flat Unit[] tree and optionally
 * fetches text for each leaf unit via /text.html/{path}.
 *
 * S1-10: when textHTML=false the parser returns units with text=null
 * (metadata-only mode) without making any text HTTP requests.
 */
export class ActParser {
  constructor(private readonly client: EliClient) {}

  async parse(eli: string, textHTML: boolean): Promise<Unit[]>;
  /**
   * B-7: Overload accepting full metadata — when textHTML=false the parser
   * attempts PDF extraction using the `texts` URLs from the ELI API response.
   */
  async parse(
    eli: string,
    textHTML: boolean,
    meta?: EliActMetadataResponse,
  ): Promise<Unit[]>;
  async parse(
    eli: string,
    textHTML: boolean,
    meta?: EliActMetadataResponse,
  ): Promise<Unit[]> {
    return withSpan(
      "ActParser.parse",
      async (span) => {
        const struct = await this.client.getActStruct(eli);
        const units: Unit[] = [];
        this.traverse(struct.content, null, units);

        if (textHTML) {
          await this.fetchLeafTexts(eli, units);
        } else if (meta) {
          // B-7: Try PDF extraction as fallback
          await this.fetchLeafTextsFromPdf(meta, units);
        }

        span.setAttribute("units.count", units.length);
        span.setAttribute("textHTML", textHTML);
        return units;
      },
      { eli },
    );
  }

  /**
   * B-7: For acts without HTML text, attempt to extract text from the first
   * available PDF URL in the metadata `texts` array.
   */
  private async fetchLeafTextsFromPdf(
    meta: EliActMetadataResponse,
    units: Unit[],
  ): Promise<void> {
    const pdfUrl = meta.texts.find((t) => t.url && t.kind === "PDF")?.url;
    if (!pdfUrl) return;

    const result = await extractPdfText(pdfUrl);
    if (!result || !result.text) return;

    // Distribute the full PDF text across leaf units proportionally.
    // This is a best-effort approximation — the PDF does not have per-unit structure.
    const childPaths = new Set(
      units.map((u) => u.parentPath).filter((p): p is string => p !== null),
    );
    const leaves = units.filter((u) => !childPaths.has(u.path));
    const chunk = Math.ceil(result.text.length / Math.max(leaves.length, 1));

    leaves.forEach((unit, i) => {
      const slice = result.text.slice(i * chunk, (i + 1) * chunk).trim();
      if (slice) {
        unit.text = slice;
        unit.textHash = normalizer.hash(slice);
      }
    });
  }

  private traverse(
    nodes: EliStructNode[],
    parentPath: string | null,
    acc: Unit[],
  ): void {
    for (const node of nodes) {
      const path = parentPath
        ? `${parentPath}/${node.type}=${node.num}`
        : `${node.type}=${node.num}`;

      acc.push({
        path,
        kind: node.type as UnitKind,
        number: node.num,
        numberSort: toNumberSort(node.num),
        parentPath,
        text: null,
        textHash: null,
      });

      if (node.children.length > 0) {
        this.traverse(node.children, path, acc);
      }
    }
  }

  /**
   * Fetch text only for leaf units (those with no children).
   * Fetches are done in parallel to minimise wall-clock time.
   */
  private async fetchLeafTexts(eli: string, units: Unit[]): Promise<void> {
    const childPaths = new Set(
      units.map((u) => u.parentPath).filter((p): p is string => p !== null),
    );
    const leaves = units.filter((u) => !childPaths.has(u.path));

    await Promise.all(
      leaves.map(async (unit) => {
        const html = await this.client.getUnitText(eli, unit.path);
        if (html) {
          unit.text = normalizer.normalize(html);
          unit.textHash = normalizer.hash(html);
        }
      }),
    );
  }
}

/** Sortable string for unit numbers like "4a", "36⁴", "1" */
function toNumberSort(num: string): string {
  const match = /^(\d+)(.*)$/.exec(num);
  if (!match) return num.toLowerCase();
  return `${match[1]!.padStart(10, "0")}${match[2]!.toLowerCase()}`;
}
