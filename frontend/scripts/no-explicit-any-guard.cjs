#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const SRC_APP_DIR = path.join(ROOT, 'src', 'app');
const REPORT_DIR = path.join(ROOT, 'docs', 'quality');
const REPORT_FILE = path.join(REPORT_DIR, 'no-explicit-any-report.md');

// Strict budgets after explicit-any cleanup.
const MAX_TOTAL_EXPLICIT_ANY = 0;
const BUDGETS = [
  { label: 'core', prefix: 'src/app/core/', max: 0 },
  { label: 'features', prefix: 'src/app/features/', max: 0 },
  { label: 'shared', prefix: 'src/app/shared/', max: 0 },
  { label: 'auth', prefix: 'src/app/auth/', max: 0 },
  { label: 'app-root', prefix: 'src/app/', max: 0, exactRootOnly: true },
  { label: 'data-grid-scope', prefix: 'src/app/shared/data-grid/', max: 0 }
];

const EXPLICIT_ANY_PATTERN = /:\s*any\b|\bas\s+any\b|<\s*any\s*>/g;

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function walkTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTsFiles(fullPath));
      continue;
    }

    if (entry.name.endsWith('.ts') && !/\.(spec|test)\.ts$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function ensureReportDir() {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
}

function countMatches(content, pattern) {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

function isAppRootFile(relativePath) {
  return /^src\/app\/[^/]+\.ts$/i.test(relativePath);
}

function computeBudgetCount(files, budget) {
  if (budget.exactRootOnly) {
    return files
      .filter(file => isAppRootFile(file.path))
      .reduce((total, file) => total + file.explicitAnyCount, 0);
  }

  return files
    .filter(file => file.path.startsWith(budget.prefix))
    .reduce((total, file) => total + file.explicitAnyCount, 0);
}

function main() {
  if (!fs.existsSync(SRC_APP_DIR)) {
    console.log('[type-safety] src/app not found. Skipping explicit-any guard.');
    process.exit(0);
  }

  const files = walkTsFiles(SRC_APP_DIR).map(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      path: toPosix(path.relative(ROOT, filePath)),
      explicitAnyCount: countMatches(content, EXPLICIT_ANY_PATTERN)
    };
  });

  const filesWithAny = files
    .filter(file => file.explicitAnyCount > 0)
    .sort((a, b) => b.explicitAnyCount - a.explicitAnyCount);
  const totalExplicitAny = filesWithAny.reduce((total, file) => total + file.explicitAnyCount, 0);
  const budgetResults = BUDGETS.map(budget => ({
    ...budget,
    actual: computeBudgetCount(filesWithAny, budget)
  }));
  const exceededBudgets = budgetResults.filter(item => item.actual > item.max);
  const hasTotalFailure = totalExplicitAny > MAX_TOTAL_EXPLICIT_ANY;

  ensureReportDir();

  const reportLines = [
    '# Explicit Any Guard Report',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- Total explicit-any usages: ${totalExplicitAny} / ${MAX_TOTAL_EXPLICIT_ANY}`,
    `- Files containing explicit-any: ${filesWithAny.length}`,
    '',
    '## Budget Status',
    ''
  ];

  for (const result of budgetResults) {
    reportLines.push(`- ${result.label}: ${result.actual} / ${result.max}`);
  }

  reportLines.push('', '## Top Files', '');
  if (filesWithAny.length === 0) {
    reportLines.push('- None');
  } else {
    for (const item of filesWithAny.slice(0, 25)) {
      reportLines.push(`- ${item.path}: ${item.explicitAnyCount}`);
    }
  }

  fs.writeFileSync(REPORT_FILE, `${reportLines.join('\n')}\n`, 'utf8');
  console.log(`[type-safety] Report written: ${toPosix(path.relative(ROOT, REPORT_FILE))}`);
  console.log(
    `[type-safety] Total explicit-any usages: ${totalExplicitAny}/${MAX_TOTAL_EXPLICIT_ANY}`
  );

  for (const result of budgetResults) {
    console.log(`[type-safety] ${result.label}: ${result.actual}/${result.max}`);
  }

  if (!hasTotalFailure && exceededBudgets.length === 0) {
    console.log('[type-safety] Passed.');
    process.exit(0);
  }

  console.error('[type-safety] Failed. Explicit-any usage exceeded baseline budgets.');
  if (hasTotalFailure) {
    console.error(`- total: ${totalExplicitAny} (limit: ${MAX_TOTAL_EXPLICIT_ANY})`);
  }
  for (const result of exceededBudgets) {
    console.error(`- ${result.label}: ${result.actual} (limit: ${result.max})`);
  }
  process.exit(1);
}

main();
