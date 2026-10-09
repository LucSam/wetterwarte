import {FIELD_CONFIG,fetchField,loadFieldImage,fieldImage,preloadField,demoField,fetchAir,demoAir,type Field,type Air,type MapLayer,type FieldLayer} from './data/fields';
import {layerTabs,fieldView,fieldIndex,airView} from './ui/fields-view';
import { loadClimateMap } from './data/climate-map';
import { climateMapView, type ClimateLayer } from './ui/climate-map-view';
import { historyNeedsUpdate, retryDue } from './data/schedule';
import { moonAt, daylightAt } from './data/astronomy';
import './style.css';
import './compact.css';
import './display-preview.css';
import { preview, previewControls, fitSmallChartLabels, setPreviewMode, calibratePreview, updateDisplayPreview, DISPLAY_PROFILES } from './ui/display-preview';
import { demoHistory, fetchHistory, HISTORY_END } from './data/history';
import { demoRadar, fetchRadar, preloadRadar, loadRadarFrame, radarFrameUrl, radarNowIndex, radarExpired, radarKey } from './data/radar';
import { radarCard, radarView } from './ui/radar-view';
import {fitRegionalMaps} from './ui/map-layout';
import {installSwipeNavigation} from './ui/swipe';
import { historyIntro, historyView } from './ui/history-view';
import { clockTime, dateTime, fmt } from './calc';
import { ENSEMBLE_TTL, PLACES, WEATHER_TTL } from './config';
import { fetchClimate, fetchEnsemble, fetchWeather, now } from './data/api';
import { readCache, readSettings, saveSettings, storageWarning, writeCache } from './data/cache';
import { demoClimate, demoEnsemble, demoWeather } from './data/demo';
import type { Climate, Dataset, Ensemble, History, Radar, ClimateField, PlaceId, View, Weather } from './types';
import { escapeHtml as esc } from './ui/charts';
import { climateIntro, climateView, clockView, compareView, empty, weatherView, type ClimateMetric } from './ui/views';

