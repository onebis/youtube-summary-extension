# M3: 字幕取得とサイドパネル表示

## 目的

ボタン押下からサイドパネルが開いて、その動画の字幕プレーンテキストを表示するところまでを End-to-End で繋ぐ。
この時点ではまだ LLM 要約は行わず、**生の字幕**を表示する。

## スコープ

- ✅ `ytInitialPlayerResponse` から字幕トラック情報を抽出
- ✅ 字幕トラックの優先順位選択（手動 > 自動生成、元言語 > 英語 > その他）
- ✅ json3 形式の字幕を fetch・パースしてプレーンテキスト化
- ✅ サイドパネル起動と字幕取得の同時開始（pending state）
- ✅ サイドパネルに字幕本文を表示
- ❌ LLM 要約は M4

## タスク分解

### 1. 字幕抽出の content script 拡張

`src/lib/subtitle-fetcher.ts`:

```ts
type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  kind?: string;          // 'asr' なら自動生成
  name?: { simpleText?: string };
};

export const extractCaptionTracks = (): CaptionTrack[] => {
  // 方法1: window.ytInitialPlayerResponse をそのまま読む
  const w = window as any;
  if (w.ytInitialPlayerResponse) {
    return w.ytInitialPlayerResponse.captions
      ?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  }

  // 方法2: <script> タグから ytInitialPlayerResponse を正規表現抽出
  const scripts = document.querySelectorAll('script');
  for (const s of scripts) {
    const match = s.textContent?.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        return data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      } catch { /* fallthrough */ }
    }
  }
  return [];
};

export const pickBestTrack = (
  tracks: CaptionTrack[],
  videoLang?: string
): CaptionTrack | null => {
  if (tracks.length === 0) return null;
  const isManual = (t: CaptionTrack) => t.kind !== 'asr';

  const ranked = [...tracks].sort((a, b) => {
    const score = (t: CaptionTrack) => {
      let s = 0;
      if (isManual(t)) s += 100;
      if (videoLang && t.languageCode === videoLang) s += 10;
      if (t.languageCode === 'en') s += 1;
      return s;
    };
    return score(b) - score(a);
  });
  return ranked[0];
};

export const fetchSubtitle = async (track: CaptionTrack): Promise<string> => {
  const url = track.baseUrl + '&fmt=json3';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Subtitle fetch failed: ${res.status}`);
  const json = await res.json() as { events?: Array<{ segs?: Array<{ utf8?: string }> }> };
  const text = (json.events ?? [])
    .flatMap(e => e.segs ?? [])
    .map(s => s.utf8 ?? '')
    .join('');
  return text.replace(/\n+/g, ' ').trim();
};
```

### 2. メッセージ型の追加

`src/types/messages.ts`:

```ts
export type Message =
  | { type: 'OPEN_SIDEPANEL_AND_SUMMARIZE'; videoId: string }
  | { type: 'GET_PENDING_REQUEST' }
  | { type: 'FETCH_SUBTITLE'; tabId: number };

export type Response =
  | { type: 'PENDING_REQUEST'; videoId: string | null; tabId: number | null }
  | { type: 'SUBTITLE_RESULT'; text: string; languageCode: string }
  | { type: 'ERROR'; message: string };
```

### 3. background の pending state

```ts
type Pending = { videoId: string; tabId: number; createdAt: number };
let pending: Pending | null = null;

chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  if (msg.type === 'OPEN_SIDEPANEL_AND_SUMMARIZE') {
    const tabId = sender.tab?.id;
    if (tabId == null) return;
    pending = { videoId: msg.videoId, tabId, createdAt: Date.now() };
    chrome.sidePanel.open({ tabId });
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === 'GET_PENDING_REQUEST') {
    sendResponse({ type: 'PENDING_REQUEST', ...pending });
    pending = null;  // 一度返したらクリア
    return;
  }

  if (msg.type === 'FETCH_SUBTITLE') {
    chrome.tabs.sendMessage(msg.tabId, { type: 'EXTRACT_SUBTITLE' })
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ type: 'ERROR', message: err.message }));
    return true;  // 非同期
  }
});
```

### 4. content script の字幕抽出ハンドラ

```ts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'EXTRACT_SUBTITLE') {
    (async () => {
      try {
        const tracks = extractCaptionTracks();
        const videoLang = (window as any).ytInitialPlayerResponse
          ?.videoDetails?.defaultAudioLanguage;
        const track = pickBestTrack(tracks, videoLang);
        if (!track) {
          sendResponse({ type: 'ERROR', message: 'NO_SUBTITLE' });
          return;
        }
        const text = await fetchSubtitle(track);
        sendResponse({
          type: 'SUBTITLE_RESULT',
          text,
          languageCode: track.languageCode,
        });
      } catch (e: any) {
        sendResponse({ type: 'ERROR', message: e.message });
      }
    })();
    return true;
  }
});
```

### 5. サイドパネルの初期化

`src/sidepanel/sidepanel.ts`:

```ts
const main = async () => {
  const pending = await chrome.runtime.sendMessage({ type: 'GET_PENDING_REQUEST' });
  if (!pending?.tabId) {
    showEmptyState();
    return;
  }
  showLoading();
  const result = await chrome.runtime.sendMessage({
    type: 'FETCH_SUBTITLE',
    tabId: pending.tabId,
  });
  if (result.type === 'ERROR') {
    showError(result.message);
    return;
  }
  // M3ではプレーンテキストを表示
  document.querySelector('#content')!.textContent = result.text;
};

main();
```

`sidepanel.html`:

```html
<div class="sidepanel">
  <header>
    <h1>🪄 YouTube要約</h1>
    <button id="settings-btn">⚙</button>
  </header>
  <main>
    <div id="content">表示する内容がありません</div>
  </main>
</div>
```

### 6. エラーケースの最低限の対応

- `NO_SUBTITLE` → 「この動画には字幕がないため要約できません」
- ネットワークエラー → 「字幕の取得に失敗しました」

## 完了条件

1. 「🪄 要約」ボタン → サイドパネル → 字幕プレーンテキストが流れる
2. 字幕がない動画ではエラーメッセージが表示される
3. 自動生成字幕しかない動画でも取得できる
4. 動画ページに戻って別動画を開いてボタンを押すと、新しい動画の字幕に切り替わる

## 動作確認手順

1. 字幕付き動画（手動字幕）で実行 → サイドパネルに本文が出る
2. 自動生成字幕のみの動画で実行 → 取得できる（精度は問わない）
3. 字幕がライブ中継等で取得できない動画で実行 → エラー文言が出る
4. 異なる動画を連続で実行 → 都度新しい字幕に切り替わる
5. DevTools の Network タブで `timedtext` リクエストが200で返ることを確認

## リスク / 注意点

- **CORS**: `timedtext` は YouTube のドメインから呼ぶ必要があるため、content script から fetch する必要あり（background からだと CORS 失敗する場合がある）
- **`ytInitialPlayerResponse`**: ページロード直後に存在しないことがある。`yt-navigate-finish` を待つか、リトライ
- **字幕の長さ**: 1時間以上の動画では本文が数十万文字になる。M4以降のトークン上限と関係するが、M3時点では生のまま表示してよい
- **pending state の競合**: ユーザーが連続でボタンを押した場合、最後の押下のみ有効。`createdAt` のタイムスタンプで古い pending を破棄する
