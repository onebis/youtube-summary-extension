import type { LLMClient, LLMRequest, LLMResponse } from './index';
import { LLMError } from './index';

type ClaudeMessageResponse = {
  content?: Array<{ type: string; text?: string }>;
};

export class ClaudeClient implements LLMClient {
  async summarize({ prompt, apiKey, model }: LLMRequest): Promise<LLMResponse> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new LLMError(res.status, body);
    }

    const data = (await res.json()) as ClaudeMessageResponse;
    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    return { text };
  }
}
