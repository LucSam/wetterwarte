import {now} from './api';
import {readCache,writeCache,retainCacheKeys} from './cache';
import {RADAR_EXTENT} from './radar';
import {PLACES} from '../config';
export type MapLayer='rain'|'temperature'|'wind'|'air';
export type FieldLayer='temperature'|'wind';
export interface Field {layer:FieldLayer;mode:'live'|'demo';runAt:number;fetchedAt:number;time:number[]}
export const FIELD_CONFIG={
 temperature:{name:'Temperatur',layer:'Icon-eu_reg00625_fd_gl_T',style:'icon-eu_reg00625_fd_gl_t_isoarea_isa',model:'ICON-EU · 0,0625° · 1 h',elevation:'2'},
 wind:{name:'Wind über 36 km/h',layer:'Icon-eps_reg025_fd_pl_SP10M',style:'icon-eps_reg025_fd_pl_sp10m_wmc_isoarea_scheme',model:'ICON-EPS · 0,25° · 6 h',elevation:'10'},
};
export const TEMP_COLORS=['#9167a3','#8172a8','#8292bd','#86b1d1','#96c6e3','#e6e6e6','#f7d640','#f0ae66','#ed9c67','#eb8963','#e87c66'];
export const WIND_COLORS=['#4D3CB5','#3364FF','#00CCCC','#66FFFF','#33CC00','#66FF33','#FFFF00','#FFCC33','#FF6600','#CC0000'];
const endpoint=(layer:FieldLayer)=>`https://maps.dwd.de/geoserver/dwd/${FIELD_CONFIG[layer].layer}/ows`;
export function fieldSchedule(xml:string,layer:FieldLayer,at=now()):Field{
 const doc=new DOMParser().parseFromString(xml,'text/xml'),node=[...doc.getElementsByTagNameNS('*','Layer')].find(e=>[...e.children].some(n=>n.localName==='Name'&&n.textContent?.replace('dwd:','')===FIELD_CONFIG[layer].layer));
 if(!node)throw Error('DWD-Kartenebene fehlt.');
 const dims=[...node.getElementsByTagNameNS('*','Dimension')],ref=dims.find(e=>e.getAttribute('name')==='REFERENCE_TIME'),valid=dims.find(e=>e.getAttribute('name')==='time');
 const runAt=(ref?.textContent??'').split(',').map(s=>Date.parse(s)/1000).filter(t=>Number.isFinite(t)&&t<=at).sort((a,b)=>a-b).at(-1);
 if(!runAt||!valid)throw Error('DWD liefert keinen verlässlichen Modelllauf.');
 const times:number[]=[];
 for(const part of (valid.textContent??'').split(',')){const [a,b,step]=part.split('/');if(!b){const t=Date.parse(a)/1000;if(Number.isFinite(t))times.push(t);continue;}const m=step.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/),dt=m?Number(m[1]??0)*3600+Number(m[2]??0)*60:0;if(!dt)continue;for(let t=Date.parse(a)/1000;t<=Math.min(Date.parse(b)/1000,at+48*3600);t+=dt)if(t>=runAt)times.push(t);}
 const time=[...new Set(times)].filter(t=>t>=at&&t<=at+48*3600).sort((a,b)=>a-b);if(!time.length)throw Error('Keine aktuelle Flächenprognose verfügbar.');
 return {layer,mode:'live',runAt,fetchedAt:at,time};
}
export function fieldUrl(data:Field,time:number){const c=FIELD_CONFIG[data.layer];return endpoint(data.layer)+'?'+new URLSearchParams({service:'WMS',request:'GetMap',version:'1.1.1',layers:'dwd:'+c.layer,styles:c.style,format:'image/png',transparent:'true',srs:'EPSG:3857',bbox:RADAR_EXTENT.join(','),width:'880',height:'448',time:new Date(time*1000).toISOString(),dim_reference_time:new Date(data.runAt*1000).toISOString(),elevation:c.elevation,...(data.layer==='wind'?{dim_ensemble_product:'Probabilities:>10m/s'}:{})});}
const images=new Map<string,string>(),pending=new Map<string,Promise<string>>();
let activeImages=0;const imageQueue:(()=>void)[]=[];
async function imageSlot(){if(activeImages>=2)await new Promise<void>(resolve=>imageQueue.push(resolve));else activeImages++;}
function releaseImageSlot(){const next=imageQueue.shift();if(next)next();else activeImages--;}
const key=(d:Field,t:number)=>`field-png-${d.layer}-${d.runAt}-${t}`;
export const fieldImage=(d:Field,t:number)=>images.get(key(d,t));
export function loadFieldImage(d:Field,t:number){const k=key(d,t);if(images.has(k))return Promise.resolve(images.get(k)!);if(pending.has(k))return pending.get(k)!;
 const task=(async()=>{let bytes=await readCache<ArrayBuffer>(k);if(!bytes){if(!navigator.onLine)throw Error('Kartenbild nicht gespeichert.');await imageSlot();try{const r=await fetch(fieldUrl(d,t),{signal:AbortSignal.timeout(25000)});if(!r.ok||!r.headers.get('content-type')?.includes('image/png'))throw Error(`DWD-Karte nicht verfügbar (${r.status}).`);bytes=await r.arrayBuffer();const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));if(bitmap.width!==880||bitmap.height!==448)throw Error('Unerwartetes Kartenformat.');bitmap.close();await writeCache(k,bytes);}finally{releaseImageSlot();}}const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));images.set(k,url);return url;})();pending.set(k,task);task.finally(()=>pending.delete(k)).catch(()=>{});return task;
}
export async function preloadField(data:Field,updated:()=>void,cancelled:()=>boolean){
 let failed=0;
 for(const time of data.time.filter(t=>t>=now())){if(cancelled())break;try{await loadFieldImage(data,time);}catch{failed++;}updated();}
 return failed;
}
export async function fetchField(layer:FieldLayer){const r=await fetch(endpoint(layer)+'?service=WMS&request=GetCapabilities&version=1.3.0',{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('DWD-Kartenquelle nicht erreichbar.');const field=fieldSchedule(await r.text(),layer);await loadFieldImage(field,field.time[0]);await writeCache('field-'+layer,field);const keep=field.time.map(t=>key(field,t));await retainCacheKeys('field-png-'+layer+'-',keep);for(const [k,url] of images)if(k.startsWith('field-png-'+layer+'-')&&!keep.includes(k)){URL.revokeObjectURL(url);images.delete(k);}return field;}
export function demoField(layer:FieldLayer):Field{const step=layer==='temperature'?3600:21600,start=Math.ceil(now()/step)*step;return {layer,mode:'demo',runAt:start,fetchedAt:now(),time:Array.from({length:layer==='temperature'?49:9},(_,i)=>start+i*step)};}
export interface Air {mode:'live'|'demo';fetchedAt:number;time:number[];places:{id:string;aqi:(number|null)[];pm25:(number|null)[]}[]}
export async function fetchAir():Promise<Air>{const url='https://air-quality-api.open-meteo.com/v1/air-quality?'+new URLSearchParams({latitude:PLACES.map(p=>p.lat).join(','),longitude:PLACES.map(p=>p.lon).join(','),hourly:'european_aqi,pm2_5',domains:'cams_europe',forecast_days:'3',timeformat:'unixtime',timezone:'Europe/Berlin'});const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('Luftqualitätsdaten nicht erreichbar.');const rows=await r.json();if(!Array.isArray(rows)||rows.length!==3||rows.some(r=>!r.hourly?.time?.length))throw Error('Luftqualitätsdaten unvollständig.');const time=rows[0].hourly.time;if(rows.some(r=>r.hourly.time.length!==time.length||r.hourly.time.some((t:number,i:number)=>t!==time[i])))throw Error('Luftqualitätszeiten sind nicht vergleichbar.');const value=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;const data:Air={mode:'live',fetchedAt:now(),time,places:rows.map((r,i)=>({id:PLACES[i].id,aqi:time.map((_:number,j:number)=>value(r.hourly.european_aqi?.[j])),pm25:time.map((_:number,j:number)=>value(r.hourly.pm2_5?.[j]))}))};await writeCache('air-points',data);return data;}
export function demoAir():Air{const time=Array.from({length:49},(_,i)=>Math.floor(now()/3600)*3600+i*3600);return {mode:'demo',fetchedAt:now(),time,places:PLACES.map((p,j)=>({id:p.id,aqi:time.map((_,i)=>22+j*8+Math.round(Math.sin(i/6)*7)),pm25:time.map((_,i)=>8+j*2+Math.sin(i/6)*2)}))};}
