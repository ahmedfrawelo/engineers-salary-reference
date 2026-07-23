/**
 * Bundle Analyzer Script
 *
 * Analyzes Angular production build bundles.
 *
 * Usage:
 * ```bash
 * npm run build:prod:clean
 * node scripts/bundle-analyzer.js
 * ```
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST_DIR_CANDIDATES = [
  path.join(__dirname, '..', 'dist', 'engineers-salary-reference'),
  path.join(__dirname, '..', 'dist', 'engineers-salary-reference', 'browser'),
];
const STATS_FILE_CANDIDATES = DIST_DIR_CANDIDATES.map(distDir => path.join(distDir, 'stats.json'));
const SIZE_THRESHOLD_KB = 200;

function resolveDistDir() {
  return DIST_DIR_CANDIDATES.find(dirPath => fs.existsSync(dirPath));
}

function resolveStatsFile() {
  return STATS_FILE_CANDIDATES.find(filePath => fs.existsSync(filePath));
}

function getFileSizeInKB(filePath) {
  const stats = fs.statSync(filePath);
  return (stats.size / 1024).toFixed(2);
}

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

function analyzeBundle() {
  console.log('Analyzing bundle...\n');

  const distDir = resolveDistDir();
  if (!distDir) {
    console.error('Build directory not found. Run "npm run build:prod:clean" first.');
    process.exit(1);
  }

  const allFiles = getAllFiles(distDir);
  const jsFiles = allFiles.filter(filePath => filePath.endsWith('.js'));
  const cssFiles = allFiles.filter(filePath => filePath.endsWith('.css'));

  console.log('JavaScript bundles:');
  console.log('-'.repeat(80));

  const jsStats = jsFiles
    .map(filePath => ({
      file: path.relative(distDir, filePath),
      size: Number.parseFloat(getFileSizeInKB(filePath)),
    }))
    .sort((a, b) => b.size - a.size);

  jsStats.forEach(({ file, size }) => {
    const flag = size > SIZE_THRESHOLD_KB ? 'WARN' : 'OK';
    console.log(`${flag} ${file.padEnd(50)} ${size.toFixed(2)} KB`);
  });

  const totalJsSize = jsStats.reduce((sum, { size }) => sum + size, 0);
  console.log('-'.repeat(80));
  console.log(`Total JS: ${totalJsSize.toFixed(2)} KB\n`);

  console.log('CSS bundles:');
  console.log('-'.repeat(80));

  const cssStats = cssFiles
    .map(filePath => ({
      file: path.relative(distDir, filePath),
      size: Number.parseFloat(getFileSizeInKB(filePath)),
    }))
    .sort((a, b) => b.size - a.size);

  cssStats.forEach(({ file, size }) => {
    console.log(`OK   ${file.padEnd(50)} ${size.toFixed(2)} KB`);
  });

  const totalCssSize = cssStats.reduce((sum, { size }) => sum + size, 0);
  console.log('-'.repeat(80));
  console.log(`Total CSS: ${totalCssSize.toFixed(2)} KB\n`);

  const totalSize = totalJsSize + totalCssSize;
  console.log('Summary:');
  console.log('-'.repeat(80));
  console.log(`Total bundle size: ${totalSize.toFixed(2)} KB`);
  console.log(`JavaScript: ${totalJsSize.toFixed(2)} KB (${((totalJsSize / totalSize) * 100).toFixed(1)}%)`);
  console.log(`CSS: ${totalCssSize.toFixed(2)} KB (${((totalCssSize / totalSize) * 100).toFixed(1)}%)`);
  console.log(`Number of chunks: ${jsStats.length}`);

  const largeFiles = jsStats.filter(file => file.size > SIZE_THRESHOLD_KB);
  if (largeFiles.length > 0) {
    console.log('\nLarge bundles detected:');
    console.log('-'.repeat(80));
    largeFiles.forEach(({ file, size }) => {
      console.log(`- ${file}: ${size.toFixed(2)} KB`);
    });
    console.log('\nRecommendations:');
    console.log('  1. Review large dependencies in these chunks');
    console.log('  2. Consider lazy loading more modules');
    console.log('  3. Use webpack-bundle-analyzer for detailed analysis');
  }

  console.log('\nBundle analysis complete.\n');
}

function generateStatsJson() {
  console.log('Generating stats.json...\n');

  try {
    execSync('ng build -c production --stats-json', { stdio: 'inherit' });
    const statsFile = resolveStatsFile();
    console.log('stats.json generated successfully.');
    if (statsFile) {
      console.log('\nTo visualize:');
      console.log(`npx webpack-bundle-analyzer ${path.relative(path.join(__dirname, '..'), statsFile)}`);
    }
  } catch (error) {
    console.error('Failed to generate stats.json:', error.message);
    process.exitCode = 1;
  }
}

const args = process.argv.slice(2);

if (args.includes('--stats')) {
  generateStatsJson();
} else {
  analyzeBundle();
}
