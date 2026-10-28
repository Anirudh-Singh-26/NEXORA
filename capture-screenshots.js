const puppeteer = require('puppeteer');
const viewports = [
  {width:1440, height:900, name:'1440'},
  {width:1280, height:800, name:'1280'},
  {width:1024, height:768, name:'1024'},
  {width:768, height:800, name:'768'},
  {width:390, height:800, name:'390'}];
(async () => {
  const browser = await puppeteer.launch({headless:true});
  const page = await browser.newPage();
  for(const vp of viewports){
    await page.setViewport({width: vp.width, height: vp.height});
    await page.goto('http://localhost:5174/wallet', {waitUntil:'networkidle2'});
    await page.waitForTimeout(2000);
    const path = `screenshot-${vp.name}.png`;
    await page.screenshot({path, fullPage:true});
    console.log('Captured', path);
  }
  await browser.close();
})();
