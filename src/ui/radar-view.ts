import { dateTime, clockTime, fmt } from '../calc';
import { demoRain, RADAR_EXTENT, RADAR_HEIGHT, RADAR_WIDTH, radarFrameUrl, radarMaskUrl, radarNowIndex, radarExpired, RAIN_CLASSES } from '../data/radar';
import { now } from '../data/api';
import type { PlaceId, Radar } from '../types';
import { escapeHtml as esc } from './charts';
import { mapBoundaries, mapLabels, projector } from './geography';
import {mapHeader,mapLayout,mapTimeline,verticalLegend} from './map-layout';
export function radarMap(data:Radar,frame:number,place:PlaceId,compact=false,regional=false) {
 const project=projector(RADAR_EXTENT,RADAR_WIDTH,RADAR_HEIGHT),time=data.time[frame],url=radarFrameUrl(time,data.runAt!);let field='',missing='';
 if(data.mode==='demo'){
  for(let y=0;y<RADAR_HEIGHT;y+=8)for(let x=0;x<RADAR_WIDTH;x+=8){const rain=demoRain(x-100,y,frame),color=[...RAIN_CLASSES].reverse().find(c=>rain>=c.min)?.color;if(color)field+=`<rect x="${x}" y="${y}" width="8" height="8" fill="${color}"/>`;}
 }else if(url){
  field=`<image class="radar-rain" href="${url}" width="${RADAR_WIDTH}" height="${RADAR_HEIGHT}"/>`;
  const mask=radarMaskUrl(time,data.runAt!),id=compact?'radar-card':'radar-full';
  if(mask)missing=`<defs><pattern id="${id}-hatch" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M-3,3L3,-3M0,12L12,0M9,15L15,9" stroke="var(--map-line)" stroke-width="1" opacity=".55"/></pattern><mask id="${id}-missing" maskUnits="userSpaceOnUse" x="0" y="0" width="${RADAR_WIDTH}" height="${RADAR_HEIGHT}"><image href="${mask}" width="${RADAR_WIDTH}" height="${RADAR_HEIGHT}"/></mask></defs><rect width="${RADAR_WIDTH}" height="${RADAR_HEIGHT}" fill="url(#${id}-hatch)" mask="url(#${id}-missing)"/>`;
 }
 return `<svg class="radar-map ${compact?'compact-map':''} ${regional?'regional-map':''}" viewBox="${regional?'325 85 392 400':compact?'360 100 385 350':`0 0 ${RADAR_WIDTH} ${RADAR_HEIGHT}`}" role="img" aria-label="${data.mode==='demo'?'Synthetisches Regenfeld':'DWD-Radarprognose'}, ${dateTime(time)}"><g class="geo-base">${mapBoundaries(project)}</g><g class="radar-field">${field}</g>${missing}<g class="geo-outlines">${mapBoundaries(project)}</g>${mapLabels(project,place,!compact)}${!compact&&!regional?'<text x="1010" y="36" class="map-direction">N ↑</text><text x="360" y="48" class="map-sea">OSTSEE</text>':''}</svg>`;
}
function rainScale(){return `<div class="rain-scale">${RAIN_CLASSES.map(c=>`<span style="background:${c.color}" title="ab ${fmt(c.min)} mm/h"></span>`).join('')}</div><div class="scale-labels">${[0,3,6,10,14].map(i=>`<span style="left:${i/15*100}%">${i===14?'150+':fmt(RAIN_CLASSES[i].min,RAIN_CLASSES[i].min<1?1:0)}</span>`).join('')}</div>`;}
export function radarView(data:Radar,frame:number,place:PlaceId,playing:boolean,loading:boolean,error?:string,following=true){
 const first=radarNowIndex(data);frame=Math.min(Math.max(first,frame),data.time.length-1);
 const time=data.time[frame],expired=radarExpired(data),unavailable=data.mode==='live'&&!radarFrameUrl(time,data.runAt!);
 const label=expired?'Abgelaufen':data.mode==='demo'?'Beispielzeit':time===data.runAt?'Messung':'Prognose';
 const legend=verticalLegend('mm/h',RAIN_CLASSES.map(c=>c.color),[0,3,6,10,14].map(i=>[i===14?'150+':fmt(RAIN_CLASSES[i].min,RAIN_CLASSES[i].min<1?1:0),i/15*100]),'<small class="rain-clear">Farblos<br>&lt; 0,1</small><small class="rain-missing"><i class="map-nodata-key"></i>Keine<br>Daten</small>');
 const unavailableMessage=expired?'Keine aktuelle Radarprognose':loading?'Radarbild wird geladen …':'Dieses Radarbild fehlt';
 const reason=expired?'Der gespeicherte Zeitraum ist beendet. Neue Daten werden automatisch angefragt.':error??'Keine Aussage zum Niederschlag möglich.';
 const old=now()-data.runAt!>1200,source=data.mode==='demo'?'DEMO':`DWD${!navigator.onLine?' · offline':error?' · gespeichert':''} · ${old?'veraltet · ':''}Basis ${clockTime(data.runAt!)}`;
 const header=mapHeader(source,label,time,`${dateTime(data.runAt!)} · ${Math.max(0,Math.floor((now()-data.runAt!)/60))} Minuten alt`,old);
 const map=radarMap(data,frame,place,false,true)+(unavailable?`<div class="radar-unavailable" role="status"><strong>${unavailableMessage}</strong><p>${esc(reason)}</p></div>`:'');
 const notice=!unavailable&&(error||expired)?`<p class="radar-notice" role="status">${esc(expired?'Gespeichertes Bild · Prognose abgelaufen.':error!)}</p>`:'';
 const timeline=expired?`<div class="radar-bottom radar-expired"><span>Keine Vorschau ab jetzt verfügbar</span><button data-action="radar-now">Neu laden</button></div>`:mapTimeline('radar',data.time,frame,first,playing,false,following);
 return mapLayout('Regenradar Berlin und Brandenburg',header,map,unavailable?'':legend,timeline,notice);

}
export function radarCard(data:Radar|undefined,place:PlaceId,loading:boolean,error?:string,compact=true){
 const index=data?radarNowIndex(data):0,time=data?.time[index],expired=data&&radarExpired(data),available=data&&(data.mode==='demo'||(time!==undefined&&radarFrameUrl(time,data.runAt!)));
 return `<section class="map-panel"><div class="section-head"><h2>Regenradar</h2><span>${data?.mode==='demo'?'DEMO':'DWD-Radar'} · mm/h</span></div><button class="radar-card-map" data-view="radar" aria-label="Regenradar mit Prognose öffnen">${data?radarMap(data,index,place,compact):'<span class="radar-placeholder"></span>'}${!available?`<span class="radar-unavailable"><strong>${expired?'Radarprognose abgelaufen':loading?'Radar wird geladen …':'Kein Radarbild verfügbar'}</strong><span>${esc(expired?'Neue Daten werden automatisch angefragt.':error??'Keine Niederschlagsaussage möglich.')}</span></span>`:''}</button><div class="radar-card-meta"><span>${time?`${dateTime(time)} · ${expired?'abgelaufen':data?.mode==='demo'?'Beispiel':time===data?.runAt?'beobachtet':'Prognose'}${now()-(data?.runAt??0)>1200?' · veraltet':''}`:'Noch kein Datenstand'}</span><span>Prognose öffnen ↗</span></div>${rainScale()}<progress class="radar-preload" aria-label="Radarbilder vorladen" max="1" value="0" hidden></progress><p class="map-note">mm/h · leicht → extrem. Schraffur = keine Radardaten.${error&&available?' Gespeichertes Radarbild.':''}</p></section>`;
}
