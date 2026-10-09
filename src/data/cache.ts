import type { Settings } from '../types';
const DB = 'wetterwarte-v1';
let db: Promise<IDBDatabase> | undefined;
export let storageWarning = '';
function open(): Promise<IDBDatabase> {
  return db ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('data');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readCache<T>(key: string): Promise<T | undefined> {
  try { const d = await open(); return await new Promise((resolve, reject) => { const r = d.transaction('data').objectStore('data').get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
  catch { storageWarning = 'Lokaler Datenspeicher ist nicht verfügbar.'; return undefined; }
}
export async function writeCache(key: string, data: unknown): Promise<void> {
  try { const d = await open(); await new Promise<void>((resolve, reject) => { const tx = d.transaction('data', 'readwrite'); tx.objectStore('data').put(data, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); }
  catch { storageWarning = 'Daten konnten nicht dauerhaft gespeichert werden.'; }
}
export async function retainCacheKeys(prefix:string, keep:string[]):Promise<void> {
  try {
    const d=await open();
    await new Promise<void>((resolve,reject)=>{
      const tx=d.transaction('data','readwrite'),store=tx.objectStore('data'),r=store.getAllKeys();
      r.onsuccess=()=>{for(const key of r.result)if(typeof key==='string'&&key.startsWith(prefix)&&!keep.includes(key))store.delete(key);};
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
    });
  } catch { storageWarning='Alte Radarbilder konnten nicht aus dem Cache entfernt werden.'; }
}
export function readSettings(): Settings {
  const defaults: Settings = { theme:'auto', mode: 'demo', place: 'elstal', view: 'weather', size: '1280' };
  try { const s = JSON.parse(localStorage.getItem('wetterwarte-settings') ?? '{}');
    return { theme:['auto','light','dark'].includes(s.theme)?s.theme:defaults.theme, mode: ['demo','live'].includes(s.mode) ? s.mode : defaults.mode, place: ['elstal','potsdam','berlin'].includes(s.place) ? s.place : defaults.place, view: ['weather','radar','climate','compare','clock'].includes(s.view) ? s.view : defaults.view, size: ['480x320','480','800','1280'].includes(s.size) ? s.size : defaults.size };
  } catch { return defaults; }
}
export function saveSettings(s: Settings) { try { localStorage.setItem('wetterwarte-settings', JSON.stringify(s)); } catch { storageWarning = 'Einstellungen werden in diesem Browser nicht gespeichert.'; } }
