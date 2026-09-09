-- B-5: Users + magic link auth + sessions
CREATE TABLE IF NOT EXISTS "users" (
  "id"         uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"      text      NOT NULL UNIQUE,
  "plan"       text      NOT NULL DEFAULT 'free', -- free | pro
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "magic_link_tokens" (
  "id"         uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    uuid      NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token"      text      NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "used_at"    timestamp
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id"         uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    uuid      NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token"      text      NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions"("token");

-- B-1: Extend subscriptions with keyword/publisher filter support
ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "user_id"           uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "subscription_type" text NOT NULL DEFAULT 'act',
  ADD COLUMN IF NOT EXISTS "keyword"           text,
  ADD COLUMN IF NOT EXISTS "publisher_filter"  text;

-- B-2: Act references graph
CREATE TABLE IF NOT EXISTS "act_references" (
  "id"             uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_eli"     text      NOT NULL,
  "target_eli"     text      NOT NULL,
  "reference_type" text      NOT NULL, -- amends | repeals | implements | extends
  "created_at"     timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "act_references_pair_idx"
  ON "act_references"("source_eli", "target_eli", "reference_type");

CREATE INDEX IF NOT EXISTS "act_references_source_idx" ON "act_references"("source_eli");
CREATE INDEX IF NOT EXISTS "act_references_target_idx" ON "act_references"("target_eli");
