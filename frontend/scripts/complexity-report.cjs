#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  COMPONENT_INTERNAL_THRESHOLD,
  HELPER_THRESHOLD,
  LEGACY_COMPONENT_INTERNAL_ALLOWLIST,
  LEGACY_HELPER_ALLOWLIST,
  isComponentOrInternalUnit,
  isHelperUnit
} = require('./source-health-rules.cjs');

const ROOT = process.cwd();
const SRC_APP_DIR = path.join(ROOT, 'src', 'app');
const REPORT_DIR = path.join(ROOT, 'docs', 'quality');
const REPORT_FILE = path.join(REPORT_DIR, 'complexity-report.md');

const LEGACY_COMPONENT_WRAPPER_ALLOWLIST = new Set([]);

function toPosix(inputPath) {
  return inputPath.split(path.sep).join('/');
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
    if (entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineCount(content) {
  return content.split(/\r?\n/).length;
}

function functionCount(content) {
  const matches = content.match(/\bfunction\b|=>/g);
  return matches ? matches.length : 0;
}

function ensureReportDir() {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
}

function isComponentWrapperOnly(content) {
  const withoutComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .trim();

  if (!withoutComments) {
    return false;
  }

  const wrapperExportPattern =
    /export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+['"]\.\/[^'"]+\.internal['"];\s*/g;
  const hasWrapperExports =
    /export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+['"]\.\/[^'"]+\.internal['"];\s*/.test(
      withoutComments
    );
  if (!hasWrapperExports) {
    return false;
  }

  const remaining = withoutComments.replace(wrapperExportPattern, '').trim();
  return remaining.length === 0;
}

function main() {
  if (!fs.existsSync(SRC_APP_DIR)) {
    console.log('[complexity] src/app not found. Skipping.');
    process.exit(0);
  }

  const files = walkTsFiles(SRC_APP_DIR).map(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      path: toPosix(path.relative(ROOT, filePath)),
      lines: lineCount(content),
      functions: functionCount(content),
      hasTsNoCheck: /^\s*\/\/\s*@ts-nocheck/m.test(content)
    };
  });

  const topLargest = [...files].sort((a, b) => b.lines - a.lines).slice(0, 15);
  const componentInternalBreaches = files
    .filter(
      file => isComponentOrInternalUnit(file.path) && file.lines >= COMPONENT_INTERNAL_THRESHOLD
    )
    .filter(file => !LEGACY_COMPONENT_INTERNAL_ALLOWLIST.has(file.path))
    .sort((a, b) => b.lines - a.lines);
  const componentInternalBacklog = files
    .filter(
      file => isComponentOrInternalUnit(file.path) && file.lines >= COMPONENT_INTERNAL_THRESHOLD
    )
    .filter(file => LEGACY_COMPONENT_INTERNAL_ALLOWLIST.has(file.path))
    .sort((a, b) => b.lines - a.lines);
  const helperBreaches = files
    .filter(file => isHelperUnit(file.path) && file.lines >= HELPER_THRESHOLD)
    .filter(file => !LEGACY_HELPER_ALLOWLIST.has(file.path))
    .sort((a, b) => b.lines - a.lines);
  const helperBacklog = files
    .filter(file => isHelperUnit(file.path) && file.lines >= HELPER_THRESHOLD)
    .filter(file => LEGACY_HELPER_ALLOWLIST.has(file.path))
    .sort((a, b) => b.lines - a.lines);
  const tsNoCheckFiles = files.filter(file => file.hasTsNoCheck).map(file => file.path);
  const temporaryNaming = files
    .filter(
      file =>
        /(^|\/)[^/]*\.(refactor|temp)\.[^/]*$/i.test(file.path) || /[-_.]copy[-_.]/i.test(file.path)
    )
    .map(file => file.path)
    .sort();
  const componentWrapperExports = files
    .filter(file => /(^|\/)[^/]*\.component\.ts$/i.test(file.path))
    .filter(file => {
      const content = fs.readFileSync(path.join(ROOT, file.path), 'utf8');
      return isComponentWrapperOnly(content);
    })
    .map(file => file.path)
    .sort();
  const componentWrapperBreaches = componentWrapperExports.filter(
    file => !LEGACY_COMPONENT_WRAPPER_ALLOWLIST.has(file)
  );
  const componentWrapperBacklog = componentWrapperExports.filter(file =>
    LEGACY_COMPONENT_WRAPPER_ALLOWLIST.has(file)
  );

  ensureReportDir();

  const reportLines = [
    '# Complexity Report',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- Component/Internal threshold: ${COMPONENT_INTERNAL_THRESHOLD}`,
    `- Helper threshold: ${HELPER_THRESHOLD}`,
    `- Component/Internal breaches: ${componentInternalBreaches.length}`,
    `- Helper breaches: ${helperBreaches.length}`,
    `- Legacy component/internal backlog: ${componentInternalBacklog.length}`,
    `- Legacy helper backlog: ${helperBacklog.length}`,
    `- @ts-nocheck files: ${tsNoCheckFiles.length}`,
    `- Temporary naming files: ${temporaryNaming.length}`,
    `- Component wrapper re-export breaches: ${componentWrapperBreaches.length}`,
    `- Component wrapper legacy backlog: ${componentWrapperBacklog.length}`,
    '',
    '## Top Largest TS Files',
    ''
  ];

  for (const item of topLargest) {
    reportLines.push(`- ${item.path}: ${item.lines} lines, ~${item.functions} function tokens`);
  }

  reportLines.push('', '## Component/Internal Breaches', '');
  if (componentInternalBreaches.length === 0) {
    reportLines.push('- None');
  } else {
    for (const item of componentInternalBreaches) {
      reportLines.push(`- ${item.path}: ${item.lines}`);
    }
  }

  reportLines.push('', '## Component/Internal Legacy Backlog', '');
  if (componentInternalBacklog.length === 0) {
    reportLines.push('- None');
  } else {
    for (const item of componentInternalBacklog) {
      reportLines.push(`- ${item.path}: ${item.lines}`);
    }
  }

  reportLines.push('', '## Helper Breaches', '');
  if (helperBreaches.length === 0) {
    reportLines.push('- None');
  } else {
    for (const item of helperBreaches) {
      reportLines.push(`- ${item.path}: ${item.lines}`);
    }
  }

  reportLines.push('', '## Helper Legacy Backlog', '');
  if (helperBacklog.length === 0) {
    reportLines.push('- None');
  } else {
    for (const item of helperBacklog) {
      reportLines.push(`- ${item.path}: ${item.lines}`);
    }
  }

  reportLines.push('', '## @ts-nocheck Files', '');
  if (tsNoCheckFiles.length === 0) {
    reportLines.push('- None');
  } else {
    for (const item of tsNoCheckFiles) {
      reportLines.push(`- ${item}`);
    }
  }

  reportLines.push('', '## Temporary Naming Files', '');
  if (temporaryNaming.length === 0) {
    reportLines.push('- None');
  } else {
    for (const item of temporaryNaming) {
      reportLines.push(`- ${item}`);
    }
  }

  reportLines.push('', '## Component Wrapper Re-Export Breaches', '');
  if (componentWrapperBreaches.length === 0) {
    reportLines.push('- None');
  } else {
    for (const item of componentWrapperBreaches) {
      reportLines.push(`- ${item}`);
    }
  }

  reportLines.push('', '## Component Wrapper Legacy Backlog', '');
  if (componentWrapperBacklog.length === 0) {
    reportLines.push('- None');
  } else {
    for (const item of componentWrapperBacklog) {
      reportLines.push(`- ${item}`);
    }
  }

  fs.writeFileSync(REPORT_FILE, `${reportLines.join('\n')}\n`, 'utf8');
  console.log(`[complexity] Report written: ${toPosix(path.relative(ROOT, REPORT_FILE))}`);

  const hasFailure =
    componentInternalBreaches.length > 0 ||
    helperBreaches.length > 0 ||
    tsNoCheckFiles.length > 0 ||
    temporaryNaming.length > 0 ||
    componentWrapperBreaches.length > 0;

  if (hasFailure) {
    console.error('[complexity] Failed. See report for details.');
    process.exit(1);
  }

  console.log('[complexity] Passed.');
}

main();
