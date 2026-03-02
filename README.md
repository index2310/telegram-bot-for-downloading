TikTok Download Bot

This is a Telegram bot built with grammY that downloads TikTok videos using a RapidAPI TikTok downloader API and sends the video back into the same chat.

Setup
1) Install dependencies
npm run install:root

2) Configure env
Copy .env.sample to .env and set:
TELEGRAM_BOT_TOKEN
RAPIDAPI_KEY
RAPIDAPI_HOST
RAPIDAPI_TIKTOK_ENDPOINT_BASE

3) Run
npm run dev

Deploy
1) Set the same environment variables in your hosting provider
2) Run build, then start

Docs
See DOCS.md
