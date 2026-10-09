import {clockTime,dateTime} from '../calc';
import {now} from '../data/api';
import {escapeHtml as esc} from './charts';

// All map products share geometry, legend direction, time labels and controls.
export function mapLayout(label:string,header:string,map:string,legend:string,timeline:string,notice=''){
 return `<section class="regional-radar" aria-label="${esc(label)}">${header}<div class="radar-layout field-layout"><div class="radar-surface field-surface">${map}</div>${legend}</div>${notice}${timeline}</section>`;
}
export function mapHeader(source:string,label:string,time?:number,detail='',stale=false){
 const day=time===undefined?'':dateTime(time).split(',')[0],today=dateTime(now()).split(',')[0];
 return `<div class="radar-title"><span class="radar-source ${stale?'is-stale':''}" title="${esc(detail)}">${esc(source)}</span><div class="radar-time"><span class="radar-time-label">${esc(label)}</span>${day&&day!==today?`<span class="map-valid-date">${day}</span>`:''}<strong>${time===undefined?'–':clockTime(time)}</strong></div></div>`;
}
export function verticalLegend(unit:string,colors:string[],ticks:[string,number][],note='',context='',gradient=''){
 return `<aside class="radar-side field-legend" aria-label="Farbskala ${esc(unit)}"><h2>${esc(unit)}</h2><small class="map-key-context">${context}</small><div class="rain-key"><div class="rain-key-colors"${gradient?` style="background:${gradient}"`:''}>${gradient?'':colors.map(color=>`<i style="background:${color}"></i>`).join('')}</div><div class="rain-key-values">${ticks.map(([label,pos])=>`<span style="bottom:${pos}%">${esc(label)}</span>`).join('')}</div></div><div class="map-key-notes">${note}</div></aside>`;
}
export function mapTimeline(kind:'radar'|'field',time:number[],index:number,first:number,playing=false,waiting=false,following=false){
 const relative=kind==='field',max=Math.max(0,time.length-1),valid=first>=0&&first<time.length,min=Math.max(0,first),disabled=!valid||max<=min;
 const stamp=(t?:number)=>t===undefined?'–':dateTime(t).split(',')[0]===dateTime(now()).split(',')[0]?clockTime(t):dateTime(t).replace(',','');
 return `<progress class="radar-preload ${relative?'field-preload':''}" aria-label="Kartenbilder vorladen" max="1" value="0" hidden></progress><div class="radar-bottom ${relative?'field-bottom':''}"><div class="radar-play-control"><button data-action="play-${kind}" class="play-button" aria-label="Kartenvorschau abspielen oder pausieren" ${disabled?'disabled':''}>${playing?'Pause':waiting?'Warten …':'▶ Vorschau'}</button><small id="${kind}-buffer" class="sr-only" role="status"></small></div><div class="radar-timeline"><input id="${kind}-time" type="range" min="${relative?0:min}" max="${relative?Math.max(0,max-min):max}" value="${Math.max(0,index-(relative?min:0))}" aria-label="Prognosezeitpunkt" aria-valuetext="${time[index]?dateTime(time[index]):'Keine Daten'}" ${disabled?'disabled':''}><div class="radar-axis"><span>Jetzt</span><span>${stamp(time[min+Math.floor((max-min)/2)])}</span><span>${stamp(time[max])}</span></div></div><button data-action="${kind}-now" class="now-button" aria-pressed="${following&&!playing}">Jetzt</button></div>`;
}
export function fitRegionalMaps(){
 document.querySelectorAll<SVGSVGElement>('.regional-map').forEach(svg=>{
  const width=svg.clientWidth,height=svg.clientHeight;if(!width||!height)return;
  const ratio=width/height,w=Math.max(392,400*ratio),h=Math.max(400,392/ratio);
  svg.setAttribute('viewBox',`${521-w/2} ${285-h/2} ${w} ${h}`);
  const labelSize=svg.closest('.size-480x320')?16:width>=1000?18:15,scale=height/h;
  svg.style.setProperty('--radar-label-size',`${labelSize/scale}px`);
  svg.style.setProperty('--radar-label-halo',`${2/scale}px`);
 });
}
