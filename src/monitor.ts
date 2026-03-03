import type { ServiceConfig } from "./config.js";
import { StatusStore } from "./storage.js";
import type { CheckSample } from "./types.js";

export const STATUS_RULE_DESCRIPTION = "Status code is not 404";

export class HealthMonitor {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  public constructor(
    private readonly services: ServiceConfig[],
    private readonly store: StatusStore,
    private readonly intervalMs: number,
    private readonly timeoutMs: number
  ) {}

  public async start(): Promise<void> {
    await this.runOnce();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async runOnce(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      await Promise.all(this.services.map((service) => this.checkService(service)));
    } finally {
      this.running = false;
    }
  }

  private async checkService(service: ServiceConfig): Promise<void> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let sample: CheckSample;

    try {
      const response = await fetch(service.url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": "clash-status-monitor/0.1"
        }
      });

      const latencyMs = Date.now() - startedAt;
      sample = {
        serviceId: service.id,
        serviceName: service.name,
        serviceUrl: service.url,
        checkedAt: new Date(),
        statusCode: response.status,
        isUp: response.status !== 404,
        latencyMs,
        error: null
      };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      sample = {
        serviceId: service.id,
        serviceName: service.name,
        serviceUrl: service.url,
        checkedAt: new Date(),
        statusCode: null,
        isUp: false,
        latencyMs,
        error: error instanceof Error ? error.message : "Unknown request error"
      };
    } finally {
      clearTimeout(timeout);
    }

    await this.store.add(sample);
  }
}
