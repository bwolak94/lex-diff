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

// Recursive struct node — the ELI API returns nodes with `type` (any string)
// and `name` as the unit number. We normalise to `num` for internal use.
export interface EliStructNode {
  type: string;
  num: string;
  children: EliStructNode[];
}

export const EliStructNodeSchema: z.ZodType<EliStructNode> = z.object({
  type: z.string(),
  num: z.string().optional(),
  name: z.string().optional(),
  children: z.lazy(() => z.array(EliStructNodeSchema).default([])),
}).transform(({ type, num, name, children }) => ({
  type,
  num: num ?? name ?? "",
  children,
})) as unknown as z.ZodType<EliStructNode>;

// The ELI API /struct endpoint returns a bare array of nodes.
export const EliActStructResponseSchema = z.array(EliStructNodeSchema);

export const EliActMetadataResponseSchema = z.object({
  ELI: z.string(),
  publisher: z.string(),
  year: z.number().int(),
  pos: z.number().int(),
  title: z.string(),
  type: z.string(),
  status: z.string(),
  inForce: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "True" || v === "IN_FORCE" || v === "PARTIALLY_IN_FORCE"),
  announcementDate: z.string().nullish(),
  entryIntoForce: z.string().nullish(),
  repealDate: z.string().nullish(),
  changeDate: z.string().nullish(),
  textHTML: z.union([z.boolean(), z.string()]).transform((v) => v === true || v === "True"),
  keywords: z.array(z.string()).default([]),
  texts: z
    .array(
      z.object({
        kind: z.string().optional(),
        fileName: z.string().optional(),
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
export type EliActStructResponse = EliStructNode[]; // bare array from API
export type EliChangedActsResponse = z.infer<typeof EliChangedActsResponseSchema>;
