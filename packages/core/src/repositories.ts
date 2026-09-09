// Repository interfaces — domain defines its own contracts (DIP).
// Implementations live in @lexdiff/db; in-memory stubs live there too.

import type { ActMetadata, Unit, ChangeEvent } from "./types.js";

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
