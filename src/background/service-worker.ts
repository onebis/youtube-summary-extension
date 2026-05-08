import type { Message, PendingRequest, SubtitleResult } from '../types/messages';

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
  | { ok: true; text: string; languageCode: string }
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
      videoDetails?: { defaultAudioLanguage?: string };
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
    // Try specific element selectors first (older YouTube DOM)
    const candidates = [
      'ytd-transcript-segment-renderer',
      'yt-transcript-segment-renderer',
      'ytd-transcript-segment-list-renderer ytd-transcript-segment-renderer',
    ];
    for (const sel of candidates) {
      const els = panel.querySelectorAll(sel);
      if (els.length > 0) {
        const txt = Array.from(els)
          .map((el) => {
            const seg = el.querySelector(
              '.segment-text, yt-formatted-string.segment-text, [class*="segment-text"]',
            );
            return (seg?.textContent ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
          })
          .filter((t) => t.length > 0)
          .join(' ');
        if (txt) return txt;
      }
    }
    // Fallback: take panel text and strip timestamps + search box label
    const bodyContainer =
      panel.querySelector<HTMLElement>('#body') ??
      panel.querySelector<HTMLElement>('ytd-transcript-renderer') ??
      panel.querySelector<HTMLElement>('ytd-transcript-search-panel-renderer') ??
      panel;
    return (bodyContainer.textContent ?? '')
      .replace(/\b\d{1,3}:\d{2}(?::\d{2})?\b/g, ' ')
      .replace(/文字音声変換を検索|文字起こし|Search transcript|Transcript/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  let panel = findPanel();
  const wasAlreadyOpen = panel != null && isVisible(panel);
  let hideStyle: HTMLStyleElement | null = null;

  try {
    if (!wasAlreadyOpen) {
      hideStyle = document.createElement('style');
      hideStyle.textContent = `
        ytd-engagement-panel-section-list-renderer[target-id*="transcript"] {
          visibility: hidden !important;
          position: fixed !important;
          top: -10000px !important;
          left: -10000px !important;
          width: 400px !important;
          height: 600px !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(hideStyle);

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

    // Wait for panel to populate with content
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

    // Close the panel we opened, leaving panel state as before
    if (!wasAlreadyOpen) {
      const closeBtn = panel.querySelector<HTMLElement>(
        'button[aria-label="Close"], button[aria-label="閉じる"], button[aria-label*="close" i], button#dismiss-button',
      );
      if (closeBtn) {
        closeBtn.click();
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    return {
      ok: true,
      text,
      languageCode: bestTrack?.languageCode ?? 'unknown',
    };
  } finally {
    if (hideStyle) hideStyle.remove();
  }
};

const runExtraction = async (tabId: number): Promise<SubtitleResult> => {
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
      return { type: 'SUBTITLE_RESULT', text: r.text, languageCode: r.languageCode };
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
    return false;
  }

  if (msg.type === 'EXTRACT_SUBTITLE') {
    runExtraction(msg.tabId)
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

  return false;
});
