import { InputFile } from "grammy";
import { cfg } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { extractFirstUrl, isTikTokUrl, normalizeUrl } from "../utils/url.js";
import { checkChatCooldown, allowRps } from "../utils/rateLimit.js";
import { fetchTikTokDownload } from "../services/rapidapiTikTok.js";
import { downloadToBuffer } from "../services/httpDownload.js";
import { getDb } from "../lib/db.js";

const inflightByUserChat = new Map();

const inMemCooldownByUser = new Map();
let inMemGlobalCooldownUntil = 0;

function newReqId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function clampInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(Math.floor(n), max));
}

function clampMs(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(n, max));
}

function buildCaption(meta) {
  const author = String(meta?.author || "").trim();
  const caption = String(meta?.caption || "").trim();
  const parts = [];
  if (author) parts.push("By: " + author);
  if (caption) parts.push(caption);
  let out = parts.join("\n").trim();
  if (out.length > 950) out = out.slice(0, 950) + "…";
  return out;
}

function getUserKey(ctx) {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  return String(chatId || "") + ":" + String(userId || "");
}

function userFacingErrorFromClassification(cls) {
  const status = Number(cls?.status || 0);
  const retryAfterSeconds = Number(cls?.retryAfterSeconds || 0);

  if (status === 429) {
    const wait = retryAfterSeconds > 0 ? " Please wait about " + retryAfterSeconds + "s." : " Please try again later.";
    return "API is rate-limited (HTTP 429)." + wait;
  }

  if (status === 408 || status === 0 || cls?.category === "network") {
    return "Temporary network issue; please retry.";
  }

  if (status >= 500 && status <= 599) {
    return "Service is temporarily unavailable; try again later.";
  }

  if (status >= 400 && status <= 499) {
    return "Couldn’t process this link. See /help for supported formats.";
  }

  return "Service is temporarily unavailable; try again later.";
}

function msToSecondsCeil(ms) {
  return Math.max(1, Math.ceil(ms / 1000));
}

async function getCooldownUntilMs({ userId }) {
  const uid = String(userId || "");
  if (!uid) return 0;

  const mongoUri = String(cfg.MONGODB_URI || "");
  const db = await getDb(mongoUri);
  if (!db) {
    return inMemCooldownByUser.get(uid) || 0;
  }

  try {
    const row = await db.collection("tiktok_limits").findOne({ _id: "u:" + uid });
    return Number(row?.cooldownUntilMs || 0);
  } catch (e) {
    logger.error("db.read_failed", { collection: "tiktok_limits", op: "findOne", err: logger.safeErr(e) });
    return inMemCooldownByUser.get(uid) || 0;
  }
}

async function setCooldownUntilMs({ userId, cooldownUntilMs, last429AtMs, inc429Count }) {
  const uid = String(userId || "");
  const until = Number(cooldownUntilMs || 0);

  if (!uid) return;

  const mongoUri = String(cfg.MONGODB_URI || "");
  const db = await getDb(mongoUri);
  if (!db) {
    inMemCooldownByUser.set(uid, until);
    if (inMemCooldownByUser.size > 20000) {
      const firstKey = inMemCooldownByUser.keys().next().value;
      if (firstKey) inMemCooldownByUser.delete(firstKey);
    }
    return;
  }

  try {
    const setObj = {
      updatedAt: new Date(),
    };

    if (Number.isFinite(until) && until > 0) setObj.cooldownUntilMs = until;
    if (Number.isFinite(last429AtMs) && last429AtMs > 0) setObj.last429AtMs = last429AtMs;
    if (inc429Count) setObj.last429Count = 0; // placeholder; use $inc below

    delete setObj._id;
    delete setObj.createdAt;

    const update = {
      $setOnInsert: { createdAt: new Date() },
      $set: setObj,
    };

    if (inc429Count) {
      update.$inc = { last429Count: 1 };
    }

    if (inc429Count) {
      delete update.$set.last429Count;
    }

    await db.collection("tiktok_limits").updateOne(
      { _id: "u:" + uid },
      update,
      { upsert: true }
    );
  } catch (e) {
    logger.error("db.write_failed", { collection: "tiktok_limits", op: "updateOne", err: logger.safeErr(e) });
    inMemCooldownByUser.set(uid, until);
  }
}

