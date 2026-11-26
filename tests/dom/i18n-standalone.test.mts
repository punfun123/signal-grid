import { expect, it } from 'vitest';
import { changeLanguage, initI18n, t } from '@/services/i18n';

it('loads English web labels despite a non-English URL and stored preference', async () => {
  localStorage.setItem('wm-locale-explicit', 'zh-TW');
  window.history.replaceState(null, '', '?lang=ar');
  await initI18n({ waitForFullTranslation: true });
  expect(document.documentElement.lang).toBe('en');
  expect(document.documentElement.hasAttribute('dir')).toBe(false);
  expect(t('components.liveNews.manage')).toBe('Manage channels');
  expect(t('components.liveNews.addChannel')).toBe('Add channel');
  await expect(changeLanguage('zh')).resolves.toBe(false);
  expect(t('components.liveNews.manage')).toBe('Manage channels');
});
