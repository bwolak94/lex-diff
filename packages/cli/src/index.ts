#!/usr/bin/env node
import { Command } from "commander";
import { Eli, EliClient, ActParser, DiffEngine } from "@lexdiff/core";
import type { ChangeEvent } from "@lexdiff/core";

// ── ANSI colour helpers ───────────────────────────────────────────────────────
const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  red:     "\x1b[31m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  cyan:    "\x1b[36m",
  gray:    "\x1b[90m",
} as const;

const isTTY = process.stdout.isTTY;
const col = (color: string, text: string) =>
  isTTY ? `${color}${text}${C.reset}` : text;

function formatEvent(ev: ChangeEvent): string {
  switch (ev.type) {
    case "UnitAdded":
      return col(C.green, `  + UnitAdded       ${ev.path}`);
    case "UnitRepealed":
      return col(C.red, `  - UnitRepealed    ${ev.path}`);
    case "UnitAmended": {
      const ops = ev.wordDiff
        .filter((op) => op.type !== "equal")
        .map((op) =>
          op.type === "insert"
            ? col(C.green, `+${op.text}`)
            : col(C.red, `-${op.text}`),
        )
        .join(" ");
      return (
        col(C.yellow, `  ~ UnitAmended     ${ev.path}`) +
        (ops ? `\n      ${ops}` : "")
      );
    }
    case "UnitRenumbered":
      return col(C.cyan, `  ↪ UnitRenumbered  ${ev.fromPath} → ${ev.toPath}`);
    case "ActConsolidated":
      return col(C.magenta, `  ● ActConsolidated tjEli=${ev.tjEli}`);
    case "ActRepealed":
      return col(C.red, `  ✕ ActRepealed     by=${ev.by}`);
    case "EntryIntoForceSet":
      return col(C.blue, `  ⏱ EntryIntoForce  ${ev.unitPath} on ${ev.date}`);
  }
}

// ── Program ───────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("lexdiff")
  .description("LexDiff — legal document diff tool")
  .version("0.1.0");

// S1 exit criterion: lexdiff show <eli> outputs a valid JSON tree
program
  .command("show <eli>")
  .description("Show a legal document as a JSON unit tree")
  .action(async (rawEli: string) => {
    const eli = Eli.parse(rawEli);
    const client = new EliClient();
    const parser = new ActParser(client);
    const meta = await client.getAct(eli.toString());
    const units = await parser.parse(eli.toString(), meta.textHTML);
    console.log(JSON.stringify({ eli: eli.toString(), units }, null, 2));
  });

// S2-10 / S2-11: lexdiff diff <eli> with coloured event output
program
  .command("diff <eli>")
  .description("Diff the two most recent versions of a legal document")
  .option("--from <eli>", "ELI of the older version (defaults to latest-1)")
  .option("--to <eli>", "ELI of the newer version (defaults to latest)")
  .option("--json", "output raw JSON instead of coloured text")
  .action(async (rawEli: string, opts: { from?: string; to?: string; json?: boolean }) => {
    const eli = Eli.parse(rawEli);
    const client = new EliClient();
    const parser = new ActParser(client);
    const engine = new DiffEngine();

    // Resolve ELIs for old and new versions
    const oldEli = opts.from ? Eli.parse(opts.from).toString() : eli.toString();
    const newEli = opts.to   ? Eli.parse(opts.to).toString()   : eli.toString();

    if (oldEli === newEli && !opts.from && !opts.to) {
      console.error(
        "Tip: use --from <eli> --to <eli> to diff two different versions.",
      );
    }

    const [oldMeta, newMeta] = await Promise.all([
      client.getAct(oldEli),
      client.getAct(newEli),
    ]);

    const [oldUnits, newUnits] = await Promise.all([
      parser.parse(oldEli, oldMeta.textHTML),
      parser.parse(newEli, newMeta.textHTML),
    ]);

    // S2-5: detect consolidated text by title heuristic
    const isConsolidated =
      /jednolity tekst|obwieszczenie.*jednolity/i.test(newMeta.title) ||
      newMeta.type === "Obwieszczenie";

    const events = engine.diff(oldUnits, newUnits, {
      actEli: newEli,
      effectiveDate: newMeta.entryIntoForce,
      isConsolidated,
      ...(isConsolidated ? { consolidatedEli: newEli } : {}),
    });

    if (opts.json) {
      console.log(JSON.stringify(events, null, 2));
      return;
    }

    // S2-11: coloured output
    if (events.length === 0) {
      console.log(col(C.gray, "No changes detected."));
      return;
    }

    const header = col(
      C.bold,
      `\nDiff: ${oldEli} → ${newEli}   (${events.length} event${events.length === 1 ? "" : "s"})\n`,
    );
    console.log(header);
    for (const ev of events) {
      console.log(formatEvent(ev));
    }
  });

program.parse();
