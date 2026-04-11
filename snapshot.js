const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();
  await page.goto('http://localhost:3001');
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({path: 'current_view.png'});
  await browser.close();
})();
