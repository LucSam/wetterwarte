export const DISPLAY_PROFILES={
 '480x320':{width:480,height:320,inches:3.5,name:'Joy-IT RB-TFT3.5 · resistiver Touch',rgb565:true},
 '480':{width:480,height:480,inches:4,name:'Pimoroni Presto · kapazitiver Touch',rgb565:false},
 '800':{width:800,height:480,inches:4.3,name:'Waveshare 4.3B · kapazitiver Touch',rgb565:false},
 '1280':{width:1280,height:720,inches:5,name:'Pi Touch Display 2 · kapazitiver Touch',rgb565:false},
};
type Size=keyof typeof DISPLAY_PROFILES;
type PreviewMode='layout'|'physical'|'pixels';
interface PreviewSettings {mode:PreviewMode;pxPerMm:number;calibrated:boolean;dpr:number}
const defaults:PreviewSettings={mode:'layout',pxPerMm:96/25.4,calibrated:false,dpr:1};
function read():PreviewSettings {
 try{const s=JSON.parse(localStorage.getItem('wetterwarte-display-preview')??'{}');return {mode:['layout','physical','pixels'].includes(s.mode)?s.mode:'layout',pxPerMm:s.pxPerMm>1&&s.pxPerMm<15?s.pxPerMm:defaults.pxPerMm,calibrated:s.calibrated===true,dpr:Number(s.dpr)||1};}catch{return {...defaults};}
}
export const preview=read();
export function savePreview(){try{localStorage.setItem('wetterwarte-display-preview',JSON.stringify(preview));}catch{/* The regular app reports unavailable local storage. */}}
export function setPreviewMode(mode:string){if(['layout','physical','pixels'].includes(mode)){preview.mode=mode as PreviewMode;savePreview();}}
export function calibratePreview(measuredMm:number,linePixels:number){if(!Number.isFinite(measuredMm)||measuredMm<20||measuredMm>300)return false;const factor=linePixels/measuredMm;if(factor<1||factor>15)return false;preview.pxPerMm=factor;preview.calibrated=true;preview.dpr=devicePixelRatio;savePreview();return true;}
export function panelDimensions(size:Size){const d=DISPLAY_PROFILES[size],diagonal=d.inches*25.4,length=Math.hypot(d.width,d.height);return {widthMm:diagonal*d.width/length,heightMm:diagonal*d.height/length};}
export function previewControls(size:Size){
 const d=DISPLAY_PROFILES[size],mm=panelDimensions(size),format=(v:number)=>v.toLocaleString('de-DE',{maximumFractionDigits:1});
 return `<section class="display-preview-controls" aria-label="Physische Displayvorschau"><div class="preview-modes" role="group" aria-label="Vorschaudarstellung">${[['layout','Arbeitsansicht'],['physical','Originalgröße'],['pixels','Pixelraster 2×']].map(([mode,label])=>`<button data-preview-mode="${mode}" aria-pressed="${preview.mode===mode}">${label}</button>`).join('')}</div><p>${d.name} · ${d.width} × ${d.height} · ${d.inches.toLocaleString('de-DE')}″ · Bildfläche ca. ${format(mm.widthMm)} × ${format(mm.heightMm)} mm${d.rgb565?' · 65.536 Farben (RGB565)':''}</p><details class="display-calibration"><summary>Originalgröße kalibrieren${preview.calibrated?' · gespeichert':' · noch nicht kalibriert'}</summary><p>Miss die Linie mit einem Lineal am Bildschirm und trage die gemessene Länge ein. Nach dem Anwenden soll sie 100 mm lang sein. Bei anderem Monitor oder Browserzoom erneut prüfen.</p><div class="calibration-ruler" style="width:${100*preview.pxPerMm}px" aria-label="Kalibrierlinie, Ziel 100 Millimeter"><span>100 mm</span></div><div class="calibration-input"><label>Gemessen <input id="measured-mm" type="number" min="20" max="300" step="0.1" value="100"> mm</label><button data-action="calibrate-display">Anwenden</button><span id="calibration-feedback" role="status"></span></div></details><p class="preview-caveat">${preview.mode==='layout'?'Arbeitsansicht: CSS-Pixel, auf Retina feiner gezeichnet.':preview.mode==='pixels'?'Ein Displaypixel wird als 2 × 2 CSS-Pixel gezeigt; keine Retina-Nachzeichnung der Schrift.':`${preview.calibrated?'Kalibrierte':'Unkalibrierte'} Größenvorschau · Bildfläche aus Diagonale und Pixelverhältnis geschätzt.`} Helligkeit, Blickwinkel und Touchdruck werden nicht simuliert.</p>${preview.calibrated&&Math.abs(preview.dpr-devicePixelRatio)>.01?'<p class="preview-caveat">Browserzoom oder Bildschirm geändert: Kalibrierlinie erneut prüfen.</p>':''}<p id="raster-status" role="status"></p></section>`;
}

