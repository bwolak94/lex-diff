/**
 * B-7: Unit tests for extractPdfText.
 *
 * pdf-parse is mocked via vi.mock so tests run without real PDF bytes.
 * fetch is stubbed to control network responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractPdfText } from "../pdfExtractor.js";

vi.mock("pdf-parse", () => ({
  default: async (_buf: Buffer) => ({
    text: "Art.  1.  Przepis  ustawy.\nArt.  2.  Kolejny  przepis.",
    numpages: 2,
  }),
}));

const PDF_URL = "https://example.com/doc.pdf";
const FAKE_BUFFER = Buffer.from("fake-pdf-bytes");

function mockFetch(ok: boolean, body?: ArrayBuffer): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValueOnce({
      ok,
      status: ok ? 200 : 404,
      arrayBuffer: async () => body ?? FAKE_BUFFER.buffer,
    } as Response),
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractPdfText", () => {
  it("returns normalized text and page count on success", async () => {
    mockFetch(true);
    const result = await extractPdfText(PDF_URL);
    expect(result).not.toBeNull();
    expect(result!.numpages).toBe(2);
    // TextNormalizer should collapse whitespace
    expect(result!.text).toMatch(/Art\.\s+1\./);
    expect(result!.text).toMatch(/Art\.\s+2\./);
  });

  it("returns null when server responds with non-ok status", async () => {
    mockFetch(false);
    const result = await extractPdfText(PDF_URL);
    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("Network error")),
    );
    const result = await extractPdfText(PDF_URL);
    expect(result).toBeNull();
  });

  it("calls fetch with the Accept: application/pdf header", async () => {
    const spy = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => FAKE_BUFFER.buffer,
    } as Response);
    vi.stubGlobal("fetch", spy);

    await extractPdfText(PDF_URL);

    expect(spy).toHaveBeenCalledWith(PDF_URL, {
      headers: { Accept: "application/pdf" },
    });
  });
});
