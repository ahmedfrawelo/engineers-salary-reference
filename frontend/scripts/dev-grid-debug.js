const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

async function runCheck() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('http://localhost:4300/tender/projects', { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForSelector('engineers-salary-reference-data-grid', { timeout: 60000 });
  const rowCount = await page.$$eval('.data-grid-table tbody tr', els => els.length);
  const cellTexts = await page.$$eval('.data-grid-table tbody tr:first-child td .cell-debug', els => els.map(el => el.textContent.trim()));
  console.log('Row count:', rowCount);
  console.log('First row cells:', cellTexts);
  if (!rowCount) {
    const empty = await page.$eval('body', el => el.innerText.slice(0, 500));
    console.log('Page snippet:', empty);
  }
  await browser.close();
}

async function main() {
  return new Promise((resolve, reject) => {
    const server = spawn('npx', ['ng', 'serve', '--configuration', 'development', '--proxy-config', 'proxy.conf.json', '--port', '4300'], {
      cwd: process.cwd(),
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let done = false;

    const cleanup = () => {
      if (server && !server.killed) {
        server.kill('SIGINT');
      }
    };

    server.stdout.on('data', async data => {
      const text = data.toString();
      process.stdout.write(`[ng] ${text}`);
      if (!done && text.includes('Local: http://localhost:4300')) {
        done = true;
        try {
          await runCheck();
          cleanup();
          resolve();
        } catch (err) {
          console.error('Check failed:', err);
          cleanup();
          reject(err);
        }
      }
    });

    server.stderr.on('data', data => {
      process.stderr.write(`[ng-err] ${data}`);
    });

    server.on('exit', code => {
      if (!done && code !== 0) {
        reject(new Error(`ng serve exited with code ${code}`));
      }
    });
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
