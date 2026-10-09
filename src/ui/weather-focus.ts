import type {PlaceId,Weather} from '../types';
import {berlinDate,clockTime,condition,fmt} from '../calc';
import {now} from '../data/api';
import {weatherIcon} from './weather-icons';

/** An additional layout. Forecast rows keep their own model and time resolution. */
export function weatherFocus(data:Weather,place:PlaceId,radar:string,offset:number,count:number,tiny:boolean){
 const p=data.places.find(p=>p.id===place)!,today=p.days.find(d=>d.date===berlinDate(now()));
 const start=Math.max(0,data.time.findIndex(t=>t>=Math.floor(now()/3600)*3600));
 const hours=data.time.map((_,i)=>i).slice(start,start+(tiny?3:6));
 const all=data.outlook?.places.find(p=>p.id===place)?.days.filter(d=>d.date>=berlinDate(now()))??[];
 const first=Math.min(offset,Math.max(0,all.length-count)),days=all.slice(first,first+count);
 const min=Math.min(...all.flatMap(d=>d.min==null?[]:[d.min])),max=Math.max(...all.flatMap(d=>d.max==null?[]:[d.max]));
 return `<div class="weather-focus"><section class="focus-summary"><div class="focus-current"><div><span class="focus-caption">Aktuell · ${clockTime(p.current.time)}</span><strong>${fmt(p.current.temperature)}<small> °C</small></strong></div><div class="focus-condition">${weatherIcon(p.current.code)}<span>${condition(p.current.code)}</span></div><p>Max <b>${fmt(today?.max,0)}<span class="degree-unit"> °C</span></b> · Min <b>${fmt(today?.min,0)}<span class="degree-unit"> °C</span></b></p></div>
 <div class="focus-hours" aria-label="Nächste Stunden, DWD ICON-EU">${hours.map((i,j)=>`<div><span>${j===0?'Jetzt':clockTime(data.time[i]).slice(0,2)}</span>${weatherIcon(j===0?p.current.code:p.code[i])}<strong>${fmt(j===0?p.current.temperature:p.temperature[i],0)}<span class="degree-unit"> °C</span></strong></div>`).join('')}</div>
 <div class="focus-days-heading"><span>Tage · ECMWF IFS</span><div><button data-focus-days="${Math.max(0,first-count)}" ${first===0?'disabled':''} aria-label="Vorherige Tage">‹</button><span>${all.length?(count===1?`${all.length} Tage`:`Tage ${first+1}–${first+days.length}`):'Keine Tagesdaten'}</span><button data-focus-days="${first+count}" ${first+count>=all.length?'disabled':''} aria-label="Weitere Tage">›</button></div></div>
 <div class="focus-days">${days.length?days.map(d=>{
  const left=d.min==null?0:(d.min-min)/Math.max(1,max-min)*100,width=d.min==null||d.max==null?0:(d.max-d.min)/Math.max(1,max-min)*100;
  return `<div class="focus-day"><strong>${d.date===berlinDate(now())?'Heute':new Intl.DateTimeFormat('de-DE',{weekday:'short',timeZone:'Europe/Berlin'}).format(new Date(d.date+'T12:00:00Z'))}${tiny?` <small>${d.date.slice(8)}.${d.date.slice(5,7)}.</small>`:''}</strong><div class="focus-day-symbol">${weatherIcon(d.code)}<small>${fmt(d.probability,0)} %</small></div><span>${fmt(d.min,0)}<span class="degree-unit"> °C</span></span><div class="focus-temperature-range" aria-label="Temperaturspanne"><i style="left:${left}%;width:${width}%"></i></div><b>${fmt(d.max,0)}<span class="degree-unit"> °C</span></b></div>`;
 }).join(''):'<p>Keine Tagesdaten gespeichert.</p>'}</div></section>${radar}</div>`;
}
