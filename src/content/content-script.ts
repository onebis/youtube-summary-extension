import { mountActionButton } from './action-button';

console.log('[content] loaded on', location.href);

const startup = (): void => {
  mountActionButton().catch((err: unknown) => {
    console.error('[content] mountActionButton failed:', err);
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startup);
} else {
  startup();
}
