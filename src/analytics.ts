import type { CheckSample, HistoryBinState, Incident } from "./types.js";

export function uptimePercentage(samples: CheckSample[]): number | null {
  if (samples.length === 0) {
    return null;
  }

  const upCount = samples.reduce((count, sample) => count + (sample.isUp ? 1 : 0), 0);
  return Number(((upCount / samples.length) * 100).toFixed(2));
}

export function buildHistoryBins(samples: CheckSample[], hours: number, bins: number): HistoryBinState[] {
  if (bins <= 0) {
    return [];
  }

  const sorted = [...samples].sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime());
  const now = Date.now();
  const windowMs = hours * 60 * 60 * 1000;
  const binSizeMs = windowMs / bins;
  const states: HistoryBinState[] = [];

  let cursor = 0;
  for (let i = 0; i < bins; i += 1) {
    const binStart = now - windowMs + i * binSizeMs;
    const binEnd = binStart + binSizeMs;

    let hasData = false;
    let hasDown = false;

    while (cursor < sorted.length && sorted[cursor].checkedAt.getTime() < binEnd) {
      if (sorted[cursor].checkedAt.getTime() >= binStart) {
        hasData = true;
        if (!sorted[cursor].isUp) {
          hasDown = true;
        }
      }
      cursor += 1;
    }

    if (!hasData) {
      states.push("nodata");
    } else if (hasDown) {
      states.push("down");
    } else {
      states.push("up");
    }
  }

  return states;
}

export function detectIncidents(samples: CheckSample[], maxCount: number): Incident[] {
  if (samples.length === 0) {
    return [];
  }

  const sorted = [...samples].sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime());
  const incidents: Incident[] = [];

  let openIncident: {
    serviceId: string;
    serviceName: string;
    startedAt: Date;
    latestStatusCode: number | null;
    latestError: string | null;
  } | null = null;

  for (const sample of sorted) {
    if (!sample.isUp) {
      if (!openIncident) {
        openIncident = {
          serviceId: sample.serviceId,
          serviceName: sample.serviceName,
          startedAt: sample.checkedAt,
          latestStatusCode: sample.statusCode,
          latestError: sample.error
        };
      } else {
        openIncident.latestStatusCode = sample.statusCode;
        openIncident.latestError = sample.error;
      }
      continue;
    }

    if (openIncident) {
      const durationSeconds = Math.max(
        0,
        Math.floor((sample.checkedAt.getTime() - openIncident.startedAt.getTime()) / 1000)
      );

      incidents.push({
        serviceId: openIncident.serviceId,
        serviceName: openIncident.serviceName,
        startedAt: openIncident.startedAt.toISOString(),
        resolvedAt: sample.checkedAt.toISOString(),
        durationSeconds,
        latestStatusCode: openIncident.latestStatusCode,
        latestError: openIncident.latestError
      });

      openIncident = null;
    }
  }

  if (openIncident) {
    incidents.push({
      serviceId: openIncident.serviceId,
      serviceName: openIncident.serviceName,
      startedAt: openIncident.startedAt.toISOString(),
      resolvedAt: null,
      durationSeconds: null,
      latestStatusCode: openIncident.latestStatusCode,
      latestError: openIncident.latestError
    });
  }

  return incidents
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, maxCount);
}
