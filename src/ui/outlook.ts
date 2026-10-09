import { berlinDate, fmt } from '../calc';
import { now } from '../data/api';
import type { PlaceId, Weather } from '../types';
import { escapeHtml as esc } from './charts';
import { weatherIcon } from './weather-icons';

export function outlookView(data:Weather,place:PlaceId,week:number){
 const all=data.outlook?.places.find(p=>p.id===place)?.days.filter(d=>d.date>=berlinDate(now()))??[];
 if(!all.length)return `<section class="daily-outlook"><h2>Tagesvorschau</h2><p class="outlook-missing">${esc(data.outlookError??'Noch keine längerfristigen Tagesdaten gespeichert.')} Die DWD-Stundenprognose bleibt verfügbar.</p></section>`;
 const page=Math.min(week,Math.floor((all.length-1)/7)),days=all.slice(page*7,page*7+7);
 return `<section class="daily-outlook"><div class="outlook-heading"><h2>${all.length}-Tage-Vorschau <small>ECMWF IFS</small></h2><div class="outlook-weeks" role="group" aria-label="Vorhersagewoche"><button data-outlook-week="0" aria-pressed="${page===0}">1–7</button><button data-outlook-week="1" aria-pressed="${page===1}" ${all.length<=7?'disabled':''}>8–14</button></div></div><div class="outlook-days">${days.map(d=>`<article class="outlook-day"><strong>${d.date===berlinDate(now())?'Heute':new Intl.DateTimeFormat('de-DE',{weekday:'short',timeZone:'Europe/Berlin'}).format(new Date(d.date+'T12:00:00Z'))}</strong><span>${d.date.slice(8)}.${d.date.slice(5,7)}.</span>${weatherIcon(d.code)}<div><strong>${fmt(d.max,0)}°</strong><span>${fmt(d.min,0)}°</span></div><span class="outlook-rain">${fmt(d.rain)} mm</span><small>${fmt(d.probability,0)} %</small></article>`).join('')}</div><p class="outlook-note"><span class="regular-label">Tageswerte: ECMWF IFS 0,25° · Woche 2 als Trend; Details unsicherer. Stunden: DWD ICON-EU.</span><span class="small-display-label">ECMWF IFS · Woche 2 unsicherer</span></p></section>`;
}
