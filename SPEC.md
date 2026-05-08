# YouTube動画要約 Chrome拡張機能 仕様書

## 1. 概要

<img src="./youtube-summary-icon.png" alt="アプリアイコン" width="120" align="right" />

YouTube動画の字幕を取得し、ユーザーが選択したLLM API（Claude / OpenAI / Gemini）で日本語または英語に要約する Chrome拡張機能。
YouTube動画ページのアクションバー（高評価/共有/保存の並び）に「🪄 要約」ボタンを差し込み、押下すると Chrome のサイドパネルが開いて構造化された要約を表示する。
UI言語と要約出力言語は、それぞれ日本語 / 英語を切替可能。

- 配布形態: Chrome Web Store 公開を見据える（Manifest V3 必須）
- ターゲットブラウザ: Chrome 114+（最新の安定版）
- ターゲットページ: `https://www.youtube.com/watch?v=*`
- アイコン: `youtube-summary-icon.png`（プロジェクトルート、マスター画像）

---

## 2. 機能要件

### 2.1 コア機能

| ID | 機能 | 詳細 |
|----|------|------|
| F-01 | 字幕取得 | 現在のYouTube動画ページから字幕を取得（手動字幕優先、なければ自動生成字幕） |
| F-02 | 要約生成 | 取得した字幕をユーザー選択のLLM APIに送信し、指定言語（日/英）の構造化要約を取得 |
| F-03 | 要約ボタン挿入 | YouTube動画ページのアクションバー（高評価ボタン等の並び）に「🪄 要約」ボタンを動的に挿入 |
| F-04 | サイドパネル表示 | ボタン押下で Chrome サイドパネルを開き、「概要・主要ポイント・結論」など見出し付き＋箇条書きで要約を表示 |
| F-05 | コピー機能 | ボタン1クリックでクリップボードに要約をコピー |
| F-06 | 再生成機能 | 同じ字幕に対して再度要約をリクエストし直す |
| F-07 | API設定 | 拡張機能オプションページで API プロバイダ選択と APIキー登録 |
| F-08 | 言語切替 | UI言語（ja/en）と要約出力言語（ja/en）を独立して設定可能、サイドパネル上でも都度切替可 |

### 2.2 LLMプロバイダ

ユーザーが下記から1つ選択（オプション設定で切替）。それぞれBYOK（Bring Your Own Key）。
選定方針は **バランス重視**（品質とコストの中間グレード）。

| プロバイダ | デフォルトモデル | 備考 |
|------------|------------------|------|
| Claude API (Anthropic)  | `claude-sonnet-4-6`  | 長コンテキスト・高品質要約のバランス |
| OpenAI API              | `gpt-4o`             | 汎用バランス型 |
| Gemini API (Google)     | `gemini-2.5-flash`   | 長尺動画に強い大容量コンテキスト |

各プロバイダごとに APIキー・モデル名を保存。アクティブなプロバイダは「使用中」フラグで管理。
オプション画面でモデル名は自由に上書き可能（例: コスト重視で Haiku / 4o-mini / Flash-Lite に変更、品質重視で Opus / Pro に変更）。

### 2.3 出力フォーマット仕様

LLM への要約プロンプトは出力言語パラメータ（`ja` / `en`）に応じて切替える。

**日本語版テンプレート:**
```
# 概要
（動画全体の要点を2〜3文で）

# 主要ポイント
- ポイント1
- ポイント2
- …（5〜10項目）

# 結論 / Takeaway
（視聴者が持ち帰るべき要点）
```

**英語版テンプレート:**
```
# Overview
(2-3 sentences capturing the essence of the video)

# Key Points
- Point 1
- Point 2
- ... (5-10 items)

# Conclusion / Takeaway
(What viewers should take away)
```

プロンプトの末尾には `Respond in {Japanese|English}.` を明示し、出力言語をモデルに強制する。
Markdown として popup 内でレンダリングする。

### 2.4 起動トリガー

- **YouTubeページ内「🪄 要約」ボタン**: 動画タイトル下のアクションバー（高評価/低評価/共有/保存の並び）にボタンを挿入。押下でサイドパネルが開き、即座に要約処理が走る。
- **拡張機能アイコンクリック**: アイコン押下で同じくサイドパネルが開く（実行は手動の「要約」ボタンから）。
- 自動実行はしない（APIコスト保護）。

