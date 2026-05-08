# M7: UX改善

## 目的

要約結果の使い勝手を上げる小機能と、ロード/エラー状態のフィードバック、動画切替時の体験を磨く。
[`SPEC §2.1 F-05/F-06`](../../SPEC.md#21-コア機能) と [`§5.2`](../../SPEC.md#52-サイドパネル幅-ユーザー任意推奨400px) の残タスク。

## スコープ

- ✅ コピーボタン（クリップボード）
- ✅ 再生成ボタン（同じ字幕を再要約）
- ✅ ローディング表示（スケルトンUI）
- ✅ エラー表示UI（[`§4.8`](../../SPEC.md#48-エラーハンドリング)全ケース）
- ✅ 動画切替検知 → サイドパネルでの再要約CTA
- ✅ サイドパネルのスタイル最終調整

## タスク分解

### 1. コピーボタン

`src/sidepanel/sidepanel.ts`:

```ts
const onCopyClick = async () => {
  const md = currentSummary.markdown;  // 直近の要約Markdownを保持
  await navigator.clipboard.writeText(md);
  showToast(t('copiedToast'));   // 「コピーしました」
};
```

`_locales/*/messages.json` に `copiedToast` を追加。

### 2. 再生成ボタン

```ts
const onRegenerateClick = async () => {
  if (!currentSubtitle) return;
  const lang = currentOutputLang;  // 現在のドロップダウン値
  await runSummarize(currentSubtitle, lang);
};
```

サイドパネル起動時に取得した字幕は `currentSubtitle` として保持しておき、APIキー再呼び出しのみ行う（字幕の再フェッチは不要）。

### 3. ローディングUI

CSS で簡易スケルトン:

```css
.skeleton-line {
  height: 12px;
  background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  margin: 8px 0;
}
@keyframes shimmer {
  0%   { background-position: -200% 0 }
  100% { background-position: 200% 0 }
}
```

ローディング中は `#content` の中身をスケルトン3〜5本に置換。

### 4. エラー表示の統一

`src/sidepanel/error-view.ts`:

```ts
type ErrorCode =
  | 'NO_SUBTITLE' | 'NO_API_KEY' | 'INVALID_KEY'
  | 'RATE_LIMIT' | 'CONTEXT_OVERFLOW' | 'NETWORK' | 'OTHER';

const messageKey: Record<ErrorCode, string> = {
  NO_SUBTITLE:        'errorNoSubtitle',
  NO_API_KEY:         'errorNoApiKey',
  INVALID_KEY:        'errorInvalidKey',
  RATE_LIMIT:         'errorRateLimit',
  CONTEXT_OVERFLOW:   'errorContextOverflow',
  NETWORK:            'errorNetwork',
  OTHER:              'errorGeneric',
};

export const renderError = (code: ErrorCode, detail?: string) => {
  const container = document.querySelector('#content')!;
  container.innerHTML = `
    <div class="error">
      <p>${t(messageKey[code])}</p>
      ${detail ? `<details><summary>詳細</summary><pre>${detail}</pre></details>` : ''}
      ${code === 'NO_API_KEY'
        ? `<button id="open-options">${t('openOptions')}</button>` : ''}
    </div>
  `;
  document.querySelector('#open-options')
    ?.addEventListener('click', () => chrome.runtime.openOptionsPage());
};
```

### 5. 動画切替検知

サイドパネルが開いている状態で YouTube 内の別動画に遷移した場合:
- content script が `yt-navigate-finish` で background に通知
- background がサイドパネルへ `VIDEO_CHANGED` メッセージを broadcast
- サイドパネルは現在の要約を保持したまま、上部に「新しい動画が選択されました [▶ 要約する]」のCTAを表示

```ts
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'VIDEO_CHANGED') {
    showVideoChangedBanner(msg.videoId, msg.title);
  }
});
```

CTAクリックで新規 `OPEN_SIDEPANEL_AND_SUMMARIZE` フローを起動。

### 6. サイドパネルの最終スタイル

[`SPEC §5.2`](../../SPEC.md#52-サイドパネル幅-ユーザー任意推奨400px) のモックに合わせる:

- ヘッダー（タイトル + 設定ボタン）固定
- 動画タイトル表示行
- 出力言語ドロップダウン
- 要約本文（Markdown）
- フッター（コピー / 再生成）固定

ライト/ダークモード両対応:

```css
:root {
  --bg: #ffffff;
  --text: #0f0f0f;
  --border: #e5e5e5;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f0f0f;
    --text: #f1f1f1;
    --border: #303030;
  }
}
```

### 7. キーボードショートカット（任意）

`Cmd/Ctrl + Enter` で再生成、`Cmd/Ctrl + C` （要約コピー）等。
ただし YouTube 側のショートカットと衝突しないよう、サイドパネル内フォーカス時のみ有効化。

## 完了条件

1. コピーボタンで Markdown 形式のままクリップボードへコピーされる
2. 再生成ボタンで字幕の再フェッチなしに新しい要約が表示される
3. ローディング中は明確なフィードバック（スケルトン）が出る
4. [`SPEC §4.8`](../../SPEC.md#48-エラーハンドリング) の全ケースが日本語/英語で適切な文言で表示される
5. 別動画に遷移すると CTA が出て、押下で新動画の要約に切り替わる
6. ダークモード時もコントラストが保たれている

## 動作確認手順

1. 要約後、コピーボタン → エディタへペーストしてMarkdownを確認
2. 再生成ボタンを連打しても字幕の再取得が走らないこと（DevTools Network）
3. APIキーを意図的に消す → エラー画面に「設定を開く」リンクが出ること
4. 動画ページ内で別動画をクリック → CTAバナーが現れること
5. ダーク/ライトモード切替で UI が崩れないこと

## リスク / 注意点

- **クリップボード権限**: `navigator.clipboard.writeText` はサイドパネルから呼ぶ場合、Permissions Policy で許可が必要。manifestに `permissions: ["clipboardWrite"]` を追加検討（必須ではないが警告抑止のため）
- **再生成での字幕保持**: メモリのみだとサイドパネルが閉じると消える。意図通り（[`SPEC §2.6`](../../SPEC.md#26-履歴機能)）
- **動画切替CTAの誤発火**: ユーザーが別タブを開いただけでも `yt-navigate-finish` は発火する場合あり。`videoId` が変わったときのみ通知する条件を追加
- **エラー詳細表示の情報漏洩**: `<details>` でAPIレスポンス本文を出すと、APIキーが含まれていないか確認すること（少なくとも Gemini はキーがクエリ文字列なので body には出ないはず）
