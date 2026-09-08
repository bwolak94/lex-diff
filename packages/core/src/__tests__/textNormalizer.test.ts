import { describe, it, expect } from "vitest";
import { TextNormalizer } from "../textNormalizer.js";

const normalizer = new TextNormalizer();

describe("TextNormalizer.normalize", () => {
  it("collapses multiple spaces and trims", () => {
    expect(normalizer.normalize("  foo   bar  ")).toBe("foo bar");
  });

  it("collapses newlines and tabs into a single space", () => {
    expect(normalizer.normalize("foo\n  \tbar")).toBe("foo bar");
  });

  it("replaces non-breaking spaces", () => {
    expect(normalizer.normalize("foo\u00A0bar")).toBe("foo bar");
  });

  it("normalizes em dash and en dash to hyphen-minus", () => {
    expect(normalizer.normalize("a\u2013b")).toBe("a-b");
    expect(normalizer.normalize("a\u2014b")).toBe("a-b");
  });

  it("normalizes typographic quotation marks to ASCII", () => {
    expect(normalizer.normalize("\u201Cfoo\u201D")).toBe('"foo"');
    expect(normalizer.normalize("\u2018foo\u2019")).toBe("'foo'");
  });

  it("canonicalizes legal journal references", () => {
    expect(
      normalizer.normalize("Dz. U. z 2024 r. poz. 1401"),
    ).toBe("DzU/2024/1401");
  });

  it("canonicalizes refs with irregular spacing", () => {
    expect(
      normalizer.normalize("Dz.U. z 2022 r. poz. 500"),
    ).toBe("DzU/2022/500");
  });

  it("strips HTML tags", () => {
    expect(normalizer.normalize("<p>Artykuł <strong>1</strong>.</p>")).toBe(
      "Artykuł 1 .",
    );
  });

  it("strips Unicode superscript footnote markers", () => {
    expect(normalizer.normalize("art. 36\u00B9")).toBe("art. 36");
    expect(normalizer.normalize("art. 36\u00B2")).toBe("art. 36");
  });

  it("strips caret-style footnote markers", () => {
    expect(normalizer.normalize("text^1 more")).toBe("text more");
  });

  it("returns empty string for empty input", () => {
    expect(normalizer.normalize("")).toBe("");
    expect(normalizer.normalize("   ")).toBe("");
  });
});

describe("TextNormalizer.hash", () => {
  it("returns a 64-char hex SHA-256 string", () => {
    const h = normalizer.hash("some text");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable: same input → same hash", () => {
    expect(normalizer.hash("foo bar")).toBe(normalizer.hash("foo bar"));
  });

  it("normalizes before hashing: equivalent texts produce identical hashes", () => {
    expect(normalizer.hash("foo  bar")).toBe(normalizer.hash("foo bar"));
    expect(normalizer.hash("foo\u2013bar")).toBe(normalizer.hash("foo-bar"));
  });

  it("different texts produce different hashes", () => {
    expect(normalizer.hash("article 1")).not.toBe(normalizer.hash("article 2"));
  });
});
