// Typed API client for the LexDiff backend
// ELI format for routes: DU:2017:2196 (colon separator)

const API_BASE =
  process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ── Domain types (mirrored from @lexdiff/core for browser safety) ─────────────

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
  textHTML: boolean;
  keywords: string[];
}

export type Severity = "critical" | "high" | "medium" | "low";

export type EventType =
  | "UnitAdded"
  | "UnitRepealed"
  | "UnitAmended"
  | "UnitRenumbered"
  | "ActRepealed"
  | "ActConsolidated"
  | "EntryIntoForceSet";

export interface WordDiffOp {
  type: "equal" | "insert" | "delete";
  text: string;
}

export interface ChangeEvent {
  eventHash: string;
  severity: Severity;
  effectiveDate: string | null;
  type: EventType;
  // Per-type fields
  path?: string;
  text?: string;
  before?: string;
  after?: string;
  wordDiff?: WordDiffOp[];
  fromPath?: string;
  toPath?: string;
  tjEli?: string;
  by?: string;
  unitPath?: string;
  date?: string;
}

// ── API functions ─────────────────────────────────────────────────────────────

export function fetchAct(eli: string): Promise<ActMetadata & { isLocal: boolean }> {
  return apiFetch<ActMetadata & { isLocal: boolean }>(`/acts/${encodeURIComponent(eli)}`);
}

export function fetchActVersions(eli: string): Promise<string[]> {
  return apiFetch<string[]>(`/acts/${encodeURIComponent(eli)}/versions`);
}

export interface ActStats {
  eli: string;
  versionCount: number;
  eventCount: number;
}

export function fetchActStats(): Promise<ActStats[]> {
  return apiFetch<ActStats[]>("/acts/stats");
}

export function fetchTimeline(eli: string): Promise<{ events: ChangeEvent[] }> {
  return apiFetch<{ events: ChangeEvent[] }>(
    `/acts/${encodeURIComponent(eli)}/timeline`,
  );
}

export function fetchDiff(
  eli: string,
  from: string,
  to: string,
): Promise<{ events: ChangeEvent[] }> {
  const params = new URLSearchParams({ from, to });
  return apiFetch<{ events: ChangeEvent[] }>(
    `/acts/${encodeURIComponent(eli)}/diff?${params.toString()}`,
  );
}

export function searchActs(query: {
  q?: string;
  keyword?: string;
  type?: string;
}): Promise<ActMetadata[]> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.keyword) params.set("keyword", query.keyword);
  if (query.type) params.set("type", query.type);
  const qs = params.toString();
  return apiFetch<ActMetadata[]>(`/acts/search${qs ? `?${qs}` : ""}`);
}

export interface ActMetadataWithLocal extends ActMetadata {
  isLocal: boolean;
}

export interface EliSearchResult {
  totalCount: number;
  items: ActMetadataWithLocal[];
}

export function searchEliActs(query: {
  q?: string;
  type?: string;
  publisher?: string;
  year?: number;
  inForce?: boolean;
  limit?: number;
  offset?: number;
}): Promise<EliSearchResult> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.type) params.set("type", query.type);
  if (query.publisher) params.set("publisher", query.publisher);
  if (query.year) params.set("year", String(query.year));
  if (query.inForce) params.set("inForce", "true");
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));
  const qs = params.toString();
  return apiFetch<EliSearchResult>(`/acts/eli-search${qs ? `?${qs}` : ""}`);
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  actEli: string;
  email: string;
  webhookUrl: string | null;
  createdAt: string;
}

export function fetchSubscriptions(): Promise<Subscription[]> {
  return apiFetch<Subscription[]>("/subscriptions");
}

export async function createSubscription(body: {
  actEli: string;
  email: string;
  webhookUrl: string | null;
}): Promise<Subscription> {
  const res = await fetch(`${API_BASE}/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<Subscription>;
}

export async function deleteSubscription(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/subscriptions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
}

// ── Admin — local acts management ─────────────────────────────────────────────

export interface LocalActSummary {
  eli: string;
  title: string;
  type: string;
  inForce: boolean;
  changeDate: string | null;
  versionCount: number;
  eventCount: number;
}

export function fetchLocalActs(): Promise<LocalActSummary[]> {
  return apiFetch<LocalActSummary[]>("/admin/acts");
}

export async function importAct(eli: string): Promise<{ eli: string; newEvents: number }> {
  const res = await fetch(`${API_BASE}/admin/acts/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eli }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<{ eli: string; newEvents: number }>;
}

export async function syncLocalAct(eli: string): Promise<{ eli: string; newEvents: number }> {
  const res = await fetch(`${API_BASE}/admin/acts/${encodeURIComponent(eli)}/sync`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<{ eli: string; newEvents: number }>;
}

export async function deleteLocalAct(eli: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/acts/${encodeURIComponent(eli)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
}

// ── References (B-2) ──────────────────────────────────────────────────────────

export type ReferenceType = "amends" | "repeals" | "implements" | "extends";

export interface ActReference {
  id: string;
  sourceEli: string;
  targetEli: string;
  referenceType: ReferenceType;
  createdAt: string;
}

export function fetchReferences(eli: string): Promise<{
  outgoing: ActReference[];
  incoming: ActReference[];
}> {
  return apiFetch(`/acts/${encodeURIComponent(eli)}/references`);
}

// ── Auth (B-5) ────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  plan: "free" | "pro";
  createdAt: string;
}

async function apiMutate<T>(
  path: string,
  method: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function sendMagicLink(email: string): Promise<{ message: string }> {
  return apiMutate("/auth/magic-link", "POST", { email });
}

export function verifyMagicLinkToken(token: string): Promise<{ sessionToken: string }> {
  return apiFetch(`/auth/verify?token=${encodeURIComponent(token)}`);
}

export function getMe(sessionToken: string): Promise<User> {
  return apiMutate<User>("/auth/me", "GET", undefined, sessionToken);
}

export function logout(sessionToken: string): Promise<void> {
  return apiMutate("/auth/session", "DELETE", undefined, sessionToken);
}
