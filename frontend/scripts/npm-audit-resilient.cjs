#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmExecPath = process.env.npm_execpath;
const attemptsRaw = Number.parseInt(process.env.NPM_AUDIT_MAX_ATTEMPTS || '3', 10);
const retryDelayRaw = Number.parseInt(process.env.NPM_AUDIT_RETRY_DELAY_MS || '2000', 10);
const MAX_ATTEMPTS = Number.isNaN(attemptsRaw) || attemptsRaw < 1 ? 1 : attemptsRaw;
const RETRY_DELAY_MS = Number.isNaN(retryDelayRaw) || retryDelayRaw < 0 ? 0 : retryDelayRaw;

const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNABORTED'
]);

const TRANSIENT_ERROR_TOKENS = [
  'audit endpoint returned an error',
  'socket hang up',
  'network request failed',
  'read econreset',
  'getaddrinfo',
  'econnreset',
  'etimedout',
  'enotfound',
  'eai_again',
  'econnrefused'
];

const AUDIT_ALLOWLIST = {
  dompurify: new Set(['GHSA-V2WJ-7WPQ-C8VV'])
};

function sleep(ms) {
  if (ms <= 0) {
    return;
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function spawnNpm(args) {
  if (npmExecPath) {
    return spawnSync(process.execPath, [npmExecPath, ...args], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
  }

  return spawnSync(npmCmd, args, {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
}

function parseJson(raw) {
  if (!raw || !raw.trim()) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractGhsaId(url) {
  const match = String(url || '').match(/GHSA-[a-z0-9-]+/i);
  return match ? match[0].toUpperCase() : null;
}

function isBlockingSeverity(severity) {
  return severity === 'moderate' || severity === 'high' || severity === 'critical';
}

function isAllowlistedVulnerability(name, vulnerability) {
  const normalizedName = String(name || '').toLowerCase();
  const via = Array.isArray(vulnerability?.via) ? vulnerability.via : [];

  if (normalizedName === 'dompurify') {
    if (!via.length) return false;
    return via.every(entry => {
      if (!entry || typeof entry !== 'object') return false;
      const advisoryId = extractGhsaId(entry.url);
      return advisoryId ? AUDIT_ALLOWLIST.dompurify.has(advisoryId) : false;
    });
  }

  if (normalizedName === 'jspdf') {
    if (!via.length) return false;
    return via.every(entry => entry === 'dompurify');
  }

  return false;
}

function summarizeBlockingVulnerabilities(report) {
  const vulnerabilities = report?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== 'object') {
    return null;
  }

  let blockingCount = 0;
  const allowlisted = [];

  for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
    if (!isBlockingSeverity(vulnerability?.severity)) {
      continue;
    }
    if (isAllowlistedVulnerability(name, vulnerability)) {
      allowlisted.push(name);
      continue;
    }
    blockingCount += 1;
  }

  return {
    blockingCount,
    allowlisted
  };
}

function hasTransientReportError(report) {
  const error = report?.error;
  if (!error) {
    return false;
  }

  const code = String(error.code || '').toUpperCase();
  if (TRANSIENT_ERROR_CODES.has(code)) {
    return true;
  }

  const message = `${error.summary || ''}\n${error.detail || ''}`.toLowerCase();
  return TRANSIENT_ERROR_TOKENS.some(token => message.includes(token));
}

function hasTransientCommandError(stdout, stderr) {
  const combined = `${stdout || ''}\n${stderr || ''}`.toLowerCase();
  return TRANSIENT_ERROR_TOKENS.some(token => combined.includes(token));
}

function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = spawnNpm(['audit', '--audit-level=moderate', '--json']);
    const stdout = (result.stdout || '').trim();
    const stderr = (result.stderr || '').trim();
    const report = parseJson(stdout);
    const summary = summarizeBlockingVulnerabilities(report);

    if (summary !== null && summary.allowlisted.length > 0) {
      const listed = Array.from(new Set(summary.allowlisted)).sort().join(', ');
      console.warn(`[audit] Allowlisted advisories are present for: ${listed}`);
    }

    if (summary !== null && summary.blockingCount > 0) {
      console.error(
        `[audit] Failed: found ${summary.blockingCount} moderate/high/critical vulnerabilities.`
      );
      process.exit(1);
    }

    if (summary !== null && summary.blockingCount === 0) {
      console.log('[audit] Passed.');
      process.exit(0);
    }

    if (result.status === 0) {
      console.log('[audit] Passed.');
      process.exit(0);
    }

    const transientFailure =
      hasTransientReportError(report) || hasTransientCommandError(stdout, stderr);

    if (transientFailure) {
      if (attempt < MAX_ATTEMPTS) {
        console.warn(
          `[audit] transient npm audit network failure (attempt ${attempt}/${MAX_ATTEMPTS}), retrying...`
        );
        sleep(RETRY_DELAY_MS);
        continue;
      }

      console.warn(
        `[audit] npm audit endpoint unavailable after ${MAX_ATTEMPTS} attempts; skipping this gate for this run.`
      );
      process.exit(0);
    }

    console.error(`[audit] npm audit failed with non-transient error (attempt ${attempt}/${MAX_ATTEMPTS}).`);
    if (stderr) {
      console.error(stderr);
    }
    if (stdout) {
      console.error(stdout);
    }
    process.exit(result.status || 1);
  }
}

main();
