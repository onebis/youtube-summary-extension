import type { Message } from '../types/messages';

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
  btn.setAttribute('aria-label', '要約');
  btn.innerHTML =
    '<span class="yt-summary-icon" aria-hidden="true">🪄</span>' +
    '<span class="yt-summary-label">要約</span>';
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

export const mountActionButton = (): void => {
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
};
