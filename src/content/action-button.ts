import type { Message } from '../types/messages';
import type { StorageSchema } from '../types';
import { initI18n, t } from '../lib/i18n';
import { loadSettings } from '../lib/storage';

const SELECTORS = [
  '#actions-inner #menu #top-level-buttons-computed',
  '#top-level-buttons-computed',
  '#menu-container ytd-menu-renderer #top-level-buttons-computed',
];

const BUTTON_ID = 'yt-summary-trigger';

const findContainer = (): HTMLElement | null => {
  for (const sel of SELECTORS) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
};

const onSummarizeClick = (): void => {
  const videoId = new URLSearchParams(location.search).get('v');
  if (!videoId) return;
  const msg: Message = { type: 'OPEN_SIDEPANEL_AND_SUMMARIZE', videoId };
  chrome.runtime.sendMessage(msg).catch((err: unknown) => {
    console.error('[content] sendMessage failed:', err);
  });
};

const buildButton = (): HTMLButtonElement => {
  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.type = 'button';
  btn.className = 'yt-summary-button';
  const label = t('summarizeButton') || 'Summarize';
  btn.setAttribute('aria-label', label);
  btn.textContent = label;
  btn.addEventListener('click', onSummarizeClick);
  return btn;
};

const insert = (): void => {
  if (location.pathname !== '/watch') return;
  const container = findContainer();
  if (!container) return;
  if (container.querySelector(`#${BUTTON_ID}`)) return;
  container.appendChild(buildButton());
};

const refreshLabel = (): void => {
  const btn = document.querySelector<HTMLButtonElement>(`#${BUTTON_ID}`);
  if (!btn) return;
  const label = t('summarizeButton') || 'Summarize';
  btn.textContent = label;
  btn.setAttribute('aria-label', label);
};

export const mountActionButton = async (): Promise<void> => {
  const settings = await loadSettings();
  await initI18n(settings.uiLanguage);

  insert();

  let scheduled = false;
  const scheduleInsert = (): void => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      insert();
    });
  };

  const observer = new MutationObserver(scheduleInsert);
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('yt-navigate-finish', () => {
    setTimeout(insert, 300);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['uiLanguage']) {
      const newLang =
        (changes['uiLanguage'].newValue as StorageSchema['uiLanguage'] | undefined) ?? 'auto';
      initI18n(newLang)
        .then(() => refreshLabel())
        .catch((err: unknown) => console.error('[content] i18n reload failed:', err));
    }
  });
};
