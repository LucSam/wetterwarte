import { getMoonIllumination } from 'suncalc';
export function moonAt(time:number) {
  const m=getMoonIllumination(new Date(time*1000));
  const label=m.fraction<.005?'Neumond':m.fraction>.995?'Vollmond':Math.abs(m.phase-.25)<.015?'Erstes Viertel':Math.abs(m.phase-.75)<.015?'Letztes Viertel':m.phase<.25?'Zunehmende Sichel':m.phase<.5?'Zunehmender Mond':m.phase<.75?'Abnehmender Mond':'Abnehmende Sichel';
  return {time,phase:m.phase,illuminated:m.fraction,waxing:m.waxing,label,source:'SunCalc 2.1.1 · astronomisch berechnet'};
}

import { getTimes } from 'suncalc';
import { berlinDate } from '../calc';
const solarCache=new Map<string,{sunrise:number|null;sunset:number|null;alwaysUp:boolean}>();
/** Civil Berlin day, independent of the browser's timezone or a selected forecast hour. */
export function daylightAt(time:number,lat:number,lon:number){
 const date=berlinDate(time),key=`${date}:${lat}:${lon}`;let solar=solarCache.get(key);
 if(!solar){const times=getTimes(new Date(`${date}T12:00:00Z`),lat,lon);solar={sunrise:times.sunrise?times.sunrise.getTime()/1000:null,sunset:times.sunset?times.sunset.getTime()/1000:null,alwaysUp:times.alwaysUp===true};solarCache.clear();solarCache.set(key,solar);}
 return {...solar,isDay:solar.sunrise!=null&&solar.sunset!=null?time>=solar.sunrise&&time<solar.sunset:solar.alwaysUp};
}
