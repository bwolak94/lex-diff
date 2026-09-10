import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { ChangeEvent, Severity } from "@lexdiff/core";
import type { ChangeEventRepository } from "@lexdiff/core";
import { changeEvents } from "../schema/index.js";
import type * as schema from "../schema/index.js";

type DB = NodePgDatabase<typeof schema>;

type EventRow = typeof changeEvents.$inferSelect;

function rowToEvent(row: EventRow): ChangeEvent {
  const payload = row.payload as Record<string, unknown>;
  return {
    eventHash: row.eventHash,
    severity: row.severity as Severity,
    effectiveDate: row.effectiveDate ?? null,
    type: row.type,
    ...payload,
  } as ChangeEvent;
}

export class DrizzleChangeEventRepository implements ChangeEventRepository {
  constructor(private readonly db: DB) {}

  async findByActEli(actEli: string): Promise<ChangeEvent[]> {
    const rows = await this.db
      .select()
      .from(changeEvents)
      .where(eq(changeEvents.actEli, actEli));
    return rows.map(rowToEvent);
  }

  async saveAll(actEli: string, events: ChangeEvent[]): Promise<void> {
    if (events.length === 0) return;

    const rows = events.map((ev) => {
      const { eventHash, severity, effectiveDate, type, ...rest } = ev as ChangeEvent & Record<string, unknown>;
      return {
        actEli,
        eventHash: eventHash as string,
        type: type as string,
        severity: severity as string,
        effectiveDate: effectiveDate as string | null | undefined,
        payload: rest as Record<string, unknown>,
      };
    });

    await this.db
      .insert(changeEvents)
      .values(rows)
      .onConflictDoNothing({ target: changeEvents.eventHash });
  }
}
