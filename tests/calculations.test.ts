import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annualHistory, historyReference } from '../src/data/history';
import { aggregateClimate, berlinDate, clockTime, commonSixHourly, fmt, quantile, summarizeMembers, type DailyClimate } from '../src/calc';
test('Quantile interpolate members; null is not zero',()=>{assert.ok(Math.abs(quantile([0,10,20,30,null],.1)!-3)<1e-12);assert.equal(quantile([0,10,20,30],.5),15);assert.equal(quantile([null],.5),null);assert.equal(fmt(null),'–');});
test('Incomplete ensemble membership does not become false certainty',()=>{const s=summarizeMembers([[1,2],[3,null],[5,6]]);assert.deepEqual(s.median,[3,null]);assert.deepEqual(s.count,[3,2]);});
test('Comparison uses only shared valid native six-hour timestamps',()=>{assert.deepEqual(commonSixHourly([0,3600,21600,43200,64800],[1,1,2,null,2],[1,2,3,4,5],1),[2,4]);});
test('Berlin date and clock remain correct through summer/winter transitions',()=>{assert.equal(clockTime(Date.parse('2026-03-29T00:00:00Z')/1000),'01:00');assert.equal(clockTime(Date.parse('2026-03-29T01:00:00Z')/1000),'03:00');assert.equal(clockTime(Date.parse('2026-10-25T00:00:00Z')/1000),'02:00');assert.equal(clockTime(Date.parse('2026-10-25T01:00:00Z')/1000),'02:00');assert.equal(berlinDate(Date.parse('2026-07-01T23:00:00Z')/1000),'2026-07-02');});
function daily():DailyClimate{const time:string[]=[];for(let t=Date.UTC(1999,11,1);t<Date.UTC(2001,0,1);t+=86400000)time.push(new Date(t).toISOString().slice(0,10));return {time,temperature:time.map(()=>10),max:time.map((_,i)=>i===40?30:29.9),rain:time.map(()=>1)};}
test('Climate handles leap years, inclusive hot-day threshold and DJF preceding December',()=>{const a=aggregateClimate(daily(),2000,2000);assert.equal(a.temperature,10);assert.equal(a.hotDays,1);assert.deepEqual(a.rain,{DJF:91,MAM:92,JJA:92,SON:91});assert.equal(a.years,1);});
test('Incomplete climate data fails instead of biasing climate indicators',()=>{const d=daily();d.max[50]=null;assert.throws(()=>aggregateClimate(d,2000,2000),/Unvollständige/);const e=daily();e.time.shift();assert.throws(()=>aggregateClimate(e,2000,2000),/Fehlender/);});
test('Historical yearly values count complete leap years and the inclusive hot-day threshold',()=>{
  const d=daily();const history={time:d.time,temperature_2m_mean:d.temperature,temperature_2m_max:d.max,precipitation_sum:d.rain};
  assert.deepEqual(annualHistory(history,2000,2000),[{year:2000,temperature:10,hotDays:1,rain:366}]);
  history.precipitation_sum[100]=null;assert.throws(()=>annualHistory(history,2000,2000),/Fehlende/);
});
test('Historical anomaly reference uses only the specified complete baseline',()=>{
  const data={baseline:[1991,2020],years:Array.from({length:65},(_,i)=>({year:1961+i,temperature:i<30?0:10,hotDays:2,rain:500}))} as Parameters<typeof historyReference>[0];
  assert.equal(historyReference(data).temperature,10);data.years=data.years.filter(y=>y.year!==2000);assert.throws(()=>historyReference(data),/unvollständig/);
});

