import {navigate} from './navigation.mjs';
import { writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>{if(!localStorage.getItem('wetterwarte-settings'))localStorage.setItem('wetterwarte-settings',JSON.stringify({theme:'light'}));});for(const host of ['archive-api','climate-api','ensemble-api','air-quality-api'])await page.route(`https://${host}.open-meteo.com/**`,route=>route.abort());});
async function fits(page:any,vertical=false){const dim=await page.locator('.device-content').evaluate((e:Element)=>({w:e.scrollWidth,cw:e.clientWidth,h:e.scrollHeight,ch:e.clientHeight}));expect(dim.w).toBeLessThanOrEqual(dim.cw+1);if(vertical)expect(dim.h).toBeLessThanOrEqual(dim.ch+1);}
test('All views and sizes; no scrolling at 1280, weather icons, climate maps and export',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  await expect(page.locator('.data-badge')).toHaveText('DEMO · Beispieldaten');
  await expect(page.locator('#place')).toHaveValue('elstal');
  expect(await page.locator('.device').evaluate(e=>getComputedStyle(e).fontFamily)).toMatch(/^Helvetica/);
  expect(await page.locator('.single-row-header').textContent()).not.toMatch(/[⌁≋]/);
  for(const size of ['1280','800','480']){
    await page.locator(`[data-size="${size}"]`).click();
    for(const view of ['weather','radar','compare','climate','clock']){
      await navigate(page,`nav [data-view="${view}"]`);
      const box=await page.locator('.device').boundingBox();expect(Math.round(box!.width)).toBe(Number(size));expect(Math.round(box!.height)).toBe(size==='1280'?720:480);
      const overflow=await page.locator('.device-content').evaluate(e=>e.scrollWidth>e.clientWidth+1);expect(overflow).toBe(false);
      if(view==='clock'){
        await expect(page.locator('#header-clock')).toHaveCount(0);
        expect(await page.locator('#clock-large').evaluate(e=>getComputedStyle(e).fill)).toBe('rgb(37, 37, 37)');
        const content=await page.locator('#view-content').boundingBox(),clock=await page.locator('.clock-face').boundingBox();
        expect(clock!.height).toBeGreaterThan(content!.height*.7);expect(clock!.y).toBeGreaterThanOrEqual(content!.y);expect(clock!.y+clock!.height).toBeLessThanOrEqual(content!.y+content!.height);
        expect(await page.locator('#clock-large').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThan(size==='1280'?280:size==='800'?155:115);
      }
      await expect(page.locator('input[type="range"]')).toHaveCount(view==='radar'?1:0);
      if(view==='compare')expect(await page.locator('.line-chart path[stroke]').evaluateAll(paths=>paths.every(p=>(p.getAttribute('d')?.match(/ L /g)?.length??0)>1))).toBe(true);
      await fits(page,size==='1280'||size==='800'||view==='radar');
      await page.screenshot({path:`test-results/${size}-${view}.png`});
      if(view==='climate'){
        await navigate(page,'[data-climate-tab="map"]');await expect(page.locator('.climate-field-map')).toBeVisible();await fits(page,size==='1280'||size==='800');
        await navigate(page,'[data-climate-tab="history"]');await expect(page.locator('.history-chart')).toBeVisible();await fits(page,size==='1280'||size==='800');await page.screenshot({path:`test-results/${size}-history.png`});
        await navigate(page,'[data-climate-tab="projection"]');
        for(const metric of ['temperature','hotDays','rain']){
          await page.locator(`[data-metric="${metric}"]`).click();
          expect(await page.locator('.device-content').evaluate(e=>e.scrollWidth>e.clientWidth+1)).toBe(false);
          await fits(page,size==='1280'||size==='800');
          await page.screenshot({path:`test-results/${size}-projection-${metric}.png`});
        }
        await navigate(page,'[data-climate-tab="history"]');
      }

    }
  }
  await navigate(page,'nav [data-view="weather"]');
  await page.locator('.time-shortcuts [data-step="24"]').click();
  await expect(page.locator('.hour-cell[aria-pressed="true"]')).toHaveAttribute('data-step','24');
  const before=await page.locator('.observation > .eyebrow').textContent();
  await page.getByRole('button',{name:'Nächste sechs Stunden'}).click();
  await expect(page.locator('.hour-cell[aria-pressed="true"]')).toHaveAttribute('data-step','30');
  expect(await page.locator('.observation > .eyebrow').textContent()).not.toEqual(before);
  await expect(page.locator('.map-value')).toHaveCount(0);
  await expect(page.locator('.radar-card-map')).toBeVisible();
  await page.locator('#place-button').click();await page.locator('button[data-place="berlin"]').click();await expect(page.locator('.place-detail')).toContainText('Mitte');
  await navigate(page,'nav [data-view="climate"]');
  await expect(page.locator('.history-chart')).toBeVisible();
  await page.locator('#history-year').selectOption('1976');await expect(page.locator('#history-year')).toHaveValue('1976');
  await navigate(page,'[data-climate-tab="projection"]');
  await page.locator('[data-metric="hotDays"]').click();await expect(page.locator('.method-note').first()).toContainText('≥ 30 °C');
  await page.locator('[data-metric="rain"]').click();await expect(page.locator('.season-model')).toHaveCount(3);await expect(page.locator('.season-point')).toHaveCount(12);await expect(page.locator('.climate-models')).toHaveCount(0);
  await expect(page.locator('[data-action="home"]')).toBeVisible();
  const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();expect((await download).suggestedFilename()).toBe('wetterwarte-climate-demo.json');
  await page.reload();await expect(page.locator('#place')).toHaveValue('berlin');await expect(page.locator('#view-menu-button')).toContainText('Klima');
  expect(errors).toEqual([]);
});
test('800-pixel pages keep complete graphics visible and radar has one labelled time',async({page})=>{
 await page.goto('./');await page.locator('[data-size="800"]').click();
 for(const theme of ['light','dark']){
  await page.locator(`button[data-theme="${theme}"]`).click();
  for(const part of ['overview','hours','forecast','moon']){
   await navigate(page,`[data-weather-page="${part}"]`);await fits(page,true);
   if(part==='overview'){await expect(page.locator('.radar-card-map')).toBeVisible();await expect(page.locator('.day-row')).toBeVisible();await expect(page.locator('.moon-page')).toBeHidden();await expect(page.locator('.reading').first()).toBeVisible();}
   if(part==='moon'){await expect(page.locator('.moon-page')).toBeVisible();await expect(page.locator('.reading').first()).toBeHidden();}
   const selector=part==='overview'?'.observation':part==='hours'?'.hourly-forecast':part==='forecast'?'.forecast-plot':'.moon-page';
   const content=await page.locator('.device-content').boundingBox(),plot=await page.locator(selector).boundingBox();
   expect(plot!.y).toBeGreaterThanOrEqual(content!.y);expect(plot!.y+plot!.height).toBeLessThanOrEqual(content!.y+content!.height);
   await page.screenshot({path:`test-results/800-${theme}-${part}.png`});
  }
  await navigate(page,'[data-weather-page="hours"]');await page.locator('.time-shortcuts [data-step="24"]').click();await expect(page.locator('.hour-cell[aria-pressed="true"]')).toHaveAttribute('data-step','24');await fits(page,true);
 }
 await navigate(page,'[data-weather-page="hours"]');
 await expect(page.locator('.outlook-heading')).toContainText('14-Tage-Vorschau');await expect(page.locator('.outlook-day')).toHaveCount(7);
 const firstWeek=await page.locator('.outlook-day>span:first-of-type').allTextContents();
 await page.locator('[data-outlook-week="1"]').click();await expect(page.locator('.outlook-day')).toHaveCount(7);
 const secondWeek=await page.locator('.outlook-day>span:first-of-type').allTextContents();expect(secondWeek.some(d=>firstWeek.includes(d))).toBe(false);
 await navigate(page,'[data-weather-page="moon"]');const initialMoon=await page.locator('.moon-description>strong').innerText();
 await page.locator('.moon-day-row [data-moon-day="6"]').click();expect(await page.locator('.moon-description>strong').innerText()).not.toBe(initialMoon);
 for(const size of ['1280','800','480']){await page.locator(`[data-size="${size}"]`).click();for(const sub of ['hours','moon']){await navigate(page,`[data-weather-page="${sub}"]`);await fits(page,size!=='480');}}
 await navigate(page,'nav [data-view="radar"]');
 for(const size of ['480','800','1280']){
  await page.locator(`[data-size="${size}"]`).click();await expect(page.locator('#header-clock')).toHaveCount(1);await expect(page.locator('.radar-time-label')).toHaveText('Beispielzeit');await fits(page,true);
  if(size==='800')expect((await page.locator('.radar-map').boundingBox())!.height).toBeGreaterThanOrEqual(240); // 44 px layer selector and a permanent progress slot share the display.
 }
 await page.locator('[data-size="800"]').click();await navigate(page,'nav [data-view="climate"]');await navigate(page,'[data-climate-tab="map"]');
 const displayed:Record<string,string>={};
 for(const layer of ['baseline','recent','change']){await page.locator(`[data-climate-layer="${layer}"]`).click();await fits(page,true);displayed[layer]=(await page.locator('.field-delta').innerText()).trim();}
 expect(displayed.change).toMatch(/^\+/);expect(displayed.baseline).not.toBe(displayed.recent);expect(displayed.recent).not.toBe(displayed.change);
 const values=await page.locator('.field-periods strong').allTextContents();expect(displayed.baseline).toBe(values[0].trim());expect(displayed.recent).toBe(values[1].trim());
 await page.screenshot({path:'test-results/800-climate-map.png'});
 await expect(page.locator('[data-action="home"]')).toBeVisible();
});
test('Failed live source never silently displays demo data',async({page})=>{
  await page.route('https://maps.dwd.de/**',route=>route.abort());
  await page.route('https://api.open-meteo.com/**',route=>route.abort());
  await page.goto('./');await page.locator('[data-mode="live"]').click();
  await expect(page.locator('.error-banner')).toContainText('nicht erreichbar');
  await expect(page.locator('.temperature')).toHaveCount(0);await expect(page.locator('.data-badge')).toHaveText('Keine Daten');
  await page.locator('[data-mode="demo"]').click();await expect(page.locator('.temperature')).toBeVisible();
});
test('No horizontal overflow at a narrow browser viewport',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('./');for(const view of ['weather','radar','compare','climate','clock']){await navigate(page,`nav [data-view="${view}"]`);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}});
test('Missing API values and stale persisted cache are explicit',async({page})=>{
  const start=Math.floor(Date.now()/3600000)*3600;
  const time=Array.from({length:73},(_,i)=>start+i*3600);
  const response=[0,1,2].map(()=>({latitude:52.5,longitude:13,current:{time:start,temperature_2m:null,wind_speed_10m:0,wind_direction_10m:null,weather_code:null},hourly:{time,temperature_2m:time.map((_,i)=>i===5?null:10),precipitation:time.map(()=>null),precipitation_probability:time.map(()=>null),wind_speed_10m:time.map(()=>0),wind_direction_10m:time.map(()=>null),weather_code:time.map(()=>null)}}));
  await page.route('https://maps.dwd.de/**',route=>route.abort());
  await page.route('https://api.open-meteo.com/**',route=>route.fulfill({json:response}));
  await page.goto('./');await page.locator('[data-mode="live"]').click();
  await expect(page.locator('.temperature')).toContainText('–');
  await expect(page.locator('.chart-empty')).toContainText('Niederschlag nicht verfügbar');
  await expect(page.locator('.reading').last()).toContainText('–');
  await page.waitForFunction(async()=>{const d=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('wetterwarte-v1');r.onsuccess=()=>resolve(r.result);});return await new Promise(resolve=>{const r=d.transaction('data').objectStore('data').get('weather-v1');r.onsuccess=()=>resolve(!!r.result);});});
  await page.evaluate(async()=>{const d=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('wetterwarte-v1');r.onsuccess=()=>resolve(r.result);});await new Promise<void>(resolve=>{const tx=d.transaction('data','readwrite'),store=tx.objectStore('data'),r=store.get('weather-v1');r.onsuccess=()=>store.put({...r.result,fetchedAt:Math.floor(Date.now()/1000)-4000},'weather-v1');tx.oncomplete=()=>resolve();});});
  await page.unroute('https://api.open-meteo.com/**');await page.route('https://api.open-meteo.com/**',route=>route.abort());
  await page.reload();await expect(page.locator('.data-badge')).toContainText('veraltet');await expect(page.locator('.temperature')).toContainText('–');
  await page.locator('[data-mode="demo"]').click();await expect(page.locator('.error-banner')).toHaveCount(0);
});
test('Radar pins its reference run and plays only current and future valid times',async({page})=>{
  const now=Math.floor(Date.now()/300000)*300000;
  const dates=[now-1200000,now-600000,now,now+7200000].map(t=>new Date(t).toISOString());
  const xml=`<WMS_Capabilities xmlns="http://www.opengis.net/wms"><Capability><Layer><Name>Niederschlagsradar</Name><Dimension name="REFERENCE_TIME">${dates.join(',')}</Dimension><Dimension name="time">${new Date(now).toISOString()}/${new Date(now+7200000).toISOString()}/PT5M</Dimension></Layer></Capability></WMS_Capabilities>`;
  const requested:number[]=[],references:number[]=[];
  await page.route('https://maps.dwd.de/**',route=>{
    const url=new URL(route.request().url());
    if(url.searchParams.get('request')==='GetCapabilities')return route.fulfill({contentType:'text/xml',body:xml});
    requested.push(Date.parse(url.searchParams.get('time')!));references.push(Date.parse(url.searchParams.get('dim_reference_time')!));
    return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')});
  });
  await page.goto('./');await navigate(page,'nav [data-view="radar"]');
  await page.locator('[data-size="480"]').click();await page.locator('[data-mode="live"]').click();
  await expect(page.locator('.radar-map .radar-rain')).toHaveCount(1);
  await expect(page.locator('#radar-time')).toHaveAttribute('max','24');const following=await page.locator('#radar-time').inputValue();
  await expect(page.locator('[data-action="radar-now"]')).toBeVisible();
  await page.locator('#radar-time').fill('18');await page.locator('#radar-time').dispatchEvent('change');await expect(page.locator('#radar-time')).toHaveValue('18');
  await page.locator('[data-action="play-radar"]').click();await expect(page.locator('[data-action="play-radar"]')).toHaveText('Pause');
  await page.waitForTimeout(2400);
  await expect(page.locator('[data-action="radar-now"]')).toBeAttached();
  await page.locator('[data-action="play-radar"]').click();await expect(page.locator('[data-action="play-radar"]')).toHaveText('▶ Vorschau');
  await page.locator('[data-action="radar-now"]').click();await expect(page.locator('#radar-time')).toHaveValue(following);
  expect(requested.every(t=>t>=now&&t<=now+7200000)).toBe(true);expect(requested.length).toBeGreaterThan(1);expect(references.every(t=>t===now)).toBe(true);
});

