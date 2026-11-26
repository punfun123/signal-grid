import { PROJECT_SYMBOL, TOKEN_CA, TOKEN_CHART_URL, X_URL } from '@/config/brand.config';
import { copyText } from '@/utils/copy-text';
import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';

const COPY_ICON = '<rect x="8" y="8" width="11" height="11" rx="1"/><path d="M15 5V4H4v11h1"/>';
const CHART_ICON = '<path d="M3 3v17h18M6 15l5-5 4 2 5-6"/>';
const X_ICON = '<path fill="currentColor" stroke="none" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>';

function iconControl<T extends HTMLElement>(control: T, label: string, icon: string): T {
  control.className = 'grid-token-control';
  control.title = label;
  control.setAttribute('aria-label', label);
  setTrustedHtml(control, trustedHtml(
    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${icon}</svg>`,
    'static token control icon',
  ));
  return control;
}

function iconLink(href: string, label: string, icon: string): HTMLAnchorElement {
  const link = iconControl(document.createElement('a'), label, icon);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

export function mountGridTokenControls(host: HTMLElement): void {
  const symbol = document.createElement('span');
  symbol.className = 'grid-token-symbol';
  symbol.textContent = `$${PROJECT_SYMBOL}`;
  const address = document.createElement('span');
  address.className = 'grid-token-address';
  address.title = TOKEN_CA || 'Contract address pending';
  const addressLabel = document.createElement('span');
  addressLabel.className = 'grid-token-address-label';
  addressLabel.textContent = 'CA';
  const addressValue = document.createElement('span');
  addressValue.className = 'grid-token-address-value';
  addressValue.textContent = TOKEN_CA ? `${TOKEN_CA.slice(0, 5)}…${TOKEN_CA.slice(-4)}` : 'PENDING';
  address.append(addressLabel, ' ', addressValue);
  host.replaceChildren(symbol, address);

  if (TOKEN_CA) {
    const status = document.createElement('span');
    status.className = 'sr-only';
    status.setAttribute('role', 'status');
    const copy = iconControl(document.createElement('button'), 'Copy contract address', COPY_ICON);
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      const copied = await copyText(TOKEN_CA);
      status.textContent = copied ? 'Contract address copied.' : '';
      if (copied) {
        copy.dataset.copied = 'true';
        window.setTimeout(() => delete copy.dataset.copied, 1400);
      }
    });
    host.append(copy, status);
  }

  const social = X_URL
    ? iconLink(X_URL, 'SIGNAL GRID on X (Twitter)', X_ICON)
    : iconControl(document.createElement('span'), 'Official X (Twitter) account pending', X_ICON);
  social.classList.add('grid-token-social');
  if (X_URL) social.setAttribute('referrerpolicy', 'no-referrer');
  else social.setAttribute('role', 'img');
  host.append(social);

  if (TOKEN_CHART_URL) {
    host.append(iconLink(TOKEN_CHART_URL, '$GRID market chart', CHART_ICON));
  }
}
