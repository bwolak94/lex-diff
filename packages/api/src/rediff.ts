// Re-run DiffEngine for all seeded version pairs after unit texts are fetched.
// Clears existing change events for affected acts and replaces them with new
// events that include real before/after text and UnitAmended word diffs.
//
// Run: DATABASE_URL=... node dist/rediff.js

import { DiffEngine } from "@lexdiff/core";
import {
  db,
  schema,
  eq,
  DrizzleUnitRepository,
  DrizzleChangeEventRepository,
} from "@lexdiff/db";

// Version pairs in the same order as seed.ts
// (baseEli = canonical act ELI, newerEli = second version)
const PAIRS: Array<{ baseEli: string; newerEli: string; effectiveDate: string | null }> = [
  {
    baseEli: "DU/2022/1510",
    newerEli: "DU/2023/1465",
    effectiveDate: "2023-07-31",
  },
  {
    baseEli: "DU/2022/1138",
    newerEli: "DU/2024/17",
    effectiveDate: "2024-01-03",
  },
  {
    baseEli: "DU/2021/1805",
    newerEli: "DU/2023/1550",
    effectiveDate: "2023-08-08",
  },
];

const unitRepo = new DrizzleUnitRepository(db);
const changeEventRepo = new DrizzleChangeEventRepository(db);
const engine = new DiffEngine();

for (const { baseEli, newerEli, effectiveDate } of PAIRS) {
  process.stdout.write(`\n${baseEli} → ${newerEli}\n`);

  // Load both unit sets from DB
  const [oldUnits, newUnits] = await Promise.all([
    unitRepo.findByActEli(baseEli),
    unitRepo.findByActEli(newerEli),
  ]);

  const withText = (units: typeof oldUnits) =>
    units.filter((u) => u.text !== null).length;

  process.stdout.write(
    `  old: ${oldUnits.length} units (${withText(oldUnits)} with text)\n`,
  );
  process.stdout.write(
    `  new: ${newUnits.length} units (${withText(newUnits)} with text)\n`,
  );

  // Clear existing events for this act
  await db
    .delete(schema.changeEvents)
    .where(eq(schema.changeEvents.actEli, baseEli));
  process.stdout.write(`  Cleared existing events\n`);

  // Re-run diff
  const events = engine.diff(oldUnits, newUnits, {
    actEli: baseEli,
    effectiveDate,
    isConsolidated: false,
  });

  const amended = events.filter((e) => e.type === "UnitAmended").length;
  const added = events.filter((e) => e.type === "UnitAdded").length;
  const repealed = events.filter((e) => e.type === "UnitRepealed").length;
  const renumbered = events.filter((e) => e.type === "UnitRenumbered").length;

  process.stdout.write(
    `  Events: ${events.length} total — ${amended} amended, ${added} added, ${repealed} repealed, ${renumbered} renumbered\n`,
  );

  if (events.length > 0) {
    await changeEventRepo.saveAll(baseEli, events);
    process.stdout.write(`  Saved ${events.length} events\n`);
  }
}

process.exit(0);