### 2.5 字幕ソースの優先順位

1. 手動アップロードされた字幕（言語問わず）
2. YouTube 自動生成字幕
3. いずれもなければ「この動画には字幕がないため要約できません」とエラー表示

複数言語の字幕がある場合の優先順位:
1. 動画の元言語の字幕
2. 英語字幕
3. その他の任意の字幕

（要約は字幕言語に関わらず、ユーザーが指定した出力言語（日本語 / 英語）で生成する）

### 2.6 履歴機能

- **MVPでは実装しない**（要約は表示するだけで保存しない）
- ポップアップを閉じたら結果は破棄

### 2.7 長尺動画への対応

- **MVP方針**: トークン上限を超える場合はエラー表示で割り切る
- エラーメッセージ例: 「動画が長すぎるため要約できません（推定: XX分）」
- 上限の目安は各プロバイダのコンテキスト長から逆算（参考: Claude Sonnet 4.6 は 1M トークン対応モデルがあり、ほとんどの動画は処理可能）

---

## 3. 非機能要件

| 項目 | 要件 |
|------|------|
| パフォーマンス | 字幕取得は2秒以内、要約レスポンスはLLM側次第（通常10〜30秒） |
| セキュリティ | APIキーは `chrome.storage.local` に平文保存（拡張機能のサンドボックス内のみアクセス可）。リモートコードロード禁止 |
| プライバシー | 字幕本文は要約時にユーザー指定APIへ送信される旨を初回起動時に明示。プライバシーポリシーは GitHub Pages で公開（後述） |
| 国際化 | UI: 日本語 / 英語の2言語対応（`chrome.i18n` の `_locales/` 仕組みを使用、ブラウザロケールを既定とし手動切替も可）。出力要約: 日本語 / 英語の2言語対応（オプションでデフォルト指定、サイドパネルでも切替可） |
| 配布審査 | Chrome Web Store のManifest V3 / 権限最小化 / プライバシーポリシー記述に対応 |
| エラーログ | 外部送信は行わない（Sentry等は導入しない）。エラーは `console.error` とサイドパネル上のユーザー向けメッセージ表示のみ |

---

## 4. 技術設計

### 4.1 アーキテクチャ概要

```
┌──────────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│ Side Panel (UI)      │───▶│ Background Worker    │───▶│ LLM Provider API│
│ - 要約結果表示       │    │ - 字幕取得仲介       │    │ (Claude/GPT/    │
│ - 言語切替           │◀───│ - LLM呼び出し統合層 │◀───│  Gemini)        │
│ - コピー/再生成      │    │ - エラー処理         │    └─────────────────┘
└──────────────────────┘    └──────────────────────┘
         ▲                            ▲ ▲
         │                            │ │
         │ runtime.sendMessage        │ │
         │                            │ │
┌──────────────────────┐              │ │
│ Content Script       │──────────────┘ │
│ - 「🪄 要約」ボタン挿入 │   字幕テキスト │
│ - 動画ID取得         │                │
│ - ytInitialPlayerResponse解析         │
│ - sidePanel.open()   │                │
└──────────────────────┘                │
                                        │
┌──────────────────────┐                │
│ Options Page         │────────────────┘
│ - APIキー入力        │     設定読み込み
│ - プロバイダ選択     │
│ - UI/出力言語設定    │
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│ chrome.storage.local │
│ - 各社APIキー        │
│ - アクティブ設定     │
│ - UI/出力言語        │
└──────────────────────┘
```

### 4.2 ディレクトリ構成（予定）

```
youtube-summary/
├── manifest.json
├── _locales/
│   ├── ja/messages.json             # 日本語UI文字列
│   └── en/messages.json             # 英語UI文字列
├── src/
│   ├── sidepanel/
│   │   ├── sidepanel.html
│   │   ├── sidepanel.ts
│   │   └── sidepanel.css
│   ├── options/
│   │   ├── options.html
│   │   ├── options.ts
│   │   └── options.css
│   ├── background/
│   │   └── service-worker.ts
│   ├── content/
│   │   ├── content-script.ts        # 動画ID/字幕URL抽出
│   │   ├── action-button.ts         # YouTubeアクションバーへのボタン挿入
│   │   └── action-button.css        # ボタンのスタイル（YouTubeのデザインに合わせる）
│   ├── lib/
│   │   ├── subtitle-fetcher.ts      # 字幕取得・結合
│   │   ├── llm/
│   │   │   ├── index.ts             # ファクトリ
│   │   │   ├── claude.ts
│   │   │   ├── openai.ts
│   │   │   └── gemini.ts
│   │   ├── prompt.ts                # 要約プロンプトテンプレ（ja/en切替）
│   │   ├── i18n.ts                  # UI翻訳ヘルパ（chrome.i18n.getMessage ラッパ）
│   │   └── storage.ts               # chrome.storage ラッパ
│   └── types/
│       └── index.ts
├── public/
│   └── icons/                       # 16/32/48/128 PNG（マスターから書き出し）
├── youtube-summary-icon.png         # アイコンマスター（高解像度、1024x1024想定）
├── package.json
├── tsconfig.json
└── vite.config.ts                   # or webpack
```

