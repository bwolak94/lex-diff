#!/usr/bin/env node
import { Command } from "commander";
import { Eli, EliClient, ActParser } from "@lexdiff/core";

const program = new Command();

program
  .name("lexdiff")
  .description("LexDiff — legal document diff tool")
  .version("0.1.0");

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

program
  .command("diff <eli>")
  .description("Diff two versions of a legal document by ELI identifier")
  .action((eli: string) => {
    console.log(`diff: not implemented (eli=${eli})`);
  });

program.parse();
