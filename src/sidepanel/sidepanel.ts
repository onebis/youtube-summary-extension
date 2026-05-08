import { marked } from 'marked';
import type {
  Message,
  PendingRequest,
  SubtitleResult,
  SummaryResult,
} from '../types/messages';
import type { SummaryMode, Provider, StorageSchema } from '../types';
import { loadSettings, saveSettings } from '../lib/storage';
import { initI18n, t, applyTranslations } from '../lib/i18n';

const PROVIDER_NAMES: Record<Provider, string> = {
  claude: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
};

type OutputLang = 'ja' | 'en';

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
  $('result-meta').textContent = t('metaSubtitleInfo', {
    lang: languageCode,
    chars: charCount.toLocaleString(),
  });
  $('result').hidden = false;
};

const subtitleErrorKey = (
  code: 'NO_SUBTITLE' | 'FETCH_FAILED' | 'EXTRACT_FAILED' | 'VIDEO_CHANGED',
): string => {
  switch (code) {
    case 'NO_SUBTITLE':
      return 'errorNoSubtitle';
    case 'FETCH_FAILED':
      return 'errorFetchFailed';
    case 'EXTRACT_FAILED':
      return 'errorExtractFailed';
    case 'VIDEO_CHANGED':
      return 'errorVideoChanged';
  }
};

const summaryErrorKey = (
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
      return 'errorNoApiKey';
    case 'INVALID_KEY':
      return 'errorInvalidKey';
    case 'RATE_LIMIT':
      return 'errorRateLimit';
    case 'CONTEXT_OVERFLOW':
      return 'errorContextOverflow';
    case 'NETWORK':
      return 'errorNetwork';
    case 'OTHER':
      return 'errorGeneric';
  }
};

let cachedSubtitle:
  | { videoId: string; text: string; languageCode: string; title: string }
  | null = null;
let isProcessing = false;
let activeVideoId: string | null = null;
let pendingNext: PendingRequest | null = null;
let summaryMode: SummaryMode = 'short';
let activeProvider: Provider = 'claude';
let outputLanguage: OutputLang = 'ja';

const loadingLabelFor = (mode: SummaryMode): string => {
  const provider = PROVIDER_NAMES[activeProvider];
  return mode === 'detailed'
    ? t('loadingSummarizingDetailed', { provider })
    : t('loadingSummarizing', { provider });
};

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
    outputLanguage,
  };
  const result = (await chrome.runtime.sendMessage(msg)) as SummaryResult;
  if (activeVideoId !== videoId) return;
  if (result.type === 'SUMMARY_RESULT') {
    showSummary(result.markdown, subtitle.languageCode, subtitle.text.length);
  } else {
    showError(t(summaryErrorKey(result.code)), result.message);
  }
};

const processRequest = async (pending: PendingRequest): Promise<void> => {
  activeVideoId = pending.videoId;
  try {
    let subtitle: { text: string; languageCode: string; title: string };
    if (cachedSubtitle && cachedSubtitle.videoId === pending.videoId) {
      subtitle = cachedSubtitle;
    } else {
      showLoading(t('loadingFetchingSubtitle'));
      const subtitleMsg: Message = {
        type: 'EXTRACT_SUBTITLE',
        tabId: pending.tabId,
        expectedVideoId: pending.videoId,
      };
      const result = (await chrome.runtime.sendMessage(subtitleMsg)) as SubtitleResult;
      if (activeVideoId !== pending.videoId) return;
      if (result.type === 'SUBTITLE_ERROR') {
        showError(t(subtitleErrorKey(result.code)), result.message);
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
    const mode = btn.dataset['mode'];
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

const onOutputLangChange = async (lang: OutputLang): Promise<void> => {
  if (lang === outputLanguage) return;
  outputLanguage = lang;
  await saveSettings({ outputLanguage: lang });
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
      const mode = btn.dataset['mode'] as SummaryMode | undefined;
      if (mode === 'short' || mode === 'detailed') {
        onModeChange(mode).catch((err: unknown) => {
          console.error('[sidepanel] onModeChange failed:', err);
        });
      }
    });
  });
};

const setupOutputLangSelect = (): void => {
  const sel = $<HTMLSelectElement>('output-lang');
  sel.value = outputLanguage;
  sel.addEventListener('change', () => {
    const lang = sel.value as OutputLang;
    if (lang === 'ja' || lang === 'en') {
      onOutputLangChange(lang).catch((err: unknown) => {
        console.error('[sidepanel] onOutputLangChange failed:', err);
      });
    }
  });
};

const init = async (): Promise<void> => {
  const settings = await loadSettings();
  summaryMode = settings.summaryMode;
  activeProvider = settings.activeProvider;
  outputLanguage = settings.outputLanguage;
  await initI18n(settings.uiLanguage);
  applyTranslations();
  updateModeButtons();
  setupModeToggle();
  setupOutputLangSelect();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['activeProvider']) {
      activeProvider =
        (changes['activeProvider'].newValue as Provider | undefined) ?? 'claude';
    }
    if (changes['uiLanguage']) {
      const newLang =
        (changes['uiLanguage'].newValue as StorageSchema['uiLanguage'] | undefined) ?? 'auto';
      initI18n(newLang)
        .then(() => applyTranslations())
        .catch((err: unknown) => console.error('[sidepanel] i18n reload failed:', err));
    }
  });

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
