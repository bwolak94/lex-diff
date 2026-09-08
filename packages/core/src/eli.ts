/**
 * Immutable value object wrapping an ELI identifier like "DU/2017/2196".
 * Validates format on construction; provides typed accessors.
 */
export class Eli {
  private constructor(
    readonly publisher: string,
    readonly year: number,
    readonly position: number,
  ) {}

  static parse(raw: string): Eli {
    const trimmed = raw.trim();
    const match = /^([A-Z]+)\/(\d{4})\/(\d+)$/.exec(trimmed);
    if (!match) {
      throw new Error(
        `Invalid ELI: "${raw}". Expected PUBLISHER/YEAR/POSITION (e.g. DU/2017/2196)`,
      );
    }
    return new Eli(
      match[1]!,
      parseInt(match[2]!, 10),
      parseInt(match[3]!, 10),
    );
  }

  toString(): string {
    return `${this.publisher}/${this.year}/${this.position}`;
  }

  /** Path fragment for ELI API URLs: "acts/DU/2017/2196" */
  toApiPath(): string {
    return `acts/${this.publisher}/${this.year}/${this.position}`;
  }

  equals(other: Eli): boolean {
    return (
      this.publisher === other.publisher &&
      this.year === other.year &&
      this.position === other.position
    );
  }
}
