import type {
  Message,
  PendingRequest,
  SubtitleResult,
  SummaryResult,
} from '../types/messages';
import type { SummaryMode } from '../types';
import { loadSettings } from '../lib/storage';
import { buildPrompt } from '../lib/prompt';
import { LLMError } from '../lib/llm';
import { getClient } from '../lib/llm/factory';

let pending: PendingRequest | null = null;
let activeSummarizeController: AbortController | null = null;

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
  const videoLang = player.videoDetails?.defaultAudioLanguage;
  const score = (t: (typeof tracks)[number]): number => {
    let s = 0;
    if (t.kind !== 'asr') s += 100;
    if (videoLang && t.languageCode === videoLang.split('-')[0]) s += 10;
    if (t.languageCode === 'en') s += 1;
    return s;
  };
  const bestTrack =
    tracks.length > 0 ? [...tracks].sort((a, b) => score(b) - score(a))[0] : null;

  // Hide ALL engagement panels during extraction. YouTube exposes transcripts in
  // different panels per video (dedicated `engagement-panel-searchable-transcript`
  // OR a tab inside `engagement-panel-structured-description`), so we can't target
  // by `target-id*="transcript"` alone. Hiding by visibility/opacity (not offscreen)
  // keeps elements in layout flow so YouTube's lazy loading still triggers.
  const hideStyle = document.createElement('style');
  hideStyle.textContent = `
    ytd-engagement-panel-section-list-renderer {
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(hideStyle);

  const findCloseBtn = (root: HTMLElement): HTMLElement | null =>
    root.querySelector<HTMLElement>('[aria-label="閉じる"]') ??
    root.querySelector<HTMLElement>('[aria-label="Close"]') ??
    root.querySelector<HTMLElement>('[aria-label*="close" i]') ??
    root.querySelector<HTMLElement>('yt-icon-button#dismiss-button button') ??
    root.querySelector<HTMLElement>('#dismiss-button');

  const findGlobalSegments = (): HTMLElement[] =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        'ytd-transcript-segment-renderer, yt-transcript-segment-renderer',
      ),
    );

  // Find any engagement panel whose textContent contains many timestamps
  // (transcript-with-chapters in the structured-description panel uses different
  // element names, so we fall back to panel-level text scraping).
  const TIMESTAMP_RE = /\d{1,3}:\d{2}(?::\d{2})?/g;
  const findPanelByTimestampDensity = (
    minCount: number,
  ): HTMLElement | null => {
    const panels = Array.from(
      document.querySelectorAll<HTMLElement>(
        'ytd-engagement-panel-section-list-renderer',
      ),
    );
    let best: HTMLElement | null = null;
    let bestCount = minCount;
    for (const p of panels) {
      const text = p.textContent ?? '';
      const count = (text.match(TIMESTAMP_RE) ?? []).length;
      if (count > bestCount) {
        bestCount = count;
        best = p;
      }
    }
    return best;
  };

  const extractFromPanelText = (panel: HTMLElement): string => {
    let text = panel.textContent ?? '';
    const firstTsIdx = text.search(/\d{1,3}:\d{2}/);
    if (firstTsIdx > 0) text = text.slice(firstTsIdx);
    return text
      .replace(/(\d{1,3}:\d{2}(?::\d{2})?)\s*秒?\s*/g, '\n[$1] ')
      .replace(/^\n+/, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ ]+/g, '\n')
      .replace(/\n+/g, '\n')
      .trim();
  };

  try {
    // If transcript was previously opened, segments may already be in DOM
    let segs = findGlobalSegments();

    if (segs.length === 0) {
      // Find and click any "transcript / 文字起こし" affordance
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
          detail: 'Transcript button not found',
        };
      }
      transcriptBtn.click();

      // Wait for transcript content. Accept either:
      //   (a) standard segment elements in DOM, or
      //   (b) any engagement panel that has many timestamps (>5)
      const startTime = Date.now();
      while (Date.now() - startTime < 12000) {
        segs = findGlobalSegments();
        if (segs.length > 0) {
          await new Promise((r) => setTimeout(r, 350));
          segs = findGlobalSegments();
          break;
        }
        if (findPanelByTimestampDensity(5)) {
          await new Promise((r) => setTimeout(r, 350));
          break;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    let extractedText = '';
    let containingPanel: HTMLElement | null = null;

    // Path 1: extraction from standard segment elements
    if (segs.length > 0) {
      const lines = segs
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
      extractedText = lines.join('\n');
      let walker: HTMLElement | null = segs[0] ?? null;
      while (walker && walker !== document.body) {
        if (walker.tagName === 'YTD-ENGAGEMENT-PANEL-SECTION-LIST-RENDERER') {
          containingPanel = walker;
          break;
        }
        walker = walker.parentElement;
      }
    }

    // Path 2: fallback to scraping panel textContent (handles transcript-in-tab cases
    // where YouTube uses a non-standard element for segments)
    if (!extractedText || extractedText.length < 10) {
      const panel = findPanelByTimestampDensity(5);
      if (panel) {
        extractedText = extractFromPanelText(panel);
        containingPanel = panel;
      }
    }

    if (!extractedText || extractedText.length < 10) {
      const allPanels = Array.from(
        document.querySelectorAll<HTMLElement>(
          'ytd-engagement-panel-section-list-renderer',
        ),
      );
      const allText = allPanels
        .map((p) => p.textContent ?? '')
        .join(' ')
        .toLowerCase();
      const noTranscriptHints = [
        'no transcript',
        'transcript is not available',
        'transcript unavailable',
        'transcript is disabled',
        '文字起こしを利用できません',
        '文字起こしがありません',
        '字幕がありません',
      ];
      if (noTranscriptHints.some((h) => allText.includes(h.toLowerCase()))) {
        return {
          ok: false,
          code: 'NO_SUBTITLE',
          detail: 'YouTube reports no transcript available',
        };
      }
      const sample = allPanels
        .map((p) => p.textContent ?? '')
        .join(' | ')
        .replace(/\s+/g, ' ')
        .slice(0, 200);
      return {
        ok: false,
        code: 'FETCH_FAILED',
        detail:
          `Could not extract transcript ` +
          `(segs=${segs.length}, panels=${allPanels.length}, ` +
          `extractedChars=${extractedText.length}). Sample: "${sample}"`,
      };
    }

    // Close the containing panel
    if (containingPanel) {
      const closeBtn = findCloseBtn(containingPanel);
      if (closeBtn) {
        closeBtn.click();
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    const text = extractedText;

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
  mode: SummaryMode,
  title: string,
  outputLanguage: 'ja' | 'en',
  videoId: string,
): Promise<SummaryResult> => {
  const settings = await loadSettings();
  const provider = settings.activeProvider;
  const cred = settings.providers[provider];

  if (!cred.apiKey) {
    return { type: 'SUMMARY_ERROR', code: 'NO_API_KEY' };
  }

  const client = getClient(provider);
  const prompt = buildPrompt(subtitle, mode, title, outputLanguage);

  // Abort any previous in-flight summarize and create a fresh controller
  if (activeSummarizeController) {
    activeSummarizeController.abort();
  }
  const controller = new AbortController();
  activeSummarizeController = controller;

  const broadcast = (msg: { type: 'STREAM_START' | 'SUMMARY_CHUNK'; videoId: string; text?: string }) => {
    chrome.runtime.sendMessage(msg).catch(() => {
      // No receivers, ignore
    });
  };

  const MAX_ATTEMPTS = 3;
  let lastErr: unknown = null;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (controller.signal.aborted) {
        return { type: 'SUMMARY_ERROR', code: 'CANCELLED', message: 'Cancelled by user' };
      }
      try {
        broadcast({ type: 'STREAM_START', videoId });
        const accumulated = await client.summarizeStream(
          {
            prompt,
            apiKey: cred.apiKey,
            model: cred.model,
            signal: controller.signal,
          },
          (chunk) => {
            if (controller.signal.aborted) return;
            broadcast({ type: 'SUMMARY_CHUNK', videoId, text: chunk });
          },
        );
        if (!accumulated) {
          return { type: 'SUMMARY_ERROR', code: 'OTHER', message: 'Empty response from LLM' };
        }
        return { type: 'SUMMARY_RESULT', markdown: accumulated };
      } catch (err) {
        lastErr = err;
        if (controller.signal.aborted) {
          return { type: 'SUMMARY_ERROR', code: 'CANCELLED', message: 'Cancelled by user' };
        }
        if (err instanceof LLMError && err.isTransient() && attempt < MAX_ATTEMPTS) {
          const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s...
          console.warn(
            `[bg] LLM transient error (HTTP ${err.status}), retrying in ${delayMs}ms (attempt ${attempt}/${MAX_ATTEMPTS})`,
          );
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, delayMs);
            controller.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                resolve();
              },
              { once: true },
            );
          });
          continue;
        }
        break;
      }
    }
  } finally {
    if (activeSummarizeController === controller) {
      activeSummarizeController = null;
    }
  }

  if (lastErr instanceof LLMError) {
    return {
      type: 'SUMMARY_ERROR',
      code: lastErr.toUserCode(),
      message: `HTTP ${lastErr.status}: ${lastErr.body.slice(0, 200)}`,
    };
  }
  return {
    type: 'SUMMARY_ERROR',
    code: 'NETWORK',
    message: lastErr instanceof Error ? lastErr.message : String(lastErr),
  };
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
    runSummarize(msg.subtitle, msg.mode, msg.title, msg.outputLanguage, msg.videoId)
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

  if (msg.type === 'CANCEL_SUMMARIZE') {
    if (activeSummarizeController) {
      activeSummarizeController.abort();
      activeSummarizeController = null;
    }
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
