import { cfg } from "./config.js";

export function buildBotProfile() {
  const cooldownSeconds =
    Number.isFinite(cfg.COOLDOWN_SECONDS) && cfg.COOLDOWN_SECONDS > 0
      ? cfg.COOLDOWN_SECONDS
      : 10;

  const tiktokCooldownMs =
    Number.isFinite(cfg.TIKTOK_COOLDOWN_MS) && cfg.TIKTOK_COOLDOWN_MS > 0
      ? cfg.TIKTOK_COOLDOWN_MS
      : 60000;

  return [
    "Purpose: Turn a TikTok link into downloadable media and send it back into the same Telegram chat.",
    "Public commands: /start, /help. You can also paste a TikTok link to download.",
    "Key rules: The downloader API may rate-limit (HTTP 429). When that happens, the bot will ask you to wait and will temporarily cooldown to avoid hammering the service.",
    "Fallback sending: send as video first, then fall back to document, then fall back to sending the direct link.",
    "Chat cooldown: 1 link per chat every " + cooldownSeconds + " seconds.",
    "Rate-limit cooldown: about " + Math.round(tiktokCooldownMs / 1000) + " seconds after repeated 429s.",
  ].join("\n");
}
