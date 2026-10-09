import { condition } from '../calc';
export function weatherIcon(code:number|null|undefined){
 const sun='<circle cx="19" cy="18" r="8" fill="#efb43f"/><path d="M19 4v3m0 22v3M5 18h3m22 0h3M9 8l3 3m14 14 3 3M9 28l3-3M26 11l3-3" stroke="#d99b1e" stroke-width="2"/>';
 const cloud='<path d="M12 33c-10 0-10-14-1-15 1-12 20-13 23-2 11-1 14 17 2 17Z" fill="#819db4"/>';
 let body=code==null?'<path d="M16 24h16" stroke="#8b9caa" stroke-width="3"/>':code===0?sun:code<=2?sun+cloud:cloud;
 if(code!=null&&code>=51&&code<80)body+='<path d="M15 37l-3 6m14-6-3 6m14-6-3 6" stroke="#167dd1" stroke-width="3" stroke-linecap="round"/>';
 if(code!=null&&((code>=71&&code<=77)||code===85||code===86))body=cloud+'<g fill="#177ac1"><circle cx="14" cy="40" r="2"/><circle cx="25" cy="43" r="2"/><circle cx="36" cy="39" r="2"/></g>';
 if(code!=null&&code>=80&&code<=82)body+='<path d="M15 37l-3 6m14-6-3 6m14-6-3 6" stroke="#167dd1" stroke-width="3" stroke-linecap="round"/>';
 if(code!=null&&code>=95)body+='<path d="m25 29-8 12h7l-2 7 12-14h-8l4-5" fill="#c98a16"/>';
 if(code===45||code===48)body='<path d="M7 15h32M11 23h29M5 31h31" stroke="#819db4" stroke-width="3" stroke-linecap="round"/>';
 return `<svg class="weather-icon" viewBox="0 0 48 48" role="img" aria-label="${condition(code??null)}"><title>${condition(code??null)}</title>${body}</svg>`;
}
