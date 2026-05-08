import type { LLMClient, LLMRequest, LLMResponse } from './index';
import { LLMError } from './index';

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export class GeminiClient implements LLMClient {
  async summarize({ prompt, apiKey, model }: LLMRequest): Promise<LLMResponse> {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
      `:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new LLMError(res.status, body);
    }

    const data = (await res.json()) as GeminiResponse;
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return { text };
  }
}
