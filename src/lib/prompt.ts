import type { SummaryMode } from '../types';

export type OutputLang = 'ja' | 'en';

const buildShortJa = (title: string, subtitle: string): string =>
  `あなたはYouTube動画を簡潔に要約する専門家です。以下の動画字幕を読み、指定されたMarkdownフォーマットで日本語要約を作成してください。

【動画タイトル】
${title}

【作成方針】
- 字幕には [mm:ss] 形式でタイムスタンプが付いている。これを参照して各トピックの開始時刻を記載する
- 推測や創作を避け、字幕の情報に忠実に書く
- 全体は500〜1000文字程度に収める
- **各文の末尾（句点「。」）の後に必ず空行を入れて、1文を1段落として書く**（読みやすさ向上のため）
- 下記のフォーマットを厳密に守る（[X]や(X)、説明文は実際の内容に置き換える）
- セクション見出しの絵文字（🏷️ 📋 🎯 💡 ⏱）はそのまま残す
- カテゴリとタイムスタンプは \`#タグ\` 形式（バックティック囲み）で記載する

【出力フォーマット】

# ${title}

## 🏷️ カテゴリ
\`#メインカテゴリ\` \`#サブカテゴリ\` \`#タグ\`

## 📋 動画の要約

> (2~3文で結論を blockquote として記述。各文の先頭に「> 」を付け、文の間には「>」だけの空行を入れる)

## 🎯 主要トピック

### 1. [トピック1] \`⏱ 00:00〜\`
要点を2〜3文で

### 2. [トピック2] \`⏱ 00:00〜\`
要点を2〜3文で

### 3. [トピック3] \`⏱ 00:00〜\`
要点を2〜3文で

## 💡 結論
(全体の主張と示唆を3〜4文で)

【字幕本文】
${subtitle}

上記フォーマットに従い、日本語で要約を生成してください。1行目は必ず「# ${title}」をそのまま記載すること。各文の末尾の句点の後には必ず空行を入れ、1文ずつ段落として記述すること。`;

const buildDetailedJa = (title: string, subtitle: string): string =>
  `あなたは動画コンテンツを深く分析する専門家です。以下のYouTube動画の字幕を読み、視聴者が動画を見なくても本質を完全に理解できる充実した日本語要約を作成してください。

【動画タイトル】
${title}

【作成方針】
- 字幕には [mm:ss] 形式でタイムスタンプが付いている。これを参照して各セクションの開始〜終了時刻を記載する
- 字幕に含まれる具体的な事実・数値・固有名詞・引用を可能な限り盛り込む
- 推測や創作を避け、字幕にない事実を補わない
- 全体は1500〜3000文字程度に収める
- **各文の末尾（句点「。」）の後に必ず空行を入れて、1文を1段落として書く**（読みやすさ向上のため）
- 下記のフォーマットを厳密に守る（[X]や(X)、説明文は実際の内容に置き換える）
- セクション見出しの絵文字（🏷️ 📝 📚 💡 ⏱）はそのまま残す
- カテゴリとタイムスタンプは \`#タグ\` 形式（バックティック囲み）で記載する

【出力フォーマット】

# ${title}

## 🏷️ カテゴリ
\`#メインカテゴリ\` \`#サブカテゴリ\` \`#タグ\`

## 📝 動画の要約

> (3〜4文で全体の主張を blockquote として記述。各文の先頭に「> 」を付け、文の間には「>」だけの空行を入れる)

## 📚 セクション別要約

### 1. [セクション1タイトル] \`⏱ 00:00〜00:00\`
(章の内容を詳しく解説)

### 2. [セクション2タイトル] \`⏱ 00:00〜00:00\`
(同上の構成)

### 3. [セクション3タイトル] \`⏱ 00:00〜00:00\`
(同上の構成)

### 4. [セクション4タイトル] \`⏱ 00:00〜00:00\`
(同上の構成)

## 💡 結論と示唆
(動画全体の結論)

【字幕本文】
${subtitle}

上記フォーマットに従い、日本語で要約を生成してください。1行目は必ず「# ${title}」をそのまま記載すること。セクション数は動画の構成に応じて4個前後で柔軟に調整してよい。各文の末尾の句点の後には必ず空行を入れ、1文ずつ段落として記述すること。`;

