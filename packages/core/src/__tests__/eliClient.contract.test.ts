// S6-10: Contract tests — verify ELI API fixture shapes pass Zod schemas
// without any live network. No MSW server needed; tests the schema layer directly.

import { describe, it, expect } from "vitest";
import {
  EliActMetadataResponseSchema,
  EliActStructResponseSchema,
  EliChangedActsResponseSchema,
} from "../schemas.js";
import {
  actMetadataFixture,
  actMetadataNoTextFixture,
  actStructFixture,
  changedActsFixture,
} from "./fixtures/eli-api.js";

describe("ELI API contract tests (S6-10)", () => {
  describe("EliActMetadataResponseSchema", () => {
    it("parses standard act metadata fixture", () => {
      const result = EliActMetadataResponseSchema.safeParse(actMetadataFixture);
      expect(result.success).toBe(true);
    });

    it("parses metadata fixture with textHTML=false", () => {
      const result = EliActMetadataResponseSchema.safeParse(
        actMetadataNoTextFixture,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.textHTML).toBe(false);
      }
    });

    it("rejects payload missing required ELI field", () => {
      const { ELI: _omit, ...withoutEli } = actMetadataFixture;
      const result = EliActMetadataResponseSchema.safeParse(withoutEli);
      expect(result.success).toBe(false);
    });

    it("rejects payload with wrong year type", () => {
      const result = EliActMetadataResponseSchema.safeParse({
        ...actMetadataFixture,
        year: "2017",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("EliActStructResponseSchema", () => {
    it("parses struct fixture", () => {
      const result = EliActStructResponseSchema.safeParse(actStructFixture);
      expect(result.success).toBe(true);
    });

    it("parses nested children recursively", () => {
      const result = EliActStructResponseSchema.safeParse(actStructFixture);
      if (!result.success) throw new Error(JSON.stringify(result.error));
      // result.data is a bare EliStructNode[]
      const art1 = result.data[0]!;
      expect(art1.children.length).toBe(2);
      expect(art1.children[0]!.type).toBe("ustep");
    });

    it("rejects struct that is not an array", () => {
      const result = EliActStructResponseSchema.safeParse({ eli: "DU/2017/2196" });
      expect(result.success).toBe(false);
    });
  });

  describe("EliChangedActsResponseSchema", () => {
    it("parses changed acts fixture", () => {
      const result = EliChangedActsResponseSchema.safeParse(changedActsFixture);
      expect(result.success).toBe(true);
    });

    it("parses empty items list", () => {
      const result = EliChangedActsResponseSchema.safeParse({
        offset: 0,
        limit: 100,
        count: 0,
        items: [],
      });
      expect(result.success).toBe(true);
    });

    it("rejects item missing changeDate", () => {
      const result = EliChangedActsResponseSchema.safeParse({
        offset: 0,
        limit: 100,
        count: 1,
        items: [{ ELI: "DU/2017/2196", publisher: "DU", year: 2017, pos: 2196 }],
      });
      expect(result.success).toBe(false);
    });
  });
});
