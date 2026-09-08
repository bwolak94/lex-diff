import { z } from "zod";

// ── ELI API response Zod schemas ─────────────────────────────────────────────
// TypeScript types are derived from these schemas (z.infer<...>).
// The same schemas validate ELI API responses, Fastify route bodies, and DB mappers.

export const UNIT_KINDS = [
  "ksiega",
  "tytul",
  "dzial",
  "rozdzial",
  "oddzial",
  "art",
  "ustep",
  "par",
  "punkt",
  "litera",
] as const;

export const UnitKindSchema = z.enum(UNIT_KINDS);

// Recursive struct node — z.lazy() required for self-referential schema
export interface EliStructNode {
  type: (typeof UNIT_KINDS)[number];
  num: string;
  children: EliStructNode[];
}

export const EliStructNodeSchema: z.ZodType<EliStructNode> = z.object({
  type: UnitKindSchema,
  num: z.string(),
  children: z.lazy(() => z.array(EliStructNodeSchema)),
});

export const EliActStructResponseSchema = z.object({
  eli: z.string(),
  content: z.array(EliStructNodeSchema),
});

export const EliActMetadataResponseSchema = z.object({
  ELI: z.string(),
  publisher: z.string(),
  year: z.number().int(),
  pos: z.number().int(),
  title: z.string(),
  type: z.string(),
  status: z.string(),
  inForce: z.boolean(),
  announcementDate: z.string().nullish(),
  entryIntoForce: z.string().nullish(),
  repealDate: z.string().nullish(),
  changeDate: z.string().nullish(),
  textHTML: z.boolean(),
  keywords: z.array(z.string()).default([]),
  texts: z
    .array(
      z.object({
        kind: z.string(),
        url: z.string().optional(),
        type: z.string().optional(),
      }),
    )
    .default([]),
});

export const EliChangedActItemSchema = z.object({
  ELI: z.string(),
  publisher: z.string(),
  year: z.number().int(),
  pos: z.number().int(),
  changeDate: z.string(),
});

export const EliChangedActsResponseSchema = z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  items: z.array(EliChangedActItemSchema),
});

// Derived TypeScript types
export type EliActMetadataResponse = z.infer<typeof EliActMetadataResponseSchema>;
export type EliActStructResponse = z.infer<typeof EliActStructResponseSchema>;
export type EliChangedActsResponse = z.infer<typeof EliChangedActsResponseSchema>;
