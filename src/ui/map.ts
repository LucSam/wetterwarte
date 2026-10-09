import region from '../data/region.json';
import { PLACES } from '../config';
import { fmt } from '../calc';
import type { PlaceId, Weather } from '../types';
export function regionMap(data:Weather, index:number, selected:PlaceId, current:boolean) {
  // Equirectangular projection with longitude scaled by cos(52.5°), actual simplified boundaries.
  const project=(p:number[])=>[30+(p[0]-11.25)*69, 295-(p[1]-51.3)*112];
  const polygons=region.features.map(f=>`<path class="state ${f.properties.name==='Berlin'?'berlin':''}" d="${f.geometry.coordinates.map(ring=>'M '+ring.map(p=>project(p).join(',')).join(' L ')+' Z').join(' ')}"/>`).join('');
  const labels:Record<PlaceId,{x:number;y:number;align:string}>= {elstal:{x:46,y:135,align:'start'},potsdam:{x:48,y:211,align:'start'},berlin:{x:230,y:174,align:'start'}};
  return `<svg class="region-map" viewBox="0 0 340 330" role="img" aria-label="Ortskarte Berlin und Brandenburg mit Temperaturwerten; keine Wetterflächen"><defs><pattern id="map-grid" width="34" height="33" patternUnits="userSpaceOnUse"><path d="M 34 0 L 0 0 0 33" fill="none" stroke="#29353a" stroke-width=".5"/></pattern></defs><rect width="340" height="330" fill="url(#map-grid)"/>${polygons}<text x="124" y="60" class="region-name">BRANDENBURG</text><text x="317" y="28" class="north">N</text><path d="M322 50v-15m-4 5 4-5 4 5" stroke="#74848b" fill="none"/>${PLACES.map(p=>{const [x,y]=project([p.lon,p.lat]), l=labels[p.id], v=data.places.find(w=>w.id===p.id);return `<g class="map-location ${p.id===selected?'selected':''}"><path d="M${x},${y} L${l.x+8},${l.y+8}" class="leader"/><circle cx="${x}" cy="${y}" r="${p.id===selected?5:3}"/><rect x="${l.x-5}" y="${l.y-13}" width="106" height="48" rx="3"/><text x="${l.x}" y="${l.y}">${p.id==='elstal'?'Elstal':p.name}</text><text x="${l.x}" y="${l.y+23}" class="map-value">${fmt(current?v?.current.temperature:v?.temperature[index])}°</text></g>`;}).join('')}<path d="M27 309h62m-62-4v8m62-8v8" stroke="#7f8e95"/><text x="58" y="299" text-anchor="middle">~60 km</text></svg>`;
}
