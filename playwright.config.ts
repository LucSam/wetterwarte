import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir:'tests', testMatch:'browser.spec.ts', timeout:30_000, workers:1, reporter:'list', use:{ baseURL:process.env.WEATHER_TEST_URL??'http://127.0.0.1:5173', viewport:{width:1440,height:1050}, channel:'chrome', headless:true }, webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:true} });
