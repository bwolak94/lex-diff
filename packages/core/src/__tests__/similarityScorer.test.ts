import { describe, it, expect } from "vitest";
import { SimilarityScorer } from "../similarityScorer.js";

const scorer = new SimilarityScorer();

describe("SimilarityScorer.score", () => {
  it("returns 1 for identical strings", () => {
    expect(scorer.score("hello world", "hello world")).toBe(1);
  });

  it("returns 1 for two empty strings", () => {
    expect(scorer.score("", "")).toBe(1);
  });

  it("returns 0 when one string is empty and the other is not", () => {
    expect(scorer.score("", "some text")).toBe(0);
    expect(scorer.score("some text", "")).toBe(0);
  });

  it("returns a value in [0, 1] for arbitrary strings", () => {
    const score = scorer.score("article one text here", "article two text here");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("very similar strings score above 0.7 (renumber threshold)", () => {
    const a = "The act regulates software testing in Poland.";
    const b = "The act regulates software testing in Poland and EU.";
    expect(scorer.score(a, b)).toBeGreaterThan(0.7);
  });

  it("completely different strings score below 0.7", () => {
    const a = "taxation of motor vehicles and road transport fees";
    const b = "environmental protection and water management regulations";
    expect(scorer.score(a, b)).toBeLessThan(0.7);
  });

  it("is symmetric: score(a,b) === score(b,a)", () => {
    const a = "Article 1. The act applies to all public entities.";
    const b = "Article 1a. The act applies to all public and private entities.";
    expect(scorer.score(a, b)).toBeCloseTo(scorer.score(b, a), 10);
  });

  it("score decreases as texts diverge", () => {
    const base = "The minister shall issue implementing regulations within 30 days.";
    const similar = "The minister shall issue implementing regulations within 60 days.";
    const different = "All penalties for non-compliance are doubled for repeat offenders.";
    expect(scorer.score(base, similar)).toBeGreaterThan(scorer.score(base, different));
  });

  it("handles very long strings without throwing", () => {
    const long = "word ".repeat(1000);
    expect(() => scorer.score(long, long + " extra")).not.toThrow();
  });
});
