import type { SummaryMode } from '../types';

export type OutputLang = 'ja' | 'en';

const buildShortJa = (title: string, subtitle: string): string =>
  `あなたはYouTube動画を簡潔に要約する専門家です。以下の動画字幕を読み、視聴者が短時間で要点を掴める日本語要約を作成してください。

【動画タイトル】
${title}

【ボリューム感】
- 全体は500〜1000文字程度に収める
- 簡潔さを最優先。冗長な説明は避ける
- それでも重要な事実・数値・固有名詞は具体的に盛り込む

【動画種別に応じた表現を選ぶ】
- 字幕の内容から動画種別（講義 / 解説 / Vlog / 対談 / インタビュー / チュートリアル / ハウツー / 比較レビュー / ニュース 等）を推定し、その種別に最も適した表現スタイルを選ぶ
- **チュートリアル / ハウツー / 比較レビュー系**: 主要トピック内で箇条書き（- や 1.）を積極的に使用
- **Vlog / 対談 / インタビュー系**: 段落形式を主とし、印象的な発言は \`> 引用\` で抜き出す
- **講義 / 解説 / ニュース系**: 段落＋重要キーワード・数値・固有名詞を **太字** で強調。専門用語は \`バッククォート\` でマーク

【段落と書き方の原則】
- 論理的なまとまりごとに段落を区切る（短めなので一段落2〜3文）
- 関連する文は接続詞で繋いで自然な読み流しを優先する。1文ごとにブツ切りにしない
- 列挙・並列内容・例示は箇条書きにする
- 重要な用語・人名・数値・主張は **太字** で強調する

【使ってよい / 避けるべき markdown】
- 使ってよい: \`# / ## / ###\` 見出し（指定通り）、段落、\`- リスト\`、\`1. リスト\`、\`**太字**\`、\`> 引用\`、\`バッククォート\`（インラインコード）
- 使わない: \`####\` 以下の見出し、テーブル、水平線（\`---\`）、斜体（\`*〜*\`）

【その他】
- 字幕には [mm:ss] 形式でタイムスタンプが付いている。これを参照して各トピックの開始時刻を記載する
- 推測や創作を避け、字幕に忠実に書く
- **下記の見出し構造（🏷️ 📋 🎯 💡）は厳守**。中身の書き方だけ動画種別に応じて柔軟にする
- セクション見出しの絵文字（🏷️ 📋 🎯 💡 ⏱）はそのまま残す
- カテゴリとタイムスタンプは \`#タグ\` 形式（バックティック囲み）で記載する

【出力フォーマット】

# ${title}

## 🏷️ カテゴリ
\`#メインカテゴリ\` \`#サブカテゴリ\` \`#タグ\`

## 📋 動画の要約

> (2〜3文で結論を blockquote として記述。各文の先頭に「> 」を付け、文の間には「>」だけの空行を入れる)

## 🎯 主要トピック

### 1. [トピック1] \`⏱ 00:00〜\`
(2〜3文で、動画種別に応じた書き方で記述)

### 2. [トピック2] \`⏱ 00:00〜\`
(同上)

### 3. [トピック3] \`⏱ 00:00〜\`
(同上)

## 💡 結論
(動画全体の主張と示唆を2〜3文で。要点が複数ある場合は箇条書きにしてよい)

【字幕本文】
${subtitle}

上記フォーマットに従い、日本語で**簡潔な**要約を生成してください。1行目は必ず「# ${title}」をそのまま記載すること。**見出しの骨組み（🏷️ 📋 🎯 💡）は厳守し、各セクション内の書き方は動画種別に応じて段落・リスト・太字・引用を適切に使い分ける**こと。`;

