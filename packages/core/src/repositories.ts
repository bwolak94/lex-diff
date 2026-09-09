// Repository interfaces — domain defines its own contracts (DIP).
// Implementations live in @lexdiff/db; in-memory stubs live there too.

import type {
  ActMetadata,
  Unit,
  ChangeEvent,
  Subscription,
  ActReference,
  User,
} from "./types.js";

export interface ActRepository {
  findByEli(eli: string): Promise<ActMetadata | null>;
  /** Returns ELIs of all stored versions linked to this base ELI. */
  listVersionElis(eli: string): Promise<string[]>;
  save(meta: ActMetadata): Promise<void>;
  search(q: { q?: string; keyword?: string; type?: string }): Promise<ActMetadata[]>;
}

export interface UnitRepository {
  findByActEli(eli: string): Promise<Unit[]>;
  saveAll(eli: string, units: Unit[]): Promise<void>;
}

export interface ChangeEventRepository {
  findByActEli(actEli: string): Promise<ChangeEvent[]>;
  saveAll(events: ChangeEvent[]): Promise<void>;
}

export interface SubscriptionRepository {
  findByActEli(actEli: string): Promise<Subscription[]>;
  /** B-1: find keyword/publisher subscriptions matching an event's context */
  findByKeyword(keyword: string): Promise<Subscription[]>;
  findByPublisher(publisher: string): Promise<Subscription[]>;
  findAll(): Promise<Subscription[]>;
  findByUserId(userId: string): Promise<Subscription[]>;
  findById(id: string): Promise<Subscription | null>;
  countByUserId(userId: string): Promise<number>;
  save(sub: {
    userId?: string | null;
    subscriptionType?: "act" | "keyword" | "publisher";
    actEli?: string;
    keyword?: string | null;
    publisherFilter?: string | null;
    email: string;
    webhookUrl: string | null;
  }): Promise<Subscription>;
  delete(id: string): Promise<void>;
}

// ── B-2: References ───────────────────────────────────────────────────────────

export interface ActReferenceRepository {
  findBySourceEli(sourceEli: string): Promise<ActReference[]>;
  findByTargetEli(targetEli: string): Promise<ActReference[]>;
  saveAll(refs: Omit<ActReference, "id" | "createdAt">[]): Promise<void>;
}

// ── B-5: Users ────────────────────────────────────────────────────────────────

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  upsert(email: string): Promise<User>;
  updatePlan(id: string, plan: "free" | "pro"): Promise<void>;
}

export interface JobCursorRepository {
  getCursor(jobType: string): Promise<string | null>;
  setCursor(jobType: string, value: string): Promise<void>;
}

export interface NotificationLogRepository {
  hasBeenSent(
    subscriptionId: string,
    eventHash: string,
    channel: string,
  ): Promise<boolean>;
  markSent(
    subscriptionId: string,
    eventHash: string,
    channel: string,
  ): Promise<void>;
}
