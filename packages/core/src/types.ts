// Domain types — single source of truth for the LexDiff domain model.
// All other packages import from here; types are never duplicated.

/**
 * Structural unit kinds using the ELI API path-key names.
 * e.g. the path "art=4/ustep=3/punkt=2/litera=d" uses these strings.
 */
export type UnitKind =
  | "ksiega"
  | "tytul"
  | "dzial"
  | "rozdzial"
  | "oddzial"
  | "art"
  | "ustep"
  | "par"
  | "punkt"
  | "litera";

/** Change event severity for notification routing */
export type Severity = "critical" | "high" | "medium" | "low";

/** Act version kind: original gazette / consolidated text / unified text */
export type ActVersionKind = "OGL" | "TJ" | "UJ";

/** A structural unit (article, paragraph, point …) within an act version */
export interface Unit {
  /** Natural key and API address, e.g. "art=4/ustep=3/punkt=2" */
  path: string;
  kind: UnitKind;
  /** Raw number string — may include letters or superscripts: "4a", "36⁴" */
  number: string;
  /** Sortable representation of number for natural ordering */
  numberSort: string;
  parentPath: string | null;
  /** Plain text after HTML stripping and normalization. null when textHTML=false */
  text: string | null;
  /** SHA-256 of normalized text. null when text is null */
  textHash: string | null;
}

/** Normalized act metadata (mapped from raw ELI API response) */
export interface ActMetadata {
  eli: string;
  publisher: string;
  year: number;
  position: number;
  title: string;
  type: string;
  status: string;
  inForce: boolean;
  announcementDate: string | null;
  entryIntoForce: string | null;
  repealDate: string | null;
  changeDate: string | null;
  /** Whether HTML text is available for this act */
  textHTML: boolean;
  keywords: string[];
}

/** A changed-act entry from GET /changes/acts */
export interface ChangedAct {
  eli: string;
  publisher: string;
  year: number;
  position: number;
  changeDate: string;
}

// ── Change events ────────────────────────────────────────────────────────────

interface BaseChangeEvent {
  /** Canonical hash for deduplication: hash(actEli, unitPath, type, payload) */
  eventHash: string;
  severity: Severity;
  effectiveDate: string | null;
}

export interface UnitAddedEvent extends BaseChangeEvent {
  type: "UnitAdded";
  path: string;
  text: string;
}

export interface UnitRepealedEvent extends BaseChangeEvent {
  type: "UnitRepealed";
  path: string;
}

/** A single operation in a word-level diff */
export interface WordDiffOp {
  type: "equal" | "insert" | "delete";
  text: string;
}

export interface UnitAmendedEvent extends BaseChangeEvent {
  type: "UnitAmended";
  path: string;
  before: string;
  after: string;
  /** Word-level diff computed by diff-match-patch */
  wordDiff: WordDiffOp[];
}

export interface UnitRenumberedEvent extends BaseChangeEvent {
  type: "UnitRenumbered";
  fromPath: string;
  toPath: string;
}

export interface ActRepealedEvent extends BaseChangeEvent {
  type: "ActRepealed";
  by: string;
}

export interface ActConsolidatedEvent extends BaseChangeEvent {
  type: "ActConsolidated";
  tjEli: string;
}

export interface EntryIntoForceSetEvent extends BaseChangeEvent {
  type: "EntryIntoForceSet";
  unitPath: string;
  date: string;
}

export type ChangeEvent =
  | UnitAddedEvent
  | UnitRepealedEvent
  | UnitAmendedEvent
  | UnitRenumberedEvent
  | ActRepealedEvent
  | ActConsolidatedEvent
  | EntryIntoForceSetEvent;

export type ChangeEventType = ChangeEvent["type"];

// ── Act versions ─────────────────────────────────────────────────────────────

export interface ActVersion {
  eli: string;
  actEli: string;
  versionKind: ActVersionKind;
  publishedAt: string | null;
}

// ── Subscriptions (B-1 extended) ──────────────────────────────────────────────

export type SubscriptionType = "act" | "keyword" | "publisher";

export interface Subscription {
  id: string;
  userId: string | null;
  subscriptionType: SubscriptionType;
  actEli: string;
  keyword: string | null;
  publisherFilter: string | null;
  email: string;
  webhookUrl: string | null;
  createdAt: string;
}

// ── B-2: Act references ───────────────────────────────────────────────────────

export type ReferenceType = "amends" | "repeals" | "implements" | "extends";

export interface ActReference {
  id: string;
  sourceEli: string;
  targetEli: string;
  referenceType: ReferenceType;
  createdAt: string;
}

// ── B-5: Users + auth ─────────────────────────────────────────────────────────

export type UserPlan = "free" | "pro";

export interface User {
  id: string;
  email: string;
  plan: UserPlan;
  createdAt: string;
}
