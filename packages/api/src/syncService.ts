// ActSyncService: fetches latest act data from ELI API, diffs against stored
// version, and persists change events. Used by the cron scheduler.

import { EliClient, ActParser, DiffEngine } from "@lexdiff/core";
import type {
  ActRepository,
  UnitRepository,
  ChangeEventRepository,
} from "@lexdiff/core";
import { db, schema } from "@lexdiff/db";

const engine = new DiffEngine();

export class ActSyncService {
  constructor(
    private readonly client: EliClient,
    private readonly parser: ActParser,
    private readonly actRepo: ActRepository,
    private readonly unitRepo: UnitRepository,
    private readonly changeEventRepo: ChangeEventRepository,
  ) {}

  /**
   * Syncs one act:
   * 1. Fetches latest metadata from ELI API.
   * 2. If changeDate unchanged and a version already exists → skip.
   * 3. Otherwise: parse units, create new actVersion, save units.
   * 4. If a previous version exists → run DiffEngine and save change events.
   */
  async syncAct(eli: string): Promise<{ newEvents: number }> {
    const meta = await this.client.getAct(eli);
    const existing = await this.actRepo.findByEli(eli);
    const versionElis = await this.actRepo.listVersionElis(eli);

    // Nothing changed since last sync — skip expensive parse
    if (
      existing &&
      existing.changeDate === meta.changeDate &&
      versionElis.length > 0
    ) {
      return { newEvents: 0 };
    }

    // Persist updated metadata
    await this.actRepo.save(meta);

    // First-time: version ELI = act ELI (mirrors what the seed does).
    // On subsequent updates: append @changeDate to create a new snapshot ELI.
    const isFirstSync = versionElis.length === 0;
    const newVersionEli = isFirstSync
      ? eli
      : `${eli}@${meta.changeDate ?? String(Date.now())}`;

    await db
      .insert(schema.actVersions)
      .values({
        actEli: eli,
        eli: newVersionEli,
        versionKind: "OGL",
        publishedAt: meta.announcementDate ?? null,
      })
      .onConflictDoNothing();

    // Parse structural units (+ text if available via textHTML)
    const newUnits = await this.parser.parse(eli, meta.textHTML);
    await this.unitRepo.saveAll(newVersionEli, newUnits);

    // Diff against the immediately preceding version
    if (!isFirstSync) {
      const prevVersionEli = versionElis[versionElis.length - 1]!;
      const oldUnits = await this.unitRepo.findByActEli(prevVersionEli);
      const events = engine.diff(oldUnits, newUnits, {
        actEli: eli,
        effectiveDate: meta.changeDate,
        isConsolidated: false,
      });
      if (events.length > 0) {
        await this.changeEventRepo.saveAll(eli, events);
      }
      return { newEvents: events.length };
    }

    return { newEvents: 0 };
  }
}