const buildDetailedJa = (title: string, subtitle: string): string =>
  `あなたは動画コンテンツを深く分析する専門家です。以下のYouTube動画の字幕を読み、視聴者が動画を見なくても本質を完全に理解できる、内容が充実した日本語要約を作成してください。

【動画タイトル】
${title}

【最重要：内容の充実度を最優先】
- **薄い要約は禁止。各セクションは具体的な事実・数値・固有名詞・引用・例示を必ず含めて厚く記述する**
- 字幕に出てきた重要な発言・データ・エピソードは可能な限り取りこぼさず盛り込む
- 文字数は気にせず、動画の情報量に応じて十分なボリュームで書く（目安として4000〜8000文字、長尺動画ならさらに長くてよい）
- 「〜について話している」「〜を解説する」のような中身のない要約は禁止。**何をどう話したか、結論は何か、まで踏み込む**

【動画種別に応じた表現を選ぶ】
- 字幕の内容から動画種別（講義 / 解説 / Vlog / 対談 / インタビュー / チュートリアル / ハウツー / 比較レビュー / ニュース 等）を推定し、その種別に最も適した表現スタイルを選ぶ
- **チュートリアル / ハウツー / 比較レビュー系**: 各セクション内で**箇条書き（- や 1.）を積極的に使用**。手順は番号付きリスト、特徴比較は箇条書き
- **Vlog / 対談 / インタビュー系**: 段落形式を主とし、印象的な発言は \`> 引用\` で抜き出す
- **講義 / 解説 / ニュース系**: 段落＋重要キーワード・数値・固有名詞を **太字** で強調。専門用語は \`バッククォート\` でマーク
- どの種別でも、列挙・並列・例示は箇条書きにすると視覚的に読みやすくなる

【段落と書き方の原則】
- 論理的なまとまり（話題・主張・根拠など）ごとに段落を区切る。一段落の目安は2〜4文
- 関連する文は接続詞で繋いで自然な読み流しを優先する。**1文ごとにブツ切りにしない**
- 話題が変わる箇所、例示に入る箇所では空行を入れる
- 重要な用語・人名・数値・主張は **太字** で強調する
- 動画から印象的な発言を引用する際は \`> 引用\` を使う
- サブトピックが3つ以上ある場合、\`### N.\` 内は「短い導入文 → 箇条書き」の構成にしてよい

【使ってよい / 避けるべき markdown】
- 使ってよい: \`# / ## / ###\` 見出し（指定通り）、段落、\`- リスト\`、\`1. リスト\`、\`**太字**\`、\`> 引用\`、\`バッククォート\`（インラインコード）
- 使わない: \`####\` 以下の見出し、テーブル、水平線（\`---\`）、斜体（\`*〜*\`）

【その他】
- 字幕には [mm:ss] 形式でタイムスタンプが付いている。これを参照して各セクションの開始〜終了時刻を記載する
- 推測や創作を避け、字幕にない事実は補わない（ただし字幕の内容を要約・整理・補足説明することは積極的に行う）
- **下記の見出し構造（🏷️ 📝 🔑 📚 💡）は厳守**。中身の書き方だけ動画種別に応じて柔軟にする
- セクション見出しの絵文字（🏷️ 📝 🔑 📚 💡 ⏱）はそのまま残す
- カテゴリとタイムスタンプは \`#タグ\` 形式（バックティック囲み）で記載する

【出力フォーマット】

# ${title}

## 🏷️ カテゴリ
\`#メインカテゴリ\` \`#サブカテゴリ\` \`#タグ\`

## 📝 動画の要約

> (動画全体の主張・結論を3〜5文で blockquote として記述。各文の先頭に「> 」を付け、文の間には「>」だけの空行を入れる)

## 🔑 キーポイント

- (重要なポイントを箇条書きで5〜8項目。各項目は具体的な事実・数値・固有名詞を含む1〜2文)
- (...)
- (...)

## 📚 セクション別要約

### 1. [セクション1タイトル] \`⏱ 00:00〜00:00\`
(このセクションで話されている内容を、動画種別に応じた最適な形で詳細に記述する。段落・箇条書き・引用・太字を内容に応じて使い分け、話者が何を主張し、どんな根拠を挙げ、どんな結論に至ったかまで具体的に書く)

### 2. [セクション2タイトル] \`⏱ 00:00〜00:00\`
(同上の方針。動画種別に応じた表現で具体的に)

### 3. [セクション3タイトル] \`⏱ 00:00〜00:00\`
(同上)

### 4. [セクション4タイトル] \`⏱ 00:00〜00:00\`
(同上)

(※動画の構成に応じて4〜8セクションに増減してよい。重要な区切りごとに細かく分ける方が望ましい)

## 💡 結論と示唆
(動画全体から得られる結論・教訓・実践的示唆を具体的に。視聴者がどう活かせるかまで踏み込む。要点が複数ある場合は箇条書きにしてよい)

【字幕本文】
${subtitle}

上記フォーマットに従い、日本語で**内容の濃い**要約を生成してください。1行目は必ず「# ${title}」をそのまま記載すること。**見出しの骨組み（🏷️ 📝 🔑 📚 💡）は厳守し、各セクション内の書き方は動画種別に応じて段落・リスト・太字・引用を適切に使い分ける**こと。**繰り返し：薄い・抽象的な要約は禁止。具体性と網羅性を最優先せよ**。`;

