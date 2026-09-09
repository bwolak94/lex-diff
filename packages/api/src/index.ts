import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { registry } from "./metrics.js";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { DiffEngine } from "@lexdiff/core";
import type {
  ActRepository,
  UnitRepository,
  ChangeEventRepository,
  SubscriptionRepository,
} from "@lexdiff/core";

// ── Zod schemas for API responses ─────────────────────────────────────────────

const ActMetadataSchema = z.object({
  eli: z.string(),
  publisher: z.string(),
  year: z.number(),
  position: z.number(),
  title: z.string(),
  type: z.string(),
  status: z.string(),
  inForce: z.boolean(),
  announcementDate: z.string().nullable(),
  entryIntoForce: z.string().nullable(),
  repealDate: z.string().nullable(),
  changeDate: z.string().nullable(),
  textHTML: z.boolean(),
  keywords: z.array(z.string()),
});

const ChangeEventSchema = z
  .object({
    eventHash: z.string(),
    severity: z.enum(["critical", "high", "medium", "low"]),
    effectiveDate: z.string().nullable(),
    type: z.enum([
      "UnitAdded",
      "UnitRepealed",
      "UnitAmended",
      "UnitRenumbered",
      "ActRepealed",
      "ActConsolidated",
      "EntryIntoForceSet",
    ]),
  })
  .catchall(z.unknown());

const EliParamSchema = z.object({
  eli: z.string().min(1),
});

const DiffQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

const SearchQuerySchema = z.object({
  q: z.string().optional(),
  keyword: z.string().optional(),
  type: z.string().optional(),
});

const ErrorSchema = z.object({ error: z.string() });

// ── App factory ───────────────────────────────────────────────────────────────

const SubscriptionSchema = z.object({
  id: z.string(),
  actEli: z.string(),
  email: z.string(),
  webhookUrl: z.string().nullable(),
  createdAt: z.string(),
});

const CreateSubscriptionBodySchema = z.object({
  actEli: z.string().min(1),
  email: z.string().email(),
  webhookUrl: z.string().url().nullable().optional(),
});

const SubscriptionIdParamSchema = z.object({
  id: z.string().uuid(),
});

export interface AppRepositories {
  acts: ActRepository;
  units: UnitRepository;
  changeEvents: ChangeEventRepository;
  subscriptions: SubscriptionRepository;
}

