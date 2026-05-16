# M4: Claude API統合（End-to-End要約）

## 目的

字幕プレーンテキストを Claude API に投げ、構造化された日本語要約をサイドパネルに Markdown 表示する。
1プロバイダ（Claude）のみで End-to-End の要約フローを完成させる。

## スコープ

- ✅ オプションページに Claude APIキー入力欄
- ✅ `chrome.storage.local` のラッパ
- ✅ プロンプトテンプレート（日本語版）
- ✅ Claude API クライアント
- ✅ サイドパネルでの Markdown レンダリング
- ✅ 主要エラー（401/429/トークン超過/ネットワーク）の表示
- ❌ OpenAI / Gemini は M5
- ❌ 英語出力は M6
- ❌ 再生成・コピーボタンは M7

## タスク分解

### 1. ストレージラッパ

`src/lib/storage.ts`:

```ts
import type { StorageSchema } from '../types';

const DEFAULTS: StorageSchema = {
  activeProvider: 'claude',
  providers: {
    claude:  { apiKey: '', model: 'claude-sonnet-4-6' },
    openai:  { apiKey: '', model: 'gpt-4o' },
    gemini:  { apiKey: '', model: 'gemini-2.5-flash' },
  },
  uiLanguage: 'auto',
  outputLanguage: 'ja',
};

export const loadSettings = async (): Promise<StorageSchema> => {
  const raw = await chrome.storage.local.get(null);
  return { ...DEFAULTS, ...raw } as StorageSchema;
};

export const saveSettings = async (patch: Partial<StorageSchema>) => {
  await chrome.storage.local.set(patch);
};
```

### 2. オプションページUI（M4ではClaudeのみ）

`src/options/options.html`:

```html
<form id="form">
  <fieldset>
    <legend>Claude API</legend>
    <label>API Key
      <input type="password" id="claude-key" autocomplete="off" />
    </label>
    <label>Model
      <input type="text" id="claude-model" />
    </label>
  </fieldset>
  <button type="submit">保存</button>
  <p id="status" aria-live="polite"></p>
</form>
```

`src/options/options.ts`:
- 起動時に `loadSettings()` で復元
- submit 時に `saveSettings()` → status を「保存しました」に更新（3秒で消す）

### 3. プロンプトテンプレート

`src/lib/prompt.ts`:

```ts
export const buildPrompt = (
  subtitle: string,
  outputLang: 'ja' | 'en'
): string => {
  const template = outputLang === 'ja'
    ? JA_TEMPLATE
    : EN_TEMPLATE;   // M6で実装

  return `${template}\n\n--- 字幕本文 ---\n${subtitle}\n\nRespond in ${
    outputLang === 'ja' ? 'Japanese' : 'English'
  }.`;
};

const JA_TEMPLATE = `以下のYouTube動画字幕を日本語で要約してください。
出力は以下のMarkdown構造に厳密に従ってください。

# 概要
（動画全体の要点を2〜3文で）

# 主要ポイント
- ポイント1
- ポイント2
- …（5〜10項目）

# 結論 / Takeaway
（視聴者が持ち帰るべき要点を1〜2文で）`;

const EN_TEMPLATE = '...';  // M6
```

### 4. LLMクライアント基底

`src/lib/llm/index.ts`:

```ts
export type LLMRequest = {
  prompt: string;
  apiKey: string;
  model: string;
};

export type LLMResponse = {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
};

export interface LLMClient {
  summarize(req: LLMRequest): Promise<LLMResponse>;
}

import { ClaudeClient } from './claude';

export const getClient = (provider: 'claude' | 'openai' | 'gemini'): LLMClient => {
  switch (provider) {
    case 'claude': return new ClaudeClient();
    default: throw new Error(`Provider not implemented: ${provider}`);
  }
};
```

### 5. Claude クライアント

`src/lib/llm/claude.ts`:

