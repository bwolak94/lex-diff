// S6-1: Must be imported first — initialises OTel SDK before any other module.
import "./telemetry.js";

import { buildApp } from "./index.js";
import {
  db,
  DrizzleActRepository,
  DrizzleUnitRepository,
  DrizzleChangeEventRepository,
  DrizzleSubscriptionRepository,
  DrizzleJobCursorRepository,
  DrizzleNotificationLogRepository,
} from "@lexdiff/db";
import { EmailChannel } from "./channels/email.js";
import { WebhookChannel } from "./channels/webhook.js";
import { Notifier } from "./notifier.js";
import { getBoss } from "./jobs/boss.js";
import { Scheduler } from "./jobs/scheduler.js";

const port = parseInt(process.env["PORT"] ?? "3001", 10);
const host = process.env["HOST"] ?? "0.0.0.0";
const databaseUrl = process.env["DATABASE_URL"] ?? "";
const resendApiKey = process.env["RESEND_API_KEY"] ?? "";

const subscriptionRepo = new DrizzleSubscriptionRepository(db);
const changeEventRepo = new DrizzleChangeEventRepository(db);
const jobCursorRepo = new DrizzleJobCursorRepository(db);
const notificationLogRepo = new DrizzleNotificationLogRepository(db);

const app = buildApp({
  acts: new DrizzleActRepository(db),
  units: new DrizzleUnitRepository(db),
  changeEvents: changeEventRepo,
  subscriptions: subscriptionRepo,
});

try {
  await app.listen({ port, host });
  app.log.info(`LexDiff API listening on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Start job scheduler if database is available (S5-2)
if (databaseUrl && resendApiKey) {
  try {
    const boss = await getBoss(databaseUrl);
    const emailChannel = new EmailChannel(resendApiKey);
    const webhookChannel = new WebhookChannel();
    const notifier = new Notifier(
      subscriptionRepo,
      notificationLogRepo,
      emailChannel,
      webhookChannel,
    );
    const scheduler = new Scheduler(boss, {
      subscriptions: subscriptionRepo,
      changeEvents: changeEventRepo,
      jobCursors: jobCursorRepo,
    }, notifier);
    await scheduler.start();
    app.log.info("Scheduler started");
  } catch (err) {
    app.log.warn({ err }, "Scheduler failed to start — running without job queue");
  }
}
