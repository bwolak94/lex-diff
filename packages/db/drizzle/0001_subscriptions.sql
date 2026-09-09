-- S5-7: Subscriptions — act + email pairs, optional webhook
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id"          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  "act_eli"     text      NOT NULL,
  "email"       text      NOT NULL,
  "webhook_url" text,
  "created_at"  timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_eli_email_idx"
  ON "subscriptions"("act_eli", "email");

-- S5-2: Job cursors — last processed cursor per scheduler job type
CREATE TABLE IF NOT EXISTS "job_cursors" (
  "id"           uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_type"     text      NOT NULL UNIQUE,
  "cursor_value" text      NOT NULL,
  "updated_at"   timestamp NOT NULL DEFAULT now()
);

-- S5-15: Notification dedup log — prevents double sends
CREATE TABLE IF NOT EXISTS "notification_log" (
  "id"              uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  "subscription_id" uuid      NOT NULL REFERENCES "subscriptions"("id") ON DELETE CASCADE,
  "event_hash"      text      NOT NULL,
  "channel"         text      NOT NULL, -- email | webhook
  "sent_at"         timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_log_dedup_idx"
  ON "notification_log"("subscription_id", "event_hash", "channel");
