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

export function isGridPanelAvailable(key: string): boolean {
  return !AI_PANELS.has(key) && !key.startsWith('cw-');
}
