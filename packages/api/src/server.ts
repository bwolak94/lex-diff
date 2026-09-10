// S6-1: Must be imported first — initialises OTel SDK before any other module.
import "./telemetry.js";

import { buildApp } from "./index.js";
import {
  db,
  schema,
  eq,
  DrizzleActRepository,
  DrizzleUnitRepository,
  DrizzleChangeEventRepository,
  DrizzleSubscriptionRepository,
  DrizzleJobCursorRepository,
  DrizzleNotificationLogRepository,
  DrizzleActReferenceRepository,
  DrizzleUserRepository,
} from "@lexdiff/db";
import { EliClient, ActParser } from "@lexdiff/core";
import { EmailChannel } from "./channels/email.js";
import { WebhookChannel } from "./channels/webhook.js";
import { Notifier } from "./notifier.js";
import { getBoss } from "./jobs/boss.js";
import { Scheduler } from "./jobs/scheduler.js";
import { ActSyncService } from "./syncService.js";
import { AuthService } from "./auth.js";
import { BillingService } from "./billing.js";
import { Resend } from "resend";

const port = parseInt(process.env["PORT"] ?? "3001", 10);
const host = process.env["HOST"] ?? "0.0.0.0";
const databaseUrl = process.env["DATABASE_URL"] ?? "";
const resendApiKey = process.env["RESEND_API_KEY"] ?? "";
const stripeSecretKey = process.env["STRIPE_SECRET_KEY"] ?? "";
const stripeWebhookSecret = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";
const stripeProPriceId = process.env["STRIPE_PRO_PRICE_ID"] ?? "";
const appBaseUrl = process.env["APP_BASE_URL"] ?? "http://localhost:3000";

// ── ELI client + parser (shared singleton) ────────────────────────────────────

const eliClient = new EliClient();
const actParser = new ActParser(eliClient);

// ── Repositories ──────────────────────────────────────────────────────────────

const actRepo = new DrizzleActRepository(db);
const unitRepo = new DrizzleUnitRepository(db);
const subscriptionRepo = new DrizzleSubscriptionRepository(db);
const changeEventRepo = new DrizzleChangeEventRepository(db);
const jobCursorRepo = new DrizzleJobCursorRepository(db);
const notificationLogRepo = new DrizzleNotificationLogRepository(db);
const referenceRepo = new DrizzleActReferenceRepository(db);
const userRepo = new DrizzleUserRepository(db);

// ── App ───────────────────────────────────────────────────────────────────────

const app = buildApp({
  acts: actRepo,
  units: unitRepo,
  changeEvents: changeEventRepo,
  subscriptions: subscriptionRepo,
  references: referenceRepo,
  users: userRepo,
});

// ── Auth + Billing routes (require Resend + Stripe) ───────────────────────────

if (resendApiKey) {
  const resend = new Resend(resendApiKey);
  const authService = new AuthService(
    {
      upsertUser: async (email) => userRepo.upsert(email),
      createMagicToken: async (userId, token, expiresAt) => {
        await db.insert(schema.magicLinkTokens).values({ userId, token, expiresAt });
      },
      findMagicToken: async (token) => {
        const [row] = await db
          .select()
          .from(schema.magicLinkTokens)
          .where(eq(schema.magicLinkTokens.token, token))
          .limit(1);
        if (!row) return null;
        return { userId: row.userId, expiresAt: row.expiresAt, usedAt: row.usedAt };
      },
      markMagicTokenUsed: async (token) => {
        await db
          .update(schema.magicLinkTokens)
          .set({ usedAt: new Date() })
          .where(eq(schema.magicLinkTokens.token, token));
      },
      createSession: async (userId, token, expiresAt) => {
        await db.insert(schema.sessions).values({ userId, token, expiresAt });
      },
      findSession: async (token) => {
        const [row] = await db
          .select()
          .from(schema.sessions)
          .where(eq(schema.sessions.token, token))
          .limit(1);
        if (!row) return null;
        return { userId: row.userId, expiresAt: row.expiresAt };
      },
      deleteSession: async (token) => {
        await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
      },
    },
    resend,
    "noreply@lexdiff.pl",
    appBaseUrl,
  );

  // Auth middleware — attaches lexdiffUserId to request if valid Bearer token
  app.addHook("onRequest", async (req) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return;
    const session = await authService.getSession(token);
    if (session) {
      (req as unknown as { lexdiffUserId: string }).lexdiffUserId = session.userId;
    }
  });

  // POST /auth/magic-link
  app.post<{ Body: { email: string } }>(
    "/auth/magic-link",
    {
      schema: {
        body: { type: "object", properties: { email: { type: "string" } }, required: ["email"] },
      },
    },
    async (req, rep) => {
      await authService.sendMagicLink(req.body.email);
      return rep.code(202).send({ message: "Magic link sent" });
    },
  );

  // GET /auth/verify?token=
  app.get<{ Querystring: { token: string } }>("/auth/verify", async (req, rep) => {
    const result = await authService.verifyMagicLink(req.query.token);
    if (!result) return rep.code(401).send({ error: "Invalid or expired token" });
    return { sessionToken: result.sessionToken };
  });

  // DELETE /auth/session
  app.delete("/auth/session", async (req, rep) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) await authService.logout(token);
    return rep.code(204).send();
  });
}