test('Weather embeds independent nowcast and keeps a saved image offline',async({page,context})=>{
  const now=Math.floor(Date.now()/300000)*300000, hour=Math.floor(now/3600000)*3600;
  const time=Array.from({length:73},(_,i)=>hour+i*3600);
  const response=[0,1,2].map(()=>({latitude:52.5,longitude:13,current:{time:hour,temperature_2m:12,wind_speed_10m:5,wind_direction_10m:180,weather_code:3},hourly:{time,temperature_2m:time.map((_,i)=>12+i/10),precipitation:time.map(()=>0),precipitation_probability:time.map(()=>0),wind_speed_10m:time.map(()=>5),wind_direction_10m:time.map(()=>180),weather_code:time.map(()=>3)}}));
  await page.route('https://api.open-meteo.com/**',route=>route.fulfill({json:response}));
  await page.route('https://maps.dwd.de/**',route=>{
    const url=new URL(route.request().url());
    if(url.searchParams.get('request')==='GetCapabilities')return route.fulfill({contentType:'text/xml',body:`<WMS_Capabilities xmlns="http://www.opengis.net/wms"><Capability><Layer><Name>Niederschlagsradar</Name><Dimension name="REFERENCE_TIME">${new Date(now).toISOString()}</Dimension><Dimension name="time">${new Date(now).toISOString()}/${new Date(now+7200000).toISOString()}/PT5M</Dimension></Layer></Capability></WMS_Capabilities>`});
    return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')});
  });
  await page.goto('./');await page.locator('[data-mode="live"]').click();
  await expect(page.locator('.radar-card-map .radar-rain')).toHaveCount(1);
  await expect(page.locator('.map-panel')).toContainText(/beobachtet|Prognose/);
  const radarTime=await page.locator('.radar-card-meta').textContent();
  await page.locator('.time-shortcuts [data-step="48"]').click();
  expect(await page.locator('.radar-card-meta').textContent()).toEqual(radarTime);
  await context.setOffline(true);
  await page.locator('.radar-card-map').click();await expect(page.locator('.radar-map .radar-rain')).toHaveCount(1);
  await navigate(page,'nav [data-view="weather"]');
  await expect(page.locator('.radar-card-map .radar-rain')).toHaveCount(1);
  await expect(page.locator('.radar-unavailable')).toHaveCount(0);
});

