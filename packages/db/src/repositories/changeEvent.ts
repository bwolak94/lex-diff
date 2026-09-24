import { eq, desc, count } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { ChangeEvent, Severity, ChangeEventWithMeta } from "@lexdiff/core";
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

  async findRecent(opts: {
    limit: number;
    offset: number;
    type?: string;
  }): Promise<{ items: ChangeEventWithMeta[]; total: number }> {
    const where = opts.type ? eq(changeEvents.type, opts.type) : undefined;

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(changeEvents)
        .$dynamic()
        .where(where)
        .orderBy(desc(changeEvents.createdAt))
        .limit(opts.limit)
        .offset(opts.offset),
      this.db
        .select({ value: count() })
        .from(changeEvents)
        .$dynamic()
        .where(where),
    ]);

    const total = Number(countRows[0]?.value ?? 0);

    const items = rows.map((row): ChangeEventWithMeta => ({
      ...rowToEvent(row),
      actEli: row.actEli,
      createdAt: row.createdAt.toISOString(),
    }));

    return { items, total };
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
