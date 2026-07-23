#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  HARD_LINE_LIMIT,
  COMPONENT_INTERNAL_THRESHOLD,
  MAX_COMPONENT_INTERNAL_THRESHOLD_BREACHES,
  HELPER_THRESHOLD: LARGE_HELPER_LINE_THRESHOLD,
  MAX_LARGE_HELPER_FILES,
  LEGACY_HARD_LIMIT_ALLOWLIST,
  LEGACY_COMPONENT_INTERNAL_ALLOWLIST,
  LEGACY_HELPER_ALLOWLIST,
  isComponentOrInternalUnit,
  isHelperUnit
} = require('./source-health-rules.cjs');

const ROOT = process.cwd();
const SRC_APP_DIR = path.join(ROOT, 'src', 'app');

function walkTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTsFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function countLines(content) {
  return content.split(/\r?\n/).length;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function main() {
  if (!fs.existsSync(SRC_APP_DIR)) {
    console.log('[source-health] src/app not found. Skipping check.');
    process.exit(0);
  }

  const files = walkTsFiles(SRC_APP_DIR).map(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      path: toPosix(path.relative(ROOT, filePath)),
      lines: countLines(content)
    };
  });

  const tooLarge = files.filter(
    file => file.lines >= HARD_LINE_LIMIT && !LEGACY_HARD_LIMIT_ALLOWLIST.has(file.path)
  );
  const highLineFiles = files
    .filter(file => file.lines >= HARD_LINE_LIMIT)
    .sort((a, b) => b.lines - a.lines);
  const largeComponentInternalUnits = files
    .filter(
        file =>
        file.lines >= COMPONENT_INTERNAL_THRESHOLD && isComponentOrInternalUnit(file.path)
    )
    .filter(file => !LEGACY_COMPONENT_INTERNAL_ALLOWLIST.has(file.path))
    .sort((a, b) => b.lines - a.lines);
  const legacyComponentInternalUnits = files
    .filter(
        file =>
        file.lines >= COMPONENT_INTERNAL_THRESHOLD && isComponentOrInternalUnit(file.path)
    )
    .filter(file => LEGACY_COMPONENT_INTERNAL_ALLOWLIST.has(file.path))
    .sort((a, b) => b.lines - a.lines);
  const largeHelperFiles = files
    .filter(file => file.lines >= LARGE_HELPER_LINE_THRESHOLD && isHelperUnit(file.path))
    .filter(file => !LEGACY_HELPER_ALLOWLIST.has(file.path))
    .sort((a, b) => b.lines - a.lines);
  const legacyLargeHelperFiles = files
    .filter(file => file.lines >= LARGE_HELPER_LINE_THRESHOLD && isHelperUnit(file.path))
    .filter(file => LEGACY_HELPER_ALLOWLIST.has(file.path))
    .sort((a, b) => b.lines - a.lines);
  const topLargest = [...files].sort((a, b) => b.lines - a.lines).slice(0, 10);

  console.log('[source-health] Largest TypeScript files:');
  for (const file of topLargest) {
    console.log(`- ${file.path}: ${file.lines} lines`);
  }

  if (tooLarge.length > 0) {
    console.error('\n[source-health] Failed. Files exceed hard line limit (non-allowlisted):');
    for (const file of tooLarge) {
      console.error(`- ${file.path}: ${file.lines} lines (limit: < ${HARD_LINE_LIMIT})`);
    }
    process.exit(1);
  }

  if (largeHelperFiles.length > MAX_LARGE_HELPER_FILES) {
    console.error(
      `\n[source-health] Failed. Large helper files >= ${LARGE_HELPER_LINE_THRESHOLD} lines: ${largeHelperFiles.length} (limit: ${MAX_LARGE_HELPER_FILES}).`
    );
    for (const file of largeHelperFiles) {
      console.error(`- ${file.path}: ${file.lines} lines`);
    }
    process.exit(1);
  }

  if (largeComponentInternalUnits.length > MAX_COMPONENT_INTERNAL_THRESHOLD_BREACHES) {
    console.error(
      `\n[source-health] Failed. Component/Internal files >= ${COMPONENT_INTERNAL_THRESHOLD} lines: ${largeComponentInternalUnits.length} (limit: ${MAX_COMPONENT_INTERNAL_THRESHOLD_BREACHES}).`
    );
    for (const file of largeComponentInternalUnits) {
      console.error(`- ${file.path}: ${file.lines} lines`);
    }
    process.exit(1);
  }

  console.log(
    `\n[source-health] Passed. Files >= ${HARD_LINE_LIMIT} lines (tracked): ${highLineFiles.length}.`
  );
  console.log(
    `[source-health] Component/Internal files >= ${COMPONENT_INTERNAL_THRESHOLD} lines: ${largeComponentInternalUnits.length}/${MAX_COMPONENT_INTERNAL_THRESHOLD_BREACHES}.`
  );
  console.log(
    `[source-health] Helper files >= ${LARGE_HELPER_LINE_THRESHOLD} lines: ${largeHelperFiles.length}/${MAX_LARGE_HELPER_FILES}.`
  );
  console.log(
    `[source-health] Legacy component/internal backlog tracked: ${legacyComponentInternalUnits.length}.`
  );
  console.log(`[source-health] Legacy helper backlog tracked: ${legacyLargeHelperFiles.length}.`);
}

main();
