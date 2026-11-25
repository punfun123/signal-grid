import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { waitUntil } from '@vercel/functions';
import { gridDisabledResponse, isDisabledGridRoute } from '../shared/grid-profile.js';

const LEGACY_NODE_ROUTES = new Set(['/api/og-story', '/api/story']);
const FALLBACK_ROUTE = '/api/[...notfound]';

function getRouteMatcher(path) {
  const pattern = path.split('/').map((segment) => {
    if (segment.startsWith('[...') && segment.endsWith(']')) return '.+';
    if (segment.startsWith('[') && segment.endsWith(']')) return '[^/]+';
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return new RegExp('^' + pattern + '$');
}

function pathPriority(path) {
  return path.split('/').reduce((score, segment) => {
    if (segment.startsWith('[...')) return score;
    return score + (segment.startsWith('[') ? 1 : 10);
  }, 0);
}

async function sendResponse(req, res, response) {
  res.statusCode = response.status;
  for (const [key, value] of response.headers) {
    if (key !== 'set-cookie') res.setHeader(key, value);
  }
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader('set-cookie', cookies);
  if (!response.body || req.method === 'HEAD') {
    res.end();
    return;
  }
  await pipeline(Readable.fromWeb(response.body), res);
}

export function createVercelApiHandler(entries) {
  const exact = new Map(entries.filter(([path]) => !path.includes('[')));
  const dynamic = entries.filter(([path]) => path.includes('[') && path !== FALLBACK_ROUTE)
    .sort(([a], [b]) => pathPriority(b) - pathPriority(a))
    .map(([path, load]) => ({ matcher: getRouteMatcher(path), load }));
  const notFound = entries.find(([path]) => path === FALLBACK_ROUTE)?.[1];

  return async function handleVercelApi(req, res) {
    try {
      const scheme = req.headers['x-forwarded-proto'] === 'http' ? 'http' : 'https';
      const url = new URL(req.url || '/', `${scheme}://${req.headers.host}`);
      const route = url.searchParams.get('__grid_path');
      url.searchParams.delete('__grid_path');
      if (!url.pathname.startsWith('/api/') && route) url.pathname = '/api/' + route;
      const path = url.pathname.replace(/\/+$/, '');

      if (!path.startsWith('/api/') || isDisabledGridRoute(path)) {
        return await sendResponse(req, res, gridDisabledResponse());
      }

      const load = exact.get(path) ?? dynamic.find(({ matcher }) => matcher.test(path))?.load ?? notFound;
      const mod = await load();
      if (LEGACY_NODE_ROUTES.has(path)) {
        req.url = url.pathname + url.search;
        res.status = (status) => { res.statusCode = status; return res; };
        res.send = (body) => res.end(body);
        return await mod.default(req, res);
      }

      const method = req.method || 'GET';
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        for (const item of Array.isArray(value) ? value : [value]) {
          if (item !== undefined) headers.append(key, item);
        }
      }
      const init = { method, headers };
      if (method !== 'GET' && method !== 'HEAD') {
        init.body = Readable.toWeb(req);
        init.duplex = 'half';
      }
      const handler = mod[method] ?? mod.default;
      const response = await handler(new Request(url, init), { waitUntil });
      return await sendResponse(req, res, response);
    } catch (error) {
      console.error('SIGNAL GRID API handler failed', error?.name, error?.code ?? '');
      if (!process.env.VERCEL) console.error(error);
      if (res.headersSent || res.destroyed) { res.destroy(); return; }
      return await sendResponse(req, res, Response.json({ error: 'API temporarily unavailable' }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }));
    }
  };
}
