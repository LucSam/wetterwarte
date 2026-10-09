import { moonAt } from '../data/astronomy';
import { clockTime, dateTime, dayLabel, fmt } from '../calc';
import lunarSurface from '../assets/moon-full.jpg';

let illuminationCache:{key:string;url:string}|undefined;

// Orthographic sphere, with the Sun direction derived from illuminated area.
// A Lommel–Seeliger approximation retains surface detail near the lunar limb;
// this is a visual treatment, not a model of crater relief or libration.
function illuminationMask(fraction:number,waxing:boolean) {
 const key=`${fraction.toFixed(5)}:${waxing}`;
 if(illuminationCache?.key===key)return illuminationCache.url;
 const size=192,canvas=document.createElement('canvas');
 canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d')!;
 const pixels=ctx.createImageData(size,size);
 const sunZ=2*fraction-1,sunX=(waxing?1:-1)*Math.sqrt(Math.max(0,1-sunZ*sunZ));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const nx=(x+.5)/size*2-1,ny=(y+.5)/size*2-1,z2=1-nx*nx-ny*ny;
  if(z2<=0)continue;
  const nz=Math.sqrt(z2),light=Math.max(0,nx*sunX+nz*sunZ);
  const brightness=light>0?Math.min(1,Math.pow(2*light/(light+nz),.65)):0;
  const i=(y*size+x)*4;
  pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;
  pixels.data[i+3]=Math.round(brightness*255);
 }
 ctx.putImageData(pixels,0,0);
 const url=canvas.toDataURL();
 illuminationCache={key,url};
 return url;
}

// Fixed orientation: waxing lit on the right, waning on the left.
// The NASA full-disc image has a 438 px radius within a 1024 px square.
export function moonDisc(fraction:number,waxing:boolean,id='moon') {
 const mask=illuminationMask(Math.max(0,Math.min(1,fraction)),waxing);
 return `<svg class="moon-disc" viewBox="0 0 100 100" aria-hidden="true">
 <defs>
  <clipPath id="${id}-disc"><circle cx="50" cy="50" r="46"/></clipPath>
  <mask id="${id}-light" maskUnits="userSpaceOnUse" x="4" y="4" width="92" height="92"><image href="${mask}" x="4" y="4" width="92" height="92"/></mask>
  <image id="${id}-surface" class="moon-surface" href="${lunarSurface}" x="-3.77" y="-3.77" width="107.54" height="107.54"/>
 </defs>
 <g clip-path="url(#${id}-disc)">
  <circle cx="50" cy="50" r="46" fill="#080a0c"/>
  <use href="#${id}-surface" opacity=".16"/>
  <use href="#${id}-surface" mask="url(#${id}-light)"/>
 </g></svg>`;
}
export function moonView(time:number) {
 const m=moonAt(time);
 return `<section class="moon-observation" aria-label="Mondphase: ${m.label}, ${fmt(m.illuminated*100,0)} Prozent beleuchtet">${moonDisc(m.illuminated,m.waxing)}<div><span class="eyebrow">MONDPHASE</span><strong>${m.label}</strong><span>${fmt(m.illuminated*100,0)} % beleuchtet</span><small>${clockTime(time)} · astronomisch berechnet</small></div></section>`;
}

export function moonPage(time:number,day=0){
 const selected=time+day*86400,m=moonAt(selected),start=Math.floor(day/7)*7;
 return `<section class="moon-page" aria-label="Mondphase und kommende Tage"><div class="moon-main">${moonDisc(m.illuminated,m.waxing,'moon-large')}<div class="moon-description"><span class="eyebrow">MOND · ${day===0?'JETZT':dateTime(selected)}</span><h1>${m.label}</h1><strong>${fmt(m.illuminated*100,0)}<small> % beleuchtet</small></strong><p>${dateTime(selected)} · Europe/Berlin</p><small><span class="regular-label">Astronomisch berechnet · SunCalc<br>Oberfläche: NASA / LRO</span><span class="small-display-label">Berechnet · NASA / LRO</span></small></div></div><div class="moon-day-row" role="group" aria-label="Mondphase je Tag">${Array.from({length:7},(_,i)=>{const offset=start+i,t=time+offset*86400,p=moonAt(t);return `<button data-moon-day="${offset}" aria-pressed="${offset===day}"><span class="regular-label">${offset===0?'Heute':dayLabel(t)}</span><span class="small-display-label" title="${dayLabel(t)}">${offset===0?'Heute':new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'short'}).format(new Date(t*1000))}</span>${moonDisc(p.illuminated,p.waxing,`moon-day-${i}`)}<small>${fmt(p.illuminated*100,0)} %</small></button>`;}).join('')}</div><div class="moon-pages"><button data-moon-day="${Math.max(0,start-7)}" ${start===0?'disabled':''} aria-label="Vorherige Mondwoche">←</button><button data-moon-day="0">Heute</button><button data-moon-day="${start+7}" aria-label="Nächste Mondwoche">→</button></div></section>`;
}
