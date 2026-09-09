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

// ── B-5: Users + auth ────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  plan: text("plan").notNull().default("free"), // free | pro
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const magicLinkTokens = pgTable("magic_link_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Subscriptions (S5-7 + B-1 extended) ──────────────────────────────────────

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    // B-1: subscription type — act | keyword | publisher
    subscriptionType: text("subscription_type").notNull().default("act"),
    actEli: text("act_eli").notNull().default(""),
    keyword: text("keyword"),
    publisherFilter: text("publisher_filter"),
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

// ── B-2: Act references graph ─────────────────────────────────────────────────

export const actReferences = pgTable(
  "act_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceEli: text("source_eli").notNull(),
    targetEli: text("target_eli").notNull(),
    referenceType: text("reference_type").notNull(), // amends | repeals | implements | extends
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("act_references_pair_idx").on(
      t.sourceEli,
      t.targetEli,
      t.referenceType,
    ),
    index("act_references_source_idx").on(t.sourceEli),
    index("act_references_target_idx").on(t.targetEli),
  ],
);

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
