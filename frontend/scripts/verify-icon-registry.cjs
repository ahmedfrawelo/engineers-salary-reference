/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.resolve(__dirname, '../src/app');
const registryPath = path.join(sourceRoot, 'shared/icons/app-icon.registry.ts');
const legacyStatefulRegistryPath = path.join(sourceRoot, 'shared/icons/stateful-icon.registry.ts');
const programmaticIconPath = path.join(sourceRoot, 'shared/icons/programmatic-app-icon.ts');
const toastPath = path.join(sourceRoot, 'shared/toast/toast.component.ts');
const violations = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

for (const filePath of walk(sourceRoot)) {
  const relativePath = path.relative(process.cwd(), filePath).replaceAll('\\', '/');
  const contents = fs.readFileSync(filePath, 'utf8');

  if (
    filePath.endsWith('.ts') &&
    filePath !== registryPath &&
    /from\s+['"]@hugeicons\/core-free-icons['"]/.test(contents)
  ) {
    violations.push(`${relativePath}: imports icon definitions outside app-icon.registry.ts`);
  }

  if (filePath.endsWith('.html') && /<svg\b/i.test(contents)) {
    violations.push(`${relativePath}: contains inline SVG geometry outside app-icon.registry.ts`);
  }

  if (filePath.endsWith('.ts') && filePath !== registryPath && filePath !== programmaticIconPath) {
    const isDataVisualization = relativePath.includes('/shared/charts/');
    const withoutToastShape =
      filePath === toastPath
        ? contents.replace(/<svg\s+class="toast-blob"[\s\S]*?<\/svg>/g, '')
        : contents;
    if (!isDataVisualization && /<svg\b/i.test(withoutToastShape)) {
      violations.push(`${relativePath}: contains UI SVG geometry outside app-icon.registry.ts`);
    }
  }

  if (/assets\/icons\//.test(contents)) {
    violations.push(`${relativePath}: references an icon asset outside app-icon.registry.ts`);
  }
}

if (fs.existsSync(legacyStatefulRegistryPath)) {
  violations.push('src/app/shared/icons/stateful-icon.registry.ts: legacy split registry still exists');
}

if (violations.length > 0) {
  console.error('Icon registry guard failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Icon registry guard passed: all UI icon definitions resolve through app-icon.registry.ts.');
