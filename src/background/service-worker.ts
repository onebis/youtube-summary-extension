import type {
  Message,
  PendingRequest,
  SubtitleResult,
  SummaryResult,
} from '../types/messages';
import { loadSettings } from '../lib/storage';
import { buildPrompt } from '../lib/prompt';
import { LLMError } from '../lib/llm';
import type { LLMClient } from '../lib/llm';
import { ClaudeClient } from '../lib/llm/claude';

let pending: PendingRequest | null = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('[bg] installed');
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err: unknown) => {
    console.error('[bg] setPanelBehavior failed:', err);
  });

type InPageResult =
  | { ok: true; text: string; languageCode: string; title: string; videoId: string }
  | {
      ok: false;
      code: 'NO_PLAYER_RESPONSE' | 'NO_SUBTITLE' | 'FETCH_FAILED';
      detail?: string;
    };

const extractAndFetchInPage = async (): Promise<InPageResult> => {
  const w = window as unknown as {
    ytInitialPlayerResponse?: {
      captions?: {
        playerCaptionsTracklistRenderer?: {
          captionTracks?: Array<{ languageCode: string; kind?: string }>;
        };
      };
      videoDetails?: {
        defaultAudioLanguage?: string;
        title?: string;
        videoId?: string;
      };
    };
    ytInitialData?: unknown;
    ytcfg?: {
      data_?: { INNERTUBE_API_KEY?: string; INNERTUBE_CONTEXT?: unknown };
      get?: (k: string) => unknown;
    };
  };

  const player = w.ytInitialPlayerResponse;
  if (!player) {
    return { ok: false, code: 'NO_PLAYER_RESPONSE' };
  }

  const videoTitle =
    player.videoDetails?.title ?? document.title.replace(/\s*-\s*YouTube\s*$/, '');
  const videoId =
    player.videoDetails?.videoId ?? new URLSearchParams(location.search).get('v') ?? '';

  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (tracks.length === 0) {
    return { ok: false, code: 'NO_SUBTITLE', detail: 'No caption tracks listed' };
  }

  const videoLang = player.videoDetails?.defaultAudioLanguage;
  const score = (t: (typeof tracks)[number]): number => {
    let s = 0;
    if (t.kind !== 'asr') s += 100;
    if (videoLang && t.languageCode === videoLang.split('-')[0]) s += 10;
    if (t.languageCode === 'en') s += 1;
    return s;
  };
  const bestTrack = [...tracks].sort((a, b) => score(b) - score(a))[0];

  const findPanel = (): HTMLElement | null =>
    document.querySelector<HTMLElement>(
      'ytd-engagement-panel-section-list-renderer[target-id*="transcript"]',
    );

  const isVisible = (el: HTMLElement): boolean => {
    if (el.hasAttribute('hidden')) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const extractText = (panel: HTMLElement): string => {
    const bodyContainer =
      panel.querySelector<HTMLElement>('#body') ??
      panel.querySelector<HTMLElement>('ytd-transcript-renderer') ??
      panel.querySelector<HTMLElement>('ytd-transcript-search-panel-renderer') ??
      panel;

    // Try specific segment selectors first
    const candidates = [
      'ytd-transcript-segment-renderer',
      'yt-transcript-segment-renderer',
    ];
    for (const sel of candidates) {
      const els = bodyContainer.querySelectorAll(sel);
      if (els.length > 0) {
        const lines = Array.from(els)
          .map((el) => {
            const tsEl = el.querySelector('.segment-timestamp, [class*="timestamp"]');
            const ts = (tsEl?.textContent ?? '').trim();
            const txtEl = el.querySelector(
              '.segment-text, yt-formatted-string.segment-text, [class*="segment-text"]',
            );
            const text = (txtEl?.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (text && ts) return `[${ts}] ${text}`;
            if (text) return text;
            const all = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (!all) return '';
            const m = all.match(/^(\d{1,3}:\d{2}(?::\d{2})?)\s*(.+)$/);
            if (m) return `[${m[1]}] ${m[2]}`;
            return all;
          })
          .filter((t) => t.length > 0);
        if (lines.length > 0) return lines.join('\n');
      }
    }

    // Fallback: use textContent (works regardless of visibility), regex-split timestamps
    const raw = (bodyContainer.textContent ?? '').trim();
    if (!raw) return '';

    return raw
      .replace(/文字音声変換を検索|文字起こし|Search transcript|Transcript/gi, '')
      .replace(/(\d{1,3}:\d{2}(?::\d{2})?)\s*/g, '\n[$1] ')
      .replace(/^\n+/, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ ]+/g, '\n')
      .replace(/\n+/g, '\n')
      .trim();
  };

  // Always apply hide style during the entire operation so the panel never flashes
  // visible regardless of its previous state (including leftover from failed close).
  const hideStyle = document.createElement('style');
  hideStyle.textContent = `
    ytd-engagement-panel-section-list-renderer[target-id*="transcript"] {
      visibility: hidden !important;
      position: fixed !important;
      top: -10000px !important;
      left: -10000px !important;
      width: 400px !important;
      height: 600px !important;
      pointer-events: none !important;
      z-index: -1 !important;
    }
  `;
  document.head.appendChild(hideStyle);

  const findCloseBtn = (root: HTMLElement): HTMLElement | null =>
    root.querySelector<HTMLElement>('[aria-label="閉じる"]') ??
    root.querySelector<HTMLElement>('[aria-label="Close"]') ??
    root.querySelector<HTMLElement>('[aria-label*="close" i]') ??
    root.querySelector<HTMLElement>('yt-icon-button#dismiss-button button') ??
    root.querySelector<HTMLElement>('#dismiss-button');

  try {
    let panel = findPanel();
    const wasAlreadyOpen = panel != null && isVisible(panel);

    if (!wasAlreadyOpen) {
      const buttons = Array.from(document.querySelectorAll('button, tp-yt-paper-button'));
      let transcriptBtn: HTMLElement | null = null;
      for (const b of buttons) {
        const aria = (b.getAttribute('aria-label') ?? '').toLowerCase();
        if (aria.includes('transcript') || aria.includes('文字起こし')) {
          transcriptBtn = b as HTMLElement;
          break;
        }
      }
      if (!transcriptBtn) {
        for (const b of buttons) {
          const text = (b.textContent ?? '').trim().toLowerCase();
          if (
            text.includes('show transcript') ||
            text.includes('文字起こしを表示') ||
            text === 'transcript' ||
            text === '文字起こし'
          ) {
            transcriptBtn = b as HTMLElement;
            break;
          }
        }
      }

      if (!transcriptBtn) {
        return {
          ok: false,
          code: 'NO_SUBTITLE',
          detail: 'Transcript button not found (transcript may not be available)',
        };
      }

      transcriptBtn.click();
    }

    // Wait for panel to populate with content (textContent works under hide style)
    const startTime = Date.now();
    let lastLen = 0;
    while (Date.now() - startTime < 8000) {
      panel = findPanel();
      if (panel) {
        const len = (panel.textContent ?? '').length;
        if (len > 200 && len === lastLen) break;
        lastLen = len;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    if (!panel) {
      return { ok: false, code: 'FETCH_FAILED', detail: 'Transcript panel not found after click' };
    }

    const text = extractText(panel);
    if (!text || text.length < 10) {
      return {
        ok: false,
        code: 'FETCH_FAILED',
        detail: `Transcript panel content too short (${text.length} chars)`,
      };
    }

    // Always attempt to close so leftovers are cleaned up. If user had it open and
    // we close it, the trade-off is acceptable vs. having stale panels accumulate.
    const closeBtn = findCloseBtn(panel);
    if (closeBtn) {
      closeBtn.click();
      await new Promise((r) => setTimeout(r, 300));
    }

    return {
      ok: true,
      text,
      languageCode: bestTrack?.languageCode ?? 'unknown',
      title: videoTitle,
      videoId,
    };
  } finally {
    hideStyle.remove();
  }
};

const runSummarize = async (
  subtitle: string,
  mode: 'short' | 'detailed',
  title: string,
): Promise<SummaryResult> => {
  const settings = await loadSettings();
  const provider = settings.activeProvider;
  const cred = settings.providers[provider];

  if (!cred.apiKey) {
    return { type: 'SUMMARY_ERROR', code: 'NO_API_KEY' };
  }

  let client: LLMClient;
  if (provider === 'claude') {
    client = new ClaudeClient();
  } else {
    return {
      type: 'SUMMARY_ERROR',
      code: 'OTHER',
      message: `Provider not yet implemented: ${provider}`,
    };
  }

  const prompt = buildPrompt(subtitle, mode, title);
  try {
    const result = await client.summarize({
      prompt,
      apiKey: cred.apiKey,
      model: cred.model,
    });
    if (!result.text) {
      return { type: 'SUMMARY_ERROR', code: 'OTHER', message: 'Empty response from LLM' };
    }
    return { type: 'SUMMARY_RESULT', markdown: result.text };
  } catch (err) {
    if (err instanceof LLMError) {
      return {
        type: 'SUMMARY_ERROR',
        code: err.toUserCode(),
        message: `HTTP ${err.status}: ${err.body.slice(0, 200)}`,
      };
    }
    return {
      type: 'SUMMARY_ERROR',
      code: 'NETWORK',
      message: err instanceof Error ? err.message : String(err),
    };
  }
};

const runExtraction = async (
  tabId: number,
  expectedVideoId: string,
): Promise<SubtitleResult> => {
  try {
    const [exec] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: extractAndFetchInPage,
    });
    const r = exec?.result;
    if (!r) {
      return {
        type: 'SUBTITLE_ERROR',
        code: 'EXTRACT_FAILED',
        message: 'No result from injected script',
      };
    }
    if (r.ok) {
      if (r.videoId && r.videoId !== expectedVideoId) {
        return {
          type: 'SUBTITLE_ERROR',
          code: 'VIDEO_CHANGED',
          message: `expected=${expectedVideoId}, actual=${r.videoId}`,
        };
      }
      return {
        type: 'SUBTITLE_RESULT',
        text: r.text,
        languageCode: r.languageCode,
        title: r.title,
      };
    }
    if (r.code === 'NO_SUBTITLE' || r.code === 'NO_PLAYER_RESPONSE') {
      return { type: 'SUBTITLE_ERROR', code: 'NO_SUBTITLE', message: r.detail };
    }
    return { type: 'SUBTITLE_ERROR', code: 'FETCH_FAILED', message: r.detail };
  } catch (err) {
    return {
      type: 'SUBTITLE_ERROR',
      code: 'EXTRACT_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }
};

chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  if (msg.type === 'OPEN_SIDEPANEL_AND_SUMMARIZE') {
    const tabId = sender.tab?.id;
    if (tabId == null) return false;
    pending = { videoId: msg.videoId, tabId, createdAt: Date.now() };
    chrome.sidePanel.open({ tabId }).catch((err: unknown) => {
      console.error('[bg] sidePanel.open failed:', err);
    });
    const broadcast: Message = { type: 'NEW_REQUEST', pending };
    chrome.runtime.sendMessage(broadcast).catch(() => {
      // No receivers (sidepanel not open yet); it will query GET_PENDING_REQUEST on load
    });
    return false;
  }

  if (msg.type === 'GET_PENDING_REQUEST') {
    sendResponse(pending);
    pending = null;
    return false;
  }

  if (msg.type === 'EXTRACT_SUBTITLE') {
    runExtraction(msg.tabId, msg.expectedVideoId)
      .then((result) => sendResponse(result))
      .catch((err: unknown) => {
        sendResponse({
          type: 'SUBTITLE_ERROR',
          code: 'EXTRACT_FAILED',
          message: err instanceof Error ? err.message : String(err),
        } satisfies SubtitleResult);
      });
    return true;
  }

  if (msg.type === 'SUMMARIZE') {
    runSummarize(msg.subtitle, msg.mode, msg.title)
      .then((result) => sendResponse(result))
      .catch((err: unknown) => {
        sendResponse({
          type: 'SUMMARY_ERROR',
          code: 'OTHER',
          message: err instanceof Error ? err.message : String(err),
        } satisfies SummaryResult);
      });
    return true;
  }

  return false;
});
