// The fork has no AI runtime. This policy is intentionally independent of
// provider credentials, browser preferences, and upstream account state.
export const AI_FEATURES_ENABLED = false;

const DISABLED_PREFIXES = [
  '/api/forecast',
  '/api/internal/brief',
  '/api/internal/company-monitoring',
  '/api/internal/llm',
  '/api/local-ollama',
  '/api/local-llm',
  '/api/internal/mcp-grant',
  '/api/mcp',
  '/api/a2a',
  '/api/widget-agent',
  '/widget-agent',
  '/api/chat-analyst',
  '/api/ask',
  '/mcp',
  '/mcp-grant',
  '/a2a',
  '/ask',
];

const DISABLED_METHODS = new Set([
  'analyze-stock',
  'classify-event',
  'deduct-situation',
  'get-country-intel-brief',
  'get-daily-market-brief',
  'get-market-implications',
  'get-regional-snapshot',
  'get-similar-events',
  'search-intel-history',
  'summarize-article',
  'translate-text',
]);

export function isDisabledGridRoute(pathname) {
  let path;
  try {
    path = decodeURIComponent(pathname).toLowerCase().replace(/\/+$/, '').replace(/\.md$/, '');
  } catch {
    return false;
  }
  if (DISABLED_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '-'))) return true;
  return path.startsWith('/api/') && DISABLED_METHODS.has(path.split('/').at(-1));
}

export function gridDisabledResponse() {
  return new Response(JSON.stringify({ error: 'This endpoint is unavailable in SIGNAL GRID.' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
