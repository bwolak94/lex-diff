import { describe, it, expect } from "vitest";
import { extractReferences } from "../referenceExtractor.js";

const SOURCE = "DU/2024/999";

describe("extractReferences — title patterns", () => {
  it("extracts Dz.U. reference with full form", () => {
    const refs = extractReferences(
      SOURCE,
      "Ustawa zmieniająca ustawę z dnia 1 marca 2017 r. (Dz.U. z 2017 r. poz. 2196)",
      [],
    );
    expect(refs).toHaveLength(1);
    expect(refs[0]!.targetEli).toBe("DU/2017/2196");
    expect(refs[0]!.referenceType).toBe("amends");
  });

  it("extracts Dz.U. reference with short modern form (no 'z' / 'r.')", () => {
    const refs = extractReferences(
      SOURCE,
      "Ustawa z dnia 5 maja 2024 r. zmieniająca ustawę (Dz.U. 2024 poz. 567)",
      [],
    );
    expect(refs).toHaveLength(1);
    expect(refs[0]!.targetEli).toBe("DU/2024/567");
  });

  it("extracts M.P. reference", () => {
    const refs = extractReferences(
      SOURCE,
      "Obwieszczenie o ogłoszeniu jednolitego tekstu (M.P. z 2020 r. poz. 100)",
      [],
    );
    expect(refs).toHaveLength(1);
    expect(refs[0]!.targetEli).toBe("MP/2020/100");
  });

  it("classifies repeals correctly from title", () => {
    const refs = extractReferences(
      SOURCE,
      "Ustawa uchylająca ustawę z dnia 10 maja 2010 r. (Dz.U. z 2010 r. poz. 555)",
      [],
    );
    expect(refs[0]!.referenceType).toBe("repeals");
  });

  it("classifies implements from title", () => {
    const refs = extractReferences(
      SOURCE,
      "Rozporządzenie wykonawcze wydane na podstawie art. 5 (Dz.U. z 2021 r. poz. 300)",
      [],
    );
    expect(refs[0]!.referenceType).toBe("implements");
  });

  it("defaults to amends when no context keyword", () => {
    const refs = extractReferences(
      SOURCE,
      "Ustawa z dnia 3 lipca 2023 r. (Dz.U. z 2023 r. poz. 1500)",
      [],
    );
    expect(refs[0]!.referenceType).toBe("amends");
  });

  it("excludes self-reference", () => {
    const selfRef = "DU/2017/2196";
    const refs = extractReferences(
      selfRef,
      "Ustawa zmieniana (Dz.U. z 2017 r. poz. 2196)",
      [],
    );
    expect(refs).toHaveLength(0);
  });

  it("deduplicates the same ELI across title and unit texts", () => {
    const refs = extractReferences(
      SOURCE,
      "Ustawa zmieniająca (Dz.U. z 2017 r. poz. 2196)",
      ["Przepis zmienia (Dz.U. z 2017 r. poz. 2196)"],
    );
    expect(refs).toHaveLength(1);
  });

  it("extracts multiple distinct references", () => {
    const refs = extractReferences(
      SOURCE,
      "Ustawa zmieniająca ustawę (Dz.U. z 2017 r. poz. 2196) i ustawę (Dz.U. z 2019 r. poz. 100)",
      [],
    );
    expect(refs).toHaveLength(2);
    const elis = refs.map((r) => r.targetEli);
    expect(elis).toContain("DU/2017/2196");
    expect(elis).toContain("DU/2019/100");
  });
});

describe("extractReferences — unit text extraction", () => {
  it("extracts reference from unit text", () => {
    const refs = extractReferences(SOURCE, "Ustawa z dnia 1 stycznia 2022 r.", [
      "Przepis zmienia ustawę z Dz.U. z 2020 r. poz. 800.",
    ]);
    expect(refs.some((r) => r.targetEli === "DU/2020/800")).toBe(true);
  });

  it("classifies implements from unit text context", () => {
    const refs = extractReferences(SOURCE, "Ustawa z dnia 1 stycznia 2022 r.", [
      "Na podstawie art. 10 ustawy (Dz.U. z 2022 r. poz. 44) wydaje się rozporządzenie.",
    ]);
    expect(refs[0]!.referenceType).toBe("implements");
  });
});
