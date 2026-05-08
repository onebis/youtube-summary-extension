import type { LLMClient, LLMRequest, LLMResponse } from './index';
import { LLMError } from './index';

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export class OpenAIClient implements LLMClient {
  async summarize({ prompt, apiKey, model }: LLMRequest): Promise<LLMResponse> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8192,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new LLMError(res.status, body);
    }

    const data = (await res.json()) as OpenAIChatResponse;
    const text = data.choices?.[0]?.message?.content ?? '';
    return { text };
  }
}