/** Snapshot HTML/SVG at native pixel dimensions, without devicePixelRatio. */
export async function rasterizeDevice(device:HTMLElement,width:number,height:number,rgb565:boolean){
 await document.fonts.ready;
 const clone=device.cloneNode(true) as HTMLElement;
 clone.style.cssText=`width:${width}px!important;height:${height}px!important;transform:none!important;border-radius:0!important;box-shadow:none!important;position:relative!important;inset:auto!important;transition:none!important`;
 // Serialize current form state rather than the original HTML defaults.
 const inputs=device.querySelectorAll('input');clone.querySelectorAll('input').forEach((input,i)=>input.setAttribute('value',inputs[i].value));
 const embeds=[...clone.querySelectorAll('image,img')];
 await Promise.all(embeds.map(async image=>{
  const attr=image.localName==='image'?'href':'src',url=image.getAttribute(attr);
  if(!url||url.startsWith('#')||url.startsWith('data:'))return;
  const response=await fetch(url);if(!response.ok)throw Error('Bildquelle für Pixelvorschau nicht verfügbar.');
  const blob=await response.blob(),data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});image.setAttribute(attr,data);
 }));
 const css=[...document.styleSheets].flatMap(sheet=>[...sheet.cssRules].map(rule=>rule.cssText)).join('\n');
 const wrap=document.createElement('div');wrap.setAttribute('xmlns','http://www.w3.org/1999/xhtml');wrap.style.cssText=`width:${width}px;height:${height}px;overflow:hidden`;
 wrap.className=document.documentElement.className;
 const style=document.createElement('style');style.textContent=css;wrap.append(style,clone);
 const xml=new XMLSerializer().serializeToString(wrap),theme=document.documentElement.dataset.theme??'light';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" data-theme="${theme}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
 const img=new Image();img.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;await img.decode();
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.fillStyle=getComputedStyle(device).backgroundColor;ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);
 if(rgb565){const pixels=ctx.getImageData(0,0,width,height);for(let i=0;i<pixels.data.length;i+=4){pixels.data[i]=Math.round(Math.round(pixels.data[i]/255*31)/31*255);pixels.data[i+1]=Math.round(Math.round(pixels.data[i+1]/255*63)/63*255);pixels.data[i+2]=Math.round(Math.round(pixels.data[i+2]/255*31)/31*255);}ctx.putImageData(pixels,0,0);}
 return canvas;
}
let revision=0;
// Chart SVG units are not display pixels. Maintain an 11 px label floor on the
// small panel and include enlarged edge labels in the viewBox (no data changes).
export function fitSmallChartLabels(){
 for(const svg of document.querySelectorAll<SVGSVGElement>('.size-480x320 .line-chart,.size-480x320 .rain-chart,.size-480x320 .history-chart,.size-480x320 .projection-figure')){
  if(svg.getBoundingClientRect().height<1)continue;
  for(let pass=0;pass<3;pass++){
   const device=svg.closest<HTMLElement>('.device')!;
   const previewScale=device.getBoundingClientRect().width/device.offsetWidth;
   const scale=Math.abs(svg.getScreenCTM()?.a??1)/previewScale;if(!scale)break;
   const box=svg.viewBox.baseVal;let left=box.x,top=box.y,right=box.x+box.width,bottom=box.y+box.height;
   for(const label of svg.querySelectorAll<SVGTextElement>('text')){
    label.style.fontSize=`${Math.max(parseFloat(getComputedStyle(label).fontSize),11/scale)}px`;
    const b=label.getBBox();left=Math.min(left,b.x-3);top=Math.min(top,b.y-3);right=Math.max(right,b.x+b.width+3);bottom=Math.max(bottom,b.y+b.height+3);
   }
   if(left===box.x&&top===box.y&&right===box.x+box.width&&bottom===box.y+box.height)break;
   svg.setAttribute('viewBox',`${left} ${top} ${right-left} ${bottom-top}`);
  }
 }
}
export async function updateDisplayPreview(size:Size){
 const current=++revision,stage=document.querySelector<HTMLElement>('.device-stage'),device=stage?.querySelector<HTMLElement>('.device');
 if(!stage||!device)return;
 if(preview.mode==='layout'){stage.querySelector('canvas.native-display-canvas')?.remove();delete stage.dataset.rasterPending;return;}
 stage.dataset.rasterPending='true';
 const d=DISPLAY_PROFILES[size],mm=panelDimensions(size),scale=preview.mode==='pixels'?2:mm.widthMm*preview.pxPerMm/d.width;
 stage.style.width=`${d.width*scale}px`;stage.style.height=`${d.height*scale}px`;
 device.style.width=`${d.width}px`;device.style.height=`${d.height}px`;device.style.transform=`scale(${scale})`;
 const status=document.querySelector('#raster-status');if(status)status.textContent='Pixelansicht wird berechnet …';
 if(device.querySelector('[role=dialog]')){stage.querySelector('canvas.native-display-canvas')?.remove();delete stage.dataset.rasterPending;if(status)status.textContent='Informationsdialog: skalierte Browseransicht für scrollbar lesbaren Text.';return;}
 try{const canvas=await rasterizeDevice(device,d.width,d.height,d.rgb565);if(current!==revision||!stage.isConnected)return;canvas.className='native-display-canvas';canvas.setAttribute('aria-hidden','true');const previous=stage.querySelector('canvas.native-display-canvas');if(previous)previous.replaceWith(canvas);else stage.append(canvas);delete stage.dataset.rasterPending;if(status)status.textContent=`${d.width} × ${d.height} echte Rasterpixel${d.rgb565?' · RGB565':''} · bedienbar mit Maus`;
 }catch{if(current!==revision)return;stage.querySelector('canvas.native-display-canvas')?.remove();delete stage.dataset.rasterPending;if(status)status.textContent='Pixelraster konnte nicht erstellt werden. Sichtbar ist die aktuelle skalierte Browseransicht.';}
}
