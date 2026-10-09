import {navigate} from './navigation.mjs';
import { chromium } from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const context=await browser.newContext();const page=await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload();
  await page.locator('.temperature').waitFor();
  const moonLoaded=await page.locator('.moon-surface').first().evaluate(async e=>{const image=new Image();image.src=e.getAttribute('href');try{await image.decode();return image.naturalWidth===1024;}catch{return false;}});
  if(!moonLoaded)throw Error('Moon surface missing offline');
  const client=await context.newCDPSession(page);await client.send('DOM.enable');await client.send('CSS.enable');const {root}=await client.send('DOM.getDocument');const {nodeId}=await client.send('DOM.querySelector',{nodeId:root.nodeId,selector:'.temperature'});const {fonts}=await client.send('CSS.getPlatformFontsForNode',{nodeId});console.log('Rendered fonts:',fonts.map(f=>f.familyName));if(!fonts.some(f=>f.familyName==='Helvetica'))throw Error('Helvetica not actually rendered');
  for(const view of ['radar','compare','climate','clock']){await navigate(page,`nav [data-view="${view}"]`);if(!await page.locator('.data-badge').textContent().then(v=>v.includes('DEMO')))throw Error('Offline demo provenance missing');}
  await navigate(page,'nav [data-view="climate"]');await page.locator('.climate-field-map').waitFor();if(await page.locator('[data-climate-cell]').count()!==4690)throw Error('Offline climate field missing');
  for(const tab of ['history','projection']){await navigate(page,`[data-climate-tab="${tab}"]`);await page.locator(tab==='history'?'.history-chart':'.projection-figure').waitFor();}
  console.log('Production shell, lunar surface, lazy climate map and all demo views work offline.');
} finally {await browser.close();}
