import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { buildHistoryBins, detectIncidents, uptimePercentage } from "./analytics.js";
import { loadConfig } from "./config.js";
import { HealthMonitor } from "./monitor.js";
import { StatusStore } from "./storage.js";

const HISTORY_HOURS = 24;
const HISTORY_BINS = 48;
const INCIDENT_LOOKBACK_HOURS = 72;
const INCIDENT_MAX_COUNT = 20;

const config = loadConfig();
const store = new StatusStore(config.database, config.memorySamplesPerService);
const monitor = new HealthMonitor(
  config.services,
  store,
  config.checkIntervalMs,
  config.requestTimeoutMs
);

const app = express();
app.use(express.json());

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const publicDir = path.resolve(currentDir, "../public");

app.get("/internal/healthz", (_req, res) => {
  res.json({ status: "ok", service: "clash-status" });
});

app.post("/api/check-now", async (_req, res) => {
  await monitor.runOnce();
  res.json({ ok: true, checkedAt: new Date().toISOString() });
});

app.get("/api/status", async (_req, res) => {
  const now = Date.now();
  const since24h = new Date(now - HISTORY_HOURS * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const sinceIncidents = new Date(now - INCIDENT_LOOKBACK_HOURS * 60 * 60 * 1000);

  const services = await Promise.all(
    config.services.map(async (service) => {
      const latest = store.getLatest(service.id);
      const [samples24h, samples7d] = await Promise.all([
        store.getSamplesSince(service.id, since24h),
        store.getSamplesSince(service.id, since7d)
      ]);

      return {
        id: service.id,
        name: service.name,
        url: service.url,
        status: latest ? (latest.isUp ? "operational" : "major_outage") : "unknown",
        isUp: latest?.isUp ?? null,
        statusCode: latest?.statusCode ?? null,
        latencyMs: latest?.latencyMs ?? null,
        checkedAt: latest?.checkedAt.toISOString() ?? null,
        lastError: latest?.error ?? null,
        uptime24h: uptimePercentage(samples24h),
        uptime7d: uptimePercentage(samples7d),
        history24h: buildHistoryBins(samples24h, HISTORY_HOURS, HISTORY_BINS)
      };
    })
  );

  const incidentsByService = await Promise.all(
    config.services.map(async (service) => {
      const samples = await store.getSamplesSince(service.id, sinceIncidents);
      return detectIncidents(samples, INCIDENT_MAX_COUNT);
    })
  );

  const incidents = incidentsByService
    .flat()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, INCIDENT_MAX_COUNT);

  const overallOperational = services.every((service) => service.status === "operational");

  res.json({
    generatedAt: new Date().toISOString(),
    overallStatus: overallOperational ? "operational" : "partial_outage",
    services,
    incidents
  });
});

app.use(express.static(publicDir, { index: "index.html", maxAge: "30s" }));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/internal")) {
    next();
    return;
  }

  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  res.status(500).json({ error: message });
});

async function start(): Promise<void> {
  await store.init();
  await monitor.start();

  app.listen(config.port, () => {
    console.log(`clash-status listening on :${config.port}`);
  });
}

function shutdown(signal: string): void {
  console.log(`received ${signal}, shutting down`);
  monitor.stop();
  void store.close().finally(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

void start();
