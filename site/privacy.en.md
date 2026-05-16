---
title: Privacy Policy
permalink: /privacy.en.html
---

# Privacy Policy

Last updated: 2026-05-16

## Single Purpose

YouTube Summary is a Chrome extension whose single purpose is to fetch captions from YouTube video pages and send them to an AI provider selected by the user to generate a summary in Japanese or English.

## Data Collected

This extension does not collect user data for the developer or any third party. Settings are stored only in the user's browser via `chrome.storage.local`.

## Data Sent During Summarization

Only when the user starts summarization, the extension sends the following data to the AI provider selected by the user:

- YouTube video caption text
- Video ID
- Summary output language

## Destinations

Summary data is sent only to the official API endpoint selected by the user in the extension settings:

- Anthropic: `https://api.anthropic.com/`
- OpenAI: `https://api.openai.com/`
- Google Gemini: `https://generativelanguage.googleapis.com/`

## API Keys

API keys entered by the user are stored only in the user's browser via `chrome.storage.local`. They are not sent to the developer's servers or to analytics services.

An API key is used only as the authentication credential for the selected AI provider when the user runs summarization.

## Error Logs

This extension does not send error logs to external services. It does not use Sentry, Google Analytics, or any other external logging service.

## Cookies and Tracking

This extension does not use cookies and does not track the user's browsing behavior.

## Data Sharing

This extension does not sell, share, or rent user data held by the developer. The API request made during summarization is necessary to ask the user-selected AI provider to process the summary.

## Contact

For questions about this privacy policy, contact:

`noru238@gmail.com`
