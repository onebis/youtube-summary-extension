# 実装計画書

本ディレクトリは [`SPEC.md`](../../SPEC.md) に基づく実装計画を、マイルストーン単位で分割したものです。
各ファイルは独立して着手可能なように、**目的 / スコープ / タスク分解 / 完了条件 / 動作確認 / リスク** を記載します。

## マイルストーン一覧

| # | ファイル | 概要 |
|---|----------|------|
| M1 | [01-skeleton.md](./01-skeleton.md) | プロジェクト初期化（Vite + TypeScript + Manifest V3 のシェル） |
| M2 | [02-action-button.md](./02-action-button.md) | YouTubeアクションバーへの「🪄 要約」ボタン挿入 |
| M3 | [03-subtitle-fetch.md](./03-subtitle-fetch.md) | 字幕取得とサイドパネルへのプレーン表示 |
| M4 | [04-claude-integration.md](./04-claude-integration.md) | Claude API統合によるEnd-to-End要約 |
| M5 | [05-multi-provider.md](./05-multi-provider.md) | OpenAI / Gemini 追加とオプションページ完成 |
| M6 | [06-i18n.md](./06-i18n.md) | UI / 要約出力言語の日英切替 |
| M7 | [07-ux-polish.md](./07-ux-polish.md) | コピー / 再生成 / エラーUI / 動画切替検知 |
| M8 | [08-store-release.md](./08-store-release.md) | アイコン書き出し / プライバシーポリシー / Web Store申請 |

## 採用技術スタック

- **言語**: TypeScript 5.x
- **ビルド**: Vite 5.x + [`@crxjs/vite-plugin`](https://crxjs.dev/vite-plugin)（Manifest V3 対応）
- **UI**: 素のHTML+TS（フレームワークは入れない方針、軽量化のため）
  - 必要に応じて将来 Preact / Lit を検討
- **Markdownレンダラ**: `marked` または `markdown-it`
- **画像リサイズ**: `sharp`（ビルドスクリプトでアイコン書き出し）
- **テスト**: 当面は手動。将来Vitest導入検討
- **lint/format**: ESLint + Prettier

## 開発の進め方

1. M1から順に着手し、各マイルストーン完了時に `chrome://extensions` で動作確認する
2. 各MS完了時に Git commit（`feat(M1): skeleton setup` 等）
3. 仕様変更が発生したら `SPEC.md` を更新してから実装へ反映
4. プロバイダの API 仕様確認には [Context7](../../README.md) 等のドキュメントツールを利用

## 共通ルール

- ファイル/関数の命名は **explicit** を優先（暗黙的な短縮形は避ける）
- すべての `chrome.runtime.sendMessage` のメッセージは `type` フィールドで分類し、`src/types/messages.ts` に型定義を集約
- LLMリクエスト / レスポンスは `src/types/llm.ts` で正規化された型を共有
- `console.error` でログ出力するが、**外部送信はしない**（[SPEC §3](../../SPEC.md#3-非機能要件)）
