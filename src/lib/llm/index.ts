export type LLMRequest = {
  prompt: string;
  apiKey: string;
  model: string;
  signal?: AbortSignal;
};

export type LLMResponse = {
  text: string;
};

export interface LLMClient {
  summarize(req: LLMRequest): Promise<LLMResponse>;
}

export type LLMUserCode =
  | 'INVALID_KEY'
  | 'RATE_LIMIT'
  | 'CONTEXT_OVERFLOW'
  | 'OVERLOADED'
  | 'OTHER';

export class LLMError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`LLM API error: ${status}`);
  }
  toUserCode(): LLMUserCode {
    if (this.status === 401 || this.status === 403) return 'INVALID_KEY';
    if (this.status === 429) return 'RATE_LIMIT';
    if (this.status === 529 || this.status === 503 || this.status === 502) {
      return 'OVERLOADED';
    }
    if (this.status === 400 && /token|context|length|too\s*long/i.test(this.body)) {
      return 'CONTEXT_OVERFLOW';
    }
    if (this.status >= 500 && /overloaded/i.test(this.body)) return 'OVERLOADED';
    return 'OTHER';
  }
  isTransient(): boolean {
    return this.status === 529 || this.status === 503 || this.status === 502;
  }
}
