// S6-6: Prometheus metrics registry — exposes /metrics for scraping.
import client from "prom-client";

const { Registry, collectDefaultMetrics, Histogram, Counter } = client;

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

/**
 * S6-4: unmatchedRatio — fraction of old units left unmatched after diff.
 * Grafana alert fires when p95 exceeds 0.05.
 */
export const unmatchedRatioHistogram = new Histogram({
  name: "lexdiff_diff_unmatched_ratio",
  help: "Fraction of old units with no match after DiffEngine run (0–1)",
  labelNames: ["actEli"] as const,
  buckets: [0, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1],
  registers: [registry],
});

/**
 * S6-6: HTTP request duration — used by the Grafana latency panel.
 * Observed in buildApp via Fastify onResponse hook.
 */
export const httpRequestDurationHistogram = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

/**
 * S6-6: Act sync duration — measures full syncAct() wall-clock time.
 * Labels: result = "skipped" | "synced"
 */
export const syncDurationHistogram = new Histogram({
  name: "lexdiff_sync_duration_seconds",
  help: "Duration of ActSyncService.syncAct() in seconds",
  labelNames: ["result"] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [registry],
});

/**
 * S6-6: Total change events generated across all syncs.
 */
export const changeEventsGeneratedCounter = new Counter({
  name: "lexdiff_change_events_generated_total",
  help: "Cumulative number of ChangeEvents produced by DiffEngine",
  labelNames: ["actEli"] as const,
  registers: [registry],
});
