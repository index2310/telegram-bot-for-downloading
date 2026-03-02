import { cfg } from "./config.js";

export function buildBotProfile() {
  const cooldown = Number.isFinite(cfg.COOLDOWN_SECONDS) && cfg.COOLDOWN_SECONDS > 0 ? cfg.COOLDOWN_SECONDS : 10;

  return [
    "Purpose: Download TikTok videos from a link and send the video file back into the same Telegram chat.",
    "Public features: /start, /help, and you can paste a TikTok link (tiktok.com, www.tiktok.com, vm.tiktok.com, vt.tiktok.com) with no command.",
    "Key rules: 1 request per chat every " + cooldown + " seconds. If sending as video fails, the bot falls back to sending as document, and if that fails it sends a direct download link.",
  ].join("\n");
}
