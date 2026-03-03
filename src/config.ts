import "dotenv/config";

export type ServiceConfig = {
  id: string;
  name: string;
  url: string;
};

export type DatabaseConfig = {
  url?: string;
  username?: string;
  password?: string;
};

export type AppConfig = {
  port: number;
  checkIntervalMs: number;
  requestTimeoutMs: number;
  memorySamplesPerService: number;
  database: DatabaseConfig;
  services: ServiceConfig[];
};

const DEFAULT_SERVICES: ServiceConfig[] = [
  { id: "api", name: "API", url: "https://api.clash.kr/" },
  { id: "web", name: "Web", url: "https://clash.kr/" }
];

function parsePositiveInt(value: string | undefined, fallback: number, min: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < min) {
    return fallback;
  }

  return parsed;
}

function normalizeUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `https://${url}`;
}

function parseServices(raw: string | undefined): ServiceConfig[] {
  if (!raw) {
    return DEFAULT_SERVICES;
  }

  try {
    const parsed = JSON.parse(raw) as Array<{ id: string; name: string; url: string }>;
    const services = parsed
      .filter((item) => item?.id && item?.name && item?.url)
      .map((item) => ({
        id: item.id.trim(),
        name: item.name.trim(),
        url: normalizeUrl(item.url.trim())
      }));

    if (services.length === 0) {
      return DEFAULT_SERVICES;
    }

    return services;
  } catch {
    return DEFAULT_SERVICES;
  }
}

function firstDefined(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function parseConnectionAuth(value: string | undefined): { hasUsername: boolean; hasPassword: boolean } {
  if (!value) {
    return { hasUsername: false, hasPassword: false };
  }

  try {
    const url = new URL(value);
    return {
      hasUsername: url.username.trim().length > 0,
      hasPassword: url.password.trim().length > 0
    };
  } catch {
    return { hasUsername: false, hasPassword: false };
  }
}

export function loadConfig(): AppConfig {
  const databaseUrl = firstDefined(process.env.DATABASE_URL);
  const explicitUsername = firstDefined(
    process.env.DATABASE_USERNAME,
    process.env.POSTGRES_USERNAME,
    process.env.POSTGRES_USER
  );
  const explicitPassword = firstDefined(process.env.DATABASE_PASSWORD, process.env.POSTGRES_PASSWORD);
  const authInUrl = parseConnectionAuth(databaseUrl);

  return {
    port: parsePositiveInt(process.env.PORT, 8080, 1),
    checkIntervalMs: parsePositiveInt(process.env.CHECK_INTERVAL_MS, 30_000, 3_000),
    requestTimeoutMs: parsePositiveInt(process.env.REQUEST_TIMEOUT_MS, 5_000, 1_000),
    memorySamplesPerService: parsePositiveInt(process.env.MEMORY_SAMPLES_PER_SERVICE, 20_000, 500),
    database: {
      url: databaseUrl,
      username: explicitUsername ?? (!authInUrl.hasUsername ? firstDefined(process.env.PGUSER) : undefined),
      password: explicitPassword ?? (!authInUrl.hasPassword ? firstDefined(process.env.PGPASSWORD) : undefined)
    },
    services: parseServices(process.env.SERVICES_JSON)
  };
}
