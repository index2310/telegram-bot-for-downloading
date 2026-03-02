import { cfg } from "../lib/config.js";

export default function register(bot) {
  bot.command("start", async (ctx) => {
    const cooldown = Number.isFinite(cfg.COOLDOWN_SECONDS) && cfg.COOLDOWN_SECONDS > 0 ? cfg.COOLDOWN_SECONDS : 10;

    const base = [
      "Send me a TikTok link and I’ll download the video and post it back here.",
      "",
      "Example:",
      "https://www.tiktok.com/@username/video/1234567890",
      "",
      "Works in groups too. Just paste a TikTok link.",
      "Cooldown: 1 link per chat every " + cooldown + " seconds.",
    ].join("\n");

    await ctx.reply(base);
  });
}
