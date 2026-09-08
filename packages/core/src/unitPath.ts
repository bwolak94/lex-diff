type Segment = { kind: string; number: string };

/**
 * Immutable value object wrapping a unit path like "art=4/ustep=3/punkt=2".
 * The path is both the natural key for a unit and its ELI API address.
 */
export class UnitPath {
  private readonly segments: ReadonlyArray<Segment>;

  private constructor(segments: ReadonlyArray<Segment>) {
    this.segments = segments;
  }

  static parse(raw: string): UnitPath {
    if (!raw.trim()) throw new Error("UnitPath cannot be empty");

    const segments = raw.split("/").map((seg, i) => {
      const eq = seg.indexOf("=");
      if (eq < 1) {
        throw new Error(
          `Invalid path segment at index ${i}: "${seg}". Expected kind=number`,
        );
      }
      return { kind: seg.slice(0, eq), number: seg.slice(eq + 1) };
    });

    return new UnitPath(segments);
  }

  toString(): string {
    return this.segments.map((s) => `${s.kind}=${s.number}`).join("/");
  }

  get depth(): number {
    return this.segments.length;
  }

  get leafKind(): string {
    const last = this.segments.at(-1);
    if (!last) throw new Error("Empty UnitPath");
    return last.kind;
  }

  parent(): UnitPath | null {
    if (this.segments.length <= 1) return null;
    return new UnitPath(this.segments.slice(0, -1));
  }

  /** All ancestor paths from root to immediate parent, in order */
  ancestors(): UnitPath[] {
    const result: UnitPath[] = [];
    let current: UnitPath = this;
    for (;;) {
      const p = current.parent();
      if (!p) break;
      result.unshift(p);
      current = p;
    }
    return result;
  }

  isAncestorOf(other: UnitPath): boolean {
    return other.toString().startsWith(this.toString() + "/");
  }

  equals(other: UnitPath): boolean {
    return this.toString() === other.toString();
  }
}