export function buildApp(repos: AppRepositories) {
  const app = Fastify({ logger: false });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register swagger before routes
  void app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "LexDiff API",
        version: "0.1.0",
        description: "Legal document diff and search API",
      },
    },
    transform: jsonSchemaTransform,
  });

  void app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
  });

  const engine = new DiffEngine();
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /health ──────────────────────────────────────────────────────────────
  typed.get(
    "/health",
    {
      schema: {
        response: { 200: z.object({ status: z.string() }) },
      },
    },
    async () => ({ status: "ok" }),
  );

  // ── GET /metrics (S6-6) — Prometheus scrape endpoint ─────────────────────────
  app.get("/metrics", async (_req, rep) => {
    rep.header("Content-Type", registry.contentType);
    return rep.send(await registry.metrics());
  });

  // ── GET /acts/search  (must precede /acts/:eli) ──────────────────────────────
  typed.get(
    "/acts/search",
    {
      schema: {
        querystring: SearchQuerySchema,
        response: {
          200: z.array(ActMetadataSchema),
        },
      },
    },
    async (req) => {
      return repos.acts.search({
        ...(req.query.q !== undefined ? { q: req.query.q } : {}),
        ...(req.query.keyword !== undefined ? { keyword: req.query.keyword } : {}),
        ...(req.query.type !== undefined ? { type: req.query.type } : {}),
      });
    },
  );

  // ── GET /acts/:eli ────────────────────────────────────────────────────────────
  typed.get(
    "/acts/:eli",
    {
      schema: {
        params: EliParamSchema,
        response: {
          200: ActMetadataSchema,
          404: ErrorSchema,
        },
      },
    },
    async (req, rep) => {
      const internalEli = req.params.eli.replace(/:/g, "/");
      const meta = await repos.acts.findByEli(internalEli);
      if (!meta) return rep.code(404).send({ error: "Act not found" });
      return meta;
    },
  );

  // ── GET /acts/:eli/versions ───────────────────────────────────────────────────
  typed.get(
    "/acts/:eli/versions",
    {
      schema: {
        params: EliParamSchema,
        response: {
          200: z.array(z.string()),
          404: ErrorSchema,
        },
      },
    },
    async (req, rep) => {
      const internalEli = req.params.eli.replace(/:/g, "/");
      const meta = await repos.acts.findByEli(internalEli);
      if (!meta) return rep.code(404).send({ error: "Act not found" });
      const versions = await repos.acts.listVersionElis(internalEli);
      return versions;
    },
  );

  // ── GET /acts/:eli/diff?from=&to= ─────────────────────────────────────────────
  typed.get(
    "/acts/:eli/diff",
    {
      schema: {
        params: EliParamSchema,
        querystring: DiffQuerySchema,
        response: {
          200: z.object({ events: z.array(z.any()) }),
          404: ErrorSchema,
        },
      },
    },
    async (req, rep) => {
      const fromEli = req.query.from.replace(/:/g, "/");
      const toEli = req.query.to.replace(/:/g, "/");

      const [oldUnits, newUnits] = await Promise.all([
        repos.units.findByActEli(fromEli),
        repos.units.findByActEli(toEli),
      ]);

      if (oldUnits.length === 0 && newUnits.length === 0) {
        return rep.code(404).send({ error: "No units found for given versions" });
      }

      const events = engine.diff(oldUnits, newUnits, {
        actEli: toEli,
        effectiveDate: null,
        isConsolidated: false,
      });

      return { events };
    },
  );

  // ── GET /acts/:eli/timeline ───────────────────────────────────────────────────
  typed.get(
    "/acts/:eli/timeline",
    {
      schema: {
        params: EliParamSchema,
        response: {
          200: z.object({ events: z.array(z.any()) }),
        },
      },
    },
    async (req) => {
      const internalEli = req.params.eli.replace(/:/g, "/");
      const events = await repos.changeEvents.findByActEli(internalEli);

      // Sort by effectiveDate ascending, nulls last
      events.sort((a, b) => {
        if (!a.effectiveDate && !b.effectiveDate) return 0;
        if (!a.effectiveDate) return 1;
        if (!b.effectiveDate) return -1;
        return a.effectiveDate < b.effectiveDate ? -1 : 1;
      });

      return { events };
    },
  );

  // ── POST /subscriptions ───────────────────────────────────────────────────────
  typed.post(
    "/subscriptions",
    {
      schema: {
        body: CreateSubscriptionBodySchema,
        response: {
          201: SubscriptionSchema,
          400: ErrorSchema,
        },
      },
    },
    async (req, rep) => {
      const sub = await repos.subscriptions.save({
        actEli: req.body.actEli,
        email: req.body.email,
        webhookUrl: req.body.webhookUrl ?? null,
      });
      return rep.code(201).send(sub);
    },
  );

  // ── GET /subscriptions ────────────────────────────────────────────────────────
  typed.get(
    "/subscriptions",
    {
      schema: {
        response: {
          200: z.array(SubscriptionSchema),
        },
      },
    },
    async () => repos.subscriptions.findAll(),
  );

  // ── DELETE /subscriptions/:id ─────────────────────────────────────────────────
  typed.delete(
    "/subscriptions/:id",
    {
      schema: {
        params: SubscriptionIdParamSchema,
        response: {
          204: z.object({}),
          404: ErrorSchema,
        },
      },
    },
    async (req, rep) => {
      const existing = await repos.subscriptions.findById(req.params.id);
      if (!existing) return rep.code(404).send({ error: "Subscription not found" });
      await repos.subscriptions.delete(req.params.id);
      return rep.code(204).send({});
    },
  );

  return app;
}