ビルド: TypeScript + Vite（`@crxjs/vite-plugin` を想定）

### 4.3 manifest.json（抜粋）

```json
{
  "manifest_version": 3,
  "name": "YouTube動画要約",
  "version": "0.1.0",
  "description": "YouTube動画の字幕をLLMで日本語/英語に要約します",
  "action": {
    "default_icon": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
  },
  "side_panel": {
    "default_path": "src/sidepanel/sidepanel.html"
  },
  "default_locale": "en",
  "options_ui": {
    "page": "src/options/options.html",
    "open_in_tab": true
  },
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/watch*"],
      "js": ["src/content/content-script.ts"],
      "css": ["src/content/action-button.css"],
      "run_at": "document_idle"
    }
  ],
  "permissions": ["storage", "activeTab", "scripting", "sidePanel"],
  "host_permissions": [
    "https://www.youtube.com/*",
    "https://api.anthropic.com/*",
    "https://api.openai.com/*",
    "https://generativelanguage.googleapis.com/*"
  ]
}
```

サイドパネル動作のポイント:
- `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` を設定し、拡張アイコン押下でパネルを開く
- YouTubeページ内ボタンの押下時は、コンテンツスクリプトから `chrome.runtime.sendMessage` で background へ依頼 → background で `chrome.sidePanel.open({ tabId })` を実行（user gesture トークンを伝搬する必要あり、Chrome 116+）

### 4.4 字幕取得の実装方針

YouTubeの字幕は以下の手順で取得する:

1. **content script** が現在の動画ページから `ytInitialPlayerResponse` を読む（`window.ytInitialPlayerResponse` または `<script>` タグから抽出）
2. `captions.playerCaptionsTracklistRenderer.captionTracks` から字幕トラックURL一覧を取得
3. 優先順位（手動 > 自動生成、元言語 > 英語 > その他）に従って1つ選択
4. URL に `&fmt=json3` を付与して fetch
5. JSON から `events[].segs[].utf8` を結合してプレーンテキスト化
6. background worker へ送信

> 注意: YouTube側の内部APIの仕様変更で動かなくなる可能性あり。`youtube-transcript` 等のOSSロジックを参考にする。

### 4.4.1 アクションバーへのボタン挿入

YouTube は SPA であり、動画ページの DOM は遷移ごとに動的に再構築される。安定挿入のため:

1. **挿入先セレクタ候補**: `#actions-inner #menu #top-level-buttons-computed`（高評価/共有/保存ボタンのコンテナ）
2. **MutationObserver** でこのコンテナの再描画を監視し、ボタンが消えたら再挿入
3. **動画ID変更検知**: `yt-navigate-finish` カスタムイベント、または `URL` の `v=` パラメータの変化を監視
4. **挿入するボタン**: YouTube の既存ボタンと同じスタイル（`tonal-button` or 同等のクラス）を踏襲し、ハイライトの違和感を最小化
5. **ボタンクリック時**: `chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL_AND_SUMMARIZE', videoId, tabId })` を送信

### 4.5 データフロー（要約実行時）

