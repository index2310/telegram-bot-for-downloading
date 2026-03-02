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
      "Common issues:",
      "- Private video: the downloader can’t access it.",
      "- Region locked: the API might not be able to fetch it.",
      "- API down or rate limited: try again in a few minutes.",
      "",
      "Fallback behavior:",
      "I try sending as a Telegram video first. If that fails, I send it as a document. If that still fails, I’ll send you a direct download link.",
    ].join("\n");

    await ctx.reply(text);
  });
}
