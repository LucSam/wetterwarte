import {FIELD_CONFIG,TEMP_COLORS,WIND_COLORS,fieldImage,type Field,type Air,type MapLayer} from '../data/fields';
import {RADAR_EXTENT,RADAR_WIDTH,RADAR_HEIGHT} from '../data/radar';
import {mapBoundaries,mapLabels,projector} from './geography';
import {mapHeader,mapLayout,mapTimeline,verticalLegend} from './map-layout';
import {clockTime,dateTime,fmt} from '../calc';
import {now} from '../data/api';
import {PLACES} from '../config';
import type {PlaceId} from '../types';
import {escapeHtml as esc} from './charts';
export const layerTabs=(layer:MapLayer)=>`<div class="map-layer-tabs" role="group" aria-label="Kartenebene">${[['rain','Regen'],['temperature','Temperatur'],['wind','Wind'],['air','Luftqualität']].map(([id,label])=>`<button data-map-layer="${id}" aria-pressed="${layer===id}">${label}</button>`).join('')}</div>`;
export function fieldIndex(data:Field,step:number){const start=data.time.findIndex(t=>t>=now());return Math.min(data.time.length-1,(start<0?data.time.length-1:start)+Math.max(0,step));}
const project=projector(RADAR_EXTENT,RADAR_WIDTH,RADAR_HEIGHT);
function fieldMap(label:string,field:string,labels:string){return `<svg class="radar-map field-map regional-map" viewBox="325 85 392 400" role="img" aria-label="${esc(label)}"><g class="geo-base">${mapBoundaries(project)}</g>${field}<g class="geo-outlines">${mapBoundaries(project)}</g>${labels}</svg>`;}
function source(mode:string|undefined,base:string,time:number|undefined,stale:boolean,error?:string){return mode==='demo'?'DEMO':`${base}${!navigator.onLine?' · offline':stale?' · veraltet':error?' · gespeichert':''}${time?` · ${clockTime(time)}`:''}`;}
export function fieldView(data:Field|undefined,layer:'temperature'|'wind',place:PlaceId,step:number,busy:boolean,error?:string,playing=false,waiting=false){
 const c=FIELD_CONFIG[layer],index=data?fieldIndex(data,step):0,t=data?.time[index],url=data&&t?fieldImage(data,t):undefined,colors=layer==='temperature'?TEMP_COLORS:WIND_COLORS;
 let image=url?`<image href="${url}" width="1100" height="560"/>`:'';
 if(data?.mode==='demo'){for(let x=0;x<1100;x+=40)for(let y=0;y<560;y+=40){const n=layer==='temperature'?3+Math.round(2*Math.sin(x/250)+Math.cos(y/140+step/5)):Math.max(0,Math.round(3+3*Math.sin(x/230+y/170+step/5)));image+=`<rect x="${x}" y="${y}" width="40" height="40" fill="${colors[Math.min(colors.length-1,Math.max(0,n))]}"/>`;}}
 const stale=!!data&&(now()-data.fetchedAt>3600||data.time.at(-1)!<now());
 const detail=`${layer==='temperature'?'2 Meter über Boden · stündlich':'10 Meter über Boden · alle 6 Stunden'} · DWD ${c.model}${data?` · Lauf ${dateTime(data.runAt)}`:''}`;
 const header=mapHeader(source(data?.mode,'DWD · Lauf',data?.runAt,stale,error),data?.mode==='demo'?'Beispielzeit':'Prognose',t,detail,stale);
 const legend=verticalLegend(layer==='temperature'?'°C':'%',colors,layer==='temperature'?[['−7,5',1/11*100],['2,5',3/11*100],['12,5',5/11*100],['22,5',7/11*100],['37,5',10/11*100]]:[['0',0],['25',25],['50',50],['75',75],['100',100]],`<small>${layer==='temperature'?'2 Meter<br>Höhe<br>stündlich':'10 Meter<br>Höhe<br>6 Stunden'}</small>`,layer==='wind'?'Wind &gt;<br>36 km/h':'',layer==='wind'?`linear-gradient(to top, transparent 0%, ${colors.map((color,i)=>`${color} ${(i+1)*10}%`).join(',')})`:'');
 const map=fieldMap(`${c.name}, ${t?dateTime(t):'keine Daten'}`,image,mapLabels(project,place,false))+(!image?`<div class="field-empty" role="status"><strong>${busy?'Karte wird geladen …':'Keine Karte verfügbar'}</strong><span>${esc(error??'Noch kein gespeichertes Kartenbild.')}</span></div>`:'');
 const notice=`<span class="field-source sr-only">${detail}</span>${error&&image?`<span class="field-error">Gespeicherte Karte · ${esc(error)}</span>`:''}`;
 return mapLayout(c.name+' Berlin und Brandenburg',header,map,legend,fieldTimeline(data?.time??[],index,playing,waiting),notice);
}
export const AQ_COLORS=['#4c9fa1','#87b57a','#deba4b','#dc8052','#ad4161','#744c8c'];
export function airColor(value:number|null|undefined){return value==null||!Number.isFinite(value)?null:AQ_COLORS[value<=20?0:value<=40?1:value<=60?2:value<=80?3:value<=100?4:5];}
export function airView(data:Air|undefined,place:PlaceId,busy:boolean,error?:string,step=0,playing=false){
 const first=data?.time.findIndex(t=>t>=Math.floor(now()/3600)*3600)??0,i=Math.min((data?.time.length??1)-1,(first<0?(data?.time.length??1)-1:first)+step),time=data?.time[i],stale=!!data&&(now()-data.fetchedAt>86400||first<0),selected=data?.places.find(p=>p.id===place);
 const detail=`CAMS Europa · Open-Meteo · 0,1° (~11 km) · stündliche Ortswerte${data?` · Abruf ${dateTime(data.fetchedAt)}`:''}`;
 const header=mapHeader(source(data?.mode,'CAMS · Abruf',data?.fetchedAt,stale,error),data?.mode==='demo'?'Beispielzeit':'Prognose',time,detail,stale);
 const labels=PLACES.map(p=>{const [x,y]=project(p.lon,p.lat),dx=p.id==='elstal'?-17:p.id==='potsdam'?-16:18,dy=p.id==='potsdam'?25:-18,v=data?.places.find(row=>row.id===p.id)?.aqi[i],color=airColor(v);
  return `<g class="geo-city geo-location air-point" data-place="${p.id}" aria-label="${esc(p.name)}: ${v==null?'Keine Daten':`${fmt(v,0)} EAQI`}"><circle cx="${x}" cy="${y}" r="${place===p.id?6:4}" style="fill:${color??'var(--muted)'}"/><text x="${x+dx}" y="${y+dy}" text-anchor="${p.id==='berlin'?'start':'end'}">${p.id==='elstal'?'Elstal':esc(p.name)}<tspan class="air-point-value" x="${x+dx}" dy="1.15em">${fmt(v,0)}</tspan></text></g>`;
 }).join('');
 const legend=verticalLegend('EAQI',AQ_COLORS,[['0',0],['40',2/6*100],['80',4/6*100],['100+',5/6*100]],`<small>PM₂,₅<br><b>${fmt(selected?.pm25[i])}</b><br>µg/m³</small>`,'Ortswerte');
 const map=fieldMap('Luftqualität: EAQI an drei Orten; keine Flächendaten', '',labels)+(!data?`<div class="field-empty" role="status"><strong>${busy?'Luftqualität wird geladen …':'Keine Luftqualitätsdaten'}</strong><span>${esc(error??'Keine gespeicherten Ortswerte.')}</span></div>`:'');
 return mapLayout('Luftqualität Berlin und Brandenburg',header,map,legend,fieldTimeline(data?.time??[],i,playing,false,true),`<span class="field-source sr-only">${detail} · EAQI: höher = stärker belastet. PM₂,₅ für den ausgewählten Ort.</span>${error&&data?`<p class="field-error">Gespeichert · ${esc(error)}</p>`:''}`);
}
export function fieldTimeline(time:number[],index:number,playing=false,waiting=false,hourlyPoints=false){
 const at=hourlyPoints?Math.floor(now()/3600)*3600:now(),start=time.findIndex(t=>t>=at),first=start<0?time.length-1:start;
 return mapTimeline('field',time,index,first,playing,waiting,index===first);
}
