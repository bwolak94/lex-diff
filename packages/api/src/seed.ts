// Seed: fetches real acts + units from isap.sejm.gov.pl, creates version pairs,
// and runs DiffEngine to produce real change events stored in the DB.
// Run after build: DATABASE_URL=... node dist/seed.js

import { EliClient, ActParser, DiffEngine } from "@lexdiff/core";
import {
  db,
  schema,
  DrizzleActRepository,
  DrizzleUnitRepository,
  DrizzleChangeEventRepository,
} from "@lexdiff/db";

// ── Version pairs ─────────────────────────────────────────────────────────────
// Each pair: baseEli = canonical act / older consolidated text,
//            newerEli = newer consolidated text of the same law.
// The diff between baseEli units and newerEli units produces real change events.

interface ActPair {
  baseEli: string;
  newerEli?: string;
}

const ACT_PAIRS: ActPair[] = [
  // Prawo oświatowe
  { baseEli: "DU/2017/2196" },
  // Kodeks pracy: 2022 → 2023 consolidated text
  { baseEli: "DU/2022/1510", newerEli: "DU/2023/1465" },
  // Kodeks karny: 2022 → 2024 consolidated text
  { baseEli: "DU/2022/1138", newerEli: "DU/2024/17" },
  // Kodeks postępowania cywilnego: 2021 → 2023 consolidated text
  { baseEli: "DU/2021/1805", newerEli: "DU/2023/1550" },
  // Prawo budowlane
  { baseEli: "DU/2023/682" },
];

// ── Setup ─────────────────────────────────────────────────────────────────────

// Slower rate for long sessions with many struct + text fetches
const client = new EliClient({ requestsPerSecond: 5 });
const parser = new ActParser(client);
const actRepo = new DrizzleActRepository(db);
const unitRepo = new DrizzleUnitRepository(db);
const changeEventRepo = new DrizzleChangeEventRepository(db);
const engine = new DiffEngine();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ensureActVersion(
  actEli: string,
  versionEli: string,
  publishedAt: string | null,
): Promise<void> {
  await db
    .insert(schema.actVersions)
    .values({ actEli, eli: versionEli, versionKind: "OGL", publishedAt })
    .onConflictDoNothing();
}

// ── Main seed loop ────────────────────────────────────────────────────────────

for (const { baseEli, newerEli } of ACT_PAIRS) {
  process.stdout.write(`\n${baseEli}... `);
  try {
    // 1. Fetch base act metadata + save
    const meta = await client.getAct(baseEli);
    await actRepo.save({
      eli: meta.eli,
      publisher: meta.publisher,
      year: meta.year,
      position: meta.position,
      title: meta.title,
      type: meta.type,
      status: meta.status,
      inForce: meta.inForce,
      announcementDate: meta.announcementDate,
      entryIntoForce: meta.entryIntoForce,
      repealDate: meta.repealDate,
      changeDate: meta.changeDate,
      textHTML: meta.textHTML,
      keywords: meta.keywords,
    });

    // 2. Ensure actVersion row for base ELI
    await ensureActVersion(meta.eli, meta.eli, meta.announcementDate ?? null);

    // 3. Parse + save base units
    process.stdout.write(`struct... `);
    const baseUnits = await parser.parse(baseEli, meta.textHTML);
    await unitRepo.saveAll(baseEli, baseUnits);
    process.stdout.write(`${baseUnits.length} units`);

    // 4. If there's a newer version, seed it and diff
    if (newerEli) {
      process.stdout.write(` | ${newerEli}... `);

      const newerMeta = await client.getAct(newerEli);

      // Ensure actVersion row for newer ELI (actEli = canonical base)
      await ensureActVersion(
        baseEli,
        newerEli,
        newerMeta.announcementDate ?? null,
      );

      // Parse + save newer version units
      process.stdout.write(`struct... `);
      const newerUnits = await parser.parse(newerEli, newerMeta.textHTML);
      await unitRepo.saveAll(newerEli, newerUnits);
      process.stdout.write(`${newerUnits.length} units | diff... `);

      // Run DiffEngine and save change events
      const events = engine.diff(baseUnits, newerUnits, {
        actEli: baseEli,
        effectiveDate: newerMeta.announcementDate ?? newerMeta.changeDate,
        isConsolidated: false,
      });
      if (events.length > 0) {
        await changeEventRepo.saveAll(baseEli, events);
      }
      process.stdout.write(`${events.length} events`);
    }

    console.log(` — ${meta.title.slice(0, 55)}`);
  } catch (err) {
    console.log(`\n  ERR: ${String(err).slice(0, 150)}`);
  }
}

console.log("\nDone.");
process.exit(0);