const buildMediumJa = (title: string, subtitle: string): string =>
  `あなたはYouTube動画を要約する専門家です。以下の動画字幕を読み、視聴者が動画の主要な内容を素早く把握できる、適度に詳しい日本語要約を作成してください。

【動画タイトル】
${title}

【ボリューム感（短めと詳細の中間）】
- 全体は1500〜2500文字程度
- 動画の主要トピックは漏らさず触れるが、各トピックの記述は2〜4文に抑えて読みやすさ優先
- 重要な事実・数値・固有名詞は具体的に盛り込む

【動画種別に応じた表現を選ぶ】
- 字幕の内容から動画種別（講義 / 解説 / Vlog / 対談 / インタビュー / チュートリアル / ハウツー / 比較レビュー / ニュース 等）を推定し、その種別に最も適した表現スタイルを選ぶ
- **チュートリアル / ハウツー / 比較レビュー系**: 各セクション内で箇条書き（- や 1.）を積極的に使用
- **Vlog / 対談 / インタビュー系**: 段落形式を主とし、印象的な発言は \`> 引用\` で抜き出す
- **講義 / 解説 / ニュース系**: 段落＋重要キーワード・数値・固有名詞を **太字** で強調。専門用語は \`バッククォート\` でマーク

【段落と書き方の原則】
- 論理的なまとまりごとに段落を区切る（一段落2〜3文）
- 関連する文は接続詞で繋いで自然な読み流しを優先する。1文ごとにブツ切りにしない
- 列挙・並列内容・例示は箇条書きにする
- 重要な用語・人名・数値・主張は **太字** で強調する

【使ってよい / 避けるべき markdown】
- 使ってよい: \`# / ## / ###\` 見出し（指定通り）、段落、\`- リスト\`、\`1. リスト\`、\`**太字**\`、\`> 引用\`、\`バッククォート\`（インラインコード）
- 使わない: \`####\` 以下の見出し、テーブル、水平線（\`---\`）、斜体（\`*〜*\`）

【その他】
- 字幕には [mm:ss] 形式でタイムスタンプが付いている。これを参照して各トピックの開始時刻を記載する
- 推測や創作を避け、字幕に忠実に書く
- **下記の見出し構造（🏷️ 📝 🔑 🎯 💡）は厳守**。中身の書き方だけ動画種別に応じて柔軟にする
- セクション見出しの絵文字（🏷️ 📝 🔑 🎯 💡 ⏱）はそのまま残す
- カテゴリとタイムスタンプは \`#タグ\` 形式（バックティック囲み）で記載する

【出力フォーマット】

# ${title}

## 🏷️ カテゴリ
\`#メインカテゴリ\` \`#サブカテゴリ\` \`#タグ\`

## 📝 動画の要約

> (動画全体の主張・結論を3〜4文で blockquote として記述。各文の先頭に「> 」を付け、文の間には「>」だけの空行を入れる)

## 🔑 キーポイント

- (重要なポイントを箇条書きで4〜6項目。各項目は具体的な事実・数値・固有名詞を含む1文)
- (...)
- (...)

## 🎯 主要トピック

### 1. [トピック1] \`⏱ 00:00〜\`
(2〜4文で、動画種別に応じた書き方で記述)

### 2. [トピック2] \`⏱ 00:00〜\`
(同上)

### 3. [トピック3] \`⏱ 00:00〜\`
(同上)

### 4. [トピック4] \`⏱ 00:00〜\`
(同上)

(※動画の構成に応じて3〜5トピックに増減してよい)

## 💡 結論
(動画全体の主張と示唆を2〜3文で。要点が複数ある場合は箇条書きにしてよい)

【字幕本文】
${subtitle}

上記フォーマットに従い、日本語で**適度な詳しさの**要約を生成してください。1行目は必ず「# ${title}」をそのまま記載すること。**見出しの骨組み（🏷️ 📝 🔑 🎯 💡）は厳守し、各セクション内の書き方は動画種別に応じて段落・リスト・太字・引用を適切に使い分ける**こと。`;

