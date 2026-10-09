import { BASELINE, CLIMATE_MODELS, FUTURE, PLACES, SCENARIO } from '../config';
import { berlinDate, commonSixHourly, summarizeMembers } from '../calc';
import type { Climate, Ensemble, PlaceId, Weather } from '../types';
import { meta, now } from './api';
const round = (v: number) => Math.round(v * 10) / 10;
const hour = (t: number) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(t * 1000));
function temperature(t: number, offset: number) { return round(13.5 + 4.2 * Math.cos((hour(t) - 15) / 24 * Math.PI * 2) + offset); }
export function demoWeather(): Weather {
  const start = Math.floor(now() / 86400) * 86400 - 86400;
  const time = Array.from({ length: 145 }, (_, i) => start + i * 3600);
  const places = PLACES.map((p, pi) => {
    const rain = time.map((t, i) => round(Math.max(0, 1.6 * Math.sin((i - 26) / 7) - 1.0) * (1 + pi * .1)));
    const temp = time.map(t => temperature(t, [0, .3, 1.1][pi]));
    const probability = rain.map(v => v > 0 ? Math.min(95, Math.round(45 + v * 40)) : 10);
    const wind = time.map((t, i) => round(12 + 5 * Math.sin(i / 8) + pi));
    const direction = time.map((t, i) => Math.round(235 + 30 * Math.sin(i / 12)));
    const code = rain.map((r, i) => r > 0 ? 61 : hour(time[i]) >= 10 && hour(time[i]) < 17 ? 2 : 3);
    const currentIndex = Math.max(0, time.findIndex(t => t >= Math.floor(now()/3600)*3600));
    const dates = [...new Set(time.map(berlinDate))];
    return { id: p.id, grid: [p.lat,p.lon] as [number,number], current: { time: now(), temperature: temp[currentIndex], wind: wind[currentIndex], direction: direction[currentIndex], code: code[currentIndex] }, temperature: temp, rain, probability, wind, direction, code,
      days: dates.map(date => { const ids = time.map((t,i) => berlinDate(t) === date ? i : -1).filter(i => i >= 0); return { date, min: Math.min(...ids.map(i=>temp[i])), max: Math.max(...ids.map(i=>temp[i])), rain: round(ids.reduce((s,i)=>s+rain[i],0)), probability: Math.max(...ids.map(i=>probability[i])), wind: Math.max(...ids.map(i=>wind[i])) }; }).filter(d => d.date >= berlinDate(now())).slice(0,3),
    };
  });
  const outlook={model:'ecmwf_ifs025 (Beispiel)',source:'Synthetische Beispieldaten',fetchedAt:now(),places:places.map((p,pi)=>({id:p.id,days:Array.from({length:14},(_,i)=>{const date=berlinDate(new Date(berlinDate(now())+'T12:00:00Z').getTime()/1000+i*86400),known=p.days.find(d=>d.date===date),rain=known?.rain??round(Math.max(0,Math.sin(i*.7)*4));return {date,min:known?.min??round(8+pi*.3+2*Math.sin(i*.6)),max:known?.max??round(15+pi*.3+3*Math.sin(i*.6)),rain,probability:known?.probability??Math.round(15+rain*15),code:rain>0?61:2};})}))};
  return { ...meta('weather','demo'), kind:'weather', model:'icon_eu (Beispiel)', time, places,outlook };
}
export function demoEnsemble(place: PlaceId): Ensemble {
  const weather = demoWeather(), p = weather.places.find(p=>p.id===place)!;
  const series = [40,51].map((n, model) => {
    const members = Array.from({length:n}, (_, m) => weather.time.map((t,i) => round(p.temperature[i]! + model * .7 + ((m/(n-1))-.5) * (2.4 + Math.max(0,t-now())/86400 * 1.8) + .3 * Math.sin(m+i/10))));
    return { model: model ? 'ecmwf_aifs025_ensemble' : 'icon_eu_eps', label: model ? 'ECMWF AIFS' : 'DWD ICON-EU-EPS', resolution: model ? '0,25° (~25 km) · 6 h' : '13 km · 1 h', members:n, ...summarizeMembers(members) };
  });
  const ids = commonSixHourly(weather.time, series[0].median, series[1].median, now());
  return { ...meta('ensemble','demo'), kind:'ensemble', place, time:ids.map(i=>weather.time[i]), series:series.map(s=>({...s,p10:ids.map(i=>s.p10[i]),median:ids.map(i=>s.median[i]),p90:ids.map(i=>s.p90[i]),count:ids.map(i=>s.count[i])})) };
}
export function demoClimate(place: PlaceId): Climate {
  const offset = place === 'berlin' ? .5 : place === 'potsdam' ? .2 : 0;
  return { ...meta('climate','demo'),kind:'climate',place,baseline:BASELINE,future:FUTURE,scenario:SCENARIO,errors:[],models:CLIMATE_MODELS.map((model,i)=>({ model,
    baseline:{temperature:9.5+i*.2+offset,hotDays:8+i+offset*4,years:20,rain:{DJF:124+i*6,MAM:139+i*5,JJA:183+i*9,SON:143+i*4}},
    future:{temperature:11.2+i*.55+offset,hotDays:17+i*4+offset*4,years:20,rain:{DJF:141+i*9,MAM:143+i*7,JJA:169+i*3,SON:147+i*6}},
  })) };
}