if (stripeSecretKey && stripeWebhookSecret) {
  const billingService = new BillingService(
    stripeSecretKey,
    {
      findUserById: async (id) => userRepo.findById(id),
      updateUserPlan: async (id, plan) => userRepo.updatePlan(id, plan),
    },
    appBaseUrl,
    stripeProPriceId,
    stripeWebhookSecret,
  );

  // POST /billing/checkout
  app.post<{ Body: { userId: string; email: string } }>(
    "/billing/checkout",
    async (req, rep) => {
      const { url } = await billingService.createCheckoutSession(
        req.body.userId,
        req.body.email,
      );
      return rep.redirect(url);
    },
  );

  // POST /billing/webhook (raw body required for Stripe signature verification)
  app.post(
    "/billing/webhook",
    { config: { rawBody: true } },
    async (req, rep) => {
      const sig = req.headers["stripe-signature"] as string;
      try {
        await billingService.handleWebhook(
          (req as unknown as { rawBody: Buffer }).rawBody,
          sig,
        );
        return rep.code(200).send({ received: true });
      } catch (err) {
        return rep.code(400).send({ error: String(err) });
      }
    },
  );
}

// ── POST /admin/sync-all — trigger immediate sync of all seeded acts ──────────

app.post("/admin/sync-all", async (_req, rep) => {
  const syncService = new ActSyncService(eliClient, actParser, actRepo, unitRepo, changeEventRepo);
  const acts = await actRepo.search({});
  const results: Array<{ eli: string; newEvents: number; error?: string }> = [];
  for (const act of acts) {
    try {
      const r = await syncService.syncAct(act.eli);
      results.push({ eli: act.eli, newEvents: r.newEvents });
    } catch (err) {
      results.push({ eli: act.eli, newEvents: 0, error: String(err).slice(0, 120) });
    }
  }
  return rep.send({ synced: results.length, results });
});


// ── Start server ──────────────────────────────────────────────────────────────

try {
  await app.listen({ port, host });
  app.log.info(`LexDiff API listening on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// ── Start job scheduler ───────────────────────────────────────────────────────

if (databaseUrl) {
  try {
    const boss = await getBoss(databaseUrl);
    const syncService = new ActSyncService(
      eliClient,
      actParser,
      actRepo,
      unitRepo,
      changeEventRepo,
    );
    const emailChannel = resendApiKey ? new EmailChannel(resendApiKey) : null;
    const webhookChannel = new WebhookChannel();
    const notifier = new Notifier(
      subscriptionRepo,
      notificationLogRepo,
      emailChannel ?? new EmailChannel(""),
      webhookChannel,
    );
    const scheduler = new Scheduler(
      boss,
      {
        subscriptions: subscriptionRepo,
        changeEvents: changeEventRepo,
        jobCursors: jobCursorRepo,
        acts: actRepo,
      },
      notifier,
      syncService,
    );
    await scheduler.start();
    app.log.info("Scheduler started — hourly poll registered");
  } catch (err) {
    app.log.warn({ err }, "Scheduler failed to start — running without job queue");
  }
}
