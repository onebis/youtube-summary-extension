# Chrome Web Store Submission Notes

## Single Purpose

This extension summarizes YouTube videos by fetching the captions and sending them to an AI provider chosen by the user.

## Permission Justification

| Permission | Reason |
| --- | --- |
| `storage` | Store API keys and user preferences locally in the browser. |
| `activeTab` | Read the current YouTube tab when the user starts summarization. |
| `scripting` | Inject and maintain the summarize button on YouTube video pages. |
| `sidePanel` | Display the generated summary alongside the video. |
| `host_permissions: https://www.youtube.com/*` | Read captions and inject the trigger button on YouTube video pages. |
| `host_permissions: https://api.anthropic.com/*` | Send captions to Anthropic only when the user selects Claude and starts summarization. |
| `host_permissions: https://api.openai.com/*` | Send captions to OpenAI only when the user selects OpenAI and starts summarization. |
| `host_permissions: https://generativelanguage.googleapis.com/*` | Send captions to Google Gemini only when the user selects Gemini and starts summarization. |

## Privacy Policy URLs

After GitHub Pages is enabled for the `main` branch and `/site` folder of the `onebis/youtube-summary-extension` repository:

- Japanese: `https://onebis.github.io/youtube-summary-extension/privacy.html`
- English: `https://onebis.github.io/youtube-summary-extension/privacy.en.html`

Verify both URLs return HTTP 200 in an Incognito window before submitting.

## Reviewer Test Instructions

This extension uses a bring-your-own-key model. To test it:

1. Open the extension options page.
2. Select one provider: Claude, OpenAI, or Gemini.
3. Enter a valid test API key for the selected provider.
4. Open a YouTube video that has captions.
5. Click the Summarize button on the YouTube video page.
6. Confirm that the side panel opens and displays a generated summary.

Provide the reviewer with one temporary test API key separately if requested by Chrome Web Store review.

## Screenshot Checklist

Save Web Store screenshots as PNG or JPG under `docs/screenshots/`:

1. `01.png`: YouTube video page with the Summarize button visible
2. `02.png`: Side panel while loading
3. `03.png`: Side panel with a Japanese summary
4. `04.png`: Side panel with an English summary
5. `05.png`: Options page with provider selection

Accepted sizes: `1280x800` or `640x400`.
