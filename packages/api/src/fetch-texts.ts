// Fetch and store unit texts for seeded version pairs.
// Texts were null because the original seed's Promise.all bypassed the rate
// limiter. This script fetches sequentially and updates the units table.
//
// Run: DATABASE_URL=... node dist/fetch-texts.js [versionEli]
// Without argument: fetches texts for all seeded version ELIs.

import { EliClient, TextNormalizer } from "@lexdiff/core";
import { db, sql } from "@lexdiff/db";

const VERSION_ELIS = [
  "DU/2022/1510",
  "DU/2023/1465",
  "DU/2022/1138",
  "DU/2024/17",
  "DU/2021/1805",
  "DU/2023/1550",
];

const targetEli = process.argv[2];
const targets = targetEli ? [targetEli] : VERSION_ELIS;

// 5 req/s — respects isap.sejm.gov.pl rate limits (rate limiter is now queue-safe)
const client = new EliClient({ requestsPerSecond: 5 });
const normalizer = new TextNormalizer();

for (const versionEli of targets) {
  process.stdout.write(`\n=== ${versionEli} ===\n`);

  const result = await db.execute(sql`
    SELECT path FROM units
    WHERE act_version_eli = ${versionEli}
      AND text IS NULL
      AND path NOT IN (
        SELECT DISTINCT parent_path FROM units
        WHERE parent_path IS NOT NULL AND act_version_eli = ${versionEli}
      )
    ORDER BY path
  `);

  const rows = result.rows as { path: string }[];
  process.stdout.write(`  ${rows.length} leaf units with null text\n`);

  let fetched = 0;
  let skipped = 0;
  let errors = 0;

  for (const { path } of rows) {
    try {
      const html = await client.getUnitText(versionEli, path);
      if (html) {
        const normalized = normalizer.normalize(html);
        const hash = normalizer.hash(html);
        await db.execute(sql`
          UPDATE units
          SET text = ${normalized}, text_hash = ${hash}
          WHERE act_version_eli = ${versionEli} AND path = ${path}
        `);
        fetched++;
      } else {
        skipped++;
      }
    } catch (err) {
      errors++;
      process.stderr.write(`  ERR ${path}: ${String(err).slice(0, 100)}\n`);
    }

    const done = fetched + skipped + errors;
    if (done % 100 === 0) {
      process.stdout.write(`  ${done}/${rows.length} (${fetched} texts, ${skipped} empty, ${errors} errors)\n`);
    }
  }

  process.stdout.write(
    `  Done: ${fetched} texts saved, ${skipped} empty, ${errors} errors\n`,
  );
}

process.exit(0);
