// In-memory repository implementations for tests (no database required).

import { randomUUID } from "crypto";
import type {
  ActMetadata,
  Unit,
  ChangeEvent,
  Subscription,
  ActReference,
  User,
  ActRepository,
  UnitRepository,
  ChangeEventRepository,
  SubscriptionRepository,
  JobCursorRepository,
  NotificationLogRepository,
  ActReferenceRepository,
  UserRepository,
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
    return Array.from(this._subs.values()).filter(
      (s) => s.actEli === actEli && s.subscriptionType === "act",
    );
  }

  async findByKeyword(keyword: string): Promise<Subscription[]> {
    return Array.from(this._subs.values()).filter(
      (s) => s.keyword === keyword && s.subscriptionType === "keyword",
    );
  }

  async findByPublisher(publisher: string): Promise<Subscription[]> {
    return Array.from(this._subs.values()).filter(
      (s) => s.publisherFilter === publisher && s.subscriptionType === "publisher",
    );
  }

  async findAll(): Promise<Subscription[]> {
    return Array.from(this._subs.values());
  }

  async findByUserId(userId: string): Promise<Subscription[]> {
    return Array.from(this._subs.values()).filter((s) => s.userId === userId);
  }

  async findById(id: string): Promise<Subscription | null> {
    return this._subs.get(id) ?? null;
  }

  async countByUserId(userId: string): Promise<number> {
    return Array.from(this._subs.values()).filter((s) => s.userId === userId).length;
  }

  async save(sub: {
    userId?: string | null;
    subscriptionType?: "act" | "keyword" | "publisher";
    actEli?: string;
    keyword?: string | null;
    publisherFilter?: string | null;
    email: string;
    webhookUrl: string | null;
  }): Promise<Subscription> {
    const type = sub.subscriptionType ?? "act";
    const actEli = sub.actEli ?? "";
    const existing = Array.from(this._subs.values()).find(
      (s) => s.actEli === actEli && s.email === sub.email,
    );
    if (existing) {
      const updated: Subscription = {
        ...existing,
        webhookUrl: sub.webhookUrl,
        keyword: sub.keyword ?? null,
        publisherFilter: sub.publisherFilter ?? null,
      };
      this._subs.set(existing.id, updated);
      return updated;
    }
    const created: Subscription = {
      id: randomUUID(),
      userId: sub.userId ?? null,
      subscriptionType: type,
      actEli,
      keyword: sub.keyword ?? null,
      publisherFilter: sub.publisherFilter ?? null,
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

export class InMemoryActReferenceRepository implements ActReferenceRepository {
  private readonly _refs: ActReference[] = [];

  async findBySourceEli(sourceEli: string): Promise<ActReference[]> {
    return this._refs.filter((r) => r.sourceEli === sourceEli);
  }

  async findByTargetEli(targetEli: string): Promise<ActReference[]> {
    return this._refs.filter((r) => r.targetEli === targetEli);
  }

  async saveAll(refs: Omit<ActReference, "id" | "createdAt">[]): Promise<void> {
    for (const ref of refs) {
      const dup = this._refs.find(
        (r) =>
          r.sourceEli === ref.sourceEli &&
          r.targetEli === ref.targetEli &&
          r.referenceType === ref.referenceType,
      );
      if (!dup) {
        this._refs.push({
          ...ref,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
}

export class InMemoryUserRepository implements UserRepository {
  private readonly _users = new Map<string, User>();

  async findByEmail(email: string): Promise<User | null> {
    return Array.from(this._users.values()).find((u) => u.email === email) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this._users.get(id) ?? null;
  }

  async upsert(email: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) return existing;
    const user: User = {
      id: randomUUID(),
      email,
      plan: "free",
      createdAt: new Date().toISOString(),
    };
    this._users.set(user.id, user);
    return user;
  }

  async updatePlan(id: string, plan: "free" | "pro"): Promise<void> {
    const user = this._users.get(id);
    if (user) this._users.set(id, { ...user, plan });
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
