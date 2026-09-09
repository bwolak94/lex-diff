import { buildApp } from "./index.js";
import {
  db,
  DrizzleActRepository,
  DrizzleUnitRepository,
  DrizzleChangeEventRepository,
} from "@lexdiff/db";

const port = parseInt(process.env["PORT"] ?? "3001", 10);
const host = process.env["HOST"] ?? "0.0.0.0";

const app = buildApp({
  acts: new DrizzleActRepository(db),
  units: new DrizzleUnitRepository(db),
  changeEvents: new DrizzleChangeEventRepository(db),
});

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
