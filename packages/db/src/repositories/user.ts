// B-5: User repository — upsert-on-email pattern for magic link auth.
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { User, UserRepository } from "@lexdiff/core";
import { users } from "../schema/index.js";
import type * as schema from "../schema/index.js";

type DB = NodePgDatabase<typeof schema>;

function rowToUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    plan: row.plan as User["plan"],
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: DB) {}

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row ? rowToUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ? rowToUser(row) : null;
  }

  async upsert(email: string): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({ email })
      .onConflictDoUpdate({
        target: users.email,
        set: { email },
      })
      .returning();
    return rowToUser(row!);
  }

  async updatePlan(id: string, plan: "free" | "pro"): Promise<void> {
    await this.db.update(users).set({ plan }).where(eq(users.id, id));
  }
}
