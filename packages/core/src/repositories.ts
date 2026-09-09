// Repository interfaces — domain defines its own contracts (DIP).
// Implementations live in @lexdiff/db; in-memory stubs live there too.

import type { ActMetadata, Unit, ChangeEvent, Subscription } from "./types.js";

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
  findAll(): Promise<Subscription[]>;
  findById(id: string): Promise<Subscription | null>;
  save(sub: {
    actEli: string;
    email: string;
    webhookUrl: string | null;
  }): Promise<Subscription>;
  delete(id: string): Promise<void>;
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