const buildShortEn = (title: string, subtitle: string): string =>
  `You are an expert YouTube video summarizer. Read the following video subtitle and create a concise English summary that lets viewers quickly grasp the key points.

[Video Title]
${title}

[Volume target]
- Total length around 500-1000 characters.
- Conciseness is the top priority — avoid verbose explanations.
- Even so, include concrete facts, numbers, and proper nouns.

[Adapt the writing style to the video type]
- Infer the video type from the subtitle (lecture / explainer / vlog / interview / dialogue / tutorial / how-to / comparison-review / news, etc.) and pick the most fitting style.
- **Tutorial / how-to / comparison-review**: Use bullet lists (\`-\`) and numbered lists (\`1.\`) actively within main topics.
- **Vlog / interview / dialogue**: Prose-paragraph dominant; pull memorable statements out as \`> blockquotes\`.
- **Lecture / explainer / news**: Paragraphs with **bold** for key terms, numbers, names, and claims. Mark technical terms with \`inline code\`.

[Paragraphing and prose principles]
- Group sentences into paragraphs by logical unit. Aim for 2-3 sentences per paragraph (this is short mode).
- Connect related sentences with conjunctions for natural reading flow. **Do NOT split every sentence into its own paragraph.**
- Use bullet lists for enumerable / parallel content.
- Bold important terms, names, numbers, and key claims.

[Allowed / forbidden markdown]
- Use: \`# / ## / ###\` headings (as specified), paragraphs, \`- list\`, \`1. list\`, \`**bold**\`, \`> blockquote\`, \`inline code\`.
- Do not use: \`####\` or deeper headings, tables, horizontal rules (\`---\`), italic (\`*...*\`).

[Other guidelines]
- Subtitles contain [mm:ss] timestamps. Reference these to indicate topic start times.
- Stay faithful to the subtitle. Avoid speculation or fabrication.
- **The heading structure (🏷️ 📋 🎯 💡) is strict; only the writing inside each section adapts to the video type.**
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
(2-3 sentences in the form best suited to the video type)

### 2. [Topic 2] \`⏱ 00:00〜\`
(Same)

### 3. [Topic 3] \`⏱ 00:00〜\`
(Same)

## 💡 Conclusion
(Overall message and implications in 2-3 sentences. Use a bullet list if there are multiple distinct takeaways.)

[Subtitle]
${subtitle}

Follow the format above and generate a **concise** summary in English. The first line must be \`# ${title}\` exactly. **The heading structure (🏷️ 📋 🎯 💡) is strict; the writing inside each section should adapt to the video type — mix paragraphs, lists, bold, and quotes as fits the content.**`;

