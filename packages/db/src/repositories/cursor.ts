import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { JobCursorRepository } from "@lexdiff/core";
import { jobCursors } from "../schema/index.js";
import type * as schema from "../schema/index.js";

type DB = NodePgDatabase<typeof schema>;

export class DrizzleJobCursorRepository implements JobCursorRepository {
  constructor(private readonly db: DB) {}

  async getCursor(jobType: string): Promise<string | null> {
    const [row] = await this.db
      .select()
      .from(jobCursors)
      .where(eq(jobCursors.jobType, jobType))
      .limit(1);
    return row?.cursorValue ?? null;
  }

  async setCursor(jobType: string, value: string): Promise<void> {
    await this.db
      .insert(jobCursors)
      .values({ jobType, cursorValue: value })
      .onConflictDoUpdate({
        target: jobCursors.jobType,
        set: { cursorValue: value, updatedAt: new Date() },
      });
  }
}
