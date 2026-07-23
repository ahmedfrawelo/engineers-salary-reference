const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('http://localhost:4300/tender/projects', { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForSelector('engineers-salary-reference-data-grid', { timeout: 60000 });
  const rows = await page.$$eval('.data-grid-table tbody tr', els => els.length);
  const sampleCellTexts = await page.$$eval('.data-grid-table tbody tr:first-child td .cell-debug', els => els.map(el => el.textContent.trim()));
  console.log('rows:', rows);
  console.log('sample cells:', sampleCellTexts);
  await browser.close();
})();