const buildShortEn = (title: string, subtitle: string): string =>
  `You are an expert YouTube video summarizer. Read the following video subtitle and create a concise English summary in the specified Markdown format.

[Video Title]
${title}

[Guidelines]
- Subtitles contain [mm:ss] timestamps. Reference these to indicate topic start times.
- Stay faithful to the subtitle. Avoid speculation or fabrication.
- Total length should be 500-1000 characters.
- **After each sentence-ending period, insert a blank line so that each sentence is its own paragraph** (for readability).
- Strictly follow the format below ([X], (X), and descriptive text should be replaced with actual content).
- Keep the section emojis (🏷️ 📋 🎯 💡 ⏱) as-is.
- Format categories and timestamps as \`#tag\` (wrapped in backticks).

[Output Format]

# ${title}

## 🏷️ Category
\`#MainCategory\` \`#SubCategory\` \`#Tag\`

## 📋 Summary

> (Conclusion in 2-3 sentences as a blockquote. Prefix each sentence line with "> " and separate sentences with a ">" only line.)

## 🎯 Main Topics

### 1. [Topic 1] \`⏱ 00:00〜\`
Key points in 2-3 sentences

### 2. [Topic 2] \`⏱ 00:00〜\`
Key points in 2-3 sentences

### 3. [Topic 3] \`⏱ 00:00〜\`
Key points in 2-3 sentences

## 💡 Conclusion
(Overall message and implications in 3-4 sentences)

[Subtitle]
${subtitle}

Follow the format above and generate the summary in English. The first line must be \`# ${title}\` exactly. Categories should be 1-3 hashtags. Insert a blank line after each sentence's period to separate sentences as paragraphs.`;

const buildDetailedEn = (title: string, subtitle: string): string =>
  `You are an expert content analyst. Read the following YouTube video subtitle and create a comprehensive English summary that allows viewers to fully grasp the content without watching the video.

[Video Title]
${title}

[Guidelines]
- Subtitles contain [mm:ss] timestamps. Reference these to indicate the start/end time of each section.
- Include as many specific facts, numbers, proper nouns, and quotes from the subtitle as possible.
- Stay faithful to the subtitle. Do not add facts that aren't in the source.
- Total length should be 1500-3000 characters.
- **After each sentence-ending period, insert a blank line so that each sentence is its own paragraph** (for readability).
- Strictly follow the format below ([X], (X), and descriptive text should be replaced with actual content).
- Keep the section emojis (🏷️ 📝 📚 💡 ⏱) as-is.
- Format categories and timestamps as \`#tag\` (wrapped in backticks).

[Output Format]

# ${title}

## 🏷️ Category
\`#MainCategory\` \`#SubCategory\` \`#Tag\`

## 📝 TL;DR

> (Overall thesis in 3-4 sentences as a blockquote. Prefix each sentence with "> " and separate with ">" only lines.)

## 📚 Section Summaries

### 1. [Section 1 Title] \`⏱ 00:00〜00:00\`
(Detailed explanation of the section)

### 2. [Section 2 Title] \`⏱ 00:00〜00:00\`
(Same structure)

### 3. [Section 3 Title] \`⏱ 00:00〜00:00\`
(Same structure)

### 4. [Section 4 Title] \`⏱ 00:00〜00:00\`
(Same structure)

## 💡 Conclusion & Implications
(Overall conclusion of the video)

[Subtitle]
${subtitle}

Follow the format above and generate the summary in English. The first line must be \`# ${title}\` exactly. Adjust the number of sections (around 4) to match the video structure. Insert a blank line after each sentence's period to separate sentences as paragraphs.`;

export const buildPrompt = (
  subtitle: string,
  mode: SummaryMode,
  title: string,
  outputLang: OutputLang = 'ja',
): string => {
  const titleSafe = title.trim() || (outputLang === 'en' ? 'Untitled' : '無題');
  if (outputLang === 'en') {
    return mode === 'detailed'
      ? buildDetailedEn(titleSafe, subtitle)
      : buildShortEn(titleSafe, subtitle);
  }
  return mode === 'detailed'
    ? buildDetailedJa(titleSafe, subtitle)
    : buildShortJa(titleSafe, subtitle);
};
