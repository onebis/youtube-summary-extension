import { marked } from 'marked';
import type {
  Message,
  PendingRequest,
  SubtitleResult,
  SummaryResult,
} from '../types/messages';
import type { SummaryMode } from '../types';
import { loadSettings, saveSettings } from '../lib/storage';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element not found: ${id}`);
  return el as T;
};

const hideAllSections = (): void => {
  $('empty-state').hidden = true;
  $('loading').hidden = true;
  $('error').hidden = true;
  $('result').hidden = true;
};

const showLoading = (message: string): void => {
  hideAllSections();
  $('loading-message').textContent = message;
  $('loading').hidden = false;
};

const showError = (message: string, detail?: string): void => {
  hideAllSections();
  $('error-message').textContent = message;
  const detailEl = $('error-detail');
  if (detail) {
    detailEl.textContent = detail;
    detailEl.hidden = false;
  } else {
    detailEl.hidden = true;
  }
  $('error').hidden = false;
};

const showSummary = (markdown: string, languageCode: string, charCount: number): void => {
  hideAllSections();
  const html = marked.parse(markdown, { async: false }) as string;
  $('summary-content').innerHTML = html;
  $('result-meta').textContent =
    `字幕言語: ${languageCode} / 字幕文字数: ${charCount.toLocaleString()}`;
  $('result').hidden = false;
};

const subtitleErrorMessage = (
  code: 'NO_SUBTITLE' | 'FETCH_FAILED' | 'EXTRACT_FAILED' | 'VIDEO_CHANGED',
): string => {
  switch (code) {
    case 'NO_SUBTITLE':
      return 'この動画には字幕がないため要約できません';
    case 'FETCH_FAILED':
      return '字幕の取得に失敗しました';
    case 'EXTRACT_FAILED':
      return '字幕情報の解析に失敗しました';
    case 'VIDEO_CHANGED':
      return '動画が切り替わったため要約を中止しました。元の動画に戻ってもう一度お試しください';
  }
};

const summaryErrorMessage = (
  code:
    | 'NO_API_KEY'
    | 'INVALID_KEY'
    | 'RATE_LIMIT'
    | 'CONTEXT_OVERFLOW'
    | 'NETWORK'
    | 'OTHER',
): string => {
  switch (code) {
    case 'NO_API_KEY':
      return 'APIキーが未設定です。設定画面で登録してください';
    case 'INVALID_KEY':
      return 'APIキーが無効です。設定を確認してください';
    case 'RATE_LIMIT':
      return 'APIレート制限に達しました。少し待って再試行してください';
    case 'CONTEXT_OVERFLOW':
      return '動画が長すぎるため要約できません';
    case 'NETWORK':
      return 'ネットワークエラーが発生しました';
    case 'OTHER':
      return '要約の生成に失敗しました';
  }
};

let cachedSubtitle:
  | { videoId: string; text: string; languageCode: string; title: string }
  | null = null;
let isProcessing = false;
let activeVideoId: string | null = null;
let pendingNext: PendingRequest | null = null;
let summaryMode: SummaryMode = 'short';

const loadingLabelFor = (mode: SummaryMode): string =>
  mode === 'detailed' ? 'Claude で詳細な要約を生成中...' : 'Claude で要約を生成中...';

const summarize = async (
  subtitle: { text: string; languageCode: string; title: string },
  videoId: string,
): Promise<void> => {
  showLoading(loadingLabelFor(summaryMode));
  const msg: Message = {
    type: 'SUMMARIZE',
    subtitle: subtitle.text,
    mode: summaryMode,
    title: subtitle.title,
  };
  const result = (await chrome.runtime.sendMessage(msg)) as SummaryResult;
  if (activeVideoId !== videoId) return;
  if (result.type === 'SUMMARY_RESULT') {
    showSummary(result.markdown, subtitle.languageCode, subtitle.text.length);
  } else {
    showError(summaryErrorMessage(result.code), result.message);
  }
};

const processRequest = async (pending: PendingRequest): Promise<void> => {
  activeVideoId = pending.videoId;
  try {
    let subtitle: { text: string; languageCode: string; title: string };
    if (cachedSubtitle && cachedSubtitle.videoId === pending.videoId) {
      subtitle = cachedSubtitle;
    } else {
      showLoading('字幕を取得中...');
      const subtitleMsg: Message = {
        type: 'EXTRACT_SUBTITLE',
        tabId: pending.tabId,
        expectedVideoId: pending.videoId,
      };
      const result = (await chrome.runtime.sendMessage(subtitleMsg)) as SubtitleResult;
      if (activeVideoId !== pending.videoId) return;
      if (result.type === 'SUBTITLE_ERROR') {
        showError(subtitleErrorMessage(result.code), result.message);
        cachedSubtitle = null;
        return;
      }
      subtitle = {
        text: result.text,
        languageCode: result.languageCode,
        title: result.title,
      };
      cachedSubtitle = { videoId: pending.videoId, ...subtitle };
    }

    await summarize(subtitle, pending.videoId);
  } catch (err) {
    if (activeVideoId !== pending.videoId) return;
    showError(err instanceof Error ? err.message : String(err));
  }
};

const handleRequest = async (pending: PendingRequest): Promise<void> => {
  // Always update activeVideoId so any in-flight handler aborts UI updates
  activeVideoId = pending.videoId;
  if (isProcessing) {
    pendingNext = pending;
    return;
  }
  isProcessing = true;
  try {
    let current: PendingRequest | null = pending;
    while (current) {
      pendingNext = null;
      await processRequest(current);
      current = pendingNext;
    }
  } finally {
    isProcessing = false;
    pendingNext = null;
  }
};

const updateModeButtons = (): void => {
  document.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
    const mode = btn.dataset.mode;
    const isActive = mode === summaryMode;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', String(isActive));
  });
};

const onModeChange = async (mode: SummaryMode): Promise<void> => {
  if (mode === summaryMode) return;
  summaryMode = mode;
  updateModeButtons();
  await saveSettings({ summaryMode: mode });
  if (isProcessing || !cachedSubtitle) return;
  isProcessing = true;
  try {
    await summarize(cachedSubtitle, cachedSubtitle.videoId);
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    isProcessing = false;
  }
};

const setupModeToggle = (): void => {
  document.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode as SummaryMode | undefined;
      if (mode === 'short' || mode === 'detailed') {
        onModeChange(mode).catch((err: unknown) => {
          console.error('[sidepanel] onModeChange failed:', err);
        });
      }
    });
  });
};

const init = async (): Promise<void> => {
  const settings = await loadSettings();
  summaryMode = settings.summaryMode;
  updateModeButtons();
  setupModeToggle();

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
