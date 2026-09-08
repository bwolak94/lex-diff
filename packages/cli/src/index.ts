#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("lexdiff")
  .description("LexDiff — legal document diff tool")
  .version("0.1.0");

program
  .command("show <eli>")
  .description("Show a legal document by ELI identifier")
  .action((eli: string) => {
    console.log(`show: not implemented (eli=${eli})`);
  });

program
  .command("diff <eli>")
  .description("Diff two versions of a legal document by ELI identifier")
  .action((eli: string) => {
    console.log(`diff: not implemented (eli=${eli})`);
  });

program.parse();
