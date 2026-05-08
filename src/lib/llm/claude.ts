import type { LLMClient, LLMRequest } from './index';
import { LLMError } from './index';

export class ClaudeClient implements LLMClient {
  async summarizeStream(
    { prompt, apiKey, model, signal }: LLMRequest,
    onChunk: (text: string) => void,
  ): Promise<string> {
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
        stream: true,
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
            type?: string;
            delta?: { type?: string; text?: string };
            error?: { type?: string; message?: string };
          };
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            const text = ev.delta.text ?? '';
            if (text) {
              accumulated += text;
              onChunk(text);
            }
          } else if (ev.type === 'error' && ev.error) {
            throw new LLMError(
              500,
              JSON.stringify(ev.error),
            );
          }
        } catch (err) {
          if (err instanceof LLMError) throw err;
          // skip malformed event
        }
      }
    }

    return accumulated;
  }
}