test('All sources load automatically from the clock view, cache once, and refresh at their intervals',async({page})=>{
 test.setTimeout(60000);
 const at=Date.parse('2026-10-08T07:10:00Z');await page.clock.install({time:at});
 await page.addInitScript(()=>localStorage.setItem('wetterwarte-settings',JSON.stringify({mode:'live',place:'elstal',view:'clock',size:'1280'})));
 const counts={weather:0,outlook:0,ensemble:0,radar:0},longRequests:string[]=[];
 const hour=Math.floor(at/3600000)*3600,time=Array.from({length:97},(_,i)=>hour+i*3600);
 const hourly={time,temperature_2m:time.map(()=>12),precipitation:time.map(()=>1),precipitation_probability:time.map(()=>50),wind_speed_10m:time.map(()=>8),wind_direction_10m:time.map(()=>180),weather_code:time.map(()=>61)};
 await page.route('https://api.open-meteo.com/**',r=>{if(new URL(r.request().url()).searchParams.get('models')==='ecmwf_ifs025'){counts.outlook++;return r.fulfill({json:[0,1,2].map(()=>({latitude:52.5,longitude:13,daily:{time:['2026-10-08'],temperature_2m_min:[8],temperature_2m_max:[15],precipitation_sum:[1],precipitation_probability_max:[25],weather_code:[3]}}))});}counts.weather++;return r.fulfill({json:[0,1,2].map(()=>({latitude:52.5,longitude:13,current:{time:hour,temperature_2m:12,weather_code:61,wind_speed_10m:8,wind_direction_10m:180},hourly}))});});
 await page.route('https://ensemble-api.open-meteo.com/**',r=>{counts.ensemble++;const h:Record<string,number[]>={time};for(const [model,count] of [['icon_eu_eps',40],['ecmwf_aifs025_ensemble',51]] as const)for(let m=0;m<count;m++)h[`temperature_2m_member${m}_${model}`]=time.map(()=>10+m/10);return r.fulfill({json:{latitude:52.5,longitude:13,hourly:h}});});
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
 await page.route('https://maps.dwd.de/**',r=>{const u=new URL(r.request().url());if(u.searchParams.get('request')==='GetCapabilities'){counts.radar++;return r.fulfill({contentType:'text/xml',body:`<WMS_Capabilities><Layer><Name>Niederschlagsradar</Name><Dimension name="REFERENCE_TIME">${new Date(at-600000).toISOString()}</Dimension><Dimension name="time">${new Date(at-600000).toISOString()}/${new Date(at+6600000).toISOString()}/PT5M</Dimension></Layer></WMS_Capabilities>`});}return r.fulfill({contentType:'image/png',body:png});});
 for(const host of ['archive-api','climate-api'])await page.route(`https://${host}.open-meteo.com/**`,r=>{
  const u=new URL(r.request().url()),start=u.searchParams.get('start_date')!,end=u.searchParams.get('end_date')!,dates:string[]=[];
  longRequests.push(host);
  for(let t=Date.parse(start);t<=Date.parse(end);t+=86400000)dates.push(new Date(t).toISOString().slice(0,10));
  const future=Number(start.slice(0,4))>2025;
  return r.fulfill({json:{latitude:52.5,longitude:13,daily:{time:dates,temperature_2m_mean:dates.map(()=>future?12:10),temperature_2m_max:dates.map(()=>future?31:29),precipitation_sum:dates.map(()=>1)}}});
 });
 await page.goto('./');await expect(page.locator('#clock-large')).toHaveText('09:10');
 for(let i=1;i<=9;i++){
  await expect.poll(()=>longRequests.length).toBe(i);
  if(i<9){await expect(page.locator('.background-progress')).toContainText('API-Pause');await page.clock.fastForward(33000);}
 }
 await expect(page.locator('.background-progress')).toContainText('Alle verfügbaren Ansichten');
 expect(longRequests).toEqual([...Array(3).fill('archive-api'),...Array(6).fill('climate-api')]);expect(counts.weather).toBe(1);expect(counts.outlook).toBe(1);expect(counts.ensemble).toBe(1);
 await navigate(page,'nav [data-view="climate"]');await expect(page.locator('.data-badge')).toHaveCount(0);await expect(page.locator('.climate-field-map')).toBeVisible();
 await navigate(page,'[data-climate-tab="history"]');await expect(page.locator('.history-chart')).toBeVisible();
 await navigate(page,'[data-climate-tab="projection"]');await expect(page.locator('.unit-tag')).toContainText('3 / 3');await expect(page.locator('.climate-summary')).toContainText('+2,0');
 await page.clock.fastForward(1800000);await expect.poll(()=>counts.weather).toBe(2);await expect.poll(()=>counts.radar).toBeGreaterThanOrEqual(2);expect(counts.ensemble).toBe(1);expect(longRequests.length).toBe(9);
 await navigate(page,'nav [data-view="clock"]');
 const actual=await page.evaluate(()=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date()));await expect(page.locator('#clock-large')).toHaveText(actual);
});

