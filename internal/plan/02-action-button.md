# M2: アクションバーへの「🪄 要約」ボタン挿入

## 目的

YouTube動画ページの動画タイトル下のアクションバー（高評価/共有/保存の並び）に「🪄 要約」ボタンを動的に挿入し、押下でサイドパネルを開くまでの導線を実現する。
要約の中身（字幕取得・LLM）は M3 以降。

## スコープ

- ✅ YouTubeページ内へのボタン挿入と再描画への耐性
- ✅ ボタン押下 → サイドパネル起動（user gesture を保持）
- ✅ SPA 遷移時（動画切替）の挙動
- ❌ 字幕取得は M3
- ❌ 要約の生成・表示は M4

## タスク分解

### 1. content script のリファクタ

`src/content/content-script.ts` を「ロガーのみ」から、`action-button.ts` を呼び出す入口に変える。

```ts
import { mountActionButton } from './action-button';

const init = () => mountActionButton();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

### 2. ボタン挿入ロジック

`src/content/action-button.ts`:

```ts
const SELECTORS = [
  '#actions-inner #menu #top-level-buttons-computed',
  '#top-level-buttons-computed',  // フォールバック
];

const BUTTON_ID = 'yt-summary-trigger';

const findContainer = (): HTMLElement | null => {
  for (const sel of SELECTORS) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
};

const buildButton = (): HTMLButtonElement => {
  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.className = 'yt-summary-button';   // YouTube tonal-button 風の自前スタイル
  btn.innerHTML = `<span>🪄</span><span>要約</span>`;
  btn.addEventListener('click', onSummarizeClick);
  return btn;
};

const insert = () => {
  const container = findContainer();
  if (!container || container.querySelector(`#${BUTTON_ID}`)) return;
  container.appendChild(buildButton());
};

export const mountActionButton = () => {
  insert();

  // YouTubeのDOM再描画に耐えるためMutationObserverで再挿入
  const observer = new MutationObserver(() => insert());
  observer.observe(document.body, { childList: true, subtree: true });

  // SPA遷移検知（YouTubeのカスタムイベント）
  document.addEventListener('yt-navigate-finish', () => {
    setTimeout(insert, 200);  // DOM 構築完了を少し待つ
  });
};
```

### 3. ボタンスタイル

`src/content/action-button.css`:

```css
.yt-summary-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  height: 36px;
  border-radius: 18px;
  border: none;
  background-color: var(--yt-spec-badge-chip-background, rgba(0,0,0,0.05));
  color: var(--yt-spec-text-primary, #0f0f0f);
  font: 500 14px/36px "YouTube Sans", Roboto, sans-serif;
  cursor: pointer;
  margin-left: 8px;
  transition: background-color 0.1s;
}
.yt-summary-button:hover {
  background-color: var(--yt-spec-button-chip-background-hover, rgba(0,0,0,0.1));
}
@media (prefers-color-scheme: dark) {
  .yt-summary-button {
    background-color: rgba(255,255,255,0.1);
    color: #f1f1f1;
  }
  .yt-summary-button:hover {
    background-color: rgba(255,255,255,0.2);
  }
}
```

### 4. メッセージ送信

`src/types/messages.ts` を新設:

```ts
export type Message =
  | { type: 'OPEN_SIDEPANEL_AND_SUMMARIZE'; videoId: string; tabId?: number };
```

ボタンの `onSummarizeClick`:

```ts
const onSummarizeClick = async () => {
  const videoId = new URLSearchParams(location.search).get('v');
  if (!videoId) return;
  await chrome.runtime.sendMessage({
    type: 'OPEN_SIDEPANEL_AND_SUMMARIZE',
    videoId,
  });
};
```

### 5. background でサイドパネル起動

`src/background/service-worker.ts`:

```ts
chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  if (msg.type === 'OPEN_SIDEPANEL_AND_SUMMARIZE') {
    const tabId = sender.tab?.id;
    if (tabId == null) return;
    // user gesture 維持のため await はせず即時呼び出し
    chrome.sidePanel.open({ tabId });
    // M3で pending state を保持する
    sendResponse({ ok: true });
  }
  return true;
});
```

> ⚠️ `chrome.sidePanel.open()` は Chrome 116+ で `userGesture` を要求する。
> content script のクリックハンドラから即座に sendMessage → background で同期的に open を呼ぶことで gesture を保持できる。

## 完了条件

1. YouTube動画ページを開くと「🪄 要約」ボタンがアクションバーに表示される
2. 高評価・共有・保存ボタンと違和感のないスタイル（サイズ・色・ホバー）
3. ボタンを押すとサイドパネルが開く
4. 動画ページ内で別の動画に遷移してもボタンが表示され続ける（消えない）
5. 動画ページ以外（ホーム、検索結果）にはボタンが**挿入されない**
6. ダークモード時に背景・文字色が反転する

## 動作確認手順

1. `npm run build` 後、拡張機能をリロード
2. YouTube 動画ページを複数開いてボタンが表示されることを確認
3. 動画ページ内のサイドバーから別動画をクリック → ボタンが残ることを確認
4. ボタン押下 → サイドパネルが開くことを確認
5. ホームページ・検索結果ではボタンが出ないことを確認
6. Chrome の設定で外観をダークに切替 → ボタンの色が追従することを確認

## リスク / 注意点

- **YouTubeのDOM変更**: アクションバーのセレクタは時折変更される。複数のセレクタにフォールバックする実装にしておく。動かなくなった場合の調査手順を `lib/subtitle-fetcher.ts` のコメントにも残す
- **MutationObserver パフォーマンス**: `subtree: true` は重いので、可能なら `#primary-inner` 等に絞る
- **多重挿入防止**: `findContainer().querySelector(#BUTTON_ID)` で必ず存在チェック
- **user gesture 切れ**: `await` を挟むと gesture を失う。`open()` 呼び出しの直前に awaitを入れない

## 参考

- [Manifest V3 Service Worker - User Gestures](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers)
- YouTube DOM 監視パターンは `enhanced-h264ify` 等のOSSが参考になる
