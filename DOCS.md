What this bot does
This Telegram bot downloads TikTok videos using a RapidAPI TikTok downloader API and sends the resulting video back into the same chat.

How to use
1) Start the bot with /start.
2) Paste a TikTok link into the chat. No command is required.
3) The bot will reply with the video. If Telegram upload fails, it will fall back to sending a document. If that fails too, it will send a direct download link.

Commands
1) /start
Shows a short welcome message and an example TikTok link.

2) /help
Shows supported URL formats, troubleshooting, and fallback behavior.

Supported TikTok URL formats
1) https://www.tiktok.com/...
2) https://tiktok.com/...
3) https://vm.tiktok.com/...
4) https://vt.tiktok.com/...

Rate limits
The bot applies a per-chat cooldown. By default this is 1 TikTok link per chat every 10 seconds. If you exceed it, the bot will ask you to wait.

Environment variables
1) TELEGRAM_BOT_TOKEN (required)
Your Telegram bot token from BotFather.

2) RAPIDAPI_KEY (required)
Your RapidAPI key.

3) RAPIDAPI_HOST (required)
The RapidAPI host for your selected TikTok downloader provider, for example: some-provider.p.rapidapi.com

4) RAPIDAPI_TIKTOK_ENDPOINT_BASE (optional but needed for downloads)
The base URL for the RapidAPI endpoint. This project defaults to https://example.p.rapidapi.com as a placeholder.
You must set it to the real provider base URL or downloading will be disabled.

5) COOLDOWN_SECONDS (optional)
Per-chat cooldown, default 10.

6) HTTP_TIMEOUT_MS (optional)
Timeout for RapidAPI calls and media downloads, default 30000.

Run locally
1) npm run install:root
2) Copy .env.sample to .env and fill it in
3) npm run dev

Deployment notes
This bot uses long polling and should run as a single Node.js service. Make sure all required environment variables are set in your hosting provider.

Troubleshooting
1) The bot replies that RapidAPI is not configured
Set RAPIDAPI_KEY, RAPIDAPI_HOST, and RAPIDAPI_TIKTOK_ENDPOINT_BASE.

2) Private or region-locked video
The downloader API may not be able to access it.

3) Telegram upload failed
The bot will automatically fall back to document, then to a direct link.
