// Menus are the same controls at every resolution; the large display also has direct main tabs.
export async function waitForDisplay(frame){
 await frame.locator('html').evaluate(()=>new Promise((resolve,reject)=>{
  const start=performance.now();
  function check(){
   if(performance.now()-start>10000){reject(Error('Display image did not settle'));return;}
   const pending=document.querySelector('[data-raster-pending=true]')||parent.document.querySelector('[data-raster-pending=true]');
   if(pending)requestAnimationFrame(check);else resolve();
  }
  requestAnimationFrame(()=>requestAnimationFrame(check));
 }));
}
export async function navigate(frame,selector){
 await waitForDisplay(frame);
 selector=selector.replace(/^nav /,'');
 let target=frame.locator('.single-row-header '+selector).filter({visible:true});
 if(!await target.count()){
  await frame.locator(selector.includes('data-view=')?'#view-menu-button':'#section-menu-button').click({force:true});
  await waitForDisplay(frame);
  target=frame.locator('.menu-panel '+selector).filter({visible:true});
 }
 await target.click({force:true});
 await waitForDisplay(frame);
}
