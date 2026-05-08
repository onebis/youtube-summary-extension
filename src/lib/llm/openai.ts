import type { LLMClient, LLMRequest } from './index';
import { LLMError } from './index';

export class OpenAIClient implements LLMClient {
  async summarizeStream(
    { prompt, apiKey, model, signal }: LLMRequest,
    onChunk: (text: string) => void,
  ): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 16384,
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
        if (!data || data === '[DONE]') continue;
        try {
          const ev = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const text = ev.choices?.[0]?.delta?.content ?? '';
          if (text) {
            accumulated += text;
            onChunk(text);
          }
        } catch {
          // skip malformed
        }
      }
    }

    return accumulated;
  }
}
