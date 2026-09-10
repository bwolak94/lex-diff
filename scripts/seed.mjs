// Seed script — fetches real acts from isap.sejm.gov.pl
// Run: DATABASE_URL=... node scripts/seed.mjs

import { EliClient, ActParser, DiffEngine } from "../packages/core/dist/index.js";
import {
  db,
  schema,
  DrizzleActRepository,
  DrizzleUnitRepository,
  DrizzleChangeEventRepository,
} from "../packages/db/dist/index.js";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

const SAMPLE_ELIS = [
  "WDU/2017/2196", // Prawo oświatowe
  "WDU/2022/2651", // Kodeks pracy
  "WDU/2023/1058", // Kodeks karny
];

const client = new EliClient();
const actRepo = new DrizzleActRepository(db);
const unitRepo = new DrizzleUnitRepository(db);
const changeEventRepo = new DrizzleChangeEventRepository(db);
const engine = new DiffEngine();

for (const eli of SAMPLE_ELIS) {
  process.stdout.write(`\n=== ${eli} ===\n`);

  try {
    // 1. Fetch metadata
    process.stdout.write(`Fetching metadata... `);
    const meta = await client.fetchActMetadata(eli);
    if (!meta) { console.log("not found, skip"); continue; }
    console.log(`✓ ${meta.title.slice(0, 60)}`);

    // 2. Save act
    await actRepo.save({
      eli: meta.eli,
      publisher: meta.publisher,
      year: meta.year,
      position: meta.pos,
      title: meta.title,
      type: meta.type ?? "Ustawa",
      status: meta.status ?? "obowiązujący",
      inForce: meta.inForce ?? true,
      announcementDate: meta.announcementDate ?? null,
      entryIntoForce: meta.entryIntoForce ?? null,
      repealDate: meta.repealDate ?? null,
      changeDate: meta.changeDate ?? null,
      textHTML: meta.textHTML ?? false,
      keywords: meta.keywords ?? [],
    });

    // 3. Fetch all versions
    process.stdout.write(`Fetching versions... `);
    const versions = await client.fetchActVersions(eli);
    console.log(`✓ ${versions.length} versions`);

    const versionElis = versions.slice(0, 3); // limit to 3 versions for speed

    let prevUnits = [];
    for (const vEli of versionElis) {
      process.stdout.write(`  Parsing ${vEli}... `);
      try {
        const vMeta = await client.fetchActMetadata(vEli);
        if (!vMeta) { console.log("skip"); continue; }

        // Save version act metadata
        await actRepo.save({
          eli: vMeta.eli,
          publisher: vMeta.publisher,
          year: vMeta.year,
          position: vMeta.pos,
          title: vMeta.title,
          type: vMeta.type ?? "Ustawa",
          status: vMeta.status ?? "obowiązujący",
          inForce: vMeta.inForce ?? true,
          announcementDate: vMeta.announcementDate ?? null,
          entryIntoForce: vMeta.entryIntoForce ?? null,
          repealDate: vMeta.repealDate ?? null,
          changeDate: vMeta.changeDate ?? null,
          textHTML: vMeta.textHTML ?? false,
          keywords: vMeta.keywords ?? [],
        });

        const parser = new ActParser(client);
        const units = await parser.parse(vEli, vMeta.textHTML ?? false);
        if (units.length > 0) {
          await unitRepo.saveAll(vMeta.eli, units);
        }
        console.log(`✓ ${units.length} units`);

        // 4. Generate change events between consecutive versions
        if (prevUnits.length > 0 && units.length > 0) {
          const events = engine.diff(prevUnits, units, {
            actEli: eli,
            effectiveDate: vMeta.entryIntoForce ?? vMeta.announcementDate ?? null,
            isConsolidated: false,
          });
          if (events.length > 0) {
            await changeEventRepo.saveAll(eli, events);
            console.log(`    → ${events.length} change events saved`);
          }
        }

        prevUnits = units;
      } catch (err) {
        console.log(`✗ ${String(err).slice(0, 80)}`);
      }
    }
  } catch (err) {
    console.log(`✗ ${String(err).slice(0, 120)}`);
  }
}

console.log("\n✓ Seed complete.");
process.exit(0);
