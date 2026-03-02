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
Shows supported URL formats, troubleshooting, rate-limit behavior (HTTP 429), and fallback behavior.

Supported TikTok URL formats
1) https://www.tiktok.com/...
2) https://tiktok.com/...
3) https://vm.tiktok.com/...
4) https://vt.tiktok.com/...

Rate limits
The bot applies multiple protections to reduce upstream rate limiting:
1) A per-chat cooldown (default: 1 TikTok link per chat every 10 seconds).
2) A per-user in-flight guard (if you send a second link while your first is processing, the bot asks you to wait).
3) RPS limits (default: global 5 requests/second, user 1 request/second).

HTTP 429 explained
HTTP 429 means the downloader API is rate-limiting requests temporarily ("Try again later").
When this happens:
1) The bot will show a clear message: “API is rate-limited (HTTP 429). Please try again later.”
2) If the API provides a Retry-After hint, the bot will include an approximate wait time.
3) The bot applies a cooldown window (default: 60 seconds) for that user so it does not hammer the downloader API.

Fallback behavior reminder
The bot uses this exact order:
1) Try sending the media as a Telegram video.
2) If that fails, send as a document.
3) If that still fails, send the direct download link.

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

5) MONGODB_URI (optional)
If set, the bot will persist per-user cooldown state in MongoDB so it survives restarts.
If not set, the bot uses an in-memory fallback.

6) COOLDOWN_SECONDS (optional)
Per-chat cooldown, default 10.

7) HTTP_TIMEOUT_MS (optional)
Timeout for RapidAPI calls and media downloads, default 30000.

Optional resilience tuning
These are optional. If not set, safe defaults are used.
1) TIKTOK_MAX_RETRIES (default 2)
Retries for transient downloader API failures (HTTP 429, 5xx, network timeouts).

2) TIKTOK_RETRY_BASE_MS (default 800)
Base delay for exponential backoff.

3) TIKTOK_RETRY_MAX_MS (default 8000)
Max delay for exponential backoff.

4) TIKTOK_COOLDOWN_MS (default 60000)
User cooldown window after repeated 429s.

5) TIKTOK_GLOBAL_RPS (default 5)
Global requests-per-second limiter for downloader calls.

6) TIKTOK_USER_RPS (default 1)
Per-user requests-per-second limiter for downloader calls.

Run locally
1) npm run install:root
2) Copy .env.sample to .env and fill it in
3) npm run dev

Deployment notes
This bot uses long polling and should run as a single Node.js service. Make sure all required environment variables are set in your hosting provider.

Troubleshooting
1) The bot replies that RapidAPI is not configured
Set RAPIDAPI_KEY, RAPIDAPI_HOST, and RAPIDAPI_TIKTOK_ENDPOINT_BASE.

2) HTTP 429 rate limited
Wait a bit and retry. The bot may apply a short cooldown to avoid hammering the API.

3) Telegram upload failed
The bot will automatically fall back to document, then to a direct link.
