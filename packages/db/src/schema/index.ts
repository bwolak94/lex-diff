import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const acts = pgTable("acts", {
  id: uuid("id").primaryKey().defaultRandom(),
  eli: text("eli").notNull().unique(),
  publisher: text("publisher").notNull(),
  year: integer("year").notNull(),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  inForce: boolean("in_force").notNull().default(false),
  announcementDate: text("announcement_date"),
  entryIntoForce: text("entry_into_force"),
  repealDate: text("repeal_date"),
  changeDate: text("change_date"),
  textHtml: boolean("text_html").notNull().default(false),
  keywords: text("keywords").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const actVersions = pgTable("act_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  actEli: text("act_eli").notNull().references(() => acts.eli),
  eli: text("eli").notNull().unique(),
  versionKind: text("version_kind").notNull(), // OGL | TJ | UJ
  publishedAt: text("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actVersionEli: text("act_version_eli")
      .notNull()
      .references(() => actVersions.eli),
    path: text("path").notNull(),
    kind: text("kind").notNull(),
    number: text("number").notNull(),
    numberSort: text("number_sort").notNull(),
    parentPath: text("parent_path"),
    text: text("text"),
    textHash: text("text_hash"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("units_version_path_idx").on(t.actVersionEli, t.path)],
);

export const changeEvents = pgTable(
  "change_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actEli: text("act_eli").notNull(),
    eventHash: text("event_hash").notNull().unique(),
    type: text("type").notNull(),
    severity: text("severity").notNull(),
    effectiveDate: text("effective_date"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("change_events_act_eli_idx").on(t.actEli)],
);

// ── Subscriptions (S5-7) ──────────────────────────────────────────────────────

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actEli: text("act_eli").notNull(),
    email: text("email").notNull(),
    webhookUrl: text("webhook_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("subscriptions_eli_email_idx").on(t.actEli, t.email)],
);

// ── Job cursors (S5-2) ────────────────────────────────────────────────────────

export const jobCursors = pgTable("job_cursors", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobType: text("job_type").notNull().unique(),
  cursorValue: text("cursor_value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Notification dedup log (S5-15) ────────────────────────────────────────────

export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    eventHash: text("event_hash").notNull(),
    channel: text("channel").notNull(), // email | webhook
    sentAt: timestamp("sent_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notification_log_dedup_idx").on(
      t.subscriptionId,
      t.eventHash,
      t.channel,
    ),
  ],
);
