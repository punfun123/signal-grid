import { IS_GRID_PUBLIC_WEB } from './grid-profile';

const AI_PANELS = new Set([
  'insights',
  'forecast',
  'latest-brief',
  'daily-market-brief',
  'regional-intelligence',
  'market-implications',
  'deduction',
  'chat-analyst',
  'stock-analysis',
]);

/** Fully gated panels. Enhanced panels can still render their public data. */
export const WEB_PREMIUM_PANELS = new Set([
  'stock-analysis',
  'stock-backtest',
  'daily-market-brief',
  'market-implications',
  'deduction',
  'chat-analyst',
  'wsb-ticker-scanner',
  'latest-brief',
  'regional-intelligence',
  'trade-policy',
  'global-procurement',
]);

export const PUBLIC_OPT_IN_PANELS = new Set(['markets', 'commodities', 'energy-complex', 'economic']);

export function isGridPanelAvailable(key: string, premium?: 'locked' | 'enhanced'): boolean {
  if (AI_PANELS.has(key) || key.startsWith('cw-')) return false;
  return !IS_GRID_PUBLIC_WEB || (
    premium !== 'locked' && !WEB_PREMIUM_PANELS.has(key)
    && key !== 'runtime-config' && !key.startsWith('mcp-')
  );
}
