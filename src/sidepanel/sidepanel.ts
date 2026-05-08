import type { Message, PendingRequest, SubtitleResult } from '../types/messages';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element not found: ${id}`);
  return el as T;
};

const showLoading = (): void => {
  $('empty-state').hidden = true;
  $('error').hidden = true;
  $('result').hidden = true;
  $('loading').hidden = false;
};

const showError = (message: string, detail?: string): void => {
  $('empty-state').hidden = true;
  $('loading').hidden = true;
  $('result').hidden = true;
  $('error').hidden = false;
  $('error-message').textContent = detail ? `${message}（${detail}）` : message;
};

const showResult = (text: string, languageCode: string): void => {
  $('empty-state').hidden = true;
  $('loading').hidden = true;
  $('error').hidden = true;
  $('result').hidden = false;
  $('result-meta').textContent = `言語: ${languageCode} / 文字数: ${text.length.toLocaleString()}`;
  $('result-text').textContent = text;
};

const errorMessageFor = (
  code: 'NO_SUBTITLE' | 'FETCH_FAILED' | 'EXTRACT_FAILED',
): string => {
  switch (code) {
    case 'NO_SUBTITLE':
      return 'この動画には字幕がないため要約できません';
    case 'FETCH_FAILED':
      return '字幕の取得に失敗しました';
    case 'EXTRACT_FAILED':
      return '字幕情報の解析に失敗しました';
  }
};

let currentVideoId: string | null = null;
let isFetching = false;

const handleRequest = async (pending: PendingRequest): Promise<void> => {
  if (isFetching) return;
  if (currentVideoId === pending.videoId) return;
  currentVideoId = pending.videoId;
  isFetching = true;
  showLoading();
  try {
    const extractMsg: Message = { type: 'EXTRACT_SUBTITLE', tabId: pending.tabId };
    const result = (await chrome.runtime.sendMessage(extractMsg)) as SubtitleResult;
    if (result.type === 'SUBTITLE_RESULT') {
      showResult(result.text, result.languageCode);
    } else {
      showError(errorMessageFor(result.code), result.message);
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    isFetching = false;
  }
};

const init = async (): Promise<void> => {
  const queryMsg: Message = { type: 'GET_PENDING_REQUEST' };
  const pending = (await chrome.runtime.sendMessage(queryMsg)) as PendingRequest | null;
  if (pending) {
    await handleRequest(pending);
  }
};

chrome.runtime.onMessage.addListener((msg: Message) => {
  if (msg.type === 'NEW_REQUEST') {
    handleRequest(msg.pending).catch((err: unknown) => {
      console.error('[sidepanel] handleRequest failed:', err);
    });
  }
});

init().catch((err: unknown) => {
  console.error('[sidepanel] init failed:', err);
});
