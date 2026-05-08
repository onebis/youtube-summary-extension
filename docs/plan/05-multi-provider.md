# M5: マルチプロバイダ対応

## 目的

OpenAI と Gemini のクライアントを追加し、オプションページで3プロバイダのキー・モデル・アクティブ選択を管理できるようにする。

## スコープ

- ✅ `OpenAIClient` 実装
- ✅ `GeminiClient` 実装
- ✅ オプションページに3プロバイダ分のセクション
- ✅ アクティブプロバイダ切替UI（ラジオボタン）
- ✅ エラーハンドリングの統一（各APIのHTTPステータスを共通コードへ正規化）
- ❌ プロンプトの英語版は M6

## タスク分解

### 1. OpenAI クライアント

`src/lib/llm/openai.ts`:

```ts
import type { LLMClient, LLMRequest, LLMResponse } from './index';
import { LLMError } from './claude';

export class OpenAIClient implements LLMClient {
  async summarize({ prompt, apiKey, model }: LLMRequest): Promise<LLMResponse> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
      }),
    });
    if (!res.ok) throw new LLMError(res.status, await res.text());
    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }
}
```

### 2. Gemini クライアント

`src/lib/llm/gemini.ts`:

```ts
import type { LLMClient, LLMRequest, LLMResponse } from './index';
import { LLMError } from './claude';

export class GeminiClient implements LLMClient {
  async summarize({ prompt, apiKey, model }: LLMRequest): Promise<LLMResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096 },
      }),
    });
    if (!res.ok) throw new LLMError(res.status, await res.text());
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text).join('') ?? '';
    return {
      text,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}
```

> ⚠️ Gemini はAPIキーをURLクエリで渡す仕様。ログ・DevToolsのNetworkタブにキーが残るので、開発時のみコンソール出力を抑制する。

### 3. ファクトリ更新

`src/lib/llm/index.ts`:

```ts
import { ClaudeClient } from './claude';
import { OpenAIClient } from './openai';
import { GeminiClient } from './gemini';

export const getClient = (provider: 'claude' | 'openai' | 'gemini'): LLMClient => {
  switch (provider) {
    case 'claude': return new ClaudeClient();
    case 'openai': return new OpenAIClient();
    case 'gemini': return new GeminiClient();
  }
};
```

### 4. オプションページの完全版

`src/options/options.html`:

```html
<form id="form">
  <section>
    <h2>プロバイダ選択</h2>
    <label><input type="radio" name="provider" value="claude" /> Claude</label>
    <label><input type="radio" name="provider" value="openai" /> OpenAI</label>
    <label><input type="radio" name="provider" value="gemini" /> Gemini</label>
  </section>

  <details>
    <summary>Claude API</summary>
    <label>API Key <input type="password" id="claude-key" /></label>
    <label>Model <input type="text" id="claude-model" /></label>
  </details>

  <details>
    <summary>OpenAI API</summary>
    <label>API Key <input type="password" id="openai-key" /></label>
    <label>Model <input type="text" id="openai-model" /></label>
  </details>

  <details>
    <summary>Gemini API</summary>
    <label>API Key <input type="password" id="gemini-key" /></label>
    <label>Model <input type="text" id="gemini-model" /></label>
  </details>

  <button type="submit">保存</button>
  <p id="status" aria-live="polite"></p>
</form>
```

`src/options/options.ts`:
- 起動時に `loadSettings()` から3プロバイダ全部復元
- submit 時に3プロバイダ分まとめて保存
- `activeProvider` のラジオボタン状態を反映/保存

### 5. エラーコード正規化

`src/lib/llm/error.ts`:

```ts
export class LLMError extends Error {
  constructor(public status: number, public body: string) {
    super(`LLM API error: ${status}`);
  }
  toUserCode(): 'INVALID_KEY' | 'RATE_LIMIT' | 'CONTEXT_OVERFLOW' | 'OTHER' {
    if (this.status === 401 || this.status === 403) return 'INVALID_KEY';
    if (this.status === 429) return 'RATE_LIMIT';
    if (this.status === 400 && /token|context|length/i.test(this.body)) return 'CONTEXT_OVERFLOW';
    return 'OTHER';
  }
}
```

`claude.ts` の `LLMError` をこれに置き換え、3クライアント共通で使う。

### 6. background のエラー判定

```ts
} catch (e: any) {
  if (e instanceof LLMError) {
    sendResponse({ type: 'ERROR', code: e.toUserCode(), status: e.status });
  } else {
    sendResponse({ type: 'ERROR', code: 'NETWORK', message: e.message });
  }
}
```

### 7. host_permissions 確認

[`SPEC §4.3`](../../SPEC.md#43-manifestjson抜粋) に記載済み。M5でM4で外していた場合は有効化:

```json
"host_permissions": [
  "https://www.youtube.com/*",
  "https://api.anthropic.com/*",
  "https://api.openai.com/*",
  "https://generativelanguage.googleapis.com/*"
]
```

## 完了条件

1. オプションページで3プロバイダの設定が保存・復元できる
2. アクティブプロバイダを切り替えると、要約呼び出し先が変わる
3. 3プロバイダすべてで同じ動画から要約結果が得られる
4. APIキー誤りや不正なモデル名で適切なエラー表示が出る

## 動作確認手順

1. 3プロバイダのキーを順に設定し、それぞれをアクティブにして要約実行
2. それぞれで同じ動画で要約が成功することを確認
3. モデル名を意図的に存在しない名前に変更 → 適切なエラー（INVALID_MODELなど）が表示されること
4. オプションを開き直して、設定が永続化されていることを確認

## リスク / 注意点

- **OpenAIのモデル名変更**: `gpt-4o` は時期によりエイリアス挙動が変わるので、テキスト入力で上書きできる現在の方針を維持する
- **Gemini APIキーの露出**: URLクエリ方式なのでログ流出注意。Network タブをスクショする時等に注意喚起する
- **エラーレスポンスのスキーマ差**: 各社で本文の構造が違う。`LLMError.body` は文字列のまま保持し、UI 側で詳細表示はせずユーザーコードでメッセージを切替える
- **CORS preflight**: 各APIは現状 OPTIONS をスキップできる単純リクエストにしているが、ヘッダ追加時は preflight が走るので注意

## 参考

- [OpenAI API Reference - Chat Completions](https://platform.openai.com/docs/api-reference/chat)
- [Gemini API - generateContent](https://ai.google.dev/api/generate-content)
