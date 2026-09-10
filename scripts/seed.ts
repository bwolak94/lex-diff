// Seed script — imports a handful of real Polish acts from isap.sejm.gov.pl
// Usage: DATABASE_URL=... npx tsx scripts/seed.ts

import { EliClient } from "@lexdiff/core";
import { ActParser } from "@lexdiff/core";
import { db, DrizzleActRepository, DrizzleUnitRepository } from "@lexdiff/db";

const SAMPLE_ELIS = [
  "WDU/2017/2196", // Ustawa o systemie oświaty (t.j.)
  "WDU/2020/1842", // Kodeks postępowania cywilnego (t.j.)
  "WDU/2022/1360", // Ustawa Prawo budowlane (t.j.)
  "WDU/2023/1058", // Kodeks karny (t.j.)
  "WDU/2023/1634", // Ustawa o VAT (t.j.)
];

const client = new EliClient();
const parser = new ActParser(client);
const actRepo = new DrizzleActRepository(db);
const unitRepo = new DrizzleUnitRepository(db);

for (const eli of SAMPLE_ELIS) {
  try {
    process.stdout.write(`Fetching ${eli}... `);
    const meta = await client.fetchActMetadata(eli);
    if (!meta) { console.log("not found, skipping"); continue; }

    const units = await parser.parse(eli, meta.textHTML ?? false);
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
    if (units.length > 0) {
      await unitRepo.saveAll(meta.eli, units);
    }
    console.log(`✓ ${meta.title.slice(0, 60)} (${units.length} units)`);
  } catch (err) {
    console.log(`✗ ${String(err)}`);
  }
}

console.log("\nDone. Restart the app and try searching.");
process.exit(0);
