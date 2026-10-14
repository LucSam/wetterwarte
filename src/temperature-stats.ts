import type { Num, TemperatureArchive, TemperatureYear } from './types';

export type TemperatureScale='month'|'year'|'long';
export type ReferenceMode='rolling'|'normal';
export interface TemperatureOptions { scale:TemperatureScale; year:number; month:number; reference:ReferenceMode; plot:'curves'|'anomaly'|'spread' }
export const DAY=86400000;
export const iso=(ms:number)=>new Date(ms).toISOString().slice(0,10);
export function berlinToday(date=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function archiveCutoff(date=new Date()){return iso(Date.parse(berlinToday(date))-5*DAY);}
export const daysInYear=(year:number)=>(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/DAY;
export const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
export function blankYear(year:number):TemperatureYear{return {year,mean:Array(daysInYear(year)).fill(null),min:Array(daysInYear(year)).fill(null),max:Array(daysInYear(year)).fill(null),fetchedAt:0};}
export function completeYear(y:TemperatureYear|undefined):boolean{return !!y&&[y.mean,y.min,y.max].every(a=>a.length===daysInYear(y.year)&&a.every(finite));}
/** ERA5 is delayed: at the start of January the previous year may not be complete. */
export function referencePeriod(mode:ReferenceMode,date=new Date()):[number,number]{
 const cutoff=archiveCutoff(date),end=Number(cutoff.slice(0,4))-(cutoff.endsWith('12-31')?0:1);
 const last=mode==='rolling'?end:Math.floor(end/10)*10;
 return [last-29,last];
}
export function requiredYears(o:TemperatureOptions,date=new Date()){
 const [start,end]=referencePeriod(o.reference,date),longEnd=referencePeriod('rolling',date)[1];
 return [...new Set([...(o.scale==='long'?Array.from({length:30},(_,i)=>longEnd-29+i):[o.year]),...Array.from({length:30},(_,i)=>start+i)])].sort((a,b)=>a-b);
}
export function distribution(values:number[]){
 if(!values.length)return {mean:null,sd:null,n:0};
 const mean=values.reduce((a,b)=>a+b,0)/values.length;
 return {mean,sd:values.length>1?Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(values.length-1)):null,n:values.length};
}
export interface TemperaturePoint { label:string; mean:Num; min:Num; max:Num; reference:Num; sd:Num; n:number; anomaly:Num; complete:boolean }
export interface TemperatureSummary { mean:Num; min:Num; max:Num; minDate:string; maxDate:string; days:number; expected:number; anomaly:Num }
export interface TemperatureStats { points:TemperaturePoint[]; summary:TemperatureSummary; baseline:[number,number]; referenceReady:boolean; title:string; scale:TemperatureScale; through:string }
function aggregate(y:TemperatureYear|undefined,start:number,end:number){
 const rows=Array.from({length:end-start},(_,i)=>start+i).filter(i=>finite(y?.mean[i])&&finite(y?.min[i])&&finite(y?.max[i]));
 const mean=rows.length?rows.reduce((s,i)=>s+y!.mean[i]!,0)/rows.length:null;
 let min:Num=null,max:Num=null,minDate='',maxDate='';
 for(const i of rows){if(min===null||y!.min[i]!<min){min=y!.min[i];minDate=iso(Date.UTC(y!.year,0,1)+i*DAY);}if(max===null||y!.max[i]!>max){max=y!.max[i];maxDate=iso(Date.UTC(y!.year,0,1)+i*DAY);}}
 return {mean,min,max,minDate,maxDate,days:rows.length,expected:end-start,anomaly:null as Num};
}
function monthSpan(year:number,month:number):[number,number]{return [(Date.UTC(year,month-1,1)-Date.UTC(year,0,1))/DAY,(Date.UTC(year,month,1)-Date.UTC(year,0,1))/DAY];}
export function temperatureStats(data:TemperatureArchive|undefined,o:TemperatureOptions,date=new Date()):TemperatureStats{
 const baseline=referencePeriod(o.reference,date),years=new Map(data?.years.map(y=>[y.year,y])),refs=Array.from({length:30},(_,i)=>years.get(baseline[0]+i));
 const referenceReady=refs.every(completeYear),selected=years.get(o.year),points:TemperaturePoint[]=[];
 const make=(label:string,a:ReturnType<typeof aggregate>,samples:number[],expected:number)=>{
  const d=distribution(referenceReady&&samples.length===expected?samples:[]),mean=a.days===a.expected?a.mean:null;
  points.push({label,mean,min:a.days===a.expected?a.min:null,max:a.days===a.expected?a.max:null,reference:d.mean,sd:d.sd,n:d.n,anomaly:mean!==null&&d.mean!==null?mean-d.mean:null,complete:a.days===a.expected});
 };
 let summary:TemperatureSummary,title:string;
 if(o.scale==='month'){
  const [start,end]=monthSpan(o.year,o.month);summary=aggregate(selected,start,end);
  for(let i=start;i<end;i++){
   const day=i-start+1,samples:number[]=[];let expected=0;
   for(let y=baseline[0];y<=baseline[1];y++){const [s,e]=monthSpan(y,o.month);if(day>e-s)continue;expected++;const value=years.get(y)?.mean[s+day-1];if(finite(value))samples.push(value);}
   make(String(day),aggregate(selected,i,i+1),samples,expected);
  }
  title=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(o.year,o.month-1,1)));
 }else if(o.scale==='year'){
  summary=aggregate(selected,0,daysInYear(o.year));
  for(let m=1;m<=12;m++){
   const a=aggregate(selected,...monthSpan(o.year,m)),samples=refs.map(y=>y?aggregate(y,...monthSpan(y.year,m)):null).filter(a=>a&&a.days===a.expected).map(a=>a!.mean!).filter(finite);
   make(new Intl.DateTimeFormat('de-DE',{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(o.year,m-1,1))).replace('.',''),a,samples,30);
  }title=String(o.year);
 }else{
  const [start,end]=referencePeriod('rolling',date),samples=refs.filter(completeYear).map(y=>aggregate(y,0,daysInYear(y!.year)).mean!).filter(finite);
  summary={mean:null,min:null,max:null,minDate:'',maxDate:'',days:0,expected:0,anomaly:null};let sum=0;
  for(let y=start;y<=end;y++){
   const a=aggregate(years.get(y),0,daysInYear(y));make(String(y),a,samples,30);
   summary.days+=a.days;summary.expected+=a.expected;if(a.mean!==null)sum+=a.mean*a.days;
   if(a.min!==null&&(summary.min===null||a.min<summary.min)){summary.min=a.min;summary.minDate=a.minDate;}
   if(a.max!==null&&(summary.max===null||a.max>summary.max)){summary.max=a.max;summary.maxDate=a.maxDate;}
  }
  // Each year carries equal weight, as in the interannual reference distribution.
  summary.mean=points.every(p=>p.mean!==null)?distribution(points.map(p=>p.mean!)).mean:summary.days?sum/summary.days:null;
  title=`${start}–${end}`;
 }
 if(referenceReady&&summary.days===summary.expected){
  const samples=refs.map(y=>o.scale==='month'?aggregate(y,...monthSpan(y!.year,o.month)).mean:aggregate(y,0,daysInYear(y!.year)).mean).filter(finite);
  const ref=distribution(samples).mean;summary.anomaly=summary.mean!==null&&ref!==null?summary.mean-ref:null;
 }
 let through='';for(const y of data?.years??[])for(let i=y.mean.length-1;i>=0;i--){if(finite(y.mean[i])&&finite(y.min[i])&&finite(y.max[i])){const d=iso(Date.UTC(y.year,0,1)+i*DAY);if(d>through)through=d;break;}}
 return {points,summary,baseline,referenceReady,title,scale:o.scale,through};
}
