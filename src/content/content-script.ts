import { mountActionButton } from './action-button';

console.log('[content] loaded on', location.href);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountActionButton());
} else {
  mountActionButton();
}