```ts
import type { LLMClient, LLMRequest, LLMResponse } from './index';

export class ClaudeClient implements LLMClient {
  async summarize({ prompt, apiKey, model }: LLMRequest): Promise<LLMResponse> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',  // 拡張機能から直接呼ぶ場合に必要
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new LLMError(res.status, body);
    }

    const data = await res.json();
    return {
      text: data.content?.[0]?.text ?? '',
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
    };
  }
}

export class LLMError extends Error {
  constructor(public status: number, public body: string) {
    super(`LLM API error: ${status}`);
  }
}
```

> `anthropic-dangerous-direct-browser-access: true` が必要なのは、Anthropic API がブラウザ環境からの呼び出しをデフォルトで拒否するため。Chrome拡張からの BYOK 用途では許可される。

### 6. background での要約実行

```ts
import { loadSettings } from '../lib/storage';
import { getClient } from '../lib/llm';
import { buildPrompt } from '../lib/prompt';

if (msg.type === 'SUMMARIZE') {
  (async () => {
    try {
      const settings = await loadSettings();
      const provider = settings.activeProvider;
      const cred = settings.providers[provider];
      if (!cred.apiKey) {
        sendResponse({ type: 'ERROR', code: 'NO_API_KEY' });
        return;
      }
      const prompt = buildPrompt(msg.subtitle, settings.outputLanguage);
      const client = getClient(provider);
      const result = await client.summarize({
        prompt,
        apiKey: cred.apiKey,
        model: cred.model,
      });
      sendResponse({ type: 'SUMMARY_RESULT', markdown: result.text });
    } catch (e: any) {
      sendResponse({ type: 'ERROR', code: 'LLM_ERROR', message: e.message });
    }
  })();
  return true;
}
```

### 7. サイドパネルでのMarkdown表示

`marked` を依存追加し、`sidepanel.ts` で字幕取得後に SUMMARIZE を呼び、結果を `marked.parse()` でレンダリング。

```ts
import { marked } from 'marked';

const result = await chrome.runtime.sendMessage({ type: 'SUMMARIZE', subtitle });
if (result.type === 'SUMMARY_RESULT') {
  document.querySelector('#content')!.innerHTML = await marked.parse(result.markdown);
}
```

### 8. 主要エラー表示

[`SPEC §4.8`](../../SPEC.md#48-エラーハンドリング) のうち以下をM4で対応:

| エラーコード | 表示 |
|--------------|------|
| `NO_API_KEY` | オプションページへの誘導付きで通知 |
| `NO_SUBTITLE` | 「この動画には字幕がないため要約できません」 |
| `LLM_ERROR` (401) | 「APIキーが無効です。設定を確認してください」 |
| `LLM_ERROR` (429) | 「APIレート制限に達しました。少し待って再試行してください」 |
| `LLM_ERROR` (other) | 「要約の生成に失敗しました: {message}」 |

## 完了条件

1. オプションページで Claude APIキーを設定できる
2. ボタン押下→ サイドパネル → ローディング → 構造化された日本語要約が表示される
3. APIキー未設定時はオプションページへの誘導が出る
4. 不正なAPIキーで明示的なエラーが出る

## 動作確認手順

1. 有効な Claude APIキーをオプションページで設定
2. 字幕付き動画でボタン押下 → 要約が「概要・主要ポイント・結論」の構造で出る
3. APIキーを意図的に間違える → 401 エラーが日本語で表示される
4. APIキーを空にする → 設定ページへの誘導が出る
5. 字幕がない動画 → エラー文言が出る

## リスク / 注意点

- **CORS / Anthropic ヘッダ**: `anthropic-dangerous-direct-browser-access: true` を忘れない。`host_permissions` に `https://api.anthropic.com/*` が必要
- **トークン上限超過**: Claude Sonnet 4.6 は 1M トークン対応モデルがあるため大半は問題ないが、4096 で `max_tokens` を切ると出力が途切れる可能性あり。出力側は4096で十分（要約は短い）
- **APIキー取り扱い**: ログ・例外メッセージにキー本体が混入しないよう注意。`LLMError` のbody出力時にマスキング検討
- **marked の XSS**: LLM 出力をそのまま `innerHTML` に入れる。`marked` v9以降は安全だが念のため `DOMPurify` を検討

## 参考

- [Anthropic API: Messages](https://docs.anthropic.com/en/api/messages)
- [marked.js](https://marked.js.org/)
