import { BASELINE, CLIMATE_MODELS, FUTURE, PLACES, SCENARIO } from '../config';
import { aggregateClimate, berlinDate, commonSixHourly, numeric, summarizeMembers, valid, type DailyClimate } from '../calc';
import type { Climate, Ensemble, Meta, Num, PlaceId, Weather } from '../types';
import { readCache, writeCache } from './cache';
type Api = { latitude: number; longitude: number; hourly?: Record<string, unknown[]>; daily?: Record<string, unknown[]>; current?: Record<string, unknown> };
export const now = () => Math.floor(Date.now() / 1000);
export function meta(kind: Meta['kind'], mode: Meta['mode'] = 'live'): Meta {
  return { schema: 1, kind, mode, source: mode === 'demo' ? 'Synthetische Beispieldaten' : 'Open-Meteo', fetchedAt: now(), runAt: null, timezone: 'Europe/Berlin' };
}
async function request(endpoint: string, params: Record<string, string>, signal?: AbortSignal): Promise<Api | Api[]> {
  const timeout = AbortSignal.timeout(60000);
  const response = await fetch(`${endpoint}?${new URLSearchParams(params)}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error(response.status === 429 ? 'API-Nutzungslimit erreicht. Später erneut versuchen.' : `Open-Meteo antwortet mit HTTP ${response.status}.`);
  const data = await response.json();
  if (data.error) throw new Error(String(data.reason));
  return data;
}
const placeParams = (id: PlaceId) => { const p = PLACES.find(x => x.id === id)!; return { latitude: String(p.lat), longitude: String(p.lon) }; };
const column = (d: Record<string, unknown[]>, key: string, length: number) => Array.from({ length }, (_, i) => numeric(d[key]?.[i]));
export async function fetchWeather(): Promise<Weather> {
  const response = await request('https://api.open-meteo.com/v1/forecast', {
    latitude: PLACES.map(p => p.lat).join(','), longitude: PLACES.map(p => p.lon).join(','),
    models: 'icon_eu', timezone: 'Europe/Berlin', timeformat: 'unixtime', forecast_days: '4',
    temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm',
    current: 'temperature_2m,wind_speed_10m,wind_direction_10m,weather_code',
    hourly: 'temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_direction_10m,weather_code',
    daily: 'temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
  });
  const records = Array.isArray(response) ? response : [response];
  if (records.length !== PLACES.length || !records[0].hourly?.time?.length) throw new Error('Unvollständige Wetterantwort.');
  const time = records[0].hourly.time as number[];
  const places = records.map((r, i) => {
    if (JSON.stringify(r.hourly?.time) !== JSON.stringify(time)) throw new Error('Orte haben unterschiedliche Zeitachsen.');
    const h = r.hourly!, c = r.current ?? {}, d = r.daily ?? {};
    return { id: PLACES[i].id, grid: [r.latitude, r.longitude] as [number, number],
      current: { time: numeric(c.time) ?? time[0], temperature: numeric(c.temperature_2m), wind: numeric(c.wind_speed_10m), direction: numeric(c.wind_direction_10m), code: numeric(c.weather_code) },
      temperature: column(h,'temperature_2m',time.length), rain: column(h,'precipitation',time.length), probability: column(h,'precipitation_probability',time.length), wind: column(h,'wind_speed_10m',time.length), direction: column(h,'wind_direction_10m',time.length), code: column(h,'weather_code',time.length),
      days: (d.time ?? []).map((t, j) => ({ date: berlinDate(Number(t)), min: numeric(d.temperature_2m_min?.[j]), max: numeric(d.temperature_2m_max?.[j]), rain: numeric(d.precipitation_sum?.[j]), probability: numeric(d.precipitation_probability_max?.[j]), wind: numeric(d.wind_speed_10m_max?.[j]) })),
    };
  });
  if (!places.some(p => p.temperature.some(valid))) throw new Error('Keine gültigen Wetterwerte erhalten.');
  // A separate model supplies the longer daily outlook. Never append its values
  // to the regional ICON hourly series or silently substitute failed requests.
  let outlook:Weather['outlook'],outlookError:string|undefined;
  try {
    const raw=await request('https://api.open-meteo.com/v1/forecast',{
      latitude:PLACES.map(p=>p.lat).join(','),longitude:PLACES.map(p=>p.lon).join(','),
      models:'ecmwf_ifs025',forecast_days:'14',timezone:'Europe/Berlin',
      daily:'temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,weather_code',
      temperature_unit:'celsius',precipitation_unit:'mm',
    });
    const rows=Array.isArray(raw)?raw:[raw];
    if(rows.length!==PLACES.length||rows.some(r=>!r.daily?.time?.length))throw Error('Keine Tagesübersicht geliefert.');
    const locations=rows.map((r,i)=>({id:PLACES[i].id,days:r.daily!.time.map((t,j)=>({date:String(t),min:numeric(r.daily!.temperature_2m_min?.[j]),max:numeric(r.daily!.temperature_2m_max?.[j]),rain:numeric(r.daily!.precipitation_sum?.[j]),probability:numeric(r.daily!.precipitation_probability_max?.[j]),code:numeric(r.daily!.weather_code?.[j])})).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&(d.min!==null||d.max!==null))}));
    if(locations.some(p=>!p.days.length))throw Error('Keine gültigen Tageswerte geliefert.');
    outlook={model:'ecmwf_ifs025',source:'Open-Meteo · ECMWF IFS 0,25°',fetchedAt:now(),places:locations};
  }catch(e){outlookError=`14-Tage-Vorschau nicht verfügbar: ${e instanceof Error?e.message:String(e)}`;}
  return { ...meta('weather'), kind: 'weather', model: 'icon_eu', time, places,outlook,outlookError };
}
export function parseEnsemble(r: Api, place: PlaceId, from = now()): Ensemble {
  const h = r.hourly;
  if (!h?.time?.length) throw new Error('Keine Ensemble-Zeitreihe erhalten.');
  const time = h.time as number[];
  const definitions = [
    { model: 'icon_eu_eps', label: 'DWD ICON-EU-EPS', resolution: '13 km · 1 h', expected: 40 },
    { model: 'ecmwf_aifs025_ensemble', label: 'ECMWF AIFS', resolution: '0,25° (~25 km) · 6 h', expected: 51 },
  ];
  const full = definitions.map(({ expected, ...model }) => {
    const keys = Object.keys(h).filter(k => new RegExp(`^temperature_2m(?:_member\\d+)?_${model.model}$`).test(k));
    if (keys.length !== expected) throw new Error(`${model.label}: ${keys.length} statt ${expected} Ensemble-Mitglieder erhalten.`);
    const members = keys.map(key => column(h, key, time.length));
    return { ...model, members: members.length, ...summarizeMembers(members) };
  });
  const ids = commonSixHourly(time, full[0].median, full[1].median, from);
  if (ids.length < 2) throw new Error('Kein ausreichender gemeinsamer Ensemble-Zeitraum verfügbar.');
  return { ...meta('ensemble'), kind: 'ensemble', place, time: ids.map(i => time[i]), series: full.map(s => ({ ...s, p10: ids.map(i => s.p10[i]), median: ids.map(i => s.median[i]), p90: ids.map(i => s.p90[i]), count: ids.map(i => s.count[i]) })) };
}
export async function fetchEnsemble(place: PlaceId): Promise<Ensemble> {
  const r = await request('https://ensemble-api.open-meteo.com/v1/ensemble', { ...placeParams(place), hourly: 'temperature_2m', models: 'icon_eu_eps,ecmwf_aifs025_ensemble', forecast_days: '4', timeformat: 'unixtime', timezone: 'GMT', temperature_unit: 'celsius' });
  return parseEnsemble(Array.isArray(r) ? r[0] : r, place);
}
async function pause(ms: number, signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Abgebrochen', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
export async function fetchClimate(place: PlaceId, progress: (message: string) => void, signal: AbortSignal): Promise<Climate> {
  const models: Climate['models'] = [], errors: string[] = [];
  let fetchedAt = now();
  for (const model of CLIMATE_MODELS) {
    try {
      const periods = [];
      for (const [start, end] of [BASELINE, FUTURE]) {
        const key = `raw-climate-v1-${place}-${model}-${start}-${end}`;
        let cached = await readCache<{ fetchedAt: number; daily: DailyClimate }>(key);
        if (!cached) {
          // A 20-year, 3-variable request counts as ~157 calls, not one.
          // Leave >=32s between climate requests across reloads; <=~315/minute.
          const last = await readCache<number>('last-climate-request') ?? 0;
          const wait = Math.max(0, last + 32 - now());
          if (wait) { progress(`${model} · ${start}–${end} · API-Pause ${wait} s`); await pause(wait * 1000, signal); }
          progress(`${model} · ${start}–${end} wird geladen …`);
          await writeCache('last-climate-request', now());
          const r = await request('https://climate-api.open-meteo.com/v1/climate', { ...placeParams(place), models: model, start_date: `${start - 1}-12-01`, end_date: `${end}-12-31`, daily: 'temperature_2m_mean,temperature_2m_max,precipitation_sum', temperature_unit: 'celsius', precipitation_unit: 'mm', disable_bias_correction: 'false' }, signal);
          const d = (Array.isArray(r) ? r[0] : r).daily;
          if (!d?.time?.length) throw new Error('Keine täglichen Klimawerte erhalten.');
          cached = { fetchedAt: now(), daily: { time: d.time as string[], temperature: column(d,'temperature_2m_mean',d.time.length), max: column(d,'temperature_2m_max',d.time.length), rain: column(d,'precipitation_sum',d.time.length) } };
          // Validate completeness before persisting a supposedly complete period.
          aggregateClimate(cached.daily, start, end);
          await writeCache(key, cached);
        }
        fetchedAt = Math.min(fetchedAt, cached.fetchedAt);
        periods.push(aggregateClimate(cached.daily, start, end));
      }
      models.push({ model, baseline: periods[0], future: periods[1] });
      progress(`${models.length} / ${CLIMATE_MODELS.length} Modelle vollständig`);
    } catch (error) {
      if (signal.aborted) throw error;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${model}: ${message}`);
      if (message.includes('Nutzungslimit')) break;
    }
  }
  if (!models.length) throw new Error(errors.join(' · ') || 'Keine Klimadaten verfügbar.');
  return { ...meta('climate'), kind: 'climate', fetchedAt, place, baseline: BASELINE, future: FUTURE, scenario: SCENARIO, models, errors };
}
/** Adapter contract for externally computed pretrained-model results. No training runtime needed. */
export interface ExternalForecastProvider { id: string; label: string; load(place: PlaceId, from: number, to: number, signal: AbortSignal): Promise<Ensemble> }
