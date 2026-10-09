export type Num = number | null;
export type PlaceId = 'elstal' | 'potsdam' | 'berlin';
export type Mode = 'demo' | 'live';
export type View = 'weather' | 'radar' | 'climate' | 'compare' | 'clock';
export interface Place { id: PlaceId; name: string; detail: string; lat: number; lon: number }
export interface Meta {
  schema: 1; kind: 'weather' | 'ensemble' | 'climate' | 'history' | 'radar' | 'climate-map'; mode: Mode;
  source: string; fetchedAt: number; runAt: number | null; timezone: 'Europe/Berlin';
}
export interface Current { time: number; temperature: Num; wind: Num; direction: Num; code: Num }
export interface WeatherPlace {
  id: PlaceId; grid: [number, number]; current: Current;
  temperature: Num[]; rain: Num[]; probability: Num[]; wind: Num[]; direction: Num[]; code: Num[];
  days: { date: string; min: Num; max: Num; rain: Num; probability: Num; wind: Num }[];
}
export interface OutlookDay { date:string; min:Num; max:Num; rain:Num; probability:Num; code:Num }
export interface Weather extends Meta { kind: 'weather'; model: string; time: number[]; places: WeatherPlace[]; outlook?:{model:string;source:string;fetchedAt:number;places:{id:PlaceId;days:OutlookDay[]}[]}; outlookError?:string }
export interface Distribution { model: string; label: string; resolution: string; members: number; p10: Num[]; median: Num[]; p90: Num[]; count: number[] }
export interface Ensemble extends Meta { kind: 'ensemble'; place: PlaceId; time: number[]; series: Distribution[] }
export const SEASONS = ['DJF', 'MAM', 'JJA', 'SON'] as const;
export interface ClimatePeriod { temperature: number; hotDays: number; rain: Record<typeof SEASONS[number], number>; years: number }
export interface ClimateModel { model: string; baseline: ClimatePeriod; future: ClimatePeriod }
export interface Climate extends Meta {
  kind: 'climate'; place: PlaceId; baseline: [number, number]; future: [number, number];
  scenario: string; models: ClimateModel[]; errors: string[];
}
export interface HistoryYear { year: number; temperature: number; hotDays: number; rain: number }
export interface History extends Meta { kind: 'history'; place: PlaceId; model: 'era5'; baseline: [number, number]; years: HistoryYear[] }
export interface Radar extends Meta { kind: 'radar'; model: 'dwd_rv'; time: number[]; frameErrors: number[] }
export interface ClimateField extends Meta { kind:'climate-map'; baseline:[number,number]; recent:[number,number]; nativeResolutionKm:number; displayResolutionKm:number; cells:{polygon:number[][];baseline:number;recent:number}[] }
export type Dataset = Weather | Ensemble | Climate | History | Radar | ClimateField;
export type Theme = 'auto' | 'light' | 'dark';
export interface Settings { theme:Theme; mode: Mode; place: PlaceId; view: View; size: '480x320' | '480' | '800' | '1280' }
