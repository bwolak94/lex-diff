// S6-1: OpenTelemetry SDK bootstrap — import BEFORE all other modules in server.ts.
// Tracing: OTLP HTTP → Jaeger
// Metrics: prom-client histogram exposed on GET /metrics

import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const exporter = new OTLPTraceExporter({
  url:
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ??
    "http://jaeger:4318/v1/traces",
});

const sdk = new NodeSDK({
  resource: new Resource({ [ATTR_SERVICE_NAME]: "lexdiff-api" }),
  traceExporter: exporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Reduce noise: disable fs instrumentation
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

sdk.start();

process.on("SIGTERM", () => {
  sdk.shutdown().finally(() => process.exit(0));
});

export {};
