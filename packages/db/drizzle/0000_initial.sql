-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── acts ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "acts" (
  "id"                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "eli"               text        NOT NULL UNIQUE,
  "publisher"         text        NOT NULL,
  "year"              integer     NOT NULL,
  "position"          integer     NOT NULL,
  "title"             text        NOT NULL,
  "type"              text        NOT NULL,
  "status"            text        NOT NULL,
  "in_force"          boolean     NOT NULL DEFAULT false,
  "announcement_date" text,
  "entry_into_force"  text,
  "repeal_date"       text,
  "change_date"       text,
  "text_html"         boolean     NOT NULL DEFAULT false,
  "keywords"          text[]      NOT NULL DEFAULT '{}',
  "created_at"        timestamp   NOT NULL DEFAULT now()
);

-- GIN indexes for full-text and trigram search on acts.title
CREATE INDEX IF NOT EXISTS "acts_title_fts_idx"
  ON "acts" USING gin(to_tsvector('simple', "title"));

CREATE INDEX IF NOT EXISTS "acts_title_trgm_idx"
  ON "acts" USING gin("title" gin_trgm_ops);

-- ── act_versions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "act_versions" (
  "id"           uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  "act_eli"      text      NOT NULL REFERENCES "acts"("eli"),
  "eli"          text      NOT NULL UNIQUE,
  "version_kind" text      NOT NULL, -- OGL | TJ | UJ
  "published_at" text,
  "created_at"   timestamp NOT NULL DEFAULT now()
);

-- ── units ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "units" (
  "id"              uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  "act_version_eli" text      NOT NULL REFERENCES "act_versions"("eli"),
  "path"            text      NOT NULL,
  "kind"            text      NOT NULL,
  "number"          text      NOT NULL,
  "number_sort"     text      NOT NULL,
  "parent_path"     text,
  "text"            text,
  "text_hash"       text,
  "created_at"      timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "units_version_path_idx"
  ON "units"("act_version_eli", "path");

-- ── change_events ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "change_events" (
  "id"             uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  "act_eli"        text      NOT NULL,
  "event_hash"     text      NOT NULL UNIQUE,
  "type"           text      NOT NULL,
  "severity"       text      NOT NULL,
  "effective_date" text,
  "payload"        jsonb     NOT NULL,
  "created_at"     timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "change_events_act_eli_idx"
  ON "change_events"("act_eli");

CREATE INDEX IF NOT EXISTS "change_events_event_hash_idx"
  ON "change_events"("event_hash");
