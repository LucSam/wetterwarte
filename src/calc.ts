import { SEASONS, type ClimatePeriod, type Num } from './types';
export const valid = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const numeric = (v: unknown): Num => valid(v) ? v : null;
export function quantile(values: Num[], p: number): Num {
  const a = values.filter(valid).sort((x, y) => x - y);
  if (!a.length) return null;
  const i = (a.length - 1) * p, lo = Math.floor(i);
  return a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo);
}
export function summarizeMembers(members: Num[][]) {
  const length = members[0]?.length ?? 0;
  const count = Array.from({ length }, (_, i) => members.filter(m => valid(m[i])).length);
  // Incomplete membership is missing data, never a narrower artificial uncertainty band.
  const stat = (p: number) => count.map((n, i) => n === members.length && n >= 2 ? quantile(members.map(m => m[i]), p) : null);
  return { p10: stat(.1), median: stat(.5), p90: stat(.9), count };
}
export function commonSixHourly(time: number[], a: Num[], b: Num[], now: number): number[] {
  return time.map((t, i) => ({ t, i })).filter(({ t, i }) => t >= now && t <= now + 48 * 3600 && t % 21600 === 0 && valid(a[i]) && valid(b[i])).map(x => x.i);
}
export interface DailyClimate { time: string[]; temperature: Num[]; max: Num[]; rain: Num[] }
export function aggregateClimate(d: DailyClimate, start: number, end: number): ClimatePeriod {
  const index = new Map(d.time.map((date, i) => [date, i]));
  function datesBetween(a: Date, b: Date): number[] {
    const result: number[] = [];
    for (let t = +a; t < +b; t += 86400000) {
      const date = new Date(t).toISOString().slice(0, 10), i = index.get(date);
      if (i === undefined) throw new Error(`Fehlender Klimatag: ${date}`);
      result.push(i);
    }
    return result;
  }
  function values(indices: number[], data: Num[]): number[] {
    return indices.map(i => { if (!valid(data[i])) throw new Error(`Unvollständige Klimadaten: ${d.time[i]}`); return data[i] as number; });
  }
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const temps: number[] = [], hot: number[] = [];
  const rain = Object.fromEntries(SEASONS.map(s => [s, []])) as unknown as Record<typeof SEASONS[number], number[]>;
  for (let year = start; year <= end; year++) {
    const indices = datesBetween(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year + 1, 0, 1)));
    temps.push(mean(values(indices, d.temperature)));
    hot.push(values(indices, d.max).filter(x => x >= 30).length);
    for (let s = 0; s < 4; s++) {
      const firstMonth = s * 3 - 1;
      const ids = datesBetween(new Date(Date.UTC(year, firstMonth, 1)), new Date(Date.UTC(year, firstMonth + 3, 1)));
      rain[SEASONS[s]].push(values(ids, d.rain).reduce((sum, v) => sum + v, 0));
    }
  }
  return { temperature: mean(temps), hotDays: mean(hot), years: end - start + 1, rain: Object.fromEntries(SEASONS.map(s => [s, mean(rain[s])])) as ClimatePeriod['rain'] };
}
export const clockTime = (t: number) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(t * 1000);
export const dateTime = (t: number) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(t * 1000);
export const dayLabel = (t: number) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit' }).format(t * 1000);
export const berlinDate = (t: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t * 1000);
export const fmt = (v: Num | undefined, digits = 1) => valid(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '–';
export const signed = (v: number, digits = 1) => `${v > 0 ? '+' : ''}${fmt(v, digits)}`;
export const compass = (v: Num) => valid(v) ? ['N','NO','O','SO','S','SW','W','NW'][Math.round(v / 45) % 8] : '–';
export function condition(code: Num): string {
  if (code === null) return 'Keine Wetterangabe';
  if (code === 0) return 'Klar'; if (code <= 2) return 'Leicht bewölkt'; if (code === 3) return 'Bedeckt';
  if (code <= 48) return 'Nebel'; if (code <= 57) return 'Nieselregen'; if (code <= 67) return 'Regen';
  if (code <= 77) return 'Schnee'; if (code <= 82) return 'Regenschauer'; if (code <= 86) return 'Schneeschauer'; return 'Gewitter';
}
