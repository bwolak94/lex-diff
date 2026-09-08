import { createHash } from "node:crypto";

/**
 * Normalizes legal text before hashing and comparison.
 * This is the single place where normalization happens — callers must not
 * normalize ad-hoc. The hash is always computed on normalized text.
 */
export class TextNormalizer {
  normalize(raw: string): string {
    return (
      raw
        // Strip HTML tags
        .replace(/<[^>]+>/g, " ")
        // Decode HTML entities before further processing
        .replace(/&#(\d+);/g, (_, n: string) =>
          String.fromCharCode(parseInt(n, 10)),
        )
        .replace(/&#x([0-9a-fA-F]+);/gi, (_, h: string) =>
          String.fromCharCode(parseInt(h, 16)),
        )
        .replace(/&nbsp;/g, "\u00A0")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        // Collapse all whitespace (including NBSP \u00A0)
        .replace(/[\s\u00A0]+/g, " ")
        .trim()
        // Normalize dashes: em dash (—) and en dash (–) → hyphen-minus
        .replace(/[\u2013\u2014]/g, "-")
        // Normalize quotation marks to ASCII equivalents
        .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
        // Canonicalize legal journal refs: "Dz. U. z 2024 r. poz. 1401" → "DzU/2024/1401"
        .replace(
          /Dz\.\s*U\.\s*z\s+(\d{4})\s+r\.\s+poz\.\s+(\d+)/g,
          "DzU/$1/$2",
        )
        // Strip superscript footnote markers (Unicode superscripts + ^ notation)
        .replace(/[\u00B9\u00B2\u00B3\u2070-\u2079]+/g, "")
        .replace(/\s*\^\d+/g, "")
        // Final whitespace collapse after all substitutions
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  /** SHA-256 hex digest of the normalized text */
  hash(raw: string): string {
    return createHash("sha256").update(this.normalize(raw)).digest("hex");
  }
}
