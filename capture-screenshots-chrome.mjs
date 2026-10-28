import { chromium } from 'playwright';
const viewports = [
  {width:1440, height:900, name:'1440'},
  {width:1280, height:800, name:'1280'},
  {width:1024, height:768, name:'1024'},
  {width:768, height:800, name:'768'},
  {width:390, height:800, name:'390'}];
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const vp of viewports) {
    await page.setViewportSize({width: vp.width, height: vp.height});
    await page.goto('http://localhost:5174/wallet', {waitUntil: 'networkidle'});
    await page.waitForTimeout(2000);
    const path = `screenshot-${vp.name}.png`;
    await page.screenshot({path, fullPage: true});
    console.log('Captured', path);
  }
  await browser.close();
})();
