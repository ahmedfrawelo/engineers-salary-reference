const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('http://localhost:4200/tender/projects', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('engineers-salary-reference-data-grid');
  const rows = await page.$$eval('.data-grid-table tbody tr', els => els.length);
  const sampleCell = await page.$eval('.data-grid-table tbody tr td:nth-child(2) .cell-value', el => el.textContent.trim());
  console.log('rows:', rows);
  console.log('sample cell:', sampleCell);
  await browser.close();
})();
