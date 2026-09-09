// B-2: Act references graph repository.
import { eq, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { ActReference, ActReferenceRepository } from "@lexdiff/core";
import { actReferences } from "../schema/index.js";
import type * as schema from "../schema/index.js";

type DB = NodePgDatabase<typeof schema>;

function rowToRef(row: typeof actReferences.$inferSelect): ActReference {
  return {
    id: row.id,
    sourceEli: row.sourceEli,
    targetEli: row.targetEli,
    referenceType: row.referenceType as ActReference["referenceType"],
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleActReferenceRepository implements ActReferenceRepository {
  constructor(private readonly db: DB) {}

  async findBySourceEli(sourceEli: string): Promise<ActReference[]> {
    const rows = await this.db
      .select()
      .from(actReferences)
      .where(eq(actReferences.sourceEli, sourceEli));
    return rows.map(rowToRef);
  }

  async findByTargetEli(targetEli: string): Promise<ActReference[]> {
    const rows = await this.db
      .select()
      .from(actReferences)
      .where(eq(actReferences.targetEli, targetEli));
    return rows.map(rowToRef);
  }

  async saveAll(
    refs: Omit<ActReference, "id" | "createdAt">[],
  ): Promise<void> {
    if (refs.length === 0) return;
    await this.db
      .insert(actReferences)
      .values(refs)
      .onConflictDoNothing();
  }
}
