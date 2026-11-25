#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);
if (process.env.REDIS_TOKEN && !process.env.UPSTASH_REDIS_REST_URL) {
  process.env.UPSTASH_REDIS_REST_URL = 'http://127.0.0.1:8079';
  process.env.UPSTASH_REDIS_REST_TOKEN = process.env.REDIS_TOKEN;
}
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error('Configure the local or operator-owned Redis REST endpoint before running the data seeders.');
  process.exit(1);
}

const watch = process.argv.includes('--watch');
const refresh = [
  ['earthquakes', 5],
  ['weather-alerts', 10],
  ['natural-events', 15],
  ['prediction-markets', 15],
  ['security-advisories', 60],
  ['crypto-quotes', 5],
  ['live-video-resolved', 60],
  ['market-quotes', 15, 'ALPHA_VANTAGE_API_KEY', 'FINNHUB_API_KEY'],
  ['commodity-quotes', 15, 'ALPHA_VANTAGE_API_KEY', 'FINNHUB_API_KEY'],
  ['internet-outages', 15, 'CLOUDFLARE_API_TOKEN'],
  ['ucdp-events', 60, 'UCDP_ACCESS_TOKEN'],
].filter(([, , ...keys]) => keys.length === 0 || keys.some((key) => process.env[key]));

const active = new Set();
const timers = new Set();
let stopping = false;
function stop() {
  stopping = true;
  for (const timer of timers) clearTimeout(timer);
  for (const child of active) child.kill();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

function run(name, minutes) {
  if (stopping) return;
  const script = fileURLToPath(new URL('./seed-' + name + '.mjs', import.meta.url));
  const child = spawn(process.execPath, [script], { stdio: 'inherit' });
  active.add(child);
  child.on('error', (error) => console.error('Seeder ' + name + ': ' + error.message));
  child.once('close', (code) => {
    active.delete(child);
    if (stopping) return;
    if (code !== 0) {
      console.error('Seeder ' + name + ' exited with status ' + code);
      if (!watch) process.exitCode = 1;
    }
    if (watch) schedule(name, minutes, minutes * 60_000);
  });
}

function schedule(name, minutes, delay) {
  const timer = setTimeout(() => {
    timers.delete(timer);
    run(name, minutes);
  }, delay);
  timers.add(timer);
}

refresh.forEach(([name, minutes], index) => schedule(name, minutes, index * 600));
