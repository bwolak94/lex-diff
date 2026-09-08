// In-memory repository implementations for tests (no database required).

import type {
  ActMetadata,
  Unit,
  ChangeEvent,
  ActRepository,
  UnitRepository,
  ChangeEventRepository,
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
