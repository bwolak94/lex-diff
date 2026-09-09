// S6-6: Prometheus metrics registry — exposes /metrics for scraping.
import client from "prom-client";

const { Registry, collectDefaultMetrics, Histogram } = client;

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