const buildMediumEn = (title: string, subtitle: string): string =>
  `You are an expert YouTube video summarizer. Read the following video subtitle and create a moderately detailed English summary that lets viewers quickly grasp the main content of the video.

[Video Title]
${title}

[Volume target — between short and detailed]
- Total length around 1500-2500 characters.
- Cover all main topics of the video, but keep each topic's description to 2-4 sentences for readability.
- Include concrete facts, numbers, and proper nouns.

[Adapt the writing style to the video type]
- Infer the video type from the subtitle (lecture / explainer / vlog / interview / dialogue / tutorial / how-to / comparison-review / news, etc.) and pick the most fitting style.
- **Tutorial / how-to / comparison-review**: Use bullet lists (\`-\`) and numbered lists (\`1.\`) actively within each section.
- **Vlog / interview / dialogue**: Prose-paragraph dominant; pull memorable statements out as \`> blockquotes\`.
- **Lecture / explainer / news**: Paragraphs with **bold** for key terms, numbers, names, and claims. Mark technical terms with \`inline code\`.

[Paragraphing and prose principles]
- Group sentences into paragraphs by logical unit. Aim for 2-3 sentences per paragraph.
- Connect related sentences with conjunctions for natural reading flow. **Do NOT split every sentence into its own paragraph.**
- Use bullet lists for enumerable / parallel content.
- Bold important terms, names, numbers, and key claims.

[Allowed / forbidden markdown]
- Use: \`# / ## / ###\` headings (as specified), paragraphs, \`- list\`, \`1. list\`, \`**bold**\`, \`> blockquote\`, \`inline code\`.
- Do not use: \`####\` or deeper headings, tables, horizontal rules (\`---\`), italic (\`*...*\`).

[Other guidelines]
- Subtitles contain [mm:ss] timestamps. Reference these to indicate topic start times.
- Stay faithful to the subtitle. Avoid speculation or fabrication.
- **The heading structure (🏷️ 📝 🔑 🎯 💡) is strict; only the writing inside each section adapts to the video type.**
- Keep the section emojis (🏷️ 📝 🔑 🎯 💡 ⏱) as-is.
- Format categories and timestamps as \`#tag\` (wrapped in backticks).

[Output Format]

# ${title}

## 🏷️ Category
\`#MainCategory\` \`#SubCategory\` \`#Tag\`

## 📝 Summary

> (Overall thesis and conclusion in 3-4 sentences as a blockquote. Prefix each sentence with "> " and separate with ">" only lines.)

## 🔑 Key Points

- (4-6 bullet points of the most important takeaways. Each bullet is 1 sentence with concrete facts/numbers/names.)
- (...)
- (...)

## 🎯 Main Topics

### 1. [Topic 1] \`⏱ 00:00〜\`
(2-4 sentences in the form best suited to the video type)

### 2. [Topic 2] \`⏱ 00:00〜\`
(Same)

### 3. [Topic 3] \`⏱ 00:00〜\`
(Same)

### 4. [Topic 4] \`⏱ 00:00〜\`
(Same)

(Adjust to 3-5 topics as the video structure warrants.)

## 💡 Conclusion
(Overall message and implications in 2-3 sentences. Use a bullet list if there are multiple distinct takeaways.)

[Subtitle]
${subtitle}

Follow the format above and generate a **moderately detailed** summary in English. The first line must be \`# ${title}\` exactly. **The heading structure (🏷️ 📝 🔑 🎯 💡) is strict; the writing inside each section should adapt to the video type — mix paragraphs, lists, bold, and quotes as fits the content.**`;

