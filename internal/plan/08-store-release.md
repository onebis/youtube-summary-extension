# M8: Chrome Web Store 公開準備

## 目的

Chrome Web Store の審査要件を満たし、申請可能な状態に仕上げる。
[`SPEC §7 プライバシーポリシー`](../../SPEC.md#7-プライバシーポリシー) と Web Store のリスティング情報を整える。

## スコープ

- ✅ アイコンサイズ書き出しの最終確認
- ✅ プライバシーポリシー作成 / GitHub Pages 公開
- ✅ Web Store 用スクリーンショット撮影
- ✅ ストア説明文（日 / 英）
- ✅ ZIPパッケージング
- ✅ 単一目的（Single Purpose）の明文化
- ❌ ストア審査の通過自体は外部要因なのでスコープ外

## タスク分解

### 1. アイコンの最終チェック

- [ ] `npm run prebuild` で `public/icons/icon-{16,32,48,128}.png` が生成されること
- [ ] 128x128 を Web Store 用にPSD/Sketch ではなく PNG として確認
- [ ] manifest の `icons` フィールドが4サイズ全部参照していること

```json
"icons": {
  "16": "icons/icon-16.png",
  "32": "icons/icon-32.png",
  "48": "icons/icon-48.png",
  "128": "icons/icon-128.png"
}
```

### 2. プライバシーポリシー

`docs/privacy.md` および `docs/privacy.en.md` を新規作成（`docs/` は GitHub Pages 専用、内部設計ドキュメントは `internal/` 配下に分離）。
[`SPEC §7.2`](../../SPEC.md#72-必要な記載項目) の全項目を含める:

- 拡張機能の単一目的
- 収集データ: なし
- 送信データ: 字幕本文 + 動画ID + 出力言語 → ユーザー選択のLLM API
- 送信先: api.anthropic.com / api.openai.com / generativelanguage.googleapis.com
- APIキーの取り扱い: ローカル保存のみ、外部送信なし
- エラーログ: 外部送信なし
- Cookie / トラッキング: なし
- 連絡先メールアドレス

GitHub Pages 公開:
- リポジトリ Settings → Pages → Source: `main` branch / `/docs` folder
- 公開URL（例: `https://<user>.github.io/youtube-summary/privacy.html`）を確認

### 3. ストア説明文

`internal/store-listing-ja.md` と `internal/store-listing-en.md`:

#### 短い説明（132字以内）

- ja: 「YouTube動画を字幕からAI要約。Claude/OpenAI/Gemini対応、BYOK方式で安心。日本語・英語で要約可能。」
- en: "Summarize YouTube videos from subtitles with your own AI key. Supports Claude / OpenAI / Gemini. Output in Japanese or English."

#### 詳細説明

機能一覧、対応モデル、プライバシー方針、ショートカット等を明記。

### 4. スクリーンショット

Web Store は `1280x800` または `640x400` のPNG/JPGを最大5枚。

撮影シーン:
1. YouTube動画ページに「🪄 要約」ボタンが表示されている様子
2. サイドパネルにローディング中
3. サイドパネルに完成した要約（日本語）
4. 同じ要約の英語版
5. オプションページ（プロバイダ選択画面）

撮影後 `internal/screenshots/01.png` 〜 `05.png` に保存。

### 5. 単一目的の明示

Web Store 申請フォームで「拡張機能の主目的」を1つに絞って記述する欄がある:

> "This extension summarizes YouTube videos by fetching the captions and sending them to an AI provider chosen by the user."

権限ごとの理由も求められる:

| 権限 | 理由 |
|------|------|
| `storage` | API keys and user preferences (local only) |
| `activeTab` | Read the current YouTube tab to fetch its captions |
| `scripting` | Inject the summarize button into YouTube pages |
| `sidePanel` | Display the generated summary alongside the video |
| `host_permissions: youtube.com` | Read captions and inject the trigger button |
| `host_permissions: api.anthropic.com etc.` | Send captions to user-selected AI provider |

### 6. ZIP パッケージング

```bash
npm run build
cd dist
zip -r ../youtube-summary-v0.1.0.zip .
```

サイズ確認: 数MB以内に収める（マスターアイコン1MBが大きいので、`youtube-summary-icon.png` 自体は `dist/` から除外する設定を vite に入れる）。

### 7. 申請前チェックリスト

- [ ] `manifest.json` の `version` が更新されている
- [ ] `description` が短く明快（132字以内）
- [ ] 全アイコンサイズが鮮明
- [ ] スクリーンショット5枚
- [ ] プライバシーポリシーURLが公開されている（404でない）
- [ ] サポート連絡先メールアドレスが用意できている
- [ ] 審査向けに「テスト用APIキーを開発者用に提供する手順」を準備（審査員がBYOKをテストするため）

### 8. 開発者アカウント

- Chrome Web Store Developer Dashboard に登録（$5の登録料、初回のみ）
- 個人 or 組織アカウント
- 公開地域、価格設定（無料）、年齢制限（全年齢可）

## 完了条件

1. `youtube-summary-v0.1.0.zip` が生成されている
2. プライバシーポリシーが公開URLでアクセス可能
3. スクリーンショット5枚が用意されている
4. ストア説明文（日/英）が手元にある
5. Developer Dashboard で「下書き」までの登録が完了している（実際の申請はユーザー判断）

## 動作確認手順

1. クリーンな別Chromeプロファイルで `dist/` を読み込み、すべての主要フローが動作することを確認
2. プライバシーポリシーURLを別ブラウザで開いて表示できることを確認
3. ZIPを再展開して `manifest.json` が正しく含まれていることを確認

## リスク / 注意点

- **審査の典型的な却下理由**:
  1. 単一目的が曖昧（複数機能を持つように見える）
  2. プライバシーポリシーが不十分（送信データを明示していない）
  3. host_permissions が広すぎる（`<all_urls>` 等は避ける）
  4. リモートコードロード（外部 JS の動的読み込み）→ 本拡張は該当しない
- **APIキーレビュー対応**: 審査員はBYOKを確認するためにテストアカウント情報を要求することがある。Anthropic/OpenAI/Gemini いずれかの試験用キーを準備しておく
- **GitHub Pagesの404**: 申請前に URL の到達性を確認。`docs/privacy.md` の front matter で `permalink: /privacy.html` を指定済みなので Jekyll で展開される
- **マスター画像のサイズ**: ZIPには不要なので `vite` の `publicDir` 構成と `.vscodeignore` 的な仕組みで除外

## 参考

- [Chrome Web Store Developer Documentation](https://developer.chrome.com/docs/webstore)
- [Single Purpose Policy](https://developer.chrome.com/docs/webstore/program-policies/mv3-single-purpose)
- [Chrome Web Store Best Practices](https://developer.chrome.com/docs/webstore/best-practices)