test('Radar Jetzt follows the next advertised forecast time and labels the older basis',async({page})=>{
 await page.clock.install({time:Date.parse('2026-10-08T07:10:00Z')});await page.clock.pauseAt(new Date('2026-10-08T07:10:00Z'));
 await page.route('https://api.open-meteo.com/**',r=>r.abort());
 await page.route('https://maps.dwd.de/**',r=>new URL(r.request().url()).searchParams.get('request')==='GetCapabilities'?r.fulfill({contentType:'text/xml',body:'<WMS_Capabilities><Layer><Name>Niederschlagsradar</Name><Dimension name="REFERENCE_TIME">2026-10-08T05:00:00Z,2026-10-08T06:00:00Z,2026-10-08T07:00:00Z</Dimension><Dimension name="time">2026-10-08T07:00:00Z/2026-10-08T09:00:00Z/PT5M</Dimension></Layer></WMS_Capabilities>'}):r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')}));
 await page.goto('./');await page.locator('[data-size="800"]').click();await navigate(page,'nav [data-view="radar"]');await page.locator('[data-mode="live"]').click();
 await expect(page.locator('.radar-time')).toContainText('10 Min. alt');await expect(page.locator('.radar-time-label')).toHaveText('Prognose');await expect(page.locator('#header-clock')).toHaveCount(1);
 await page.locator('#radar-time').fill('18');await page.locator('#radar-time').dispatchEvent('change');await expect(page.locator('.radar-time strong')).toHaveText('10:30');
 await page.locator('[data-action="radar-now"]').click();await expect(page.locator('.radar-time strong')).toHaveText('09:10');await expect(page.locator('[data-action="radar-now"]')).toHaveAttribute('aria-pressed','true');
 await page.clock.fastForward(60000);await expect(page.locator('#header-clock')).toHaveCount(1);await expect(page.locator('.radar-time')).toContainText('11 Min. alt');await expect(page.locator('.radar-time strong')).toHaveText('09:15');await expect(page.locator('#radar-time')).toHaveAttribute('min','3');
 await expect(page.locator('#radar-time')).toHaveCount(1);await expect(page.locator('[data-radar-frame]')).toHaveCount(0);
});

test('Automatic and manual themes use consistent readings and readable complete views',async({page})=>{
 await page.clock.install({time:Date.parse('2026-10-08T20:00:00Z')});await page.goto('./');await page.locator('button[data-theme="auto"]').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 const temperatureColor=await page.locator('.temperature').evaluate(e=>getComputedStyle(e).color);
 await navigate(page,'[data-weather-page="moon"]');await expect(page.locator('.moon-main .moon-disc')).toBeVisible();await navigate(page,'[data-weather-page="overview"]');await expect(page.locator('.map-panel h2')).toHaveText('Regenradar');
 for(const view of ['weather','radar','compare','climate','clock']){
  await navigate(page,`nav [data-view="${view}"]`);await fits(page,true);
  if(view==='clock')expect(await page.locator('.clock-weather strong').evaluate(e=>getComputedStyle(e).color)).toBe(temperatureColor);
  await page.screenshot({path:`test-results/night-${view}.png`});
  if(view==='climate'){for(const tab of ['history','projection']){await navigate(page,`[data-climate-tab="${tab}"]`);await fits(page,true);await page.screenshot({path:`test-results/night-${tab}.png`});}}
 }
 await page.locator('button[data-theme="light"]').click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.reload();await expect(page.locator('button[data-theme="light"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('button[data-theme="auto"]').click();await page.clock.setSystemTime(new Date('2026-06-21T18:00:00Z'));await page.clock.runFor(1100);await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.clock.setSystemTime(new Date('2026-12-21T19:00:00Z'));await page.clock.runFor(1100);await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});

test('Joy-IT native layout, calibrated size and RGB565 pixel raster remain interactive',async({page,context})=>{
 test.setTimeout(90000);
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:2,mobile:false});
 await page.goto('./');await page.locator('[data-size="480x320"]').click();
 const bounds=await page.locator('.device').boundingBox();expect(bounds!.width).toBe(480);expect(bounds!.height).toBe(320);
 for(const theme of ['light','dark']){
  await page.locator(`button[data-theme="${theme}"]`).click();
  for(const view of ['weather','radar','compare','climate','clock']){
   await navigate(page,`nav [data-view="${view}"]`);
   const parts=view==='weather'?['overview','hours','days','forecast','moon']:view==='climate'?['map','history','projection']:[''];
   for(const part of parts){
    if(part)await navigate(page,`[data-${view==='weather'?'weather-page':'climate-tab'}="${part}"]`);
    const dims=await page.locator('.device-content').evaluate(e=>({w:e.scrollWidth,cw:e.clientWidth,h:e.scrollHeight,ch:e.clientHeight}));
    expect.soft(dims.h,`${theme} ${view} ${part} height`).toBeLessThanOrEqual(dims.ch+1);expect.soft(dims.w,`${theme} ${view} ${part} width`).toBeLessThanOrEqual(dims.cw+1);
    await page.locator('.device').screenshot({path:`test-results/320-${theme}-${view}-${part||'main'}.png`});
    if(part==='projection'){
     for(const metric of ['hotDays','rain']){await page.locator(`[data-metric="${metric}"]`).click();await fits(page,true);}
     await page.locator('[data-metric="temperature"]').click();
    }
   }
  }
 }
 await page.locator('button[data-theme="light"]').click();await navigate(page,'nav [data-view="weather"]');await navigate(page,'[data-weather-page="overview"]');
 await page.locator('[data-preview-mode="pixels"]').click();await expect(page.locator('#raster-status')).toContainText('480 × 320 echte Rasterpixel', {timeout:15000});
 const canvas=page.locator('.native-display-canvas');expect(await canvas.evaluate((c:HTMLCanvasElement)=>[c.width,c.height])).toEqual([480,320]);
 const colors=await canvas.evaluate((c:HTMLCanvasElement)=>{const p=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data,r=new Set(),g=new Set(),b=new Set();for(let i=0;i<p.length;i+=4){r.add(p[i]);g.add(p[i+1]);b.add(p[i+2]);}return [r.size,g.size,b.size];});colors.forEach((n,i)=>{expect(n).toBeLessThanOrEqual([32,64,32][i]);expect(n).toBeGreaterThan(16);});
 await page.locator('.device-stage').screenshot({path:'test-results/320-pixel-raster.png'});
 for(const view of ['weather','radar','compare','climate','clock']){
  await navigate(page,`nav [data-view="${view}"]`);
  const parts=view==='weather'?['overview','hours','days','forecast','moon']:view==='climate'?['map','history','projection']:[''];
  for(const part of parts){
   if(part)await navigate(page,`[data-${view==='weather'?'weather-page':'climate-tab'}="${part}"]`);
   await expect(page.locator('#raster-status')).toContainText('echte Rasterpixel', {timeout:15000});
   const png=await page.locator('.native-display-canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL().split(',')[1]);
   await writeFile(`test-results/native-320-${view}-${part||'main'}.png`,Buffer.from(png,'base64'));
   if(part==='projection'){
    for(const metric of ['hotDays','rain']){
     await page.locator(`[data-metric="${metric}"]`).click();await expect(page.locator('#raster-status')).toContainText('echte Rasterpixel', {timeout:15000});
     const image=await page.locator('.native-display-canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL().split(',')[1]);
     await writeFile(`test-results/native-320-climate-${metric}.png`,Buffer.from(image,'base64'));
    }
   }
  }
 }
 await navigate(page,'nav [data-view="weather"]');await navigate(page,'[data-weather-page="moon"]');await expect(page.locator('.moon-page')).toBeVisible();
 await page.locator('[data-preview-mode="physical"]').click();await page.locator('.display-calibration summary').click();
 const rulerWidth=(await page.locator('.calibration-ruler').boundingBox())!.width;
 await page.locator('#measured-mm').fill('80');await page.locator('[data-action="calibrate-display"]').click();
 const expectedWidth=3.5*25.4*480/Math.hypot(480,320)*rulerWidth/80;
 expect((await page.locator('.device-stage').boundingBox())!.width).toBeCloseTo(expectedWidth,0);
 await expect(page.locator('.display-calibration summary')).toContainText('gespeichert');
 await page.reload();await expect(page.locator('[data-preview-mode="physical"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('[data-size="480x320"]')).toHaveAttribute('aria-pressed','true');
 expect((await page.locator('.device-stage').boundingBox())!.width).toBeCloseTo(expectedWidth,0);
 await expect(page.locator('#raster-status')).toContainText('480 × 320 echte Rasterpixel', {timeout:15000});
 await navigate(page,'nav [data-view="clock"]');await expect(page.locator('#raster-status')).toContainText('echte Rasterpixel', {timeout:15000});
 await page.locator('[data-size="800"]').click();await expect(page.locator('#raster-status')).toContainText('800 × 480 echte Rasterpixel', {timeout:15000});
 expect(await page.locator('.native-display-canvas').evaluate((c:HTMLCanvasElement)=>[c.width,c.height])).toEqual([800,480]);
 await expect(page.locator('[data-action="home"]')).toBeVisible();
});
