# Changelog

All notable changes to this bot project are recorded here.

## 2026-03-02 07:33:24. UTC
- Request: TikTok downloader API error (HTTP 429). Try again later. Fix this for me
- Summary: Implemented robust downloader API 429 handling with classification, controlled retries (backoff + jitter + Retry-After), per-user cooldown (MongoDB-backed when MONGODB_URI is set, in-memory fallback otherwise), plus glo…
- Files: .env.sample, DOCS.md, package.json, src/commands/help.js, src/features/tiktokHandler.js, src/index.js, src/lib/botProfile.js, src/lib/config.js, src/lib/db.js, src/lib/memory.js, src/services/rapidapiTikTok.js, src/utils/rateLimit.js

## 2026-03-02 07:00:50. UTC
- Request: Help me to build a bot that could download video link from tiktok using rapid api tikok then send the video to chatroom
- Summary: Created a new Telegram TikTok downloader bot using grammY. It auto-detects TikTok links, enforces a per-chat cooldown, calls your RapidAPI downloader endpoint, downloads the mp4 server-side, and sends it as video with f…
- Files: .env.sample, DOCS.md, README.md, package.json, project.json, src/bot.js, src/commands/help.js, src/commands/loader.js, src/commands/start.js, src/features/tiktokHandler.js, src/index.js, src/lib/botProfile.js, src/lib/config.js, src/lib/logger.js (+5 more)

