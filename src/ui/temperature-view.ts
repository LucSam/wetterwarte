import type { TemperatureArchive } from '../types';
import { berlinToday, temperatureStats, type TemperatureOptions, type TemperatureStats, type TemperaturePoint } from '../temperature-stats';
import { escapeHtml as esc } from './charts';

const number=(v:number|null,digits=1)=>v===null?'–':v.toLocaleString('de-DE',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const signed=(v:number|null)=>v===null?'–':`${v>0?'+':''}${number(v)}`;
const shortDate=(date:string)=>date?`${date.slice(8,10)}.${date.slice(5,7)}.${date.slice(0,4)}`:'Keine Daten';
const months=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
export function readTemperatureOptions():TemperatureOptions{
 const today=berlinToday(),current=Number(today.slice(0,4)),defaults:TemperatureOptions={scale:'long',year:current,month:Number(today.slice(5,7)),reference:'normal',plot:'anomaly'};
 try{const saved=JSON.parse(localStorage.getItem('wetterwarte-temperature')??'null');if(!saved)return defaults;return {scale:['month','year','long'].includes(saved.scale)?saved.scale:defaults.scale,year:Number.isInteger(saved.year)&&saved.year>=1961&&saved.year<=current?saved.year:current,month:Number.isInteger(saved.month)&&saved.month>=1&&saved.month<=12?saved.month:defaults.month,reference:['normal','rolling'].includes(saved.reference)?saved.reference:defaults.reference,plot:['anomaly','curves','spread'].includes(saved.plot)?saved.plot:defaults.plot};}catch{return defaults;}
}
export function saveTemperatureOptions(o:TemperatureOptions){try{localStorage.setItem('wetterwarte-temperature',JSON.stringify(o));}catch{/* In-memory controls remain usable. */}}
let displayed:TemperatureStats|undefined;
let displayedPlot:TemperatureOptions['plot']='anomaly';
export function temperatureView(data:TemperatureArchive|undefined,o:TemperatureOptions,progress:string,error:string,online:boolean){
 const s=temperatureStats(data,o);displayed=s;displayedPlot=o.plot;const summary=s.summary,current=Number(berlinToday().slice(0,4));
 const select=(key:string,label:string,value:string,items:[string,string][],extra='')=>`<select id="temperature-${key}" aria-label="${label}" ${extra}>${items.map(([id,text])=>`<option value="${id}" ${id===value?'selected':''}>${text}</option>`).join('')}</select>`;
 const complete=summary.days===summary.expected,delta=summary.anomaly;
 const leapNote=o.scale==='month'&&o.month===2&&s.points.length===29&&s.points[28].n?`29.2.: ${s.points[28].n} Referenzjahre`:'';
 const state=error||(progress?progress:!online?'Offline · gespeichert':summary.days===0?'Keine Werte für diesen Zeitraum':!s.referenceReady?'Referenz unvollständig':!complete?`${summary.days}/${summary.expected} Tage · bisher`:leapNote);
 return `<section class="temperature-history" data-plot="${o.plot}" aria-label="Temperaturstatistik">
 <div class="temperature-controls">
 ${select('scale','Zeitskala',o.scale,[['month','Monat'],['year','Jahr'],['long','30 Jahre']])}
 ${o.scale!=='long'?select('year','Jahr',String(o.year),Array.from({length:current-1960},(_,i)=>[String(current-i),String(current-i)])):''}
 ${o.scale==='month'?select('month','Monat',String(o.month),months.map((m,i)=>[String(i+1),m])):''}
 ${select('reference','Referenzzeitraum',o.reference,[['rolling','Letzte 30 J.'],['normal','Klimanormal']])}
 ${select('plot','Diagramm',o.plot,[['anomaly','Abweichung'],['curves','Kurven'],['spread','Streuung']],'class="temperature-plot-choice"')}
 </div>
 <div class="temperature-heading"><h1>${s.title}</h1><span>${o.scale==='month'?'Tageswerte':o.scale==='year'?'Monatswerte':'Jahreswerte'} · Temperatur in °C</span></div>
 <div class="temperature-summary">
 <div class="stat-min"><span>Minimum</span><strong>${number(summary.min)}<small> °C</small></strong><span>${shortDate(summary.minDate)}</span></div>
 <div class="stat-max"><span>Maximum</span><strong>${number(summary.max)}<small> °C</small></strong><span>${shortDate(summary.maxDate)}</span></div>
 <div><span>Mittel${!complete&&summary.days?' · bisher':''}</span><strong>${number(summary.mean)}<small> °C</small></strong><span>${complete?'Zeitraum vollständig':`${summary.days}/${summary.expected} Tage`}</span></div>
 <div><span>Abweichung</span><strong class="${delta===null?'':delta<0?'colder':'warmer'}">${signed(delta)}<small> °C</small></strong><span>${delta===null?'Nicht vergleichbar':`zu ${s.baseline.join('–')}`}</span></div>
 </div>
 <div class="temperature-charts">
 <div class="temperature-figure temperature-${o.plot}" role="img" aria-label="${esc(s.title)}: ${o.plot==='curves'?'Minimum, Maximum und Mittelwerte':o.plot==='spread'?`Mittelwerte und Referenz ${s.baseline.join(' bis ')} mit einer Standardabweichung`:`Abweichung der Mittelwerte von ${s.baseline.join(' bis ')}`}"><div class="temperature-plot" data-temperature-chart="${o.plot}"></div></div>
 </div>
 ${o.plot==='curves'?'<div class="temperature-legend"><span class="legend-min">Minimum</span><span class="legend-max">Maximum</span><span class="legend-mean">Mittel</span></div>':o.plot==='spread'?`<div class="temperature-legend"><span class="legend-mean">Mittel</span><span class="legend-reference">${s.baseline.join('–')}</span><span class="legend-spread">±1 Standardabweichung</span></div>`:`<div class="temperature-anomaly-legend"><span class="colder">Kälter</span><span class="warmer">Wärmer</span><span class="legend-reference">Referenz ${s.baseline.join('–')}</span></div>`}
 <div class="temperature-source" role="status"><span>${data?.mode==='demo'?'DEMO': 'ERA5 · Reanalyse'}${s.through?` · bis ${shortDate(s.through)}`:''}</span><span title="${esc(state)}">${esc(state)}</span></div>
 </section>`;
}
const rounded=(n:number)=>Number(n.toFixed(2));
function niceStep(range:number){const base=10**Math.floor(Math.log10(range/4||1));return [1,2,5,10].map(n=>n*base).find(n=>n>=range/4)??base*10;}
function lineSegments(points:TemperaturePoint[],get:(p:TemperaturePoint)=>number|null,x:(i:number)=>number,y:(n:number)=>number){
 let open=false;return points.map((p,i)=>{const value=get(p);if(value===null){open=false;return '';}const command=open?'L':'M';open=true;return `${command}${rounded(x(i))},${rounded(y(value))}`;}).join(' ');
}
function chart(s:TemperatureStats,width:number,height:number,plot:TemperatureOptions['plot']){
 const anomaly=plot==='anomaly',spread=plot==='spread';
 const small=width<550,left=small?33:44,right=12,top=20,bottom=24,w=Math.max(10,width-left-right),h=Math.max(10,height-top-bottom),points=s.points;
 const values=points.flatMap(p=>anomaly?[p.anomaly]:spread?[p.mean,p.reference===null||p.sd===null?null:p.reference-p.sd,p.reference===null||p.sd===null?null:p.reference+p.sd]:[p.min,p.mean,p.max]).filter((v):v is number=>v!==null);
 const extent=anomaly?Math.max(.5,...values.map(Math.abs)):0;
 const rawMin=anomaly?-extent:values.length?Math.min(...values):0,rawMax=anomaly?extent:values.length?Math.max(...values):20,step=niceStep(Math.max(1,rawMax-rawMin));
 const min=Math.floor(rawMin/step)*step,max=Math.max(min+step,Math.ceil(rawMax/step)*step);
 const x=(i:number)=>left+(i+.5)*w/points.length,y=(n:number)=>top+(max-n)/(max-min)*h;
 let html=`<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><text x="${left}" y="13" class="plot-title">${anomaly?'Abweichung':spread?'Mittel und Referenz':'Temperatur'} · °C</text>`;
 for(let tick=min;tick<=max+.001;tick+=step)html+=`<line x1="${left}" x2="${width-right}" y1="${y(tick)}" y2="${y(tick)}" class="${anomaly&&Math.abs(tick)<.0001?'plot-zero':'plot-grid'}"/><text x="${left-7}" y="${y(tick)+4}" text-anchor="end">${number(tick,step<1?1:0)}</text>`;
 if(anomaly){
  points.forEach((p,i)=>{if(p.anomaly===null)return;const value=p.anomaly;html+=`<rect class="${value<0?'plot-cold':'plot-warm'}" x="${x(i)-w/points.length*.34}" y="${Math.min(y(value),y(0))}" width="${w/points.length*.68}" height="${Math.max(1,Math.abs(y(value)-y(0)))}"><title>${esc(p.label)}: ${signed(value)} °C</title></rect>`;});
 }else{
  // Spread has its own axis range; do not distort SD to fit the extreme curves.
  if(spread){
  // Separate polygons at data gaps; never bridge a missing reference value.
  let run:number[]=[];const flush=()=>{if(!run.length)return;const topPoints=run.map(i=>`${x(i)},${y(points[i].reference!+points[i].sd!)}`),bottomPoints=[...run].reverse().map(i=>`${x(i)},${y(points[i].reference!-points[i].sd!)}`);html+=`<polygon points="${[...topPoints,...bottomPoints].join(' ')}" class="plot-band"/>`;run=[];};
  points.forEach((p,i)=>{if(p.reference!==null&&p.sd!==null)run.push(i);else flush();});flush();
  }
  const series=spread?[['reference','plot-reference'],['mean','plot-mean']] as const:[['min','plot-min'],['max','plot-max'],['mean','plot-mean']] as const;
  for(const [field,cls] of series){
   html+=`<path d="${lineSegments(points,p=>p[field],x,y)}" class="${cls}"/>`;
   // Markers keep single values and breaks visible (including incomplete years).
   points.forEach((p,i)=>{if(p[field]!==null&&field!=='reference'&&(s.scale!=='month'||points[i-1]?.[field]==null&&points[i+1]?.[field]==null))html+=`<circle cx="${x(i)}" cy="${y(p[field]!)}" r="${field==='mean'?2.4:1.7}" class="${cls}"/>`;});
  }
 }
 const count=small?5:9,indices=[...new Set(Array.from({length:Math.min(count,points.length)},(_,n)=>Math.round(n*(points.length-1)/(Math.min(count,points.length)-1))))];
 for(const i of indices)html+=`<text x="${x(i)}" y="${height-5}" text-anchor="${i===0?'start':i===points.length-1?'end':'middle'}">${esc(points[i].label)}</text>`;
 if(!values.length)html+=`<text x="${left+w/2}" y="${top+h/2}" text-anchor="middle">${anomaly?'Keine vergleichbaren Werte':'Daten werden vorbereitet'}</text>`;
 return html+'</svg>';
}
export function fitTemperatureCharts(){
 if(!displayed)return;for(const node of document.querySelectorAll<HTMLElement>('[data-temperature-chart]')){if(node.clientHeight>0&&node.clientWidth>0)node.innerHTML=chart(displayed,node.clientWidth,node.clientHeight,displayedPlot);}
}
