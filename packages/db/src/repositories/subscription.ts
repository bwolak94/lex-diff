import { eq, and, count } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Subscription, SubscriptionRepository } from "@lexdiff/core";
import { subscriptions } from "../schema/index.js";
import type * as schema from "../schema/index.js";

type DB = NodePgDatabase<typeof schema>;
type SubscriptionRow = typeof subscriptions.$inferSelect;

function rowToSub(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.userId ?? null,
    subscriptionType: (row.subscriptionType ?? "act") as Subscription["subscriptionType"],
    actEli: row.actEli,
    keyword: row.keyword ?? null,
    publisherFilter: row.publisherFilter ?? null,
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
      .where(and(eq(subscriptions.actEli, actEli), eq(subscriptions.subscriptionType, "act")));
    return rows.map(rowToSub);
  }

  async findByKeyword(keyword: string): Promise<Subscription[]> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.keyword, keyword), eq(subscriptions.subscriptionType, "keyword")));
    return rows.map(rowToSub);
  }

  async findByPublisher(publisher: string): Promise<Subscription[]> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.publisherFilter, publisher), eq(subscriptions.subscriptionType, "publisher")));
    return rows.map(rowToSub);
  }

  async findAll(): Promise<Subscription[]> {
    const rows = await this.db.select().from(subscriptions);
    return rows.map(rowToSub);
  }

  async findByUserId(userId: string): Promise<Subscription[]> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
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

  async countByUserId(userId: string): Promise<number> {
    const [res] = await this.db
      .select({ count: count() })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    return Number(res?.count ?? 0);
  }

  async save(sub: {
    userId?: string | null;
    subscriptionType?: "act" | "keyword" | "publisher";
    actEli?: string;
    keyword?: string | null;
    publisherFilter?: string | null;
    email: string;
    webhookUrl: string | null;
  }): Promise<Subscription> {
    const type = sub.subscriptionType ?? "act";
    const actEli = sub.actEli ?? "";
    const [row] = await this.db
      .insert(subscriptions)
      .values({
        userId: sub.userId ?? null,
        subscriptionType: type,
        actEli,
        keyword: sub.keyword ?? null,
        publisherFilter: sub.publisherFilter ?? null,
        email: sub.email,
        webhookUrl: sub.webhookUrl,
      })
      .onConflictDoUpdate({
        target: [subscriptions.actEli, subscriptions.email],
        set: {
          webhookUrl: sub.webhookUrl,
          keyword: sub.keyword ?? null,
          publisherFilter: sub.publisherFilter ?? null,
        },
      })
      .returning();
    return rowToSub(row!);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(subscriptions).where(eq(subscriptions.id, id));
  }
}
