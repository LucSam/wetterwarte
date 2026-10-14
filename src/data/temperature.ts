import { PLACES } from '../config';
import type { PlaceId, TemperatureArchive, TemperatureYear } from '../types';
import { archiveCutoff, blankYear, completeYear, DAY, finite, iso, requiredYears, type TemperatureOptions } from '../temperature-stats';
import { meta, now } from './api';
import { readCache, writeCache } from './cache';

export const temperatureKey=(place:PlaceId)=>`temperature-daily-v1-${place}`;
export function emptyTemperature(place:PlaceId):TemperatureArchive{return {...meta('temperature-history'),kind:'temperature-history',place,model:'era5',unit:'°C',source:'Open-Meteo / Copernicus ERA5',years:[]};}
const variables=['temperature_2m_mean','temperature_2m_min','temperature_2m_max'] as const;
export function parseTemperature(response:any,start:number,end:number,fetchedAt=now()):TemperatureYear[]{
 if(response.timezone!=='Europe/Berlin'||variables.some(v=>response.daily_units?.[v]!=='°C'))throw Error('ERA5: unerwartete Zeitzone oder Temperatureinheit.');
 const d=response.daily;if(!Array.isArray(d?.time)||variables.some(v=>!Array.isArray(d[v])||d[v].length!==d.time.length))throw Error('ERA5: unvollständiges Datenformat.');
 const years=new Map(Array.from({length:end-start+1},(_,i)=>{const y=blankYear(start+i);y.fetchedAt=fetchedAt;return [y.year,y] as const;})),seen=new Set<string>();
 for(let i=0;i<d.time.length;i++){
  const date=d.time[i];if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||iso(Date.parse(date))!==date||seen.has(date))throw Error('ERA5: ungültige oder doppelte Kalendertage.');
  seen.add(date);const year=Number(date.slice(0,4)),y=years.get(year);if(!y)throw Error('ERA5: Datum außerhalb des Abrufs.');
  const values=variables.map(v=>d[v][i]);if(values.some(v=>v!==null&&!finite(v)))throw Error('ERA5: ungültiger Temperaturwert.');
  const [mean,min,max]=values;if(values.every(finite)&&(min>mean||mean>max))throw Error('ERA5: Minimum, Mittelwert und Maximum widersprechen sich.');
  const n=(Date.parse(date)-Date.UTC(year,0,1))/DAY;y.mean[n]=mean;y.min[n]=min;y.max[n]=max;
 }
 return [...years.values()];
}
export function temperatureNeedsFetch(y:TemperatureYear|undefined,date=new Date()){
 if(!y)return true;
 // Completed calendar years are immutable here; retry incomplete years daily.
 if(completeYear(y)&&y.year<Number(archiveCutoff(date).slice(0,4)))return false;
 return date.getTime()/1000-y.fetchedAt>=86400;
}
async function pause(signal:AbortSignal,seconds:number){
 signal.throwIfAborted();if(seconds<=0)return;
 await new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Abgebrochen','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},seconds*1000);signal.addEventListener('abort',abort,{once:true});});
}
/** Serial, resumable blocks. Selected year arrives first; each block persists before the next request. */
export async function fetchTemperature(place:PlaceId,o:TemperatureOptions,cached:TemperatureArchive|undefined,signal:AbortSignal,progress:(s:string,data?:TemperatureArchive)=>void,date=new Date()):Promise<TemperatureArchive>{
 const location=PLACES.find(p=>p.id===place)!,cutoff=archiveCutoff(date),years=new Map((cached?.years??[]).map(y=>[y.year,y]));
 const missing=requiredYears(o,date).filter(y=>temperatureNeedsFetch(years.get(y),date));
 const blocks:[number,number][]=[];
 if(o.scale!=='long'&&missing.includes(o.year)){blocks.push([o.year,o.year]);missing.splice(missing.indexOf(o.year),1);}
 for(const year of missing){const last=blocks.at(-1);if(last&&last[0]!==o.year&&last[1]===year-1&&year-last[0]<10)last[1]=year;else blocks.push([year,year]);}
 let data=cached??emptyTemperature(place);
 for(let b=0;b<blocks.length;b++){
  const [start,end]=blocks[b],last=await readCache<number>('last-climate-request')??0,wait=Math.max(0,last+32-now());
  if(wait){progress(`Referenz lädt · Pause ${Math.ceil(wait)} s`,data);await pause(signal,wait);}
  signal.throwIfAborted();const endDate=`${end}-12-31`<cutoff?`${end}-12-31`:cutoff;
  if(`${start}-01-01`>endDate)continue;
  progress(`ERA5 ${start===end?start:`${start}–${end}`} · ${b+1}/${blocks.length}`,data);await writeCache('last-climate-request',now());
  const params=new URLSearchParams({latitude:String(location.lat),longitude:String(location.lon),start_date:`${start}-01-01`,end_date:endDate,daily:variables.join(','),models:'era5',timezone:'Europe/Berlin',temperature_unit:'celsius'});
  const r=await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`,{signal:AbortSignal.any([signal,AbortSignal.timeout(90_000)])});
  if(!r.ok)throw Error(r.status===429?'ERA5-Nutzungslimit erreicht. Gespeicherte Werte bleiben verfügbar.':`ERA5-Abruf: HTTP ${r.status}`);
  for(const y of parseTemperature(await r.json(),start,end))years.set(y.year,y);
  data={...emptyTemperature(place),years:[...years.values()].sort((a,b)=>a.year-b.year)};
  await writeCache(temperatureKey(place),data);progress(`Temperaturdaten gespeichert · ${b+1}/${blocks.length}`,data);
 }
 return data;
}
const demos=new Map<string,TemperatureArchive>();
export function demoTemperature(place:PlaceId,o:TemperatureOptions,date=new Date()):TemperatureArchive{
 const required=requiredYears(o,date),key=`${place}:${required.join(',')}:${archiveCutoff(date)}`;const existing=demos.get(key);if(existing)return existing;
 const offset=place==='berlin'?.6:place==='potsdam'?.2:0,cutoff=archiveCutoff(date);
 const years=required.map(year=>{
  const y=blankYear(year);y.fetchedAt=now();
  for(let i=0;i<y.mean.length;i++){
   if(iso(Date.UTC(year,0,1)+i*DAY)>cutoff)continue;
   const annual=(year-1990)*.038+1.05*Math.sin(year*1.72),season=10*Math.sin((i-100)*Math.PI*2/y.mean.length),weather=2.2*Math.sin(i*.24+year)+1.4*Math.cos(i*.079+year*.61);
   const mean=9.1+offset+annual+season+weather,range=4+1.3*Math.sin(i*.15+year);
   y.mean[i]=Math.round(mean*10)/10;y.min[i]=Math.round((mean-range)*10)/10;y.max[i]=Math.round((mean+range+1)*10)/10;
  }return y;
 });
 const data:TemperatureArchive={...emptyTemperature(place),mode:'demo',source:'Synthetische Beispieldaten',years};if(demos.size>20)demos.clear();demos.set(key,data);return data;
}
