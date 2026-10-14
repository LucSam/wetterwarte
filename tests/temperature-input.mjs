import assert from 'node:assert/strict';
import {navigate,waitForDisplay} from './navigation.mjs';

// Act on the visible, scaled device. Never blur the select on the user's behalf.
export async function chooseVisible(page,frame,id,value,whileOpen){
 await waitForDisplay(page);
 const position=await frame.locator('html').evaluate((_root,id)=>{
  const r=document.getElementById(id).getBoundingClientRect(),d=document.querySelector('.device').getBoundingClientRect();
  return {x:(r.left+r.width/2-d.left)/d.width,y:(r.top+r.height/2-d.top)/d.height};
 },id),stage=await page.locator('.device-stage').boundingBox();
 await page.mouse.click(stage.x+stage.width*position.x,stage.y+stage.height*position.y);
 if(whileOpen)await whileOpen();
 await page.locator('select.input-proxy').selectOption(value);
 await waitForDisplay(page);
 assert.equal(await frame.locator('#'+id).inputValue(),value,`Repeated visible selection ${id} → ${value}`);
 assert.equal(await page.locator('select.input-proxy').count(),0,'Committed picker must close without a manual blur');
}
export async function repeatedTemperatureInput(page,frame){
 for(const [mode,size] of [['physical','480x320'],['pixels','480x320'],['physical','800'],['physical','480'],['physical','1280']]){
  await page.locator(`button[data-size="${size}"]`).click();await page.locator(`[data-mode=${mode}]`).click();await waitForDisplay(page);
  await chooseVisible(page,frame,'temperature-scale','month');
  for(const month of ['7','8','9','7','9','8'])await chooseVisible(page,frame,'temperature-month',month);
  await chooseVisible(page,frame,'temperature-scale','year');
  for(const year of ['2026','2025','2024','2025','2026','2024'])await chooseVisible(page,frame,'temperature-year',year);
  await chooseVisible(page,frame,'temperature-scale','long');
  for(const plot of ['anomaly','curves','anomaly','spread','curves','spread','anomaly'])await chooseVisible(page,frame,'temperature-plot',plot);
  for(const reference of ['normal','rolling','normal','rolling'])await chooseVisible(page,frame,'temperature-reference',reference);
  for(const scale of ['year','long','year','long'])await chooseVisible(page,frame,'temperature-scale',scale);
  await chooseVisible(page,frame,'temperature-plot','curves');await chooseVisible(page,frame,'temperature-plot','anomaly');
  // Simulate data arriving while the system picker is open.
  await chooseVisible(page,frame,'temperature-reference','normal',async()=>{
   await frame.locator('html').evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await waitForDisplay(page);
  });
  // A DOM rebuild between the native input and change events must also be safe.
  await frame.locator('html').evaluate(()=>document.addEventListener('input',()=>document.dispatchEvent(new Event('visibilitychange')),{once:true}));
  await chooseVisible(page,frame,'temperature-reference','rolling');
  console.log(`PASS repeated native picks, redraw while open, input/change rebuild: ${mode} ${size}`);
 }
 await frame.locator('[data-action=home]').click({force:true});await waitForDisplay(page);
 const control=await page.locator('#reload-app').boundingBox();const nav=page.waitForEvent('load');await page.mouse.click(control.x+control.width/2,control.y+control.height/2);await nav;
 // A reload starts with no raster yet; pending=false alone is not readiness.
 await page.locator('.native-display-canvas').waitFor();await waitForDisplay(page);await page.locator('.tile[data-open=weather]').click({force:true});await frame.locator('.temperature-history').waitFor();await waitForDisplay(page);
 assert.equal(await frame.locator('#temperature-scale').inputValue(),'long');assert.equal(await frame.locator('#temperature-reference').inputValue(),'rolling');assert.equal(await frame.locator('#temperature-plot').inputValue(),'anomaly');
 console.log('PASS touch-accessible reload preserves temperature selection');
 // Real device path: no pixel proxy and no browser toolbar in kiosk mode.
 await page.goto('http://127.0.0.1:5173/?kiosk=1');await page.locator('.tile[data-open=weather]').click();await frame.locator('.temperature-history').waitFor();
 for(const scale of ['year','long','month','year','long'])await frame.locator('#temperature-scale').selectOption(scale);
 for(const plot of ['curves','anomaly','spread','anomaly'])await frame.locator('#temperature-plot').selectOption(plot);
 await navigate(frame,'[data-view=weather]');await frame.locator('[data-action=home]').click();assert(await page.locator('#reload-app').isVisible());
 console.log('PASS device kiosk input and reload access');
}
