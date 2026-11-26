export const PROJECT_NAME = 'SIGNAL GRID';
export const PROJECT_SYMBOL = 'GRID';
export const PROJECT_TAGLINE = 'The World Never Stops. Stay Connected.';
export const PROJECT_DESCRIPTION = 'A community-powered global intelligence network with a live world map, international news, public webcams, and market data.';
export const UPSTREAM_COMMIT = '15db6d39b7a0edff498b9f1417b81d5196d26c3f';
export const UPSTREAM_URL = `https://github.com/koala73/worldmonitor/tree/${UPSTREAM_COMMIT}`;

function httpsUrl(value: string | undefined): string {
  try {
    const url = new URL(value?.trim() ?? '');
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* Unconfigured or invalid links are omitted. */ }
  return '';
}

const env = import.meta.env;
const ca = env?.VITE_GRID_CONTRACT_ADDRESS?.trim() || '58REuuFa42VY59yxb1boKLwvBjeFRVoV7CY9iqcGpump';
export const TOKEN_CA = /^[a-zA-Z0-9]{20,128}$/.test(ca) ? ca : '';
export const X_URL = httpsUrl(env?.VITE_GRID_X_URL) || 'https://x.com/SignalGridLive';
export const TOKEN_CHART_URL = TOKEN_CA ? httpsUrl(env?.VITE_GRID_CHART_URL) : '';
export const SOURCE_CODE_URL = httpsUrl(env?.VITE_GRID_SOURCE_CODE_URL) || '/source/index.html';