import { moonAt } from '../src/data/astronomy';
import { DWD_RAIN_CLASSES, RAIN_CLASSES, remapRadarPixels } from '../src/data/radar';
import { divergingColor } from '../src/ui/colors';
import { historyNeedsUpdate, retryDue } from '../src/data/schedule';
import { loadClimateMap } from '../src/data/climate-map';
test('Moon illumination distinguishes known new and full moons and never depends on demo values',()=>{
 const newMoon=moonAt(Date.parse('2024-04-08T18:21:00Z')/1000),fullMoon=moonAt(Date.parse('2024-03-25T07:00:00Z')/1000);
 assert.ok(newMoon.illuminated<.001);assert.ok(fullMoon.illuminated>.999);assert.equal(newMoon.label,'Neumond');assert.equal(fullMoon.label,'Vollmond');
});
test('Rain recolouring preserves every class and its alpha, including the formerly blue maximum',()=>{
 const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const input=new Uint8ClampedArray(DWD_RAIN_CLASSES.flatMap(c=>[...rgb(c.color),180]));
 assert.deepEqual([...remapRadarPixels(input)],RAIN_CLASSES.flatMap(c=>[...rgb(c.color),180]));
 assert.deepEqual(DWD_RAIN_CLASSES.map(c=>c.min),RAIN_CLASSES.map(c=>c.min));
 assert.throws(()=>remapRadarPixels(new Uint8ClampedArray([123,64,33,255])),/Farbdaten/);
});
test('Diverging colours are valid around the white centre; cold and warm remain distinct',()=>{
 assert.equal(divergingColor(0,2.5),'#ffffff');assert.notEqual(divergingColor(-1,2.5),divergingColor(1,2.5));
 for(let i=-30;i<=30;i++)assert.match(divergingColor(i/10,2.5),/^#[0-9a-f]{6}$/);
 assert.equal(divergingColor(8,2.5),divergingColor(2.5,2.5));
});
test('Automatic history refresh follows the Berlin year boundary, with bounded retry frequency',()=>{
 assert.equal(historyNeedsUpdate(2025,Date.parse('2026-12-31T22:59:00Z')),false);
 assert.equal(historyNeedsUpdate(2025,Date.parse('2026-12-31T23:01:00Z')),true);
 assert.equal(retryDue(1000,1899),false);assert.equal(retryDue(1000,1900),true);
});
test('DWD climate grids use paired 5 km means in Celsius, with independent demo values',async()=>{
 const real=await loadClimateMap('live'),demo=await loadClimateMap('demo');
 assert.equal(real.cells.length,4690);assert.deepEqual(real.baseline,[1961,1990]);assert.deepEqual(real.recent,[1991,2020]);
 const elstal=real.cells.find(c=>c.polygon[0][0]===12.98374)!;
 assert.ok(elstal);assert.equal(elstal.baseline,8.99);assert.equal(elstal.recent,10.08);
 assert.equal(demo.mode,'demo');assert.notEqual(demo.cells[0].baseline,real.cells[0].baseline);assert.equal((await loadClimateMap('live')).cells[0].baseline,real.cells[0].baseline);
});

import {daylightAt} from '../src/data/astronomy';
import {lineChart} from '../src/ui/charts';
test('Automatic day/night mode follows seasonal sunrise and sunset, including Berlin DST dates',()=>{
 const at=(s:string)=>Date.parse(s)/1000,lat=52.5425,lon=12.98795;
 const summer=daylightAt(at('2026-06-21T18:00:00Z'),lat,lon),winter=daylightAt(at('2026-12-21T19:00:00Z'),lat,lon);
 assert.equal(summer.isDay,true);assert.equal(winter.isDay,false);
 assert.ok(summer.sunset!-summer.sunrise!>16*3600);assert.ok(winter.sunset!-winter.sunrise!<8*3600);
 for(const date of ['2026-03-29','2026-10-25']){const noon=daylightAt(at(date+'T11:00:00Z'),lat,lon);assert.equal(noon.isDay,true);assert.equal(berlinDate(noon.sunrise!),date);assert.equal(daylightAt(noon.sunset!-1,lat,lon).isDay,true);assert.equal(daylightAt(noon.sunset!+1,lat,lon).isDay,false);}
});
test('Long six-hour ensembles retain continuous median and percentile paths, while real gaps remain gaps',()=>{
 const time=Array.from({length:16},(_,i)=>i*21600),values=time.map((_,i)=>i),series=[{values,low:values.map(v=>v-1),high:values.map(v=>v+1),color:'#123456',name:'ensemble'}];
 const svg=lineChart(time,series,{label:'test',intervalSeconds:21600,markers:true});
 assert.equal((svg.match(/class="data-point"/g)??[]).length,16);assert.equal((svg.match(/<path/g)??[]).length,2);assert.ok((svg.match(/ L /g)??[]).length>30);
 const missing=lineChart([0,21600,64800],[{values:[1,2,4],color:'#123456',name:'gap'}],{label:'test',intervalSeconds:21600});assert.equal((missing.match(/<path/g)??[]).length,2);
});

test('DWD contour is masked, never interpreted as heavy rain; unknown colours still fail',()=>{
 const contour=new Uint8ClampedArray([251,0,255,139,165,85,167,99,252,0,255,223]);
 const result=remapRadarPixels(contour);
 for(let i=0;i<result.length;i+=4){assert.equal(result[i],128);assert.equal(result[i+1],128);assert.equal(result[i+2],128);}
 assert.equal(result[3],139);assert.equal(result[7],99);assert.equal(result[11],223);
 assert.throws(()=>remapRadarPixels(new Uint8ClampedArray([123,64,33,255])),/Farbdaten/);
});
