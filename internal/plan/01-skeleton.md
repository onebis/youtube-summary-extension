# M1: スケルトン

## 目的

Chrome 拡張機能（Manifest V3）の最低限のシェルを構築し、`chrome://extensions` から開発モードで読み込める状態にする。
以降のマイルストーンで実装を肉付けする「土台」をつくる。

## スコープ

- ✅ プロジェクト初期化（Vite + TypeScript + `@crxjs/vite-plugin`）
- ✅ Manifest V3 の最小構成
- ✅ サイドパネル / オプションページ / バックグラウンド / コンテンツスクリプトの**空シェル**作成
- ✅ アイコン書き出し（後続MSで使うため最低限の自動化）

❌ 字幕取得、LLM呼び出し、ボタン挿入はスコープ外

## タスク分解

### 1. プロジェクト初期化
- [ ] `package.json` 作成（プロジェクト名 `youtube-summary`、`type: "module"`）
- [ ] 依存追加: `vite`, `typescript`, `@types/chrome`, `@crxjs/vite-plugin`
- [ ] devDeps: `sharp`（アイコンリサイズ用）
- [ ] `tsconfig.json` 作成（strict, ES2022, moduleResolution: bundler）
- [ ] `.gitignore`（node_modules, dist 等）
- [ ] `vite.config.ts` で `@crxjs/vite-plugin` を読み込み `manifest.json` を渡す

### 2. ディレクトリ構造作成

[`SPEC.md §4.2`](../../SPEC.md#42-ディレクトリ構成予定) に従って空のディレクトリ・ファイルを置く。

```
src/
  sidepanel/  { sidepanel.html, sidepanel.ts, sidepanel.css }
  options/    { options.html, options.ts, options.css }
  background/ { service-worker.ts }
  content/    { content-script.ts, action-button.ts, action-button.css }
  lib/        { storage.ts, i18n.ts, prompt.ts, subtitle-fetcher.ts, llm/index.ts }
  types/      { index.ts, messages.ts, llm.ts }
public/icons/   ← M1 では空でOK、scripts/build-icons.ts で書き出し
_locales/ja/messages.json
_locales/en/messages.json
scripts/build-icons.ts
```

### 3. Manifest V3

[`SPEC.md §4.3`](../../SPEC.md#43-manifestjson抜粋) の内容で `manifest.json` を作成。
M1では `host_permissions` のうち外部APIは不要なのでコメントアウトしておき、M4 以降で順次有効化してもよい。

### 4. シェル実装

各ファイルは「読み込まれていることが分かる程度」のミニマム実装。

| ファイル | 内容 |
|----------|------|
| `sidepanel.html` | `<h1>YouTube Summary</h1><p>Hello sidepanel</p>` |
| `sidepanel.ts`   | `console.log('[sidepanel] loaded')` |
| `options.html`   | `<h1>Options</h1>` |
| `options.ts`     | `console.log('[options] loaded')` |
| `service-worker.ts` | `chrome.runtime.onInstalled.addListener(() => console.log('[bg] installed'))` + `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` |
| `content-script.ts` | `console.log('[content] loaded on', location.href)` |

### 5. アイコン書き出しスクリプト

`scripts/build-icons.ts`:
- 入力: `youtube-summary-icon.png`（プロジェクトルート）
- 出力: `public/icons/icon-{16,32,48,128}.png`
- `sharp` でリサイズ
- `package.json` の `scripts.prebuild` に登録

### 6. npm scripts

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "prebuild": "tsx scripts/build-icons.ts",
  "preview": "vite preview"
}
```

## 完了条件

1. `npm run build` がエラーなく完走する
2. 生成された `dist/` を `chrome://extensions` の「パッケージ化されていない拡張機能を読み込む」で読み込める
3. ツールバーアイコンをクリックするとサイドパネルが開き、`Hello sidepanel` が表示される
4. オプションページに遷移できる（拡張機能管理ページから）
5. YouTube動画ページを開くと DevTools コンソールに `[content] loaded on ...` が出る
6. アイコン4サイズが `public/icons/` に生成され、ツールバーのアイコンが正しく表示される

## 動作確認手順

1. `npm install`
2. `npm run build`
3. Chrome で `chrome://extensions` を開く → 開発者モードON → `dist/` を読み込む
4. 拡張機能アイコンをクリック → サイドパネルが開くこと
5. YouTubeで適当な動画ページを開き、DevTools の Console で `[content] loaded` を確認
6. 拡張アイコンを右クリック → 「オプション」 → 空のページが開くこと

## リスク / 注意点

- `@crxjs/vite-plugin` の HMR は MV3 でサイドパネル/サービスワーカーに対して挙動が独特。動かない場合は `npm run build` ＋手動リロードでも構わない
- `chrome.sidePanel.setPanelBehavior` の API は Chrome 116+ 必須
- アイコンマスター画像は 1024x1024 を推奨。元画像が小さいと128サイズで荒くなる

## 参考

- [`@crxjs/vite-plugin` Docs](https://crxjs.dev/vite-plugin)
- [Chrome Extensions Manifest V3 Migration](https://developer.chrome.com/docs/extensions/develop/migrate)
- [chrome.sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
