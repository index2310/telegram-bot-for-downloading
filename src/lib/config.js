export const cfg = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",

  // RapidAPI (required for downloading)
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY || "",
  RAPIDAPI_HOST: process.env.RAPIDAPI_HOST || "",
  // Optional; disable feature if left as placeholder.
  RAPIDAPI_TIKTOK_ENDPOINT_BASE:
    process.env.RAPIDAPI_TIKTOK_ENDPOINT_BASE || "https://example.p.rapidapi.com",

  // Controls
  COOLDOWN_SECONDS: Number(process.env.COOLDOWN_SECONDS || 10),
  HTTP_TIMEOUT_MS: Number(process.env.HTTP_TIMEOUT_MS || 30000),
};
