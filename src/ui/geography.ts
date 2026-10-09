import context from '../data/map-context.json';
import { PLACES } from '../config';
import { mercator } from '../data/radar';
export function projector(extent:number[],width:number,height:number){return(lon:number,lat:number)=>{const [x,y]=mercator(lon,lat);return [(x-extent[0])/(extent[2]-extent[0])*width,(extent[3]-y)/(extent[3]-extent[1])*height];};}
export function mapBoundaries(project:ReturnType<typeof projector>) {
 return context.map(f=>`<path d="${f.rings.map(r=>'M '+r.map(([x,y])=>project(x,y).map(v=>v.toFixed(1)).join(',')).join(' L ')+' Z').join(' ')}" class="geo-state ${f.name==='Berlin'||f.name==='Brandenburg'?'geo-focus':''}" fill-rule="evenodd"/>`).join('');
}
export function mapLabels(project:ReturnType<typeof projector>,selected:string,full=true){
 const cities=full?[['Hamburg',9.99,53.55],['Rostock',12.14,54.09],['Magdeburg',11.63,52.12],['Leipzig',12.37,51.34],['Dresden',13.74,51.05],['Szczecin',14.55,53.43],['Cottbus',14.33,51.76]] as const:[];
 return cities.map(([name,lon,lat])=>{const [x,y]=project(lon,lat);return `<g class="geo-city"><circle cx="${x}" cy="${y}" r="2.5"/><text x="${x+8}" y="${y+5}">${name}</text></g>`;}).join('')+PLACES.map(p=>{const [x,y]=project(p.lon,p.lat),dx=p.id==='elstal'?-17:p.id==='potsdam'?-16:18,dy=p.id==='potsdam'?25:-18;return `<g class="geo-city geo-location" data-place="${p.id}"><circle cx="${x}" cy="${y}" r="${selected===p.id?5:3}"/><text x="${x+dx}" y="${y+dy}" text-anchor="${p.id==='berlin'?'start':'end'}">${p.id==='elstal'?'Elstal':p.name}</text></g>`;}).join('');
}
