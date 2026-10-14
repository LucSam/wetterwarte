import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {navigate,waitForDisplay} from './navigation.mjs';
import {repeatedTemperatureInput} from './temperature-input.mjs';

const engine=process.argv.includes('webkit')?'webkit':'chrome';
await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1480,height:1120},deviceScaleFactor:2}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  if(!localStorage.getItem('pi-startmenue'))localStorage.setItem('pi-startmenue',JSON.stringify({size:'480x320',theme:'light',weatherMode:'demo',idle:0}));
  if(!localStorage.getItem('wetterwarte-display-preview'))localStorage.setItem('wetterwarte-display-preview',JSON.stringify({mode:'layout',pxPerMm:6,calibrated:true,dpr:2}));
  if(!localStorage.getItem('wetterwarte-temperature'))localStorage.setItem('wetterwarte-temperature',JSON.stringify({scale:'month',year:2024,month:2,reference:'rolling',plot:'curves'}));
 });
 await page.goto('http://127.0.0.1:5173/');await page.locator('.tile[data-open=weather]').click();
 const weather=page.frameLocator('[data-module=weather]');await weather.locator('.device').waitFor();await page.waitForTimeout(500);
 await navigate(weather,'[data-view=climate]');await navigate(weather,'[data-climate-tab=temperature]');
 if(process.argv.includes('--repeat-selects')){await repeatedTemperatureInput(page,weather);}else{
 const shape=()=>weather.locator('.temperature-curves path.plot-mean').getAttribute('d');
 for(const size of ['480x320','800','1280','480']){
  await page.locator(`button[data-size="${size}"]`).click();await weather.locator(`.device.size-${size}`).waitFor();
  for(const scale of ['month','year','long']){
   await weather.locator('#temperature-scale').selectOption(scale);await waitForDisplay(page);
   for(const plot of ['curves','anomaly','spread']){
   await weather.locator('#temperature-plot').selectOption(plot);await waitForDisplay(page);
   assert.equal(await weather.locator('.temperature-figure').count(),1,'One focused plot on every display');
   assert.equal(await weather.locator('.plot-band').count()>0,plot==='spread',`${size}/${scale}/${plot}: band only in spread view`);
   assert.equal(await weather.locator('path.plot-min').count()>0,plot==='curves','Extremes only in curves view');
   const metrics=await weather.locator('.temperature-history').evaluate(e=>{
    const parent=e.closest('.device-content').getBoundingClientRect();
    const visible=[...e.querySelectorAll('select,.temperature-summary,.temperature-figure,.temperature-legend,.temperature-anomaly-legend,.temperature-source')].filter(n=>n.getBoundingClientRect().height>0);
    return {height:e.clientHeight,contentHeight:e.scrollHeight,contentWidth:e.scrollWidth,width:e.clientWidth,overflow:visible.filter(n=>{const r=n.getBoundingClientRect();return r.bottom>parent.bottom+.5||r.right>parent.right+.5;}).map(n=>n.className||n.id),plots:[...e.querySelectorAll('.temperature-plot')].filter(n=>n.clientHeight>0).map(n=>({h:n.clientHeight,w:n.clientWidth,font:parseFloat(getComputedStyle(n.querySelector('text')).fontSize)})),controls:[...e.querySelectorAll('select')].filter(n=>n.clientHeight>0).map(n=>n.clientHeight)};
   });
   assert.deepEqual(metrics.overflow,[],`${size}/${scale}: clipped ${JSON.stringify(metrics)}`);assert(metrics.contentHeight<=metrics.height+1&&metrics.contentWidth<=metrics.width+1,`${size}/${scale}: overflow ${JSON.stringify(metrics)}`);
   assert(metrics.plots.every(p=>p.h>=95&&p.font>=12),`${size}/${scale}: chart too small ${JSON.stringify(metrics)}`);assert(metrics.controls.every(h=>h>=44));
   await page.locator('.device-stage').screenshot({path:new URL(`../test-results/temperature-${engine}-${size}-${scale}-${plot}.png`,import.meta.url).pathname});
   }
  }
  await weather.locator('#temperature-scale').selectOption('month');
  await weather.locator('#temperature-plot').selectOption('curves');
  await weather.locator('#temperature-month').selectOption('2');
  const before=await shape();await weather.locator('#temperature-month').selectOption('7');assert.notEqual(await shape(),before,'Month changes curve');
  await weather.locator('#temperature-plot').selectOption('anomaly');const baselineBefore=await weather.locator('.legend-reference').textContent();
  await weather.locator('#temperature-reference').selectOption('normal');assert.notEqual(await weather.locator('.legend-reference').textContent(),baselineBefore);
  await weather.locator('#temperature-reference').selectOption('rolling');
  {
   await weather.locator('#temperature-plot').selectOption('anomaly');assert(await weather.locator('.temperature-anomaly').isVisible());assert(!(await weather.locator('.temperature-curves').isVisible()));
   assert(await weather.locator('.temperature-anomaly rect').count()>0);await weather.locator('#temperature-plot').selectOption('curves');
  }
  console.log(`PASS temperature layout and controls ${engine} ${size}`);
 }
 // Keep the Retina/native path and its select proxy under test, without opening Safari.
 await page.locator('button[data-size="480x320"]').click();await page.locator('[data-mode=pixels]').click();await waitForDisplay(page);
 await page.locator('.native-display-canvas').waitFor();assert.deepEqual(await page.locator('.native-display-canvas').evaluate(c=>[c.width,c.height]),[480,320]);
 // Click the actual visible select position: exercise Safari's unscaled proxy.
 const selectorBox=await weather.locator('#temperature-plot').boundingBox();await page.mouse.click(selectorBox.x+selectorBox.width/2,selectorBox.y+selectorBox.height/2);
 await page.locator('select.input-proxy').selectOption('anomaly');await waitForDisplay(page);assert.equal(await page.locator('select.input-proxy').count(),0);
 assert.equal(await weather.locator('#temperature-plot').inputValue(),'anomaly');assert(await weather.locator('.temperature-anomaly').isVisible());
 await page.locator('.device-stage').screenshot({path:new URL(`../test-results/temperature-${engine}-native.png`,import.meta.url).pathname});
 await page.locator('#theme').selectOption('dark');await waitForDisplay(page);
 await page.locator('.device-stage').screenshot({path:new URL(`../test-results/temperature-${engine}-dark.png`,import.meta.url).pathname});
 // Integration fixture: one uncached year, 29 persisted reference years.
 // External responses below are deliberate test fixtures, never shipped data.
 await page.locator('[data-mode=layout]').click();await page.locator('button[data-size="800"]').click();
 await weather.locator('#temperature-scale').selectOption('month');await weather.locator('#temperature-year').selectOption('2024');await weather.locator('#temperature-month').selectOption('7');
 const requests=[];
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();
  if(url.hostname==='archive-api.open-meteo.com'&&url.searchParams.get('daily')?.includes('temperature_2m_min')){
   requests.push(url.href);assert.equal(url.searchParams.get('models'),'era5');assert.equal(url.searchParams.get('timezone'),'Europe/Berlin');assert.equal(url.searchParams.get('temperature_unit'),'celsius');if(url.searchParams.get('start_date')==='1961-01-01')return route.fulfill({status:503,body:'Temporarily unavailable'});assert.equal(url.searchParams.get('start_date'),'2024-01-01');
   const time=Array.from({length:366},(_,i)=>new Date(Date.UTC(2024,0,1)+i*86400000).toISOString().slice(0,10));
   await new Promise(r=>setTimeout(r,700));return route.fulfill({json:{timezone:'Europe/Berlin',daily_units:{temperature_2m_mean:'°C',temperature_2m_min:'°C',temperature_2m_max:'°C'},daily:{time,temperature_2m_mean:time.map(()=>15),temperature_2m_min:time.map(()=>4),temperature_2m_max:time.map(()=>26)}}});
  }return route.abort();
 });
 const actualYear=Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Berlin',year:'numeric'}).format(new Date()));
 await weather.locator('html').evaluate(async(_e,actualYear)=>{
  const req=indexedDB.open('wetterwarte-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('data');const db=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});
  const years=Array.from({length:30},(_,i)=>actualYear-30+i).filter(year=>year!==2024).map(year=>{const n=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;return {year,fetchedAt:Date.now()/1000,mean:Array(n).fill(10),min:Array(n).fill(5),max:Array(n).fill(15)};});
  const data={schema:1,kind:'temperature-history',mode:'live',source:'Integration fixture',place:'elstal',model:'era5',unit:'°C',timezone:'Europe/Berlin',runAt:null,fetchedAt:Date.now()/1000,years};
  await new Promise((res,rej)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(data,'temperature-daily-v1-elstal');tx.objectStore('data').put(0,'last-climate-request');tx.oncomplete=res;tx.onerror=rej;});db.close();
 },actualYear);
 await page.locator('#weather-mode').selectOption('live');
 await weather.locator('.temperature-source').filter({hasText:'ERA5 2024'}).waitFor();
 const plotBox=()=>weather.locator('html').evaluate(()=>document.querySelector('.temperature-charts').getBoundingClientRect().toJSON());
 const loadingBox=await plotBox();
 await weather.locator('.stat-min strong').filter({hasText:'4,0'}).waitFor();
 const loadedBox=await plotBox();assert.deepEqual(loadingBox,loadedBox,'Data arrival must not resize the plots');
 assert.match(await weather.locator('.stat-max strong').textContent(),/26,0/);assert.match(await weather.locator('.temperature-summary>div').nth(3).textContent(),/\+4,8/);
 assert.equal(requests.length,1,'Only the missing year is requested');
 await weather.locator('#temperature-month').selectOption('8');assert.equal(requests.length,1,'Changing month must use cached daily data');
 await page.context().setOffline(true);await weather.locator('.temperature-source').filter({hasText:'Offline'}).waitFor();assert.match(await weather.locator('.stat-max strong').textContent(),/26,0/);
 await page.context().setOffline(false);
 // Reload only the iframe with its saved live mode: all values must come from IDB.
 const moduleFrame=page.frames().find(f=>f.url().includes('/wetter/')&&f.url().includes('embedded'));
 await moduleFrame.goto(moduleFrame.url());await weather.locator('.device').waitFor();await navigate(weather,'[data-view=climate]');await navigate(weather,'[data-climate-tab=temperature]');
 await weather.locator('.stat-max strong').filter({hasText:'26,0'}).waitFor();assert.equal(requests.length,1,'Reload must reuse persisted full-year cache');
 await weather.locator('html').evaluate(async()=>{const {writeCache}=await import('/wetter/src/data/cache.ts');await writeCache('last-climate-request',0);});
 await weather.locator('#temperature-year').selectOption('1961');await weather.locator('.temperature-source').filter({hasText:'HTTP 503'}).waitFor();
 assert.match(await weather.locator('.stat-max strong').textContent(),/–/);assert(!(await weather.locator('.temperature-history').textContent()).includes('DEMO'),'Network failure must not substitute demo values');
 await weather.locator('#temperature-year').selectOption('2024');await weather.locator('.stat-max strong').filter({hasText:'26,0'}).waitFor();assert.equal(requests.length,2);
 await page.locator('#weather-mode').selectOption('demo');
 await page.clock.setFixedTime(new Date('2029-07-01T12:00:00Z'));
 await weather.locator('html').evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 assert.match(await weather.locator('.legend-reference').textContent(),/1999–2028/,'Reference must update with actual calendar, without changing its control');
 await weather.locator('#temperature-reference').selectOption('normal');assert.match(await weather.locator('.legend-reference').textContent(),/1991–2020/);
 await page.clock.setFixedTime(new Date('2031-01-05T12:00:00Z'));
 await weather.locator('html').evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 assert.match(await weather.locator('.legend-reference').textContent(),/2001–2030/);
 console.log(`PASS automatic load, cache, offline, fixed plot geometry and native select proxy ${engine}`);
 assert.deepEqual(errors,[]);console.log(`PASS native preview, theme and zero console errors ${engine}`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
