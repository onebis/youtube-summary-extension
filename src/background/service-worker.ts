import type { Message } from '../types/messages';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[bg] installed');
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err: unknown) => {
    console.error('[bg] setPanelBehavior failed:', err);
  });

chrome.runtime.onMessage.addListener((msg: Message, sender) => {
  if (msg.type === 'OPEN_SIDEPANEL_AND_SUMMARIZE') {
    const tabId = sender.tab?.id;
    if (tabId == null) return;
    chrome.sidePanel.open({ tabId }).catch((err: unknown) => {
      console.error('[bg] sidePanel.open failed:', err);
    });
  }
});
