import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveCutoff, blankYear, completeYear, distribution, referencePeriod, requiredYears, temperatureStats, type TemperatureOptions } from '../src/temperature-stats';
import { emptyTemperature, parseTemperature, temperatureNeedsFetch, demoTemperature } from '../src/data/temperature';

const at=new Date('2026-10-12T12:00:00Z'),options:TemperatureOptions={scale:'month',year:2024,month:2,reference:'rolling',plot:'curves'};
function fixture(){const data=emptyTemperature('elstal');data.years=Array.from({length:30},(_,i)=>{const y=blankYear(1996+i);y.mean.fill(i);y.min.fill(i-5);y.max.fill(i+7);return y;});return data;}
test('Reference moves annually, normal moves by decade, Berlin and delayed January data',()=>{
 assert.deepEqual(referencePeriod('rolling',at),[1996,2025]);assert.deepEqual(referencePeriod('normal',at),[1991,2020]);
 assert.deepEqual(referencePeriod('rolling',new Date('2029-07-01')),[1999,2028]);assert.deepEqual(referencePeriod('normal',new Date('2029-07-01')),[1991,2020]);
 assert.deepEqual(referencePeriod('rolling',new Date('2031-01-02T12:00Z')),[2000,2029]);assert.deepEqual(referencePeriod('normal',new Date('2031-01-05T12:00Z')),[2001,2030]);
 assert.equal(archiveCutoff(new Date('2026-12-31T23:15:00Z')),'2026-12-27');
 assert(requiredYears({...options,reference:'normal',scale:'long'},at).includes(2025));
});
test('Sample SD uses n−1 and has no value for a single member',()=>{
 assert.deepEqual(distribution([1,2,3]),{mean:2,sd:1,n:3});assert.deepEqual(distribution([5]),{mean:5,sd:null,n:1});assert.deepEqual(distribution([]),{mean:null,sd:null,n:0});
});
test('Same calendar days including leap day; no day-of-year shift after February',()=>{
 const data=fixture(),s=temperatureStats(data,options,at);
 assert.equal(s.points.length,29);assert.equal(s.points[0].n,30);assert.equal(s.points[28].n,8);
 assert.equal(s.points[0].reference,14.5);assert.equal(s.points[0].anomaly,13.5);assert.equal(s.summary.min,23);assert.equal(s.summary.max,35);
 assert.equal(s.summary.minDate,'2024-02-01');assert.equal(s.summary.anomaly,13.5);
 const leap=data.years.find(y=>y.year===2024)!;leap.mean[60]=100;leap.max[60]=101;
 const march=temperatureStats(data,{...options,month:3},at);assert.equal(march.points[0].mean,100);assert.equal(march.points[0].reference,(435-28+100)/30);
});
test('Monthly curves aggregate comparable month means; annual mean weights days',()=>{
 const data=fixture(),y=data.years.find(y=>y.year===2024)!;
 y.mean.fill(0);y.mean.fill(10,0,31);y.min.fill(-5);y.max.fill(12);y.min[2]=-20;y.max[10]=40;
 const s=temperatureStats(data,{...options,scale:'year'},at);
 assert.equal(s.points[0].mean,10);assert.equal(s.points[1].mean,0);assert.equal(s.points[0].min,-20);assert.equal(s.points[0].max,40);assert.equal(s.summary.mean,310/366);
 assert.equal(s.points[0].reference,(435-28+10)/30);assert.equal(s.points[1].reference,(435-28)/30);
});
test('Missing days break curves, suppress whole-period anomaly and incomplete reference bands',()=>{
 const data=fixture(),selected=data.years.find(y=>y.year===2024)!;selected.mean[31]=null;
 const month=temperatureStats(data,options,at);assert.equal(month.points[0].mean,null);assert.equal(month.summary.days,28);assert.equal(month.summary.anomaly,null);assert.equal(month.referenceReady,false);assert(month.points.every(p=>p.reference===null&&p.sd===null));
 const year=temperatureStats(data,{...options,scale:'year'},at);assert.equal(year.points[1].mean,null);assert.equal(year.points[0].mean,28);
});
test('Annual plot has genuine period extrema and equally weighted annual references',()=>{
 const data=fixture(),s=temperatureStats(data,{...options,scale:'long'},at);
 assert.equal(s.points.length,30);assert.equal(s.summary.mean,14.5);assert.equal(s.summary.anomaly,0);assert.equal(s.summary.min,-5);assert.equal(s.summary.max,36);assert(s.points.every(p=>p.reference===14.5));
});
test('Parser verifies units/time/calendar order, leaves gaps null, never changes scale',()=>{
 const response={timezone:'Europe/Berlin',daily_units:{temperature_2m_mean:'°C',temperature_2m_min:'°C',temperature_2m_max:'°C'},daily:{time:['2024-02-28','2024-02-29','2024-03-01'],temperature_2m_mean:[3.1,3.1,6.1],temperature_2m_min:[-.4,-1.5,3.8],temperature_2m_max:[5.4,9.5,10.2]}};
 const [y]=parseTemperature(response,2024,2024,1);assert.equal(y.mean.length,366);assert.equal(y.mean[58],3.1);assert.equal(y.min[59],-1.5);assert.equal(y.max[60],10.2);assert.equal(y.mean[0],null);
 assert.throws(()=>parseTemperature({...response,timezone:'UTC'},2024,2024));
 assert.throws(()=>parseTemperature({...response,daily_units:{...response.daily_units,temperature_2m_mean:'°F'}},2024,2024));
 assert.throws(()=>parseTemperature({...response,daily:{...response.daily,time:['2024-02-30','2024-02-29','2024-03-01']}},2024,2024));
 assert.throws(()=>parseTemperature({...response,daily:{...response.daily,temperature_2m_min:[20,-1.5,3.8]}},2024,2024));
});
test('Complete historical cache durable; current and incomplete years refresh daily',()=>{
 const data=fixture();assert(completeYear(data.years[0]));assert.equal(temperatureNeedsFetch(data.years[0],at),false);
 const y=blankYear(2026);y.fetchedAt=at.getTime()/1000;assert.equal(temperatureNeedsFetch(y,at),false);assert.equal(temperatureNeedsFetch(y,new Date(+at+86400000)),true);
});
test('Demo uses the same daily source for all scales, never fills the ERA5 lag',()=>{
 const o={...options,year:2026,month:10},data=demoTemperature('elstal',o,at),daily=temperatureStats(data,o,at),monthly=temperatureStats(data,{...o,scale:'year'},at);
 assert.equal(data.mode,'demo');assert.equal(daily.through,'2026-10-07');assert.equal(daily.summary.days,7);assert.equal(daily.points[7].mean,null);assert.equal(monthly.points[9].mean,null);assert.equal(daily.summary.anomaly,null);
});
