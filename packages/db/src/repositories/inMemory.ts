// In-memory repository implementations for tests (no database required).

import { randomUUID } from "crypto";
import type {
  ActMetadata,
  Unit,
  ChangeEvent,
  Subscription,
  ActRepository,
  UnitRepository,
  ChangeEventRepository,
  SubscriptionRepository,
  JobCursorRepository,
  NotificationLogRepository,
} from "@lexdiff/core";

export class InMemoryActRepository implements ActRepository {
  private readonly _acts = new Map<string, ActMetadata>();

  async findByEli(eli: string): Promise<ActMetadata | null> {
    return this._acts.get(eli) ?? null;
  }

  async listVersionElis(eli: string): Promise<string[]> {
    // Simplified: treat the act's own ELI as its sole version.
    return this._acts.has(eli) ? [eli] : [];
  }

  async save(meta: ActMetadata): Promise<void> {
    this._acts.set(meta.eli, meta);
  }

  async search(q: {
    q?: string;
    keyword?: string;
    type?: string;
  }): Promise<ActMetadata[]> {
    let results = Array.from(this._acts.values());

    if (q.q) {
      const lower = q.q.toLowerCase();
      results = results.filter((a) => a.title.toLowerCase().includes(lower));
    }
    if (q.keyword) {
      results = results.filter((a) => a.keywords.includes(q.keyword!));
    }
    if (q.type) {
      results = results.filter((a) => a.type === q.type);
    }

    return results;
  }
}

export class InMemoryUnitRepository implements UnitRepository {
  private readonly _units = new Map<string, Unit[]>();

  async findByActEli(eli: string): Promise<Unit[]> {
    return this._units.get(eli) ?? [];
  }

  async saveAll(eli: string, units: Unit[]): Promise<void> {
    this._units.set(eli, units);
  }
}

export class InMemoryChangeEventRepository implements ChangeEventRepository {
  private readonly _events = new Map<string, Map<string, ChangeEvent>>();

  async findByActEli(actEli: string): Promise<ChangeEvent[]> {
    const byHash = this._events.get(actEli);
    return byHash ? Array.from(byHash.values()) : [];
  }

  async saveAll(events: ChangeEvent[]): Promise<void> {
    for (const ev of events) {
      const actEli = this._resolveActEli(ev);
      if (!this._events.has(actEli)) {
        this._events.set(actEli, new Map());
      }
      this._events.get(actEli)!.set(ev.eventHash, ev);
    }
  }

  private _resolveActEli(ev: ChangeEvent): string {
    if ("path" in ev) return ev.path.split("/")[0] ?? "";
    if ("fromPath" in ev) return ev.fromPath.split("/")[0] ?? "";
    if ("tjEli" in ev) return ev.tjEli;
    if ("by" in ev) return ev.by;
    if ("unitPath" in ev) return ev.unitPath.split("/")[0] ?? "";
    return "";
  }
}

export class InMemorySubscriptionRepository
  implements SubscriptionRepository
{
  private readonly _subs = new Map<string, Subscription>();

  async findByActEli(actEli: string): Promise<Subscription[]> {
    return Array.from(this._subs.values()).filter((s) => s.actEli === actEli);
  }

  async findAll(): Promise<Subscription[]> {
    return Array.from(this._subs.values());
  }

  async findById(id: string): Promise<Subscription | null> {
    return this._subs.get(id) ?? null;
  }

  async save(sub: {
    actEli: string;
    email: string;
    webhookUrl: string | null;
  }): Promise<Subscription> {
    // upsert on (actEli, email)
    const existing = Array.from(this._subs.values()).find(
      (s) => s.actEli === sub.actEli && s.email === sub.email,
    );
    if (existing) {
      const updated: Subscription = { ...existing, webhookUrl: sub.webhookUrl };
      this._subs.set(existing.id, updated);
      return updated;
    }
    const created: Subscription = {
      id: randomUUID(),
      actEli: sub.actEli,
      email: sub.email,
      webhookUrl: sub.webhookUrl,
      createdAt: new Date().toISOString(),
    };
    this._subs.set(created.id, created);
    return created;
  }

  async delete(id: string): Promise<void> {
    this._subs.delete(id);
  }
}

export class InMemoryJobCursorRepository implements JobCursorRepository {
  private readonly _cursors = new Map<string, string>();

  async getCursor(jobType: string): Promise<string | null> {
    return this._cursors.get(jobType) ?? null;
  }

  async setCursor(jobType: string, value: string): Promise<void> {
    this._cursors.set(jobType, value);
  }
}

export class InMemoryNotificationLogRepository
  implements NotificationLogRepository
{
  private readonly _log = new Set<string>();

  private _key(subscriptionId: string, eventHash: string, channel: string) {
    return `${subscriptionId}::${eventHash}::${channel}`;
  }

  async hasBeenSent(
    subscriptionId: string,
    eventHash: string,
    channel: string,
  ): Promise<boolean> {
    return this._log.has(this._key(subscriptionId, eventHash, channel));
  }

  async markSent(
    subscriptionId: string,
    eventHash: string,
    channel: string,
  ): Promise<void> {
    this._log.add(this._key(subscriptionId, eventHash, channel));
  }
}
