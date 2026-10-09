import { clockTime, fmt, valid } from '../calc';
import type { Num } from '../types';
export const escapeHtml = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
interface Series { values: Num[]; color: string; low?: Num[]; high?: Num[]; name: string; dashed?: boolean }
export function lineChart(time: number[], series: Series[], options: { height?: number; selected?: number; unit?: string; intervalSeconds?:number; markers?:boolean; label: string } ) {
  const w=600, h=options.height??205, left=52, right=15, top=20, bottom=34;
  const values=series.flatMap(s=>[...s.values,...(s.low??[]),...(s.high??[])]).filter(valid);
  if (!values.length || !time.length) return '<div class="chart-empty">Keine gültigen Werte für diesen Zeitraum.</div>';
  const min=Math.floor(Math.min(...values)-1), max=Math.ceil(Math.max(...values)+1);
  const x=(i:number)=>left+(time[i]-time[0])/Math.max(1,time[time.length-1]-time[0])*(w-left-right), y=(n:number)=>top+(max-n)/(max-min)*(h-top-bottom);
  const segments=(data:Num[])=>{ const result: number[][]=[]; let run:number[]=[]; data.forEach((v,i)=>{ if(valid(v)){if(run.length&&time[i]-time[i-1]>(options.intervalSeconds??3600)){result.push(run);run=[];}run.push(i);} else if(run.length){result.push(run);run=[];} }); if(run.length)result.push(run); return result; };
  const grid=Array.from({length:4},(_,i)=>{const v=min+(max-min)*i/3;return `<line x1="${left}" y1="${y(v)}" x2="${w-right}" y2="${y(v)}" class="gridline"/><text x="${left-10}" y="${y(v)+4}" text-anchor="end">${fmt(v,0)}°</text>`;}).join('');
  const ticks=[...new Set([0,Math.floor((time.length-1)/3),Math.floor((time.length-1)*2/3),time.length-1])].map(i=>`<text x="${x(i)}" y="${h-7}" text-anchor="${i===0?'start':i===time.length-1?'end':'middle'}">${clockTime(time[i])}</text>`).join('');
  const lines=series.map(s=>{
    const band=s.low&&s.high?segments(s.low.map((v,i)=>valid(v)&&valid(s.high![i])?v:null)).map(ids=>`<path d="M ${ids.map(i=>`${x(i)},${y(s.high![i]!)}`).join(' L ')} L ${[...ids].reverse().map(i=>`${x(i)},${y(s.low![i]!)}`).join(' L ')} Z" fill="${s.color}" opacity=".12"/>`).join(''):'';
    return band+segments(s.values).map(ids=>`<path d="M ${ids.map(i=>`${x(i)},${y(s.values[i]!)}`).join(' L ')}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" ${s.dashed?'stroke-dasharray="10 6"':''}/>`).join('')+(options.markers?s.values.map((v,i)=>valid(v)?`<circle class="data-point" cx="${x(i)}" cy="${y(v)}" r="3.5" fill="${s.color}"><title>${escapeHtml(s.name)} ${clockTime(time[i])}: ${fmt(v)} °C</title></circle>`:'').join(''):'');
  }).join('');
  const cursor=options.selected!==undefined&&options.selected>=0?`<line x1="${x(options.selected)}" x2="${x(options.selected)}" y1="${top}" y2="${h-bottom}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 5"/>`:'';
  return `<svg class="line-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeHtml(options.label)}"><title>${escapeHtml(options.label)}</title>${grid}${ticks}${lines}${cursor}</svg>`;
}
export function rainChart(time:number[],values:Num[]) {
  if(!values.some(valid))return '<div class="chart-empty">Niederschlag nicht verfügbar</div>';
  const w=600,h=60,left=42,right=15,max=Math.max(1,...values.filter(valid)),bw=(w-left-right)/Math.max(1,values.length);
  return `<svg class="rain-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Stündliche Niederschlagsmenge in Millimetern; jeweils vorangehende Stunde"><text x="32" y="14" text-anchor="end">${fmt(max,1)}</text><text x="32" y="53" text-anchor="end">0</text><line class="gridline" x1="${left}" x2="585" y1="53" y2="53"/>${values.map((v,i)=>valid(v)?`<rect x="${left+i*bw+1}" y="${53-v/max*42}" width="${Math.max(1,bw-2)}" height="${v/max*42}" fill="var(--blue)"><title>${clockTime(time[i])}: ${fmt(v)} mm</title></rect>`:`<text x="${left+i*bw}" y="50">×</text>`).join('')}</svg>`;
}
