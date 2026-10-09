import {navigate} from './navigation.mjs';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
await mkdir('.audit',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage();
 for(const host of ['archive-api','climate-api','ensemble-api'])await page.route(`https://${host}.open-meteo.com/**`,r=>r.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const frames=[];page.on('request',r=>{const u=new URL(r.url());if(u.searchParams.get('request')==='GetMap')frames.push({time:Date.parse(u.searchParams.get('time')),reference:Date.parse(u.searchParams.get('dim_reference_time'))});});
 await page.goto('http://127.0.0.1:5173/');await page.locator('[data-mode="live"]').click();
 await page.waitForFunction(()=>document.querySelector('.temperature')||document.querySelector('.error-banner'),null,{timeout:65000});
 if(!await page.locator('.temperature').count())throw Error(await page.locator('#view-content').innerText());
 console.log('Weather:',await page.locator('.observation').innerText());
 await navigate(page,'[data-weather-page="hours"]');
 if(!await page.locator('.outlook-heading h2').innerText().then(t=>t.includes('14-Tage')))throw Error('14-Tage-Prognose fehlt.');
 if(await page.locator('.outlook-day').count()!==7)throw Error('Erste Prognosewoche unvollständig.');
 await page.locator('[data-outlook-week="1"]').click();
 if(await page.locator('.outlook-day').count()!==7)throw Error('Zweite Prognosewoche unvollständig.');
 console.log('Outlook:',await page.locator('.outlook-day').first().innerText(),await page.locator('.outlook-day').last().innerText());
 await navigate(page,'nav [data-view="radar"]');
 await page.waitForFunction(()=>document.querySelector('.radar-map .radar-rain')||document.querySelector('.error-banner'),null,{timeout:40000});
 if(!await page.locator('.radar-map .radar-rain').count())throw Error(await page.locator('#view-content').innerText());
 console.log('Radar:',await page.locator('.radar-time').innerText());
 await page.screenshot({path:'.audit/live-radar.png'});
 const colors=await page.locator('.radar-map .radar-rain').evaluate(async e=>{
  const img=await createImageBitmap(await(await fetch(e.getAttribute('href'))).blob()),canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);img.close();const p=ctx.getImageData(0,0,canvas.width,canvas.height).data,colors=new Map();for(let i=0;i<p.length;i+=4)if(p[i+3]&&Math.max(p[i],p[i+1],p[i+2])-Math.min(p[i],p[i+1],p[i+2])>12){const c=[p[i],p[i+1],p[i+2]].map(v=>v.toString(16).padStart(2,'0')).join('');colors.set(c,(colors.get(c)??0)+1);}return [...colors].sort((a,b)=>b[1]-a[1]).slice(0,15);
 });console.log('Recoloured radar pixels:',colors);
 const firstFrame=await page.locator('#radar-time').inputValue();
 await page.locator('#radar-time').fill('18');await page.locator('#radar-time').dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('.radar-map .radar-rain')&&!document.querySelector('.radar-unavailable'),null,{timeout:30000});
 if(!frames.some(f=>f.time-f.reference===90*60000))throw Error('Keine Radarprognose für +90 Minuten abgerufen.');
 console.log('Radar +90 Minuten:',await page.locator('.radar-time').innerText(),frames);
 await page.screenshot({path:'.audit/live-radar-future.png'});
 await context.setOffline(true);await page.locator('#radar-time').fill(firstFrame);await page.locator('#radar-time').dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('.radar-map .radar-rain')&&!document.querySelector('.radar-unavailable'));
 await navigate(page,'nav [data-view="climate"]');await page.locator('.climate-field-map').waitFor();console.log('DWD climate grid:',await page.locator('.field-periods').innerText());await page.screenshot({path:'.audit/live-climate-map.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log('LIVE WEATHER + RADAR + HISTORICAL CLIMATE MAP PASSED');
}finally{await browser.close();}
