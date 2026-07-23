const fs = require('node:fs');
const path = require('node:path');

const apiBaseUrl = String(process.env.API_BASE_URL || '').replace(/\/+$/, '');
if (!apiBaseUrl || !apiBaseUrl.startsWith('https://')) {
  console.error('API_BASE_URL must be an HTTPS URL.');
  process.exit(1);
}

const output = path.join(__dirname, '..', 'src', 'assets', 'runtime-config.json');
fs.writeFileSync(output, `${JSON.stringify({ apiBaseUrl }, null, 2)}\n`, 'utf8');
console.log('Generated runtime-config.json from API_BASE_URL.');
