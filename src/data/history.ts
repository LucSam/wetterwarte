import { PLACES } from '../config';
import { valid } from '../calc';
import type { History, HistoryYear, PlaceId } from '../types';
import { meta, now } from './api';
import { readCache, writeCache } from './cache';

export const HISTORY_BASELINE: [number, number] = [1991, 2020];
export const historyEnd = () => Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Europe/Berlin'}).format(new Date()))-1;
export const HISTORY_END = historyEnd();
export interface HistoryDaily { time: string[]; temperature_2m_mean: (number|null)[]; temperature_2m_max: (number|null)[]; precipitation_sum: (number|null)[] }
export function annualHistory(d: HistoryDaily, start: number, end: number): HistoryYear[] {
  const byDate = new Map(d.time.map((t, i) => [t, i]));
  return Array.from({length:end-start+1}, (_, n) => {
    const year = start+n; let temperature=0, hotDays=0, rain=0, count=0;
    for (let day=Date.UTC(year,0,1);day<Date.UTC(year+1,0,1);day+=86400000) {
      const date=new Date(day).toISOString().slice(0,10), i=byDate.get(date);
      if (i===undefined) throw Error(`Historie unvollständig: ${date}`);
      const t=d.temperature_2m_mean[i], max=d.temperature_2m_max[i], p=d.precipitation_sum[i];
      if (!valid(t)||!valid(max)||!valid(p)) throw Error(`Fehlende historische Werte: ${date}`);
      temperature+=t; hotDays+=max>=30?1:0; rain+=p; count++;
    }
    return {year,temperature:temperature/count,hotDays,rain};
  });
}
export function historyReference(data:History) {
  const years=data.years.filter(y=>y.year>=data.baseline[0]&&y.year<=data.baseline[1]);
  if(years.length!==data.baseline[1]-data.baseline[0]+1)throw Error('Historischer Referenzzeitraum unvollständig.');
  return {temperature:years.reduce((s,y)=>s+y.temperature,0)/years.length,hotDays:years.reduce((s,y)=>s+y.hotDays,0)/years.length,rain:years.reduce((s,y)=>s+y.rain,0)/years.length};
}
export async function fetchHistory(place:PlaceId, progress:(s:string)=>void, signal:AbortSignal):Promise<History> {
  const location=PLACES.find(p=>p.id===place)!; const years:HistoryYear[]=[]; let fetchedAt=now();
  for(const [start,end] of [[1961,1990],[1991,2020],[2021,historyEnd()]]) {
    const key=`history-years-v1-${place}-${start}-${end}`;
    let saved=await readCache<{fetchedAt:number;years:HistoryYear[]}>(key);
    if(!saved) {
      const last=await readCache<number>('last-climate-request')??0;
      const wait=Math.max(0,last+32-now());
      if(wait) {
        progress(`ERA5 ${start}–${end} · API-Pause ${wait} s`);
        await new Promise<void>((resolve,reject)=>{
          const abort=()=>{clearTimeout(timer);reject(new DOMException('Abgebrochen','AbortError'));};
          const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},wait*1000);
          signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
        });
      }
      if(signal.aborted)throw new DOMException('Abgebrochen','AbortError');
      progress(`ERA5 ${start}–${end} wird geladen …`);await writeCache('last-climate-request',now());
      const params=new URLSearchParams({latitude:String(location.lat),longitude:String(location.lon),start_date:`${start}-01-01`,end_date:`${end}-12-31`,daily:'temperature_2m_mean,temperature_2m_max,precipitation_sum',models:'era5',timezone:'Europe/Berlin',temperature_unit:'celsius',precipitation_unit:'mm'});
      const r=await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`,{signal:AbortSignal.any([signal,AbortSignal.timeout(90_000)])});
      if(!r.ok)throw Error(r.status===429?'API-Nutzungslimit erreicht. Später erneut versuchen.':`ERA5-Abruf: HTTP ${r.status}`);
      const data=await r.json();if(!data.daily)throw Error('Keine ERA5-Tageswerte erhalten.');
      saved={fetchedAt:now(),years:annualHistory(data.daily,start,end)};await writeCache(key,saved);
    }
    fetchedAt=Math.min(fetchedAt,saved.fetchedAt);years.push(...saved.years);
  }
  return {...meta('history'),kind:'history',place,model:'era5',source:'Open-Meteo / Copernicus ERA5',baseline:HISTORY_BASELINE,years,fetchedAt};
}
export function demoHistory(place:PlaceId):History {
  const offset=place==='berlin'?.6:place==='potsdam'?.2:0;
  return {...meta('history','demo'),kind:'history',place,model:'era5',baseline:HISTORY_BASELINE,
    years:Array.from({length:historyEnd()-1960},(_,i)=>({year:1961+i,temperature:8.7+offset+i*.032+.8*Math.sin(i*1.71)+.35*Math.cos(i*.48),hotDays:Math.max(0,Math.round(3+i*.20+5*Math.sin(i*1.3)+offset*3)),rain:Math.round(590+110*Math.sin(i*1.64)+65*Math.cos(i*.31))}))};
}
