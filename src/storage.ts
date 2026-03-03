import { Pool } from "pg";

import type { DatabaseConfig } from "./config.js";
import type { CheckSample } from "./types.js";

type DbRow = {
  service_id: string;
  service_name: string;
  service_url: string;
  checked_at: Date;
  status_code: number | null;
  is_up: boolean;
  latency_ms: number | null;
  error: string | null;
};

export class StatusStore {
  private readonly memoryByService = new Map<string, CheckSample[]>();
  private readonly latestByService = new Map<string, CheckSample>();
  private readonly maxSamplesPerService: number;
  private readonly pool?: Pool;

  public constructor(database: DatabaseConfig, maxSamplesPerService: number) {
    this.maxSamplesPerService = maxSamplesPerService;

    if (database.url) {
      let connectionString = database.url;

      if (database.username || database.password) {
        try {
          const parsed = new URL(database.url);
          if (database.username) {
            parsed.username = database.username;
          }
          if (database.password) {
            parsed.password = database.password;
          }
          connectionString = parsed.toString();
        } catch {
          connectionString = database.url;
        }
      }

      this.pool = new Pool({ connectionString });
    }
  }

  public async init(): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS service_checks (
        id BIGSERIAL PRIMARY KEY,
        service_id TEXT NOT NULL,
        service_name TEXT NOT NULL,
        service_url TEXT NOT NULL,
        checked_at TIMESTAMPTZ NOT NULL,
        status_code INTEGER,
        is_up BOOLEAN NOT NULL,
        latency_ms INTEGER,
        error TEXT
      )
    `);

    await this.pool.query(
      "CREATE INDEX IF NOT EXISTS idx_service_checks_service_checked_at ON service_checks (service_id, checked_at DESC)"
    );
  }

  public async add(sample: CheckSample): Promise<void> {
    const current = this.memoryByService.get(sample.serviceId) ?? [];
    current.push(sample);

    if (current.length > this.maxSamplesPerService) {
      current.splice(0, current.length - this.maxSamplesPerService);
    }

    this.memoryByService.set(sample.serviceId, current);
    this.latestByService.set(sample.serviceId, sample);

    if (!this.pool) {
      return;
    }

    await this.pool.query(
      `
      INSERT INTO service_checks (
        service_id,
        service_name,
        service_url,
        checked_at,
        status_code,
        is_up,
        latency_ms,
        error
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        sample.serviceId,
        sample.serviceName,
        sample.serviceUrl,
        sample.checkedAt,
        sample.statusCode,
        sample.isUp,
        sample.latencyMs,
        sample.error
      ]
    );
  }

  public getLatest(serviceId: string): CheckSample | undefined {
    return this.latestByService.get(serviceId);
  }

  public async getSamplesSince(serviceId: string, since: Date): Promise<CheckSample[]> {
    if (!this.pool) {
      const memory = this.memoryByService.get(serviceId) ?? [];
      return memory.filter((sample) => sample.checkedAt >= since);
    }

    const result = await this.pool.query<DbRow>(
      `
      SELECT service_id, service_name, service_url, checked_at, status_code, is_up, latency_ms, error
      FROM service_checks
      WHERE service_id = $1 AND checked_at >= $2
      ORDER BY checked_at ASC
      `,
      [serviceId, since]
    );

    return result.rows.map((row) => ({
      serviceId: row.service_id,
      serviceName: row.service_name,
      serviceUrl: row.service_url,
      checkedAt: new Date(row.checked_at),
      statusCode: row.status_code,
      isUp: row.is_up,
      latencyMs: row.latency_ms,
      error: row.error
    }));
  }

  public async close(): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.end();
  }

  public isUsingDatabase(): boolean {
    return Boolean(this.pool);
  }
}
