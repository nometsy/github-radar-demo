#!/usr/bin/env node

/**
 * Render cron entry point: asks the running web service to capture snapshots.
 *
 * Required environment variables:
 *   RADAR_BASE_URL  public URL of the web service (Render supplies it from
 *                   RENDER_EXTERNAL_URL through render.yaml)
 *   CRON_SECRET     same secret the web service uses
 *
 * Optional:
 *   RADAR_COLLECT_TIMEOUT_MS  request timeout, default 60000
 */

const DEFAULT_TIMEOUT_MS = 60_000;

function readTimeout() {
  const parsed = Number.parseInt(
    process.env.RADAR_COLLECT_TIMEOUT_MS ?? "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function normalizeBaseUrl() {
  const raw =
    process.env.RADAR_BASE_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    "";
  if (!raw) {
    throw new Error(
      "RADAR_BASE_URL is not set. Point it at the public web service URL.",
    );
  }

  const base = raw.replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error(`RADAR_BASE_URL is not a valid URL: ${base}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("RADAR_BASE_URL must start with https:// or http://.");
  }
  return base;
}

function readSecret() {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    throw new Error("CRON_SECRET is not set.");
  }
  return secret;
}

async function main() {
  const baseUrl = normalizeBaseUrl();
  const secret = readSecret();
  const timeoutMs = readTimeout();
  const endpoint = `${baseUrl}/api/radar/collect`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  let body;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    body = await response.text();
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? `request timed out after ${timeoutMs} ms`
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(`Could not reach ${endpoint}: ${reason}`);
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = body ? JSON.parse(body) : null;
  } catch {
    // Keep the raw body in the error below; it is more useful than a parse error.
  }

  if (!response.ok) {
    const detail =
      payload?.error?.message ||
      body.slice(0, 500) ||
      "(empty response body)";
    throw new Error(`Collector returned HTTP ${response.status}: ${detail}`);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Collector returned an unexpected response.");
  }

  const captured = payload.captured ?? "?";
  const skipped = payload.skipped ?? "?";
  const tracked = payload.tracked ?? payload.status?.trackedRepos ?? "?";
  const snapshots = payload.status?.snapshotCount ?? "?";
  const writable = payload.status?.writable;

  console.log(
    `Collected ${captured} snapshot(s), skipped ${skipped}; ` +
      `${tracked} repositories tracked, ${snapshots} stored` +
      (writable === false ? " (storage is not writable)" : ""),
  );

  if (writable === false) {
    throw new Error(
      "The web service reports that snapshot storage is not writable.",
    );
  }
}

main().catch((error) => {
  console.error(
    `[github-radar] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
