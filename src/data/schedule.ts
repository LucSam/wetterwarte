export const WEATHER_INTERVAL=30*60, ENSEMBLE_INTERVAL=3*60*60, RADAR_INTERVAL=5*60, RETRY_INTERVAL=15*60;
export function historyNeedsUpdate(lastYear:number|undefined,nowMs=Date.now()){
 const currentYear=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Europe/Berlin'}).format(nowMs));
 return lastYear===undefined||lastYear<currentYear-1;
}
export function retryDue(lastAttempt:number|undefined,at:number){return lastAttempt===undefined||at-lastAttempt>=RETRY_INTERVAL;}
