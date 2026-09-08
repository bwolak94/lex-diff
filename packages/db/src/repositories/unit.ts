import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Unit, UnitKind } from "@lexdiff/core";
import type { UnitRepository } from "@lexdiff/core";
import { units } from "../schema/index.js";
import type * as schema from "../schema/index.js";

type DB = NodePgDatabase<typeof schema>;

type UnitRow = typeof units.$inferSelect;

function rowToUnit(row: UnitRow): Unit {
  return {
    path: row.path,
    kind: row.kind as UnitKind,
    number: row.number,
    numberSort: row.numberSort,
    parentPath: row.parentPath ?? null,
    text: row.text ?? null,
    textHash: row.textHash ?? null,
  };
}

export class DrizzleUnitRepository implements UnitRepository {
  constructor(private readonly db: DB) {}

  async findByActEli(eli: string): Promise<Unit[]> {
    const rows = await this.db
      .select()
      .from(units)
      .where(eq(units.actVersionEli, eli));
    return rows.map(rowToUnit);
  }

  async saveAll(eli: string, unitList: Unit[]): Promise<void> {
    if (unitList.length === 0) return;

    await this.db
      .insert(units)
      .values(
        unitList.map((u) => ({
          actVersionEli: eli,
          path: u.path,
          kind: u.kind,
          number: u.number,
          numberSort: u.numberSort,
          parentPath: u.parentPath,
          text: u.text,
          textHash: u.textHash,
        })),
      )
      .onConflictDoUpdate({
        target: [units.actVersionEli, units.path],
        set: {
          text: units.text,
          textHash: units.textHash,
        },
      });
  }
}