export function registerTikTokHandler(bot) {
  bot.on("message:text", async (ctx, next) => {
    const text = String(ctx.message?.text || "");
    if (text.startsWith("/")) return next();

    const url = extractFirstUrl(text);
    if (!url) return next();

    if (!isTikTokUrl(url)) return next();

    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    if (!chatId || !userId) return next();

    const requestId = newReqId();

    const cooldownMsChat = clampMs(Number(cfg.COOLDOWN_SECONDS || 10) * 1000, 10000, 1000, 600000);
    const cd = checkChatCooldown(chatId, cooldownMsChat);
    if (!cd.ok) {
      const waitS = Math.ceil(cd.waitMs / 1000);
      await ctx.reply("Please wait " + waitS + "s before sending another TikTok link in this chat.", {
        reply_to_message_id: ctx.message?.message_id,
      });
      return;
    }

    const globalRps = clampInt(cfg.TIKTOK_GLOBAL_RPS, 5, 1, 100);
    const userRps = clampInt(cfg.TIKTOK_USER_RPS, 1, 1, 10);

    if (!allowRps("tiktok:global", globalRps, globalRps)) {
      await ctx.reply("Busy right now. Please try again in a moment.", {
        reply_to_message_id: ctx.message?.message_id,
      });
      logger.warn("tiktok.ratelimit.global_block", { requestId, globalRps });
      return;
    }

    if (!allowRps("tiktok:user:" + userId, userRps, userRps)) {
      await ctx.reply("Please wait a bit before sending another link.", {
        reply_to_message_id: ctx.message?.message_id,
      });
      logger.warn("tiktok.ratelimit.user_block", { requestId, userId, userRps });
      return;
    }

    const now = Date.now();
    if (now < inMemGlobalCooldownUntil) {
      const remainMs = inMemGlobalCooldownUntil - now;
      await ctx.reply("The downloader is rate-limited right now. Please wait " + msToSecondsCeil(remainMs) + "s and try again.", {
        reply_to_message_id: ctx.message?.message_id,
      });
      logger.warn("tiktok.cooldown.global_block", { requestId, remainMs });
      return;
    }

    const userCooldownUntil = await getCooldownUntilMs({ userId });
    if (now < userCooldownUntil) {
      const remainMs = userCooldownUntil - now;
      await ctx.reply("Please wait " + msToSecondsCeil(remainMs) + "s before trying again. The downloader is temporarily rate-limited.", {
        reply_to_message_id: ctx.message?.message_id,
      });
      logger.info("tiktok.cooldown.user_block", { requestId, userId, remainMs });
      return;
    }

    const inflightKey = getUserKey(ctx);
    if (inflightByUserChat.get(inflightKey)) {
      await ctx.reply("Already processing your previous link; please wait.", {
        reply_to_message_id: ctx.message?.message_id,
      });
      return;
    }

    inflightByUserChat.set(inflightKey, true);

    try {
      const normalized = normalizeUrl(url);

      try {
        await ctx.api.sendChatAction(chatId, "upload_video");
      } catch {}

      const workingMsg = await ctx.reply("Working on it…", {
        reply_to_message_id: ctx.message?.message_id,
      });

      logger.info("tiktok.fetch.start", { requestId, userId, chatId });
      const r = await fetchTikTokDownload({ tiktokUrl: normalized, requestId });

      if (!r.ok) {
        const cls = r.classification || { status: 0, category: "unknown" };

        if (Number(cls.status) === 429) {
          const cooldownMs = clampMs(cfg.TIKTOK_COOLDOWN_MS, 60000, 5000, 15 * 60 * 1000);
          const retryAfterMs = Number(cls.retryAfterSeconds || 0) > 0 ? Math.min(15 * 60 * 1000, Number(cls.retryAfterSeconds) * 1000) : 0;
          const until = Date.now() + Math.max(cooldownMs, retryAfterMs);

          await setCooldownUntilMs({ userId, cooldownUntilMs: until, last429AtMs: Date.now(), inc429Count: true });

          const globalUntil = Date.now() + Math.min(30000, Math.max(5000, Math.floor(cooldownMs / 2)));
          inMemGlobalCooldownUntil = Math.max(inMemGlobalCooldownUntil, globalUntil);

          logger.warn("tiktok.fetch.429", {
            requestId,
            userId,
            cooldownMsApplied: until - Date.now(),
            retryAfterSeconds: cls.retryAfterSeconds ?? undefined,
          });
        }

        const userMsg = userFacingErrorFromClassification(cls);
        logger.warn("tiktok.fetch.failed", {
          requestId,
          userId,
          chatId,
          status: cls.status,
          classification: cls.category,
          msg: userMsg,
          err: r.error,
        });

        await ctx.api.editMessageText(chatId, workingMsg.message_id, userMsg);
        return;
      }

      logger.info("tiktok.fetch.success", { requestId, userId, chatId });

      const caption = buildCaption(r.meta);

      logger.info("media.download.start", { requestId });
      let bytes;
      try {
        bytes = await downloadToBuffer(r.videoUrl, {
          timeoutMs: Number(cfg.HTTP_TIMEOUT_MS || 30000),
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
          "Temporary network issue; please retry. If it keeps failing, try this link directly: " + r.videoUrl
        );
        return;
      }

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
        logger.warn("media.send.failure", {
          requestId,
          method: "video",
          err: logger.safeErr(e),
          note: "sendVideo failed -> fallback document",
        });
      }

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
        logger.warn("media.send.failure", {
          requestId,
          method: "document",
          err: logger.safeErr(e),
          note: "sendDocument failed -> fallback link",
        });
      }

      logger.info("media.send.fallback_link", { requestId });
      await ctx.api.editMessageText(
        chatId,
        workingMsg.message_id,
        "I couldn’t upload the video to Telegram. Try downloading it directly: " + r.videoUrl
      );
    } finally {
      inflightByUserChat.delete(inflightKey);
      if (inflightByUserChat.size > 25000) {
        const firstKey = inflightByUserChat.keys().next().value;
        if (firstKey) inflightByUserChat.delete(firstKey);
      }
    }
  });
}
