import type { Place } from './types';
export const PLACES: Place[] = [
  { id: 'elstal', name: 'Wustermark', detail: 'Elstal', lat: 52.5425, lon: 12.98795 },
  { id: 'potsdam', name: 'Potsdam', detail: 'Zentrum', lat: 52.4009, lon: 13.0591 },
  { id: 'berlin', name: 'Berlin', detail: 'Mitte', lat: 52.52, lon: 13.405 },
];
export const CLIMATE_MODELS = ['MPI_ESM1_2_XR', 'EC_Earth3P_HR', 'MRI_AGCM3_2_S'];
export const SCENARIO = 'HighResMIP · nahe RCP8.5';
export const BASELINE: [number, number] = [1995, 2014];
export const FUTURE: [number, number] = [2030, 2049];
export const WEATHER_TTL = 30 * 60;
export const ENSEMBLE_TTL = 3 * 3600;
