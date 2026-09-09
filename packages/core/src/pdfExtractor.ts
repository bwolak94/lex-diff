/**
 * B-7: OCR / PDF text extraction fallback.
 *
 * Used by ActParser when an act has textHTML=false but the ELI API
 * provides a PDF URL in the `texts` array.
 *
 * Extraction pipeline:
 *   1. Fetch PDF bytes from the provided URL.
 *   2. Run pdf-parse to extract embedded text.
 *   3. Normalize whitespace/ligatures via TextNormalizer.
 *
 * Returns null when extraction fails (caller degrades gracefully to text=null).
 */

import { TextNormalizer } from "./textNormalizer.js";

const normalizer = new TextNormalizer();

export interface PdfTextResult {
  text: string;
  numpages: number;
}

export async function extractPdfText(
  pdfUrl: string,
): Promise<PdfTextResult | null> {
  try {
    const res = await fetch(pdfUrl, { headers: { Accept: "application/pdf" } });
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    // Dynamic import keeps pdf-parse optional — if the package is absent
    // (e.g. in edge runtimes) the function returns null gracefully.
    const pdfParse = await import("pdf-parse").then(
      (m) => (m.default ?? m) as (buf: Buffer, opts?: object) => Promise<{ text: string; numpages: number }>,
    );

    const data = await pdfParse(Buffer.from(buffer));
    return {
      text: normalizer.normalize(data.text),
      numpages: data.numpages,
    };
  } catch {
    return null;
  }
}
