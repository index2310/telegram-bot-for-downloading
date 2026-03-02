import { InputFile } from "grammy";
import { cfg } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { extractFirstUrl, isTikTokUrl, normalizeUrl } from "../utils/url.js";
import { checkChatCooldown } from "../utils/rateLimit.js";
import { fetchTikTokDownload } from "../services/rapidapiTikTok.js";
import { downloadToBuffer } from "../services/httpDownload.js";

const inflightByChat = new Map();

function newReqId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function buildCaption(meta) {
  const author = String(meta?.author || "").trim();
  const caption = String(meta?.caption || "").trim();
  const parts = [];
  if (author) parts.push("By: " + author);
  if (caption) parts.push(caption);
  let out = parts.join("\n").trim();
  // Telegram caption limit for video is 1024.
  if (out.length > 950) out = out.slice(0, 950) + "…";
  return out;
}

export function registerTikTokHandler(bot) {
  bot.on("message:text", async (ctx, next) => {
    const text = String(ctx.message?.text || "");
    if (text.startsWith("/")) return next();

    const url = extractFirstUrl(text);
    if (!url) return next();

    if (!isTikTokUrl(url)) return next();

    const chatId = ctx.chat?.id;
    if (!chatId) return next();

    const cooldownMs = Math.max(1, Number(cfg.COOLDOWN_SECONDS || 10)) * 1000;
    const cd = checkChatCooldown(chatId, cooldownMs);
    if (!cd.ok) {
      const waitS = Math.ceil(cd.waitMs / 1000);
      await ctx.reply("Please wait " + waitS + "s before sending another TikTok link in this chat.", {
        reply_to_message_id: ctx.message?.message_id,
      });
      return;
    }

    const key = String(chatId);
    if (inflightByChat.get(key)) {
      await ctx.reply("I’m already processing a TikTok link for this chat. Please wait a moment.", {
        reply_to_message_id: ctx.message?.message_id,
      });
      return;
    }

    inflightByChat.set(key, true);
    try {
      const requestId = newReqId();
      const normalized = normalizeUrl(url);

      // quick UX feedback
      try {
        await ctx.api.sendChatAction(chatId, "upload_video");
      } catch {}

      const workingMsg = await ctx.reply("Working on it…", {
        reply_to_message_id: ctx.message?.message_id,
      });

      const r = await fetchTikTokDownload({ tiktokUrl: normalized, requestId });
      if (!r.ok) {
        await ctx.api.editMessageText(chatId, workingMsg.message_id, r.error || "Failed to fetch TikTok download info.");
        return;
      }

      const caption = buildCaption(r.meta);

      // Download bytes first; Telegram fetching remote URLs can be flaky.
      logger.info("media.download.start", { requestId });
      let bytes;
      try {
        bytes = await downloadToBuffer(r.videoUrl, {
          timeoutMs: Number(cfg.HTTP_TIMEOUT_MS || 30000),
          // keep a conservative cap to avoid memory blowups
          maxBytes: 70 * 1024 * 1024,
        });
        logger.info("media.download.success", {
          requestId,
          bytes: bytes.buffer?.length || 0,
          contentType: bytes.contentType || "",
        });
      } catch (e) {
        logger.warn("media.download.failure", { requestId, err: logger.safeErr(e) });
        await ctx.api.editMessageText(
          chatId,
          workingMsg.message_id,
          "I couldn’t download the video bytes. Here’s a link you can try: " + r.videoUrl
        );
        return;
      }

      // Try sendVideo
      try {
        logger.info("media.send.attempt", { requestId, method: "video" });
        await ctx.api.sendVideo(chatId, new InputFile(bytes.buffer, "tiktok.mp4"), {
          caption: caption || undefined,
          reply_to_message_id: ctx.message?.message_id,
        });
        logger.info("media.send.success", { requestId, method: "video" });
        await ctx.api.deleteMessage(chatId, workingMsg.message_id).catch(() => {});
        return;
      } catch (e) {
        logger.warn("media.send.failure", { requestId, method: "video", err: logger.safeErr(e) });
      }

      // Fallback: sendDocument
      try {
        logger.info("media.send.attempt", { requestId, method: "document" });
        await ctx.api.sendDocument(chatId, new InputFile(bytes.buffer, "tiktok.mp4"), {
          caption: caption || undefined,
          reply_to_message_id: ctx.message?.message_id,
        });
        logger.info("media.send.success", { requestId, method: "document" });
        await ctx.api.deleteMessage(chatId, workingMsg.message_id).catch(() => {});
        return;
      } catch (e) {
        logger.warn("media.send.failure", { requestId, method: "document", err: logger.safeErr(e) });
      }

      // Final fallback: link
      logger.info("media.send.fallback_link", { requestId });
      await ctx.api.editMessageText(
        chatId,
        workingMsg.message_id,
        "I couldn’t upload the video to Telegram. Try downloading it directly: " + r.videoUrl
      );
    } finally {
      inflightByChat.delete(key);
      if (inflightByChat.size > 5000) {
        const firstKey = inflightByChat.keys().next().value;
        if (firstKey) inflightByChat.delete(firstKey);
      }
    }
  });
}
