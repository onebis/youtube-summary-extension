export type PendingRequest = {
  videoId: string;
  tabId: number;
  createdAt: number;
};

export type SubtitleResult =
  | { type: 'SUBTITLE_RESULT'; text: string; languageCode: string; title: string }
  | {
      type: 'SUBTITLE_ERROR';
      code: 'NO_SUBTITLE' | 'FETCH_FAILED' | 'EXTRACT_FAILED' | 'VIDEO_CHANGED';
      message?: string;
    };

export type SummaryResult =
  | { type: 'SUMMARY_RESULT'; markdown: string }
  | {
      type: 'SUMMARY_ERROR';
      code:
        | 'NO_API_KEY'
        | 'INVALID_KEY'
        | 'RATE_LIMIT'
        | 'CONTEXT_OVERFLOW'
        | 'OVERLOADED'
        | 'CANCELLED'
        | 'NETWORK'
        | 'OTHER';
      message?: string;
    };

import type { SummaryMode } from './index';

export type Message =
  | { type: 'OPEN_SIDEPANEL_AND_SUMMARIZE'; videoId: string }
  | { type: 'GET_PENDING_REQUEST' }
  | { type: 'NEW_REQUEST'; pending: PendingRequest }
  | { type: 'EXTRACT_SUBTITLE'; tabId: number; expectedVideoId: string }
  | {
      type: 'SUMMARIZE';
      subtitle: string;
      mode: SummaryMode;
      title: string;
      outputLanguage: 'ja' | 'en';
      videoId: string;
    }
  | { type: 'VIDEO_NAVIGATED'; videoId: string }
  | { type: 'CANCEL_SUMMARIZE' }
  | { type: 'STREAM_START'; videoId: string }
  | { type: 'SUMMARY_CHUNK'; videoId: string; text: string };