const app=document.querySelector<HTMLDivElement>('#app')!;
const settings=readSettings();
const embedded=window.parent!==window && new URLSearchParams(location.search).get('embedded')==='1';
if(embedded){document.documentElement.classList.add('embedded');preview.mode='layout';}
const bridge=(type:string,extra:Record<string,unknown>={})=>{if(embedded)parent.postMessage({protocol:'pi-display-v1',type,...extra},location.origin);};
let mapLayer:MapLayer='rain',fieldStep=0,air:Air|undefined;
const fields=new Map<FieldLayer,Field>(),fieldErrors=new Map<string,string>(),fieldBusy=new Set<string>();
let layersAttempt=0,fieldPlaying=false,fieldWaiting=false;
const fieldBuffers=new Map<FieldLayer,number>();
let step=0, weatherPage='overview', outlookWeek=0, moonDay=0, metric:ClimateMetric='temperature';
let renderedView='',focusOffset=0,placeMenu=false,openMenu:''|'view'|'section'|'place'='';
let bufferRun=0,bufferBusy=false,bufferFailures=0,playWhenReady=false,bufferGeneration=0,bufferAttempt=0;
let demoW=demoWeather(), demoR=demoRadar();
let climateTab:'map'|'history'|'projection'='map', selectedYear=HISTORY_END, radarFrame=-1, radarPlaying=false,radarPinnedTime:number|undefined;
let climateLayer:ClimateLayer='change',climateCell=-1,backgroundLoading=false,backgroundMessage='';
const attempts=new Map<string,number>();
const radarLoading=new Set<string>(), radarErrors=new Map<string,string>();
const live=new Map<string,Dataset>(), busy=new Set<string>(), errors=new Map<string,string>();
let climateController:AbortController|undefined, climateProgress='';
const keyFor=(view:View=settings.view,place:PlaceId=settings.place)=>view==='radar'?'radar-v2':view==='climate'?(climateTab==='map'?`climate-map-${settings.mode}`:climateTab==='history'?`history-v1-${place}`:`climate-v1-${place}`):view==='compare'?`ensemble-v1-${place}`:'weather-v1';
const message=(error:unknown)=>error instanceof Error ? (error.name==='TimeoutError'?'Zeitüberschreitung beim Datenabruf.':error.name==='TypeError'?'Datenquelle nicht erreichbar. Netzwerk oder Browserzugriff prüfen.':error.message):String(error);
function dataset():Dataset|undefined {
  if(settings.mode==='demo')return settings.view==='radar'?demoR:settings.view==='climate'?(climateTab==='map'?live.get('climate-map-demo'):climateTab==='history'?demoHistory(settings.place):demoClimate(settings.place)):settings.view==='compare'?demoEnsemble(settings.place):demoW;
  return live.get(keyFor());
}
function radar():Radar|undefined {return settings.mode==='demo'?demoR:live.get('radar-v2') as Radar|undefined;}
function weather():Weather|undefined {return settings.mode==='demo'?demoW:live.get('weather-v1') as Weather|undefined;}
function stale(d:Dataset) { return d.kind==='radar' ? now()-(d.runAt??0)>1200 : d.kind==='weather' ? now()-d.fetchedAt>WEATHER_TTL : d.kind==='ensemble' ? now()-d.fetchedAt>ENSEMBLE_TTL : false; }
function status(d:Dataset|undefined) {
  if(settings.mode==='demo')return ['demo','DEMO · Beispieldaten'];
  if(settings.view==='radar'&&mapLayer!=='rain'){const layer=mapLayer,field=layer==='air'?air:fields.get(layer);return !field?['unavailable',fieldBusy.has(layer)?'Karte wird geladen':'Keine Daten']:!navigator.onLine||fieldErrors.has(layer)||now()-field.fetchedAt>(layer==='air'?86400:3600)?['stale','Gespeicherte Karte / Ortswerte']:['live','Modelldaten'];}
  if(d?.kind==='climate-map')return ['stored','DWD · Klimaraster'];
  if(d?.kind==='climate')return ['stored','Gespeicherte Projektion'];
  if(d?.kind==='history')return ['stored','ERA5 · Reanalyse'];
  if(d?.kind==='radar')return stale(d)||!navigator.onLine||errors.has(keyFor())?['stale','Radar · gespeichert'+(stale(d)?' · veraltet':'')]:['live','DWD · Nowcast'];
  if(d && (stale(d)||!navigator.onLine||errors.has(keyFor())))return ['stale',`Gespeichert${stale(d)?' · veraltet':''}`];
  if(d)return ['live','Echte Modelldaten'];
  return ['unavailable',busy.has(keyFor())?'Daten werden geladen':'Keine Daten'];
}
function content() {
  const d=dataset(), key=keyFor();
  if(settings.view==='radar'&&mapLayer!=='rain')return layerTabs(mapLayer)+(mapLayer==='air'?airView(settings.mode==='demo'?demoAir():air,settings.place,fieldBusy.has('air'),fieldErrors.get('air'),fieldStep,fieldPlaying):fieldView(settings.mode==='demo'?demoField(mapLayer):fields.get(mapLayer),mapLayer,settings.place,fieldStep,fieldBusy.has(mapLayer),fieldErrors.get(mapLayer),fieldPlaying,fieldWaiting));
  if(settings.view==='clock')return clockView(weather(),settings.place);
  if(settings.view==='climate') {
    const tabs=`<div class="climate-mode-tabs" role="group" aria-label="Klimazeitraum"><button data-climate-tab="map" aria-pressed="${climateTab==='map'}">Karte</button><button data-climate-tab="history" aria-pressed="${climateTab==='history'}">Verlauf</button><button data-climate-tab="projection" aria-pressed="${climateTab==='projection'}">Zukunft</button></div>`;
    return tabs+(climateTab==='map'?(d?.kind==='climate-map'?climateMapView(d,climateLayer,settings.place,climateCell):empty('Klimakarte wird vorbereitet …','DWD-Flächenraster werden lokal geladen.')):climateTab==='history'?(d?.kind==='history'?historyView(d,selectedYear):historyIntro(busy.has(key),esc(climateProgress))):(d?.kind==='climate'?climateView(d,metric):climateIntro(busy.has(key),climateProgress)));
  }
  if(d?.kind==='radar'){const f=radarIndex(d),key=radarKey(d.time[f],d.runAt!);return layerTabs(mapLayer)+radarView(d,f,settings.place,radarPlaying,radarLoading.has(key),radarErrors.get(key)??errors.get(keyFor()),radarFrame<0);}
  if(!d)return (settings.view==='radar'?layerTabs(mapLayer):'')+empty(busy.has(key)?'Modelldaten werden geladen …':'Keine Modelldaten verfügbar',errors.get(key)??'Gespeicherte Daten erscheinen hier auch ohne Internet. Der Demo-Modus bietet eigenständige Beispieldaten.',`<button class="primary" data-action="refresh" ${busy.has(key)?'disabled':''}>Erneut laden</button>`);
  return d.kind==='weather'?weatherView(d,settings.place,step,radarCard(radar(),settings.place,busy.has('radar-v2')||radarLoading.has(radarActiveKey()),errors.get('radar-v2')??radarErrors.get(radarActiveKey()),weatherPage!=='focus'),weatherPage,outlookWeek,moonDay,settings.size==='480x320',focusOffset,settings.size==='480x320'?1:settings.size==='1280'?7:3):d.kind==='ensemble'?compareView(d):'';
}
function appearance(){
 const p=PLACES.find(p=>p.id===settings.place)!,solar=daylightAt(now(),p.lat,p.lon);
 const resolved=settings.theme==='auto'?(solar.isDay?'light':'dark'):settings.theme;
 if(document.documentElement.dataset.theme!==resolved)document.documentElement.dataset.theme=resolved;
 return {solar,resolved};
}
const viewOptions=[['weather','Wetter'],['radar','Radar'],['climate','Klima'],['compare','Modelle'],['clock','Uhr']];
const chevron='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 6 5 5 5-5"/></svg>';
function sectionOptions(){
 if(settings.view==='weather')return {attribute:'weather-page',current:weatherPage,items:[['overview','Übersicht'],['focus','Fokus'],['hours','Stunden'],...(settings.size==='480x320'?[['days','Tage']]:[]),['forecast','Verlauf'],['moon','Mond']]};
 if(settings.view==='radar')return {attribute:'map-layer',current:mapLayer,items:[['rain','Regen'],['temperature','Temperatur'],['wind','Wind'],['air','Luftqualität']]};
 if(settings.view==='climate')return {attribute:'climate-tab',current:climateTab,items:[['map','Karte'],['history','Verlauf'],['projection','Zukunft']]};
 return undefined;
}
function deviceHeader(){
 const section=sectionOptions(),compact=settings.size!=='1280',viewName=viewOptions.find(([id])=>id===settings.view)![1],place=PLACES.find(p=>p.id===settings.place)!;
 const menuButton=(id:string,label:string,aria:string)=>`<button id="${id==='place'?'place-button':id+'-menu-button'}" class="menu-trigger" data-menu="${id}" aria-label="${aria}" aria-expanded="${openMenu===id}">${label}${chevron}</button>`;
 let options='';
 if(openMenu==='view')options=viewOptions.map(([id,label])=>`<button data-view="${id}" aria-current="${id===settings.view?'page':'false'}">${label}</button>`).join('');
 if(openMenu==='section'&&section)options=section.items.map(([id,label])=>`<button data-${section.attribute}="${id}" aria-pressed="${id===section.current}">${label}</button>`).join('');
 if(openMenu==='place')options=PLACES.map(p=>`<button data-place="${p.id}" aria-pressed="${p.id===settings.place}">${p.id==='elstal'?'Wustermark · Elstal':p.name}</button>`).join('');
 return `<header class="device-header single-row-header">
 ${compact?menuButton('view',viewName,'Ansicht wählen'):`<nav aria-label="Ansichten">${viewOptions.map(([id,label])=>`<button data-view="${id}" aria-current="${id===settings.view?'page':'false'}">${label}</button>`).join('')}</nav>`}
 ${section?menuButton('section',section.items.find(([id])=>id===section.current)?.[1]??'Auswahl','Unterseite wählen'):''}
 <div class="location">${menuButton('place',place.id==='elstal'?'Elstal':place.name,'Ort wählen')}<select id="place" class="sr-only" tabindex="-1" aria-hidden="true">${PLACES.map(p=>`<option value="${p.id}" ${p.id===settings.place?'selected':''}>${p.name}</option>`).join('')}</select></div>
 ${settings.view==='clock'?'':`<time id="header-clock" aria-label="Uhrzeit Europe/Berlin">${clockTime(now())}</time>`}
 <button data-action="home" aria-label="Zum Startmenü">Start</button>
 </header>${openMenu?`<button class="menu-dismiss" data-menu="close" aria-label="Menü schließen"></button><div class="menu-panel menu-${openMenu}" role="group" aria-label="${openMenu==='view'?'Ansichten':openMenu==='place'?'Orte':'Unterseiten'}">${options}</div>`:''}`;
}

