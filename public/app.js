const refreshButton = document.getElementById("refresh-btn");
const lastUpdated = document.getElementById("last-updated");
const overallCard = document.getElementById("overall-card");
const overallDot = document.getElementById("overall-dot");
const overallLabel = document.getElementById("overall-label");
const overallTitle = document.getElementById("overall-title");
const overallDesc = document.getElementById("overall-desc");
const servicesBody = document.getElementById("services-body");
const incidentsList = document.getElementById("incidents-list");
const kpiHealth = document.getElementById("kpi-health");
const kpiHealthSub = document.getElementById("kpi-health-sub");
const kpiLatency = document.getElementById("kpi-latency");
const kpiLatencySub = document.getElementById("kpi-latency-sub");
const kpiUptime = document.getElementById("kpi-uptime");
const kpiUptimeSub = document.getElementById("kpi-uptime-sub");
const kpiIncidents = document.getElementById("kpi-incidents");
const kpiIncidentsSub = document.getElementById("kpi-incidents-sub");

const REFRESH_INTERVAL_MS = 30_000;

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return `${date.toLocaleDateString("ko-KR")} ${date.toLocaleTimeString("ko-KR")}`;
}

function formatUptime(value) {
  if (value === null || value === undefined) {
    return "n/a";
  }
  return `${value.toFixed(2)}%`;
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) {
    return "In progress";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `${hours}h ${remainMinutes}m`;
}