```
[User] YouTubeページ内「🪄 要約」ボタン押下
   │
   ▼
[Content Script] runtime.sendMessage({type: 'OPEN_SIDEPANEL_AND_SUMMARIZE', videoId, tabId})
   │
   ▼
[Background] chrome.sidePanel.open({tabId}) でサイドパネル起動
   │             + 「summarize要求」を一時保存（pending state）
   ▼
[Side Panel] 起動時にbackgroundへpending要求を問い合わせ → 字幕取得を開始
   │
   ▼
[Side Panel → Content Script] 字幕取得依頼（runtime.sendMessage）
   │
   ▼
[Content Script] ytInitialPlayerResponse から字幕URL抽出 → fetch → テキスト化
   │
   ▼
[Side Panel] 字幕受信 → background経由でLLM呼び出し依頼
   │
   ▼
[Background] chrome.storage から APIキー取得 → プロンプト組立 → LLM API呼出
   │
   ▼
[Side Panel] レスポンス受信 → Markdown レンダリング → 表示
```

サイドパネル起動と要約の同時開始を実現するため、background が「pending summarize 要求」を保持する小さなステートを持つ。サイドパネルは初期化時に必ずこの pending を確認する。

### 4.6 ストレージスキーマ

`chrome.storage.local`:

```ts
type StorageSchema = {
  activeProvider: 'claude' | 'openai' | 'gemini';
  providers: {
    claude:  { apiKey: string; model: string };
    openai:  { apiKey: string; model: string };
    gemini:  { apiKey: string; model: string };
  };
  uiLanguage: 'ja' | 'en' | 'auto';        // 'auto' はブラウザロケールに従う（既定）
  outputLanguage: 'ja' | 'en';             // 要約出力のデフォルト言語
};
```

UI文字列は `chrome.i18n.getMessage()` で取得する。`uiLanguage` が `'auto'` 以外のとき、独自ヘルパで `_locales/{ja|en}/messages.json` を直接読み込んで上書き表示する（`chrome.i18n` はブラウザロケール固定のため手動切替には自前ロード層が必要）。

### 4.7 アイコンアセット

マスター画像 `youtube-summary-icon.png`（プロジェクトルート、高解像度PNG）から、Chrome拡張で必要な以下のサイズへリサイズして `public/icons/` に配置する。

| 用途 | サイズ | ファイル名 |
|------|--------|------------|
| ツールバー（標準） | 16x16  | `icon-16.png`  |
| ツールバー（高DPI） | 32x32 | `icon-32.png`  |
| 拡張機能管理ページ | 48x48 | `icon-48.png`  |
| Chrome Web Store | 128x128 | `icon-128.png` |

リサイズ手段:
- ビルド時に `sharp` で自動生成するスクリプトを `package.json` の `prebuild` に登録するのが望ましい
- もしくは初回手動でImageMagick等で書き出して `public/icons/` にコミット

manifest.json の `action.default_icon` および `icons` セクションで上記4サイズすべてを参照する。

### 4.8 エラーハンドリング

| ケース | 対応 |
|--------|------|
| YouTube動画ページ以外で実行 | 「YouTube動画ページで使用してください」と表示 |
| 字幕が存在しない | 「この動画には字幕がないため要約できません」 |
| APIキー未設定 | オプションページへの誘導リンク付きで通知 |
| APIキー誤り（401） | 「APIキーが無効です。設定を確認してください」 |
| レート制限（429） | 「APIレート制限に達しました。少し待って再試行してください」 |
| トークン上限超過 | 「動画が長すぎるため要約できません」 |
| ネットワーク失敗 | 「通信に失敗しました。再試行してください」 |

---

## 5. UI設計

### 5.1 YouTubeページ内ボタン（コンテンツスクリプトで挿入）

動画タイトル下のアクションバーに「🪄 要約」ボタンを挿入する。

```
動画タイトル

[👍 1.2万] [👎] [↪ 共有] [➕ 保存] [🪄 要約]
                                    ↑ 挿入位置
動画説明欄...
```

- スタイル: 隣接する YouTube 既存ボタンと統一（角丸 pill、同サイズ、同色）
- ホバー: YouTube同様の薄いグレー背景
- ラベル: UI言語に応じて「要約」/「Summarize」と切替
- 動画ページ以外（ホーム、検索結果等）には挿入しない

### 5.2 サイドパネル（幅: ユーザー任意、推奨400px〜）

```
┌─────────────────────────────────┐
│ 🪄 YouTube要約       [⚙ 設定]   │
├─────────────────────────────────┤
│ 動画タイトル                    │
├─────────────────────────────────┤
│ 出力言語: [日本語 ▼]            │
├─────────────────────────────────┤
│ # 概要                          │
│ ……                              │
│                                 │
│ # 主要ポイント                  │
│ - ……                            │
│ - ……                            │
│                                 │
│ # 結論                          │
│ ……                              │
├─────────────────────────────────┤
│ [📋 コピー] [🔄 再生成]         │
└─────────────────────────────────┘
```

