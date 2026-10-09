// Diverging scales: equal magnitudes on both sides of a meaningful zero.
// Blue–white–red for signed differences; ColorBrewer YlOrRd for absolute temperatures.
export const TEMPERATURE_COLORS = ['#123eb4', '#176bd3', '#6ea8e5', '#c4def4', '#ffffff', '#fdd5b2', '#f79762', '#e44924', '#ad190f'];
export const RAIN_COLORS = ['#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f', '#01665e'];
export function divergingColor(value:number, limit:number, colors=TEMPERATURE_COLORS) {
  const position=(Math.max(-limit,Math.min(limit,value))/limit+1)/2*(colors.length-1);
  const i=Math.min(colors.length-2,Math.floor(position)), f=position-i;
  const a=colors[i].slice(1), b=colors[i+1].slice(1);
  return '#'+[0,2,4].map(n=>Math.round(parseInt(a.slice(n,n+2),16)*(1-f)+parseInt(b.slice(n,n+2),16)*f).toString(16).padStart(2,'0')).join('');
}
export function colorInk(hex:string) {
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722<.34?'#fff':'#203448';
}
export function colorScale(colors:string[], left:string, right:string, label:string,center='0') {
  return `<div class="color-scale"><div class="color-gradient" style="background:linear-gradient(90deg,${colors.join(',')})"></div><div class="color-ticks"><span>${left}</span><span>${center}</span><span>${right}</span></div><p>${label}</p></div>`;
}

export const ABSOLUTE_TEMPERATURE_COLORS=['#ffffcc','#ffeda0','#fed976','#feb24c','#fd8d3c','#fc4e2a','#e31a1c','#bd0026','#800026'];
export const absoluteTemperatureColor=(temperature:number)=>divergingColor(temperature-9,4,ABSOLUTE_TEMPERATURE_COLORS);