function average(values) {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function statusPill(status) {
  if (status === "operational") {
    return '<span class="status-pill good">Operational</span>';
  }
  if (status === "major_outage") {
    return '<span class="status-pill bad">Major Outage</span>';
  }
  return '<span class="status-pill unknown">Unknown</span>';
}

function statusCodeBadge(statusCode) {
  if (statusCode === null || statusCode === undefined) {
    return '<span class="code-badge neutral">No code</span>';
  }
  if (statusCode >= 500) {
    return `<span class="code-badge bad">${statusCode}</span>`;
  }
  if (statusCode >= 400) {
    return `<span class="code-badge warn">${statusCode}</span>`;
  }
  return `<span class="code-badge good">${statusCode}</span>`;
}

function buildHistory(history24h) {
  const cells = history24h
    .map((state) => `<span class="history-cell ${state === "nodata" ? "" : state}"></span>`)
    .join("");

  return `<div class="history">${cells}</div>`;
}

function renderServices(services) {
  if (!services || services.length === 0) {
    servicesBody.innerHTML =
      '<tr><td colspan="6"><div class="incident-empty">No service data available.</div></td></tr>';
    return;
  }

  servicesBody.innerHTML = services
    .map((service) => {
      const responseNote =
        service.latencyMs !== null && service.latencyMs !== undefined
          ? `${service.latencyMs} ms`
          : escapeHtml(service.lastError || "No response");

      return `
        <tr>
          <td>
            <div class="service-main">${escapeHtml(service.name)}</div>
            <div class="service-url">${escapeHtml(service.url)}</div>
            <div class="service-time">${formatDate(service.checkedAt)}</div>
          </td>
          <td>${statusPill(service.status)}</td>
          <td>
            <div class="response">
              ${statusCodeBadge(service.statusCode)}
              <span class="latency">${responseNote}</span>
            </div>
          </td>
          <td>${formatUptime(service.uptime24h)}</td>
          <td>${formatUptime(service.uptime7d)}</td>
          <td>${buildHistory(service.history24h || [])}</td>
        </tr>
      `;
    })
    .join("");
}

function renderIncidents(incidents) {
  if (!incidents || incidents.length === 0) {
    incidentsList.innerHTML = '<li class="incident-empty">No incidents recorded in the last 72 hours.</li>';
    return;
  }

  incidentsList.innerHTML = incidents
    .map((incident) => {
      const active = !incident.resolvedAt;
      const reason =
        incident.latestError ||
        (incident.latestStatusCode ? `HTTP ${incident.latestStatusCode}` : "Request failed");

      return `
        <li class="incident-item ${active ? "active" : ""}">
          <span class="incident-marker"></span>
          <div>
            <div class="incident-head">
              <p class="incident-title">${escapeHtml(incident.serviceName)} ${active ? "disruption" : "incident"}</p>
              <span class="incident-state ${active ? "active" : "resolved"}">${active ? "Active" : "Resolved"}</span>
            </div>
            <p class="incident-meta">
              Started ${formatDate(incident.startedAt)} •
              ${incident.resolvedAt ? `Resolved ${formatDate(incident.resolvedAt)}` : "Resolution in progress"} •
              Duration ${formatDuration(incident.durationSeconds)}
            </p>
            <p class="incident-reason">Impact signal: ${escapeHtml(reason)}</p>
          </div>
        </li>
      `;
    })
    .join("");
}

function renderMetrics(services, incidents) {
  const total = services.length;
  const healthy = services.filter((service) => service.status === "operational").length;
  const healthRatio = `${healthy} / ${total || 0}`;
  kpiHealth.textContent = healthRatio;
  kpiHealthSub.textContent = `${total || 0} monitored component${total === 1 ? "" : "s"}`;

  const latencies = services
    .map((service) => service.latencyMs)
    .filter((value) => typeof value === "number");
  const avgLatency = average(latencies);
  kpiLatency.textContent = avgLatency === null ? "n/a" : `${Math.round(avgLatency)} ms`;
  kpiLatencySub.textContent = latencies.length === 0 ? "No successful checks yet" : "Across latest successful checks";

  const uptimes24h = services
    .map((service) => service.uptime24h)
    .filter((value) => typeof value === "number");
  const avgUptime = average(uptimes24h);
  kpiUptime.textContent = avgUptime === null ? "n/a" : `${avgUptime.toFixed(2)}%`;
  kpiUptimeSub.textContent = uptimes24h.length === 0 ? "No uptime sample yet" : "Average across all services";

  const activeIncidents = incidents.filter((incident) => !incident.resolvedAt);
  kpiIncidents.textContent = `${activeIncidents.length} active`;
  if (activeIncidents.length > 0) {
    kpiIncidentsSub.textContent = `Latest at ${formatDate(activeIncidents[0].startedAt)}`;
  } else if (incidents.length > 0) {
    kpiIncidentsSub.textContent = `Last resolved at ${formatDate(incidents[0].resolvedAt)}`;
  } else {
    kpiIncidentsSub.textContent = "No ongoing incidents";
  }
}

function applyBannerState(state) {
  overallCard.classList.remove("operational", "degraded", "unknown");
  overallDot.classList.remove("good", "bad", "unknown");

  if (state === "operational") {
    overallCard.classList.add("operational");
    overallDot.classList.add("good");
    overallLabel.textContent = "Operational";
    return;
  }

  if (state === "degraded") {
    overallCard.classList.add("degraded");
    overallDot.classList.add("bad");
    overallLabel.textContent = "Degraded";
    return;
  }

  overallCard.classList.add("unknown");
  overallDot.classList.add("unknown");
  overallLabel.textContent = "Unknown";
}

function renderOverall(data) {
  if (data.overallStatus === "operational") {
    applyBannerState("operational");
    overallTitle.textContent = "All systems operational";
    overallDesc.textContent = "All monitored services are running within expected parameters.";
    return;
  }

  applyBannerState("degraded");
  overallTitle.textContent = "Service disruption detected";
  overallDesc.textContent = "One or more services are currently experiencing elevated errors or degraded performance.";
}

function renderUnavailable(errorMessage) {
  applyBannerState("unknown");
  overallTitle.textContent = "Unable to load live status";
  overallDesc.textContent = errorMessage;
  kpiHealth.textContent = "n/a";
  kpiLatency.textContent = "n/a";
  kpiUptime.textContent = "n/a";
  kpiIncidents.textContent = "n/a";
  kpiHealthSub.textContent = "Status feed unavailable";
  kpiLatencySub.textContent = "Status feed unavailable";
  kpiUptimeSub.textContent = "Status feed unavailable";
  kpiIncidentsSub.textContent = "Status feed unavailable";
}

async function fetchStatus() {
  const response = await fetch("/api/status", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function loadStatus() {
  try {
    const data = await fetchStatus();
    const services = data.services || [];
    const incidents = data.incidents || [];

    renderOverall(data);
    renderMetrics(services, incidents);
    renderServices(services);
    renderIncidents(incidents);
    lastUpdated.textContent = `Last updated ${formatDate(data.generatedAt)}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    lastUpdated.textContent = `Status fetch failed: ${message}`;
    renderUnavailable(`Could not fetch status feed (${message}).`);
  }
}

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  refreshButton.textContent = "Running...";

  try {
    await fetch("/api/check-now", { method: "POST" });
    await loadStatus();
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Run Check";
  }
});

void loadStatus();
setInterval(loadStatus, REFRESH_INTERVAL_MS);