- ヘッダーラベル等のUI文字列はUI言語設定（ja/en）に応じて切替
- 出力言語ドロップダウンで都度切替可能。変更後に「再生成」を押すと新言語で再要約
- 動画切替（YouTube内で別動画に遷移）した場合、サイドパネルは「新しい動画が選択されました。要約しますか？」とCTAを出して再要約を提案
- ローディング中はスケルトン UI で進行表示

### 5.3 オプションページ

- **LLMプロバイダ選択**（ラジオボタン: Claude / OpenAI / Gemini）
- 各プロバイダ毎の APIキー入力欄（type=password、目玉アイコンで表示切替）
- 各プロバイダ毎のモデル名入力欄（デフォルト値プリセット）
- **UI言語**選択（Auto / 日本語 / English）
- **要約出力言語**のデフォルト選択（日本語 / English）
- 「保存」ボタン → 保存後トースト表示
- プライバシーに関する注意書き（字幕が選択APIへ送信されること）

オプションページ自体もUI言語設定に追従して日/英表示。

---

## 6. 開発ロードマップ

| マイルストーン | 内容 |
|----------------|------|
| M1: スケルトン | Vite + TS + Manifest V3 でサイドパネルとオプションページの空シェル |
| M2: ボタン挿入 | content script で YouTubeアクションバーに「🪄 要約」ボタン挿入＋MutationObserverで生存維持 |
| M3: 字幕取得 | ボタン押下→サイドパネル起動→字幕取得しサイドパネルに表示 |
| M4: Claude統合 | 1プロバイダのみで End-to-End要約 |
| M5: マルチプロバイダ | OpenAI / Gemini を追加、オプションページ実装 |
| M6: i18n対応 | `_locales/` 整備、UI言語切替、出力言語切替（ja/en） |
| M7: UX改善 | コピー/再生成ボタン、エラーUI、ローディング状態、動画切替検知 |
| M8: ストア準備 | アイコン、スクリーンショット、プライバシーポリシー、Web Store審査 |

---

## 7. プライバシーポリシー

### 7.1 掲載先

- **GitHub Pages** で公開する（リポジトリの `docs/privacy.md` または `gh-pages` ブランチ）
- 公開URLは Chrome Web Store の「プライバシーへの取り組み」セクションに登録
- 日本語版・英語版の両方を用意（UI国際化方針に揃える）

### 7.2 必要な記載項目

Chrome Web Store の審査要件と単一目的ポリシーに沿って、以下を必ず明記する。

- 拡張機能の単一目的（YouTube動画の字幕を要約する）
- **収集するデータ**: 拡張機能側では収集しない（ローカル `chrome.storage.local` のみ）
- **送信するデータ**: ユーザーが要約を実行した際に、その動画の字幕本文と一部メタデータ（動画ID、出力言語）が、ユーザーが選択したLLMプロバイダ（Anthropic / OpenAI / Google）の API へ送信される
- **送信先**: 各プロバイダの公式APIエンドポイントのみ
- **APIキーの取り扱い**: ユーザーが入力した APIキーは `chrome.storage.local` に保存され、外部送信されない（LLM API リクエスト時の認証ヘッダにのみ使用）
- **エラーログの外部送信**: 行わない（Sentry等のSaaS連携なし）
- **Cookie / トラッキング**: 行わない
- **連絡先**: 開発者の連絡先メールアドレス

---

## 8. 未確定事項 / 今後検討

- [x] アイコンデザイン: 決定済み（マスター画像 `youtube-summary-icon.png` を使用、ビルド時に16/32/48/128サイズへ書き出し）
- [x] LLMデフォルトモデル: Claude=`claude-sonnet-4-6` / OpenAI=`gpt-4o` / Gemini=`gemini-2.5-flash`
- [x] プライバシーポリシー掲載先: GitHub Pages
- [x] エラーログ収集: 不要
- [ ] 日/英以外の言語追加のタイミング（中国語/韓国語等は将来検討）
- [ ] 要約スタイル切替（初心者向け/専門的等）の優先度（今回は対象外）
- [ ] 履歴機能の優先度（今回は対象外、将来的に検討）

---

最終更新: 2026-05-08
