export type PendingRequest = {
  videoId: string;
  tabId: number;
  createdAt: number;
};

export type SubtitleResult =
  | { type: 'SUBTITLE_RESULT'; text: string; languageCode: string }
  | {
      type: 'SUBTITLE_ERROR';
      code: 'NO_SUBTITLE' | 'FETCH_FAILED' | 'EXTRACT_FAILED';
      message?: string;
    };

export type Message =
  | { type: 'OPEN_SIDEPANEL_AND_SUMMARIZE'; videoId: string }
  | { type: 'GET_PENDING_REQUEST' }
  | { type: 'NEW_REQUEST'; pending: PendingRequest }
  | { type: 'EXTRACT_SUBTITLE'; tabId: number };
