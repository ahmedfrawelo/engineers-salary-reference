#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const FEATURES_DIR = path.join(ROOT, 'src', 'app', 'features');
const ALLOWLIST_PATH = path.join(
  ROOT,
  'scripts',
  'allowlists',
  'legacy-elimination-allowlist.json'
);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function isLegacyCandidate(relativePath) {
  return (
    relativePath.includes('/presentation/legacy/') ||
    relativePath.includes('/infrastructure/legacy/') ||
    /(^|\/)[^/]*\.route-compat\.component\.ts$/i.test(relativePath) ||
    /(^|\/)[^/]*legacy-page\.bridge\.component\.ts$/i.test(relativePath) ||
    /(^|\/)legacy[-_.][^/]*\.[^/]+$/i.test(relativePath)
  );
}

function loadAllowlistPatterns() {
  if (!fs.existsSync(ALLOWLIST_PATH)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(ALLOWLIST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const patterns = Array.isArray(parsed.patterns) ? parsed.patterns : [];
    return patterns.map(pattern => new RegExp(pattern));
  } catch (error) {
    console.error(`[legacy-elimination] Failed to read allowlist: ${String(error)}`);
    process.exit(1);
  }
}

function printSection(title, lines) {
  if (!lines.length) {
    return;
  }
  console.error(`\n${title}`);
  for (const line of lines) {
    console.error(`- ${line}`);
  }
}

function main() {
  const strictMode = process.env.STRICT_LEGACY_ELIMINATION === '1';
  const files = walkFiles(FEATURES_DIR).map(filePath => toPosix(path.relative(ROOT, filePath)));
  const legacyCandidates = files.filter(isLegacyCandidate);

  if (strictMode) {
    if (legacyCandidates.length > 0) {
      console.error('[legacy-elimination] Failed (strict mode).');
      printSection('Legacy files still present:', legacyCandidates);
      process.exit(1);
    }
    console.log('[legacy-elimination] Passed (strict mode, zero legacy files).');
    return;
  }

  const allowlistPatterns = loadAllowlistPatterns();
  const untrackedLegacy = legacyCandidates.filter(
    candidate => !allowlistPatterns.some(pattern => pattern.test(candidate))
  );

  if (untrackedLegacy.length > 0) {
    console.error('[legacy-elimination] Failed.');
    printSection('Legacy files outside allowlist:', untrackedLegacy);
    process.exit(1);
  }

  console.log(
    `[legacy-elimination] Passed. Tracked legacy files: ${legacyCandidates.length}. Strict mode: off.`
  );
}

main();
