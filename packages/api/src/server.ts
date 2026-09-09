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
  DrizzleActReferenceRepository,
  DrizzleUserRepository,
} from "@lexdiff/db";
import { EmailChannel } from "./channels/email.js";
import { WebhookChannel } from "./channels/webhook.js";
import { Notifier } from "./notifier.js";
import { getBoss } from "./jobs/boss.js";
import { Scheduler } from "./jobs/scheduler.js";
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

// ── Repositories ──────────────────────────────────────────────────────────────

const subscriptionRepo = new DrizzleSubscriptionRepository(db);
const changeEventRepo = new DrizzleChangeEventRepository(db);
const jobCursorRepo = new DrizzleJobCursorRepository(db);
const notificationLogRepo = new DrizzleNotificationLogRepository(db);
const referenceRepo = new DrizzleActReferenceRepository(db);
const userRepo = new DrizzleUserRepository(db);

// ── App ───────────────────────────────────────────────────────────────────────

const app = buildApp({
  acts: new DrizzleActRepository(db),
  units: new DrizzleUnitRepository(db),
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
        await db.insert(
          (await import("@lexdiff/db")).schema.magicLinkTokens,
        ).values({ userId, token, expiresAt });
      },
      findMagicToken: async (token) => {
        const { schema } = await import("@lexdiff/db");
        const { eq } = await import("drizzle-orm");
        const [row] = await db
          .select()
          .from(schema.magicLinkTokens)
          .where(eq(schema.magicLinkTokens.token, token))
          .limit(1);
        if (!row) return null;
        return { userId: row.userId, expiresAt: row.expiresAt, usedAt: row.usedAt };
      },
      markMagicTokenUsed: async (token) => {
        const { schema } = await import("@lexdiff/db");
        const { eq } = await import("drizzle-orm");
        await db
          .update(schema.magicLinkTokens)
          .set({ usedAt: new Date() })
          .where(eq(schema.magicLinkTokens.token, token));
      },
      createSession: async (userId, token, expiresAt) => {
        const { schema } = await import("@lexdiff/db");
        await db.insert(schema.sessions).values({ userId, token, expiresAt });
      },
      findSession: async (token) => {
        const { schema } = await import("@lexdiff/db");
        const { eq } = await import("drizzle-orm");
        const [row] = await db
          .select()
          .from(schema.sessions)
          .where(eq(schema.sessions.token, token))
          .limit(1);
        if (!row) return null;
        return { userId: row.userId, expiresAt: row.expiresAt };
      },
      deleteSession: async (token) => {
        const { schema } = await import("@lexdiff/db");
        const { eq } = await import("drizzle-orm");
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

// ── Start server ──────────────────────────────────────────────────────────────

try {
  await app.listen({ port, host });
  app.log.info(`LexDiff API listening on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// ── Start job scheduler ───────────────────────────────────────────────────────

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
    const scheduler = new Scheduler(
      boss,
      { subscriptions: subscriptionRepo, changeEvents: changeEventRepo, jobCursors: jobCursorRepo },
      notifier,
    );
    await scheduler.start();
    app.log.info("Scheduler started");
  } catch (err) {
    app.log.warn({ err }, "Scheduler failed to start — running without job queue");
  }
}
