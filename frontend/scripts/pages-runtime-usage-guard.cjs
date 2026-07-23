#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'src', 'app');
const ALLOWLIST_PATH = path.join(
  ROOT,
  'scripts',
  'allowlists',
  'pages-runtime-imports-allowlist.json'
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

function isSourceFile(relativePath) {
  return /\.(ts|tsx|js|mjs|cjs)$/.test(relativePath) && !relativePath.endsWith('.d.ts');
}

function isTestLikeFile(relativePath) {
  return /(^|\/)[^/]+\.(spec|test|stories|story)\.(ts|tsx|js|mjs|cjs)$/.test(relativePath);
}

function tryResolveImportFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.mjs'),
    path.join(basePath, 'index.cjs')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function resolveImportPath(importerAbsolutePath, specifier) {
  if (specifier.startsWith('.')) {
    const resolved = tryResolveImportFile(path.resolve(path.dirname(importerAbsolutePath), specifier));
    return resolved ? toPosix(path.relative(ROOT, resolved)) : null;
  }

  if (specifier.startsWith('src/')) {
    const resolved = tryResolveImportFile(path.join(ROOT, specifier));
    return resolved ? toPosix(path.relative(ROOT, resolved)) : toPosix(specifier);
  }

  if (specifier.startsWith('/src/')) {
    const normalized = specifier.slice(1);
    const resolved = tryResolveImportFile(path.join(ROOT, normalized));
    return resolved ? toPosix(path.relative(ROOT, resolved)) : toPosix(normalized);
  }

  if (specifier.startsWith('@features/')) {
    const resolved = tryResolveImportFile(
      path.join(ROOT, 'src', 'app', 'features', specifier.slice('@features/'.length))
    );
    return resolved ? toPosix(path.relative(ROOT, resolved)) : null;
  }

  if (specifier.startsWith('@shared-kernel/')) {
    const resolved = tryResolveImportFile(
      path.join(ROOT, 'src', 'app', 'shared-kernel', specifier.slice('@shared-kernel/'.length))
    );
    return resolved ? toPosix(path.relative(ROOT, resolved)) : null;
  }

  if (specifier.startsWith('@platform/')) {
    const resolved = tryResolveImportFile(
      path.join(ROOT, 'src', 'app', 'platform', specifier.slice('@platform/'.length))
    );
    return resolved ? toPosix(path.relative(ROOT, resolved)) : null;
  }

  if (specifier.startsWith('@infrastructure/')) {
    const resolved = tryResolveImportFile(
      path.join(ROOT, 'src', 'app', 'infrastructure', specifier.slice('@infrastructure/'.length))
    );
    return resolved ? toPosix(path.relative(ROOT, resolved)) : null;
  }

  return null;
}

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) {
    return { importerPatterns: [], edgePatterns: [] };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
    const importerPatterns = Array.isArray(parsed.importerPatterns)
      ? parsed.importerPatterns.map(pattern => new RegExp(pattern))
      : [];
    const edgePatterns = Array.isArray(parsed.edgePatterns)
      ? parsed.edgePatterns.map(pattern => new RegExp(pattern))
      : [];

    return { importerPatterns, edgePatterns };
  } catch (error) {
    console.error(`[pages-runtime-usage] Failed to read allowlist: ${String(error)}`);
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
  const strictMode = process.env.STRICT_RUNTIME_NO_PAGES === '1';
  const { importerPatterns, edgePatterns } = loadAllowlist();
  const files = walkFiles(APP_DIR);
  const violations = [];
  let trackedEdges = 0;

  for (const absolutePath of files) {
    const importer = toPosix(path.relative(ROOT, absolutePath));
    if (!isSourceFile(importer) || isTestLikeFile(importer)) {
      continue;
    }
    if (importer.startsWith('src/app/pages/')) {
      continue;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const importRegex =
      /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (!specifier) {
        continue;
      }

      const resolved = resolveImportPath(absolutePath, specifier);
      const target = resolved ?? specifier;
      const isPagesTarget =
        target.startsWith('src/app/pages/') || /^(\.?\.\/)+pages\//.test(specifier);

      if (!isPagesTarget) {
        continue;
      }

      const edge = `${importer} -> ${target}`;
      if (strictMode) {
        violations.push(edge);
        continue;
      }

      const importerAllowed = importerPatterns.some(pattern => pattern.test(importer));
      const edgeAllowed = edgePatterns.some(pattern => pattern.test(edge));
      if (importerAllowed || edgeAllowed) {
        trackedEdges += 1;
        continue;
      }

      violations.push(edge);
    }
  }

  if (violations.length > 0) {
    console.error('[pages-runtime-usage] Failed.');
    printSection('Runtime imports to src/app/pages detected:', violations);
    process.exit(1);
  }

  const mode = strictMode ? 'strict' : 'allowlist';
  console.log(
    `[pages-runtime-usage] Passed. Mode: ${mode}. Tracked transitional edges: ${trackedEdges}.`
  );
}

main();
