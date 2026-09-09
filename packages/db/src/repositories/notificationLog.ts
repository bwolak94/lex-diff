import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { NotificationLogRepository } from "@lexdiff/core";
import { notificationLog } from "../schema/index.js";
import type * as schema from "../schema/index.js";

type DB = NodePgDatabase<typeof schema>;

export class DrizzleNotificationLogRepository
  implements NotificationLogRepository
{
  constructor(private readonly db: DB) {}

  async hasBeenSent(
    subscriptionId: string,
    eventHash: string,
    channel: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: notificationLog.id })
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.subscriptionId, subscriptionId),
          eq(notificationLog.eventHash, eventHash),
          eq(notificationLog.channel, channel),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async markSent(
    subscriptionId: string,
    eventHash: string,
    channel: string,
  ): Promise<void> {
    await this.db
      .insert(notificationLog)
      .values({ subscriptionId, eventHash, channel })
      .onConflictDoNothing();
  }
}