const buildDetailedEn = (title: string, subtitle: string): string =>
  `You are an expert content analyst. Read the following YouTube video subtitle and create a comprehensive English summary that allows viewers to fully grasp the content without watching the video.

[Video Title]
${title}

[TOP PRIORITY: Substance over brevity]
- **Thin summaries are forbidden. Each section must include concrete facts, numbers, proper nouns, quotes, and examples — write thoroughly.**
- Capture as many key statements, data points, and anecdotes from the subtitle as possible.
- Do not worry about character count. Write at length proportional to the video's information density (target 4000-8000 characters; longer for long-form videos).
- Vague summaries like "the speaker talks about X" or "explains Y" are forbidden. **Get into WHAT was said, HOW it was argued, and WHAT the conclusion was.**

[Adapt the writing style to the video type]
- Infer the video type from the subtitle (lecture / explainer / vlog / interview / dialogue / tutorial / how-to / comparison-review / news, etc.) and pick the most fitting expression style.
- **Tutorial / how-to / comparison-review**: Use **bullet lists (\`-\`) and numbered lists (\`1.\`) actively** within each section. Steps as numbered lists, feature comparisons as bullets.
- **Vlog / interview / dialogue**: Prose-paragraph dominant; pull memorable statements out as \`> blockquotes\`.
- **Lecture / explainer / news**: Paragraphs with **bold** for key terms, numbers, names, and claims. Mark technical terms with \`inline code\`.
- For any video type, enumerable / parallel content (definitions, examples, trade-offs) reads better as a bullet list.

[Paragraphing and prose principles]
- Group sentences into paragraphs by logical unit (topic, claim, supporting evidence). Aim for 2-4 sentences per paragraph.
- Connect related sentences with conjunctions for natural reading flow. **Do NOT split every sentence into its own paragraph.**
- Insert blank lines at topic shifts or before examples.
- Bold important terms, names, numbers, and key claims.
- Use \`> blockquote\` for memorable direct quotes from the speaker.
- If a \`### N.\` section has 3+ subtopics, structure it as "short intro paragraph → bullet list".

[Allowed / forbidden markdown]
- Use: \`# / ## / ###\` headings (as specified), paragraphs, \`- list\`, \`1. list\`, \`**bold**\`, \`> blockquote\`, \`inline code\`.
- Do not use: \`####\` or deeper headings, tables, horizontal rules (\`---\`), italic (\`*...*\`).

[Other guidelines]
- Subtitles contain [mm:ss] timestamps. Reference these to indicate the start/end time of each section.
- Stay faithful to the subtitle (do not invent facts), but actively summarize, organize, and clarify what is in it.
- **The heading structure (🏷️ 📝 🔑 📚 💡) is strict; only the writing inside each section adapts to the video content.**
- Keep the section emojis (🏷️ 📝 🔑 📚 💡 ⏱) as-is.
- Format categories and timestamps as \`#tag\` (wrapped in backticks).

[Output Format]

# ${title}

## 🏷️ Category
\`#MainCategory\` \`#SubCategory\` \`#Tag\`

## 📝 TL;DR

> (Overall thesis and conclusion in 3-5 sentences as a blockquote. Prefix each sentence with "> " and separate with ">" only lines.)

## 🔑 Key Points

- (5-8 bullet points of the most important takeaways. Each bullet is 1-2 sentences with concrete facts/numbers/names.)
- (...)
- (...)

## 📚 Section Summaries

### 1. [Section 1 Title] \`⏱ 00:00〜00:00\`
(Detailed coverage in the form best suited to the video type — paragraphs, bullets, blockquotes, bold as appropriate. Cover what the speaker argues, what evidence they cite, and what conclusion they reach.)

### 2. [Section 2 Title] \`⏱ 00:00〜00:00\`
(Same approach with specifics)

### 3. [Section 3 Title] \`⏱ 00:00〜00:00\`
(Same)

### 4. [Section 4 Title] \`⏱ 00:00〜00:00\`
(Same)

(Expand to 4-8 sections as the video structure warrants. Splitting at meaningful breakpoints is preferred over forcing content into fewer sections.)

## 💡 Conclusion & Implications
(Overall conclusion, lessons, and practical implications. Cover how viewers can apply this. Use a bullet list if there are multiple distinct takeaways.)

[Subtitle]
${subtitle}

Follow the format above and generate a **substantive** summary in English. The first line must be \`# ${title}\` exactly. **The heading structure (🏷️ 📝 🔑 📚 💡) is strict; the writing inside each section should adapt to the video type — mix paragraphs, lists, bold, and quotes as fits the content.** **Repeat: thin or abstract summaries are forbidden — prioritize specificity and completeness.**`;

export const buildPrompt = (
  subtitle: string,
  mode: SummaryMode,
  title: string,
  outputLang: OutputLang = 'ja',
): string => {
  const titleSafe = title.trim() || (outputLang === 'en' ? 'Untitled' : '無題');
  if (outputLang === 'en') {
    if (mode === 'detailed') return buildDetailedEn(titleSafe, subtitle);
    if (mode === 'medium') return buildMediumEn(titleSafe, subtitle);
    return buildShortEn(titleSafe, subtitle);
  }
  if (mode === 'detailed') return buildDetailedJa(titleSafe, subtitle);
  if (mode === 'medium') return buildMediumJa(titleSafe, subtitle);
  return buildShortJa(titleSafe, subtitle);
};
