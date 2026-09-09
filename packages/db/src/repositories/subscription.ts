import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Subscription, SubscriptionRepository } from "@lexdiff/core";
import { subscriptions } from "../schema/index.js";
import type * as schema from "../schema/index.js";

type DB = NodePgDatabase<typeof schema>;

type SubscriptionRow = typeof subscriptions.$inferSelect;

function rowToSub(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    actEli: row.actEli,
    email: row.email,
    webhookUrl: row.webhookUrl ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: DB) {}

  async findByActEli(actEli: string): Promise<Subscription[]> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.actEli, actEli));
    return rows.map(rowToSub);
  }

  async findAll(): Promise<Subscription[]> {
    const rows = await this.db.select().from(subscriptions);
    return rows.map(rowToSub);
  }

  async findById(id: string): Promise<Subscription | null> {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);
    return row ? rowToSub(row) : null;
  }

  async save(sub: {
    actEli: string;
    email: string;
    webhookUrl: string | null;
  }): Promise<Subscription> {
    const [row] = await this.db
      .insert(subscriptions)
      .values({
        actEli: sub.actEli,
        email: sub.email,
        webhookUrl: sub.webhookUrl,
      })
      .onConflictDoUpdate({
        target: [subscriptions.actEli, subscriptions.email],
        set: { webhookUrl: sub.webhookUrl },
      })
      .returning();

    return rowToSub(row!);
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(subscriptions)
      .where(eq(subscriptions.id, id));
  }
}
