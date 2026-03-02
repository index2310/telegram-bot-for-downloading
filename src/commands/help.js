export default function register(bot) {
  bot.command("help", async (ctx) => {
    const text = [
      "How to use:",
      "1) Paste a TikTok URL in this chat.",
      "2) Wait a moment while I fetch and upload the video.",
      "",
      "Supported URL formats:",
      "- https://www.tiktok.com/...",
      "- https://tiktok.com/...",
      "- https://vm.tiktok.com/...",
      "- https://vt.tiktok.com/...",
      "",
      "Rate limits and HTTP 429:",
      "- If you see HTTP 429, the downloader API is rate-limited (temporary).",
      "- The bot may ask you to wait before retrying, and may cooldown briefly to protect the service.",
      "",
      "Common issues:",
      "- Temporary network issue: retry in a bit.",
      "- Service unavailable (5xx): try again later.",
      "- Couldn’t process this link: the link may be invalid, private, or unsupported.",
      "",
      "Fallback behavior:",
      "I try sending as a Telegram video first. If that fails, I send it as a document. If that still fails, I’ll send you a direct download link.",
    ].join("\n");

    await ctx.reply(text);
  });
}
