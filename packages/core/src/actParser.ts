import type { Unit, UnitKind } from "./types.js";
import type { EliClient } from "./eliClient.js";
import type { EliStructNode } from "./schemas.js";
import { TextNormalizer } from "./textNormalizer.js";

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

  async parse(eli: string, textHTML: boolean): Promise<Unit[]> {
    const struct = await this.client.getActStruct(eli);
    const units: Unit[] = [];
    this.traverse(struct.content, null, units);

    if (textHTML) {
      await this.fetchLeafTexts(eli, units);
    }

    return units;
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
