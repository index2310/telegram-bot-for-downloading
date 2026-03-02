export const cfg = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",

  MONGODB_URI: process.env.MONGODB_URI || "",

  // RapidAPI (required for downloading)
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY || "",
  RAPIDAPI_HOST: process.env.RAPIDAPI_HOST || "",
  // Optional; disable feature if left as placeholder.
  RAPIDAPI_TIKTOK_ENDPOINT_BASE:
    process.env.RAPIDAPI_TIKTOK_ENDPOINT_BASE || "https://example.p.rapidapi.com",

  // Controls
  COOLDOWN_SECONDS: Number(process.env.COOLDOWN_SECONDS || 10),
  HTTP_TIMEOUT_MS: Number(process.env.HTTP_TIMEOUT_MS || 30000),

  // TikTok downloader resilience (optional)
  TIKTOK_MAX_RETRIES: Number(process.env.TIKTOK_MAX_RETRIES || 2),
  TIKTOK_RETRY_BASE_MS: Number(process.env.TIKTOK_RETRY_BASE_MS || 800),
  TIKTOK_RETRY_MAX_MS: Number(process.env.TIKTOK_RETRY_MAX_MS || 8000),
  TIKTOK_COOLDOWN_MS: Number(process.env.TIKTOK_COOLDOWN_MS || 60000),

  // Token-bucket rate limits (optional)
  TIKTOK_GLOBAL_RPS: Number(process.env.TIKTOK_GLOBAL_RPS || 5),
  TIKTOK_USER_RPS: Number(process.env.TIKTOK_USER_RPS || 1),
};