function render() {
  const {solar,resolved}=appearance();
  const scroll=renderedView===settings.view?(document.querySelector('#view-content')?.scrollTop??0):0;
  const d=dataset(), [badge,label]=status(d), key=keyFor();
  const error=settings.mode==='live'?errors.get(key):undefined;
  // Reuse the displayed raster across DOM rebuilds. updateDisplayPreview swaps
  // it only after the new image is ready, so menus never flash a live CSS view.
  const previousRaster=app.querySelector<HTMLCanvasElement>('canvas.native-display-canvas');
  app.innerHTML=`<main class="workbench" data-preview="${preview.mode}"><div class="preview-toolbar"><div class="project-label"><span>WETTERWARTE <small>BILDSCHIRMVORSCHAU</small></span></div><div class="size-control" role="group" aria-label="Vorschaugröße">${[['480x320','480 × 320 · 3,5″'],['480','480 × 480'],['800','800 × 480'],['1280','1280 × 720']].map(([size,label])=>`<button data-size="${size}" aria-pressed="${settings.size===size}">${label}</button>`).join('')}</div><button class="export-button" data-action="export" ${!d&&!(settings.view==='radar'&&mapLayer!=='rain')?'disabled':''}>JSON exportieren</button></div>${previewControls(settings.size)}<div class="device-wrap"><div class="device-stage"><article class="device menu-navigation size-${settings.size} view-${settings.view}" aria-label="Wetterdisplay ${settings.size} Pixel">${deviceHeader()}<div class="device-content ${settings.view}-content" id="view-content">${error&&settings.view!=='radar'?`<div class="error-banner" role="status">${esc(error)}</div>`:''}${!navigator.onLine&&settings.view!=='radar'?'<div class="error-banner">Offline · lokal gespeicherte Daten</div>':''}${storageWarning?`<div class="error-banner">${esc(storageWarning)}</div>`:''}${content()}</div>${(['demo','stale','unavailable'].includes(badge)||settings.view==='radar')?`<footer class="device-footer state-footer"><span class="data-badge ${badge}">${['demo','stale','unavailable'].includes(badge)?label:''}</span></footer>`:''}</article></div></div><div class="preview-bottom"><div class="mode-control"><span>Datenmodus</span><button data-mode="demo" aria-pressed="${settings.mode==='demo'}">Demo</button><button data-mode="live" aria-pressed="${settings.mode==='live'}">Echte Daten</button></div><div class="theme-control" role="group" aria-label="Darstellung"><span>Darstellung</span>${[['auto','Auto'],['light','Hell'],['dark','Dunkel']].map(([theme,label])=>`<button data-theme="${theme}" aria-pressed="${settings.theme===theme}">${label}</button>`).join('')}<small title="Sonnenaufgang ${solar.sunrise?clockTime(solar.sunrise):'–'} · Sonnenuntergang ${solar.sunset?clockTime(solar.sunset):'–'}">${settings.theme==='auto'?`${resolved==='light'?'Tag':'Nacht'} · hell ${solar.sunrise?clockTime(solar.sunrise):'–'}–${solar.sunset?clockTime(solar.sunset):'–'}`:'Manuell'}</small></div><p>${settings.mode==='demo'?'Offline gestaltbar · Wetter/Klima: Beispiele; Uhr/Mond: aktuelle Zeit':'Direkter API-Abruf · Daten bleiben lokal'}<span>${DISPLAY_PROFILES[settings.size].name} · Touch / Maus</span></p></div><div class="background-progress" role="status">${settings.mode==='live'?(climateController?esc(climateProgress):backgroundMessage):''}</div><div id="export-message" role="status"></div></main>`;
  if(previousRaster&&preview.mode!=='layout'&&previousRaster.width===DISPLAY_PROFILES[settings.size].width&&previousRaster.height===DISPLAY_PROFILES[settings.size].height)app.querySelector('.device-stage')?.append(previousRaster);
  fitClock();
  fitRegionalMaps();
  fitSmallChartLabels();
  void updateDisplayPreview(settings.size);
  document.querySelector('#view-content')!.scrollTop=scroll;renderedView=settings.view;
  updateRadarBuffer();
  updateFieldBuffer();bridge('appearance',{theme:resolved});bridge('rendered');
}
// Font metrics use the visible numeral shapes, not the larger typographic line box.
function fitClock(){
 const face=document.querySelector<SVGSVGElement>('.clock-face'),digits=document.querySelector<SVGTextElement>('#clock-large');if(!face||!digits)return;
 const ctx=document.createElement('canvas').getContext('2d')!;ctx.font=getComputedStyle(digits).font;
 const m=ctx.measureText('0123456789:'),height=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
 face.setAttribute('viewBox',`0 0 1160 ${height+30}`);digits.setAttribute('y',String(m.actualBoundingBoxAscent+15));
}
async function ensure(force=false,view:View=settings.view) {
  if(settings.mode==='demo')return;
  const place=settings.place, key=keyFor(view,place);
  if(busy.has(key))return;
  if(!force&&errors.has(key)&&(view==='radar'?now()-(attempts.get(key)??0)<60:!retryDue(attempts.get(key),now())))return;
  attempts.set(key,now());
  if(view==='weather')void ensure(force,'radar');
  busy.add(key); render();
  try {
    if(!live.has(key)) {const cached=await readCache<Dataset>(key); if(cached?.schema===1&&cached.mode==='live'){ live.set(key,cached); render(); }}
    const cached=live.get(key);
    if(view==='climate')return; // Long historical series are handled by the serial background queue.
    if(!force&&cached&&(cached.kind==='radar'?now()-cached.fetchedAt<300&&!radarExpired(cached):!stale(cached))&&!(cached.kind==='weather'&&!cached.outlook&&!cached.outlookError))return;
    if(!navigator.onLine)throw new Error('Offline: kein neuer Abruf möglich.');
    const data=view==='radar'?await fetchRadar():view==='compare'?await fetchEnsemble(place):await fetchWeather();
    live.set(key,data);errors.delete(key);await writeCache(key,data);if(data.kind==='radar')void bufferRadar(data);
  }catch(error){errors.set(key,message(error));}
  finally{busy.delete(key);render();if(settings.view==='radar'||settings.view==='weather')void prepareRadarFrame();const r=radar();if(r?.mode==='live'&&(bufferRun!==r.runAt||(!bufferBusy&&bufferFailures>0&&now()-bufferAttempt>=60)))void bufferRadar(r,true);}
}
async function loadClimate() {
  if(settings.mode==='demo')return;
  const place=settings.place,key=`climate-v1-${place}`;
  if(busy.has(key)||climateController)return;
  climateController=new AbortController();const controller=climateController;
  busy.add(key);errors.delete(key);climateProgress='Klimadaten werden vorbereitet …';render();
  try {
    const data=await fetchClimate(place,msg=>{climateProgress=msg;render();},controller.signal);
    live.set(key,data);await writeCache(key,data);
  }catch(e){errors.set(key,controller.signal.aborted?'Klimaabruf abgebrochen. Vollständige Teilabrufe bleiben gespeichert.':message(e));}
  finally{busy.delete(key);if(climateController===controller)climateController=undefined;render();}
}
function radarActiveKey(){const d=radar();return d?radarKey(d.time[radarNowIndex(d)],d.runAt!):'';}
function radarIndex(data:Radar) { if(radarFrame<0)return radarNowIndex(data);const exact=radarPinnedTime===undefined?-1:data.time.indexOf(radarPinnedTime);return Math.max(radarNowIndex(data),exact>=0?exact:Math.min(radarFrame,data.time.length-1)); }
function radarBuffer(){const data=radar();if(!data||data.mode==='demo')return {ready:0,total:0,complete:true};const times=radarExpired(data)?[]:data.time.slice(radarNowIndex(data));const ready=times.filter(t=>radarFrameUrl(t,data.runAt!)).length;return {ready,total:times.length,complete:ready===times.length};}
function updateRadarBuffer(){
 const status=radarBuffer();document.querySelectorAll<HTMLProgressElement>('.radar-preload:not(.field-preload)').forEach(bar=>{bar.max=status.total||1;bar.value=status.total?status.ready:1;bar.hidden=status.complete;});const button=document.querySelector<HTMLElement>('[data-action=play-radar]'),label=document.querySelector('#radar-buffer');
 if(button){button.textContent=radarPlaying?'Pause':playWhenReady?'Warten …':bufferFailures&&!bufferBusy?'Erneut laden':'▶ Vorschau';button.setAttribute('aria-busy',String(bufferBusy));}
 if(label)label.textContent=status.total?(status.complete?'Bereit':`${status.ready}/${status.total} Bilder${bufferFailures&&!bufferBusy?' · Lücke':''}`):'';
}
async function bufferRadar(data:Radar,force=false){
 if(data.mode!=='live'||radarExpired(data)||(!force&&bufferRun===data.runAt))return;
 const generation=++bufferGeneration;bufferRun=data.runAt!;bufferAttempt=now();bufferBusy=true;bufferFailures=0;radarPlaying=false;updateRadarBuffer();
 const failures=await preloadRadar(data,updateRadarBuffer,()=>generation!==bufferGeneration||settings.mode!=='live');
 if(generation!==bufferGeneration)return;bufferFailures=failures.length;bufferBusy=false;
 if(playWhenReady&&radarBuffer().complete){radarPlaying=true;playWhenReady=false;radarFrame=-1;}
 updateRadarBuffer();bridge('rendered');
}
async function prepareRadarFrame() {
  const d=radar();if(!d||d.mode==='demo'||radarExpired(d)||(settings.view!=='radar'&&settings.view!=='weather'))return;
  const time=d.time[settings.view==='weather'?radarNowIndex(d):radarIndex(d)],key=radarKey(time,d.runAt!);if(radarLoading.has(key)||radarFrameUrl(time,d.runAt!))return;
  radarLoading.add(key);radarErrors.delete(key);render();
  try {const url=await loadRadarFrame(time,navigator.onLine,d.runAt!);if(!url)throw Error('Offline: dieses Radarbild wurde noch nicht gespeichert.');}
  catch(error){radarErrors.set(key,message(error));radarPlaying=false;}
  finally{radarLoading.delete(key);render();}
}
async function loadHistory() {
  if(settings.mode==='demo')return;
  const place=settings.place,key=`history-v1-${place}`;if(busy.has(key)||climateController)return;
  const controller=new AbortController();climateController=controller;busy.add(key);errors.delete(key);climateProgress='Historische Reihe wird vorbereitet …';render();
  try{const data=await fetchHistory(place,msg=>{climateProgress=msg;render();},controller.signal);live.set(key,data);await writeCache(key,data);}
  catch(error){errors.set(key,controller.signal.aborted?'Abruf abgebrochen. Vollständige Teilabrufe bleiben gespeichert.':message(error));}
  finally{busy.delete(key);if(climateController===controller)climateController=undefined;render();}
}
async function autoLoadAll(){
 if(backgroundLoading)return;
 backgroundLoading=true;const mode=settings.mode,place=settings.place;
 const stillCurrent=()=>settings.mode===mode&&settings.place===place;
 try{
  void loadLayers();
  const field=await loadClimateMap(mode);live.set(`climate-map-${mode}`,field);render();
  if(mode==='demo')return;
  for(const key of [`history-v1-${place}`,`climate-v1-${place}`]){if(!live.has(key)){const cached=await readCache<Dataset>(key);if(cached?.schema===1&&cached.mode==='live')live.set(key,cached);}}
  await Promise.all([ensure(false,'weather'),ensure(false,'compare')]);
  if(!stillCurrent()||!navigator.onLine)return;
  const history=live.get(`history-v1-${place}`) as History|undefined;
  const historyKey=`history-v1-${place}`,climateKey=`climate-v1-${place}`;
  if(historyNeedsUpdate(history?.years.at(-1)?.year)&&retryDue(attempts.get(historyKey),now())){
   attempts.set(historyKey,now());backgroundMessage='Vergangenheit wird automatisch vorbereitet …';await loadHistory();
  }
  if(!stillCurrent()||!navigator.onLine)return;
  const climate=live.get(climateKey) as Climate|undefined;
  if((!climate||climate.models.length<3)&&retryDue(attempts.get(climateKey),now())){
   attempts.set(climateKey,now());backgroundMessage='Klimaprojektionen werden automatisch vorbereitet …';await loadClimate();
  }
  backgroundMessage=['weather-v1','radar-v2',`ensemble-v1-${place}`,historyKey,climateKey].some(key=>errors.has(key))||(live.get(climateKey) as Climate|undefined)?.errors.length?'Ein Datenabruf ist unvollständig. Automatischer neuer Versuch frühestens nach 15 Minuten.':'Alle verfügbaren Ansichten sind lokal vorbereitet.';
 }catch(e){backgroundMessage=message(e);}
 finally{backgroundLoading=false;render();if(!stillCurrent())void autoLoadAll();}
}
function fieldBuffer(){
 if(settings.mode==='demo'||mapLayer==='air'||mapLayer==='rain')return {ready:0,total:0,complete:true};
 const data=fields.get(mapLayer),time=data?.time.filter(t=>t>=now())??[],ready=data?time.filter(t=>fieldImage(data,t)).length:0;
 return {ready,total:time.length,complete:time.length>0&&ready===time.length};
}
function updateFieldBuffer(){
 const state=fieldBuffer(),bar=document.querySelector<HTMLProgressElement>('.field-preload'),label=document.querySelector('#field-buffer'),button=document.querySelector('[data-action=play-field]');
 if(bar){bar.max=state.total||1;bar.value=state.ready;bar.hidden=state.complete;}
 if(label)label.textContent=state.total?(state.complete?'Bereit':`${state.ready}/${state.total} Bilder${fieldErrors.has(mapLayer)?' · Lücke':''}`):'';
 if(fieldWaiting&&state.complete){fieldWaiting=false;fieldPlaying=true;}
 if(button)button.textContent=fieldPlaying?'Pause':fieldWaiting?'Warten …':fieldErrors.has(mapLayer)&&!state.complete?'Erneut laden':'▶ Vorschau';
}
async function bufferField(data:Field){
 if(fieldBuffers.get(data.layer)===data.runAt)return;
 fieldBuffers.set(data.layer,data.runAt);
 const failed=await preloadField(data,()=>{updateFieldBuffer();bridge('rendered');},()=>settings.mode!=='live'||fields.get(data.layer)?.runAt!==data.runAt);
 if(fieldBuffers.get(data.layer)!==data.runAt)return;
 fieldBuffers.delete(data.layer);
 if(failed){fieldErrors.set(data.layer,`${failed} Kartenbilder nicht verfügbar.`);if(mapLayer===data.layer)fieldWaiting=false;}
 else if(fieldErrors.get(data.layer)?.includes('Kartenbilder nicht verfügbar'))fieldErrors.delete(data.layer);
 updateFieldBuffer();bridge('rendered');
}
async function prepareField(){
 if(settings.mode!=='live'||(mapLayer!=='temperature'&&mapLayer!=='wind'))return;
 const layer=mapLayer,d=fields.get(layer);if(!d||fieldBusy.has(layer))return;
 fieldBusy.add(layer);render();try{await loadFieldImage(d,d.time[fieldIndex(d,fieldStep)]);if(!fieldErrors.get(layer)?.includes('Kartenbilder nicht verfügbar'))fieldErrors.delete(layer);}catch(e){fieldErrors.set(layer,message(e));}finally{fieldBusy.delete(layer);render();}
}
async function loadLayers(){
 if(settings.mode==='demo')return;if(now()-layersAttempt<60){void prepareField();return;}layersAttempt=now();
 await Promise.all((['temperature','wind','air'] as const).map(async layer=>{
  if(fieldBusy.has(layer))return;fieldBusy.add(layer);
  try{
   if(layer==='air'){
    air??=await readCache<Air>('air-points');if(!air||now()-air.fetchedAt>=21600){if(!navigator.onLine)throw Error('Offline · gespeicherte Luftqualität');air=await fetchAir();}
   }else{
    if(!fields.has(layer)){const cached=await readCache<Field>('field-'+layer);if(cached)fields.set(layer,cached);}
    const cached=fields.get(layer);if(cached)await loadFieldImage(cached,cached.time[fieldIndex(cached,0)]).catch(()=>{});if(!cached||now()-cached.fetchedAt>=3600){if(!navigator.onLine)throw Error('Offline · gespeicherte Karte');fields.set(layer,await fetchField(layer));}else await loadFieldImage(cached,cached.time[fieldIndex(cached,0)]);
   }
   fieldErrors.delete(layer);
  }catch(e){fieldErrors.set(layer,message(e));}finally{fieldBusy.delete(layer);if(settings.view==='radar'&&mapLayer===layer)render();}
 }));
 if(settings.view==='radar')void prepareField();
 for(const data of fields.values())void bufferField(data);
}
function exportData() {
  if(settings.mode==='live'&&settings.view==='radar'&&mapLayer!=='rain'&&!(mapLayer==='air'?air:fields.get(mapLayer)))return;
  const data=settings.view==='radar'&&mapLayer!=='rain'?(mapLayer==='air'?{kind:'air',...(settings.mode==='demo'?demoAir():air)}:{kind:'field',...(settings.mode==='demo'?demoField(mapLayer):fields.get(mapLayer)),model:FIELD_CONFIG[mapLayer].model}):dataset();if(!data)return;
  const envelope={...data,...(data.kind==='weather'?{astronomy:moonAt(now())}:{}),units:{temperature:'°C',precipitation:data.kind==='radar'?'mm/h':'mm',wind:'km/h',probability:'%',time:'unix_s_UTC'},exportedAt:now()};
  const blob=new Blob([JSON.stringify(envelope)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`wetterwarte-${data.kind}-${settings.mode}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  document.querySelector('#export-message')!.textContent=`JSON exportiert · ${(blob.size/1024).toFixed(1)} kB · ${data.mode==='demo'?'Demodaten':'Modelldaten'}`;
}
function selectPage(attribute:string,value:string){
 openMenu='';
 if(attribute==='view'){
  fieldPlaying=false;fieldWaiting=false;placeMenu=false;playWhenReady=false;radarPlaying=false;settings.view=value as View;saveSettings(settings);render();void ensure();
 }else if(attribute==='map-layer'){
  fieldPlaying=false;fieldWaiting=false;mapLayer=value as MapLayer;fieldStep=0;radarPlaying=false;render();void loadLayers();
 }else if(attribute==='weather-page'){
  weatherPage=value;render();
 }else if(attribute==='climate-tab'){
  renderedView='';climateTab=value as typeof climateTab;render();void autoLoadAll();
 }
}
installSwipeNavigation((scope,direction)=>{
 const section=scope==='section'?sectionOptions():undefined;
 const items=section?.items??viewOptions,current=section?.current??settings.view;
 const index=items.findIndex(([id])=>id===current),next=items[index+direction];
 if(next)selectPage(section?.attribute??'view',next[0]);
},()=>!openMenu);

app.addEventListener('click',event=>{
  const target=event.target as Element,cell=target.closest<HTMLElement>('[data-climate-cell]'),year=target.closest<HTMLElement>('[data-year]');
  if(cell){climateCell=Number(cell.dataset.climateCell);render();return;}
  if(year){selectedYear=Number(year.dataset.year);render();return;}
  const button=target.closest<HTMLButtonElement>('button');if(!button||button.disabled)return;
  if(button.dataset.menu){const next=button.dataset.menu;openMenu=next==='close'||openMenu===next?'':next as typeof openMenu;render();document.querySelector<HTMLButtonElement>('.menu-panel button')?.focus();return;}
  if(button.closest('.menu-panel'))openMenu='';
  if(button.dataset.mapLayer){selectPage('map-layer',button.dataset.mapLayer);return;}
  if(button.dataset.fieldStep){fieldStep=Number(button.dataset.fieldStep);render();void prepareField();return;}
  if(button.dataset.place){climateController?.abort();settings.place=button.dataset.place as PlaceId;placeMenu=false;step=0;climateCell=-1;saveSettings(settings);render();void autoLoadAll();return;}
  if(button.dataset.theme){settings.theme=button.dataset.theme as typeof settings.theme;saveSettings(settings);render();}
  if(button.dataset.size){settings.size=button.dataset.size as typeof settings.size;if(settings.size!=='480x320'&&weatherPage==='days')weatherPage='hours';saveSettings(settings);render();}
  if(button.dataset.view){selectPage('view',button.dataset.view);return;}
  if(button.dataset.mode){fieldPlaying=false;fieldWaiting=false;fieldStep=0;bufferGeneration++;bufferRun=0;bufferBusy=false;playWhenReady=false;radarPlaying=false;radarFrame=-1;climateController?.abort();settings.mode=button.dataset.mode as typeof settings.mode;step=0;saveSettings(settings);render();void autoLoadAll();}
  if(button.dataset.previewMode){setPreviewMode(button.dataset.previewMode);render();}
  if(button.dataset.focusDays){focusOffset=Number(button.dataset.focusDays);render();}
  if(button.dataset.weatherPage){selectPage('weather-page',button.dataset.weatherPage);return;}
  if(button.dataset.outlookWeek){outlookWeek=Number(button.dataset.outlookWeek);render();}
  if(button.dataset.moonDay){moonDay=Number(button.dataset.moonDay);render();}
  if(button.dataset.step){step=Number(button.dataset.step);render();}
  if(button.dataset.radarFrame){radarPlaying=false;radarFrame=Number(button.dataset.radarFrame);render();void prepareRadarFrame();}
  if(button.dataset.climateTab){selectPage('climate-tab',button.dataset.climateTab);return;}
  if(button.dataset.year){selectedYear=Number(button.dataset.year);render();}
  if(button.dataset.climateLayer){climateLayer=button.dataset.climateLayer as ClimateLayer;render();}
  if(button.dataset.metric){metric=button.dataset.metric as ClimateMetric;render();}
  switch(button.dataset.action){
    case 'play-field':
     if(fieldPlaying||fieldWaiting){fieldPlaying=false;fieldWaiting=false;}else if(fieldBuffer().complete){fieldPlaying=true;}else{fieldWaiting=true;if(mapLayer==='temperature'||mapLayer==='wind'){const data=fields.get(mapLayer);if(data)void bufferField(data);}}
     updateFieldBuffer();bridge('rendered');break;
    case 'field-now':fieldPlaying=false;fieldWaiting=false;fieldStep=0;render();void loadLayers();break;
    case 'places':placeMenu=!placeMenu;render();break;
    case 'calibrate-display': {const measured=Number(document.querySelector<HTMLInputElement>('#measured-mm')?.value),width=document.querySelector('.calibration-ruler')?.getBoundingClientRect().width??0;if(calibratePreview(measured,width)){render();document.querySelector<HTMLDetailsElement>('.display-calibration')!.open=true;}else document.querySelector('#calibration-feedback')!.textContent='Bitte eine gemessene Länge zwischen 20 und 300 mm eingeben.';break;}
    case 'refresh': if(settings.mode==='demo'){demoW=demoWeather();demoR=demoRadar();render();}else if(settings.view==='climate'){void autoLoadAll();}else void ensure(true);break;
    case 'load-history':void loadHistory();break;
    case 'radar-now':playWhenReady=false;radarFrame=-1;radarPinnedTime=undefined;radarPlaying=false;render();void ensure(true,'radar');break;
    case 'play-radar':if(radar()&&radarExpired(radar()!)){radarPlaying=false;playWhenReady=false;void ensure(true,'radar');break;}if(radarPlaying||playWhenReady){radarPlaying=false;playWhenReady=false;}else if(radarBuffer().complete){radarPlaying=true;}else{playWhenReady=true;const r=radar();if(r&&!bufferBusy)void bufferRadar(r,true);}updateRadarBuffer();break;
    case 'home':if(embedded)bridge('home');else location.assign(location.pathname.startsWith('/wetter/')?'/':'http://127.0.0.1:5173/');break;
    case 'load-climate':void loadClimate();break;
    case 'cancel-climate':climateController?.abort();break;
    case 'export':exportData();break;
  }
});
app.addEventListener('change',event=>{
  const target=event.target as HTMLSelectElement;
  if(target.id==='field-time'){fieldStep=Number(target.value);fieldPlaying=false;fieldWaiting=false;render();void prepareField();}
  if(target.id==='radar-time'){const data=radar();radarFrame=Number(target.value);radarPinnedTime=data?.time[radarFrame];radarPlaying=false;render();void prepareRadarFrame();}
  if(target.id==='history-year'){selectedYear=Number(target.value);render();}
  if(target.id==='place'){climateController?.abort();settings.place=target.value as PlaceId;step=0;climateCell=-1;saveSettings(settings);render();void autoLoadAll();}
});
window.addEventListener('online',()=>{render();void autoLoadAll();});window.addEventListener('offline',render);
setInterval(()=>{const previousTime=document.querySelector('#header-clock,#clock-large')?.textContent;const previous=document.documentElement.dataset.theme;appearance();if(previous!==document.documentElement.dataset.theme)render();for(const selector of ['#header-clock','#clock-large']){const node=document.querySelector(selector);if(node&&node.textContent!==clockTime(now()))node.replaceChildren(clockTime(now()));}if(settings.view==='clock')document.querySelector('#clock-date')?.replaceChildren(new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date()));if(preview.mode!=='layout'&&previousTime&&previousTime!==clockTime(now()))void updateDisplayPreview(settings.size);},1000);
setInterval(()=>{if(settings.mode==='live'&&navigator.onLine)void autoLoadAll();else if(settings.mode==='demo'){demoW=demoWeather();demoR=demoRadar();}render();void prepareRadarFrame();},60_000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();void autoLoadAll();}});
setInterval(()=>{if(settings.view!=='radar'||!radarPlaying||document.hidden)return;const d=dataset();if(d?.kind!=='radar')return;if(radarExpired(d)){radarPlaying=false;render();return;}const i=radarIndex(d);if(!radarBuffer().complete)return;if(d.mode==='live'&&!radarFrameUrl(d.time[i],d.runAt!))return;radarFrame=i+1>=d.time.length?radarNowIndex(d):i+1;radarPinnedTime=d.time[radarFrame];render();void prepareRadarFrame();},1100);
setInterval(()=>{
 if(settings.view!=='radar'||mapLayer==='rain'||!fieldPlaying||document.hidden||openMenu)return;
 const data=mapLayer==='air'?(settings.mode==='demo'?demoAir():air):(settings.mode==='demo'?demoField(mapLayer):fields.get(mapLayer));
 if(!data||!fieldBuffer().complete)return;
 const at=mapLayer==='air'?Math.floor(now()/3600)*3600:now(),total=data.time.filter(t=>t>=at).length;
 if(total<2){fieldPlaying=false;render();return;}fieldStep=(fieldStep+1)%total;render();
},1100);
render();void autoLoadAll();
if(!embedded&&import.meta.env.PROD&&'serviceWorker' in navigator)navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{});

window.addEventListener('message',event=>{
 if(!embedded||event.origin!==location.origin||event.source!==parent||event.data?.protocol!=='pi-display-v1')return;
 if(event.data.type==='configure'){
  const next=event.data.settings??{};
  if(Object.hasOwn(DISPLAY_PROFILES,next.size))settings.size=next.size;
  if(['auto','light','dark'].includes(next.theme))settings.theme=next.theme;
  const changedMode=['demo','live'].includes(next.weatherMode)&&next.weatherMode!==settings.mode;
  if(changedMode){fieldPlaying=false;fieldWaiting=false;fieldStep=0;bufferGeneration++;bufferRun=0;bufferBusy=false;playWhenReady=false;radarPlaying=false;radarFrame=-1;settings.mode=next.weatherMode;climateController?.abort();step=0;}
  if(settings.size!=='480x320'&&weatherPage==='days')weatherPage='hours';
  saveSettings(settings);render();if(changedMode)void autoLoadAll();
 }
 if(event.data.type==='refresh')void autoLoadAll();
});
for(const event of ['pointerdown','keydown','input'])document.addEventListener(event,()=>bridge('activity'),{passive:true});
bridge('ready');

document.addEventListener('keydown',event=>{if(event.key==='Escape'&&(placeMenu||openMenu)){placeMenu=false;openMenu='';render();document.querySelector<HTMLElement>('#place-button')?.focus();}});
