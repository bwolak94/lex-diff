import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
});

export const db = drizzle(pool, { schema });
export { schema };

export { eq, sql } from "drizzle-orm";
export { DrizzleActRepository } from "./repositories/act.js";
export { DrizzleUnitRepository } from "./repositories/unit.js";
export { DrizzleChangeEventRepository } from "./repositories/changeEvent.js";
export { DrizzleSubscriptionRepository } from "./repositories/subscription.js";
export { DrizzleJobCursorRepository } from "./repositories/cursor.js";
export { DrizzleNotificationLogRepository } from "./repositories/notificationLog.js";
export { DrizzleActReferenceRepository } from "./repositories/reference.js";
export { DrizzleUserRepository } from "./repositories/user.js";
export {
  InMemoryActRepository,
  InMemoryUnitRepository,
  InMemoryChangeEventRepository,
  InMemorySubscriptionRepository,
  InMemoryJobCursorRepository,
  InMemoryNotificationLogRepository,
  InMemoryActReferenceRepository,
  InMemoryUserRepository,
} from "./repositories/inMemory.js";
