export type CheckSample = {
  serviceId: string;
  serviceName: string;
  serviceUrl: string;
  checkedAt: Date;
  statusCode: number | null;
  isUp: boolean;
  latencyMs: number | null;
  error: string | null;
};

export type Incident = {
  serviceId: string;
  serviceName: string;
  startedAt: string;
  resolvedAt: string | null;
  durationSeconds: number | null;
  latestStatusCode: number | null;
  latestError: string | null;
};

export type HistoryBinState = "up" | "down" | "nodata";
