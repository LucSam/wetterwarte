import { meta, now } from './api';
import { readCache, retainCacheKeys, writeCache } from './cache';
import type { Radar } from '../types';

export const RADAR_ENDPOINT='https://maps.dwd.de/geoserver/dwd/Niederschlagsradar/ows';
export const RADAR_WIDTH=1100, RADAR_HEIGHT=560;
export const DWD_RAIN_CLASSES=[
  {min:.1,color:'#33FFFF'}, {min:.2,color:'#1ACC9A'}, {min:.4,color:'#019934'},
  {min:1,color:'#4DB31B'}, {min:2,color:'#99CC01'}, {min:3,color:'#CCE601'},
  {min:5,color:'#FFFF01'}, {min:7.5,color:'#FFC401'}, {min:10,color:'#FF8901'},
  {min:15,color:'#FF4501'}, {min:30,color:'#FE0000'}, {min:45,color:'#E5004C'},
  {min:75,color:'#CC0098'}, {min:100,color:'#6600CB'}, {min:150,color:'#0000FE'},
];
// Ordered blue → violet → yellow. The measured classes stay unchanged.
const DISPLAY_COLORS=['#74c9ff','#57b8f5','#3296e3','#2873d4','#5262cb','#7959c4','#9655ba','#b463bb','#c983c2','#daabc2','#e4c597','#ebd971','#f1e74a','#f6ed29','#fbf40d'];
export const RAIN_CLASSES=DWD_RAIN_CLASSES.map((c,i)=>({...c,color:DISPLAY_COLORS[i]}));
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const sourceRGB=DWD_RAIN_CLASSES.map(c=>rgb(c.color)),targetRGB=RAIN_CLASSES.map(c=>rgb(c.color));
// The official DWD SLD overlays a #fb00ff DataContour line (0.5 px).
// It is not a precipitation class. Recognise its alpha-composited pixels,
// including over grey NoData and opaque rain, and mark them unevaluable.
// Never invert a mixture to infer a rain value hidden by the line.
export function isRadarContour(p:number[],alpha:number){
 const f=[251,0,255],a=alpha/255,premul=p.map(v=>v*a),close=(values:number[])=>values.every((v,i)=>Math.abs(v-premul[i])<=2.2);
 if(close(f.map(v=>v*a)))return true;
 if(a>=.3){const t=(a-.3)/.7;if(close(f.map(v=>v*t+125*.3*(1-t))))return true;}
 if(alpha===255)return sourceRGB.some(base=>{const vector=f.map((v,i)=>v-base[i]),t=p.reduce((sum,v,i)=>sum+(v-base[i])*vector[i],0)/vector.reduce((sum,v)=>sum+v*v,0);return t>=0&&t<=1&&p.every((v,i)=>Math.abs(v-base[i]-t*vector[i])<=2.2);});
 return false;
}
export function remapRadarPixels(pixels:Uint8ClampedArray) {
 let unknown=0,colored=0;
 for(let i=0;i<pixels.length;i+=4){
  if(!pixels[i+3])continue;const p=[pixels[i],pixels[i+1],pixels[i+2]];if(Math.max(...p)-Math.min(...p)<12)continue;
  colored++;let best=Infinity,index=-1;sourceRGB.forEach((s,j)=>{const distance=s.reduce((v,x,k)=>v+(x-p[k])**2,0);if(distance<best){best=distance;index=j;}});
  if(best<=20){targetRGB[index].forEach((v,k)=>pixels[i+k]=v);continue;}
  if(!isRadarContour(p,pixels[i+3]))unknown++;
  pixels[i]=pixels[i+1]=pixels[i+2]=128;
 }
 if(colored&&unknown/colored>.02)throw Error('Radarbild enthält unerwartete Farbdaten und kann nicht ausgewertet werden.');
 return pixels;
}
async function styledRadar(blob:Blob):Promise<{rain:Blob;missing:Blob}> {
 const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
 const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0);bitmap.close();
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);remapRadarPixels(pixels.data);
 const mask=ctx.createImageData(canvas.width,canvas.height);
 for(let i=0;i<pixels.data.length;i+=4){const p=pixels.data;if(p[i+3]&&Math.max(p[i],p[i+1],p[i+2])-Math.min(p[i],p[i+1],p[i+2])<12){mask.data[i]=mask.data[i+1]=mask.data[i+2]=255;mask.data[i+3]=p[i+3];p[i+3]=0;}}
 const png=()=>new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Radarbild konnte nicht gezeichnet werden.')),'image/png'));
 ctx.putImageData(pixels,0,0);const rain=await png();ctx.putImageData(mask,0,0);return {rain,missing:await png()};
}
export function mercator(lon:number,lat:number):[number,number] {return [lon*Math.PI/180*6378137,Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*6378137];}
const center=mercator(13.3,52.5);
export const RADAR_EXTENT=[center[0]-610000,center[1]-310545,center[0]+610000,center[1]+310545];
export function radarMapUrl(time:number,reference=time) {
  return `${RADAR_ENDPOINT}?${new URLSearchParams({service:'WMS',version:'1.1.1',request:'GetMap',layers:'dwd:Niederschlagsradar',styles:'',format:'image/png',transparent:'true',srs:'EPSG:3857',bbox:RADAR_EXTENT.join(','),width:String(RADAR_WIDTH),height:String(RADAR_HEIGHT),time:new Date(time*1000).toISOString(),dim_reference_time:new Date(reference*1000).toISOString()})}`;
}
/** Valid times belong to ONE reference run; forecasts never borrow newer runs. */
export function parseRadarSchedule(xml:string,at=now()):{runAt:number;time:number[]} {
  const doc=new DOMParser().parseFromString(xml,'text/xml');
  const layer=[...doc.getElementsByTagNameNS('*','Layer')].find(l=>[...l.children].some(n=>n.localName==='Name'&&n.textContent?.replace(/^dwd:/,'')==='Niederschlagsradar'));
  if(!layer)throw Error('DWD meldet keinen Radar-Layer.');
  const dims=[...layer.getElementsByTagNameNS('*','Dimension')];
  const ref=dims.find(n=>n.getAttribute('name')?.toUpperCase()==='REFERENCE_TIME');
  const valid=dims.find(n=>n.getAttribute('name')?.toLowerCase()==='time');
  if(!ref||!valid)throw Error('DWD liefert keine verlässlichen Prognosezeiten.');
  const references=(ref.textContent??'').split(',').map(s=>Date.parse(s)/1000).filter(t=>Number.isFinite(t)&&t<=at).sort((a,b)=>a-b);
  const runAt=references.at(-1);if(runAt===undefined)throw Error('Keine aktuelle Radar-Referenzzeit verfügbar.');
  const times:number[]=[];
  for(const entry of (valid.textContent??'').split(',')){
    const [start,end,period]=entry.trim().split('/');
    if(!end){const t=Date.parse(start)/1000;if(Number.isFinite(t))times.push(t);continue;}
    const match=period?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    const interval=match?Number(match[1]??0)*3600+Number(match[2]??0)*60+Number(match[3]??0):0;
    const from=Date.parse(start)/1000,to=Math.min(Date.parse(end)/1000,runAt+7200);
    if(!interval||!Number.isFinite(from)||!Number.isFinite(to))continue;
    for(let t=from+Math.max(0,Math.ceil((runAt-from)/interval))*interval;t<=to;t+=interval)times.push(t);
  }
  const time=[...new Set(times)].filter(t=>t>=runAt&&t<=runAt+7200).sort((a,b)=>a-b);
  if(time.length<2)throw Error('Keine Radarprognose verfügbar.');
  return {runAt,time};
}
export const parseRadarTimes=(xml:string,at=now())=>parseRadarSchedule(xml,at).time;
export function radarNowIndex(data:Radar,at=now()) {const i=data.time.findIndex(t=>t>=at);return i<0?data.time.length-1:i;}
export function radarExpired(data:Radar,at=now()){return !data.time.length||data.time.at(-1)!<at;}
export const radarKey=(time:number,reference:number)=>`${reference}:${time}`;
const urls=new Map<string,{rain:string;missing:string}>();
export const radarFrameUrl=(time:number,reference=time)=>urls.get(radarKey(time,reference))?.rain;
export const radarMaskUrl=(time:number,reference=time)=>urls.get(radarKey(time,reference))?.missing;
const inFlight=new Map<string,Promise<string|undefined>>();
export function loadRadarFrame(time:number,fetchMissing=true,reference=time):Promise<string|undefined> {
 const id=radarKey(time,reference);const existing=inFlight.get(id);if(existing)return existing;
 const task=readRadarFrame(time,fetchMissing,reference).finally(()=>inFlight.delete(id));inFlight.set(id,task);return task;
}
async function readRadarFrame(time:number,fetchMissing=true,reference=time):Promise<string|undefined> {
  const id=radarKey(time,reference);if(urls.has(id))return urls.get(id)!.rain;
  const key=`radar-png-v3-${reference}-${time}`;
  // ArrayBuffer avoids WebKit's filesystem-backed IndexedDB Blob failures.
  // Continue reading previously saved Blob values without a cache migration.
  const cached=await readCache<Blob|ArrayBuffer>(key);
  let blob=cached instanceof Blob?cached:cached instanceof ArrayBuffer?new Blob([cached],{type:'image/png'}):undefined,styled:{rain:Blob;missing:Blob}|undefined;
  if(blob){try{styled=await styledRadar(blob);}catch{blob=undefined;}}
  if(!styled&&fetchMissing) {
    const r=await fetch(radarMapUrl(time,reference),{signal:AbortSignal.timeout(25000)});
    if(!r.ok||!r.headers.get('content-type')?.includes('image/png'))throw Error(`Radarbild nicht verfügbar (${r.status}).`);
    blob=await r.blob();if(!blob.size)throw Error('Leeres Radarbild erhalten.');
    styled=await styledRadar(blob);await writeCache(key,await blob.arrayBuffer());
  }
  if(styled){const frame={rain:URL.createObjectURL(styled.rain),missing:URL.createObjectURL(styled.missing)};urls.set(id,frame);return frame.rain;}

}
export async function fetchRadar():Promise<Radar> {
  const r=await fetch(`${RADAR_ENDPOINT}?service=WMS&version=1.3.0&request=GetCapabilities`,{signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw Error(`DWD-Radar nicht erreichbar (${r.status}).`);
  const schedule=parseRadarSchedule(await r.text());
  const data:Radar={...meta('radar'),kind:'radar',source:'Deutscher Wetterdienst · RV-Nowcast',model:'dwd_rv',...schedule,frameErrors:[]};
  if(radarExpired(data))throw Error('DWD liefert derzeit keine Radarprognose ab der aktuellen Uhrzeit.');
  await loadRadarFrame(data.time[radarNowIndex(data)],true,data.runAt!);
  await retainCacheKeys('radar-png-v3-',data.time.map(t=>`radar-png-v3-${data.runAt}-${t}`));
  const retain=new Set(data.time.map(t=>radarKey(t,data.runAt!)));
  for(const [key,url] of urls)if(!retain.has(key)){URL.revokeObjectURL(url.rain);URL.revokeObjectURL(url.missing);urls.delete(key);}
  return data;
}
export function demoRadar():Radar {
  const runAt=Math.floor(now()/300)*300;
  return {...meta('radar','demo'),kind:'radar',model:'dwd_rv',runAt,time:Array.from({length:25},(_,i)=>runAt+i*300),frameErrors:[]};
}
export function demoRain(x:number,y:number,frame:number) {
  const band=6*Math.exp(-Math.pow((x-(150+y*.52+frame*8))/58,2))*(.7+.3*Math.sin(y/27));
  const cell=18*Math.exp(-Math.pow((x-450-frame*4)/53,2)-Math.pow((y-270+frame*3)/47,2));
  return band+cell;
}

/** Two requests at a time; the current frame has already loaded in fetchRadar. */
export async function preloadRadar(data:Radar,progress:()=>void,cancelled:()=>boolean){
 if(radarExpired(data))return [];
 const times=data.time.slice(radarNowIndex(data)),failures:string[]=[];let next=0;
 async function worker(){while(next<times.length&&!cancelled()){
  const time=times[next++];try{const url=await loadRadarFrame(time,navigator.onLine,data.runAt!);if(!url)throw Error('Bild nicht im Offline-Cache');const image=new Image();image.src=url;await image.decode();}catch{failures.push(radarKey(time,data.runAt!));}
  if(!cancelled())progress();
 }}
 await Promise.all([worker(),worker()]);return failures;
}
