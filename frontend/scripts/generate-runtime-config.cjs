const fs = require('node:fs');
const path = require('node:path');

const apiBaseUrl = String(process.env.API_BASE_URL || '').replace(/\/+$/, '');
if (!apiBaseUrl || !apiBaseUrl.startsWith('https://')) {
  console.error('API_BASE_URL must be an HTTPS URL.');
  process.exit(1);
}

const output = path.join(__dirname, '..', 'src', 'assets', 'runtime-config.json');
const releaseId = String(
  process.env.RELEASE_ID || process.env.GITHUB_SHA || new Date().toISOString()
).trim();
fs.writeFileSync(output, `${JSON.stringify({ apiBaseUrl, releaseId }, null, 2)}\n`, 'utf8');
console.log(`Generated runtime-config.json for release ${releaseId}.`);
