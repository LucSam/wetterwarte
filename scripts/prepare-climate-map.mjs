// Reproducible offline preprocessing. Supply the two original DWD .asc.gz files.
// node scripts/prepare-climate-map.mjs /tmp/wetterwarte-6190.asc.gz /tmp/wetterwarte-9120.asc.gz
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import proj4 from 'proj4';
const inputs=await Promise.all(process.argv.slice(2,4).map(p=>readFile(p)));
if(inputs.length!==2)throw Error('Supply DWD annual grids 1961–1990 and 1991–2020.');
function parse(buffer){const lines=gunzipSync(buffer).toString().trim().split(/\r?\n/),h={};for(const l of lines.splice(0,6)){const [k,v]=l.trim().split(/\s+/);h[k.toLowerCase()]=Number(v);}const values=lines.join(' ').trim().split(/\s+/).map(Number);if(values.length!==h.ncols*h.nrows)throw Error('Incomplete raster');return {h,values};}
const [a,b]=inputs.map(parse);if(JSON.stringify(a.h)!==JSON.stringify(b.h))throw Error('Raster geometries differ');
const gk='+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs';
const {ncols,nrows,xllcorner,yllcorner,cellsize,nodata_value}=a.h;
const cells=[];const size=5;
for(let row=0;row+size<=nrows;row+=size)for(let col=0;col+size<=ncols;col+=size){
 const x=xllcorner+col*cellsize,y=yllcorner+(nrows-row-size)*cellsize;
 const center=proj4(gk,'EPSG:4326',[x+2500,y+2500]);if(center[0]<10||center[0]>15.8||center[1]<50.6||center[1]>54.2)continue;
 const values=[];for(let dy=0;dy<size;dy++)for(let dx=0;dx<size;dx++){const i=(row+dy)*ncols+col+dx;if(a.values[i]!==nodata_value&&b.values[i]!==nodata_value)values.push([a.values[i],b.values[i]]);}
 // Retain complete paired blocks only: do not fabricate coverage at country borders.
 if(values.length!==25)continue;
 const polygon=[[x,y],[x+5000,y],[x+5000,y+5000],[x,y+5000]].map(p=>proj4(gk,'EPSG:4326',p).map(v=>Math.round(v*100000)/100000));
 const mean=k=>Math.round(values.reduce((s,v)=>s+v[k],0)/25*10)/100;
 cells.push([...polygon.flat(),mean(0),mean(1)]);
}
const data={schema:1,kind:'climate-map',mode:'live',source:'DWD Climate Data Center · vieljährige Temperaturmittel',fetchedAt:Math.floor(Date.now()/1000),runAt:null,timezone:'Europe/Berlin',baseline:[1961,1990],recent:[1991,2020],nativeResolutionKm:1,displayResolutionKm:5,crs:'EPSG:4326',cellFormat:'lon1,lat1,lon2,lat2,lon3,lat3,lon4,lat4,baseline_C,recent_C',processing:'Complete paired 5 × 5 means of native 1-km EPSG:31467 cells, transformed to WGS84; no interpolation.',sha256:inputs.map(b=>createHash('sha256').update(b).digest('hex')),cells};
await writeFile('src/data/climate-field.json',JSON.stringify(data));console.log(cells.length,'5-km cells;',JSON.stringify(data).length,'bytes');
