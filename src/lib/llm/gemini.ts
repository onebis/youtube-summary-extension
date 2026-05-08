import type { LLMClient, LLMRequest } from './index';
import { LLMError } from './index';

export class GeminiClient implements LLMClient {
  async summarizeStream(
    { prompt, apiKey, model, signal }: LLMRequest,
    onChunk: (text: string) => void,
  ): Promise<string> {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
      `:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 16384 },
      }),
      signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new LLMError(res.status, body);
    }
    if (!res.body) throw new Error('No response body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data) continue;
        try {
          const ev = JSON.parse(data) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> };
            }>;
          };
          const parts = ev.candidates?.[0]?.content?.parts ?? [];
          for (const p of parts) {
            const text = p.text ?? '';
            if (text) {
              accumulated += text;
              onChunk(text);
            }
          }
        } catch {
          // skip malformed
        }
      }
    }

    return accumulated;
  }
}
