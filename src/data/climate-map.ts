import type { ClimateField, Mode } from '../types';
let real:ClimateField|undefined,demo:ClimateField|undefined;
export async function loadClimateMap(mode:Mode):Promise<ClimateField>{
 if(!real){const packed=(await import('./climate-field.json')).default;real={...packed,cells:packed.cells.map(c=>({polygon:[[c[0],c[1]],[c[2],c[3]],[c[4],c[5]],[c[6],c[7]]],baseline:c[8],recent:c[9]}))} as unknown as ClimateField;}
 if(mode==='live')return real;
 if(!demo)demo={...real,mode:'demo',source:'Synthetische Klima-Flächendaten · keine Messwerte',cells:real.cells.map(c=>{const [lon,lat]=c.polygon[0],base=8.6+Math.sin(lon*2)*.6-(lat-52)*.4,delta=1.4+.6*Math.sin(lon*1.2+lat*.7);return {...c,baseline:base,recent:base+delta};})};
 return demo;
}
