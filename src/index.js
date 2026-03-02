import "dotenv/config";

import { run } from "@grammyjs/runner";
import { GrammyError, HttpError } from "grammy";

import { cfg } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { createBot } from "./bot.js";
import { buildBotProfile } from "./lib/botProfile.js";

process.on("unhandledRejection", (r) => {
  logger.error("process.unhandledRejection", { err: logger.safeErr(r) });
  process.exit(1);
});
process.on("uncaughtException", (e) => {
  logger.error("process.uncaughtException", { err: logger.safeErr(e) });
  process.exit(1);
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function boot() {
  logger.info("boot.start", {
    nodeEnv: process.env.NODE_ENV || "",
    TELEGRAM_BOT_TOKEN_set: !!cfg.TELEGRAM_BOT_TOKEN,
    RAPIDAPI_KEY_set: !!cfg.RAPIDAPI_KEY,
    RAPIDAPI_HOST_set: !!cfg.RAPIDAPI_HOST,
    RAPIDAPI_TIKTOK_ENDPOINT_BASE_set: !!cfg.RAPIDAPI_TIKTOK_ENDPOINT_BASE,
  });

  if (!cfg.TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is required. Add it to your env and restart.");
    process.exit(1);
  }

  const botProfile = buildBotProfile();
  logger.info("bot.profile", { lines: botProfile.split("\n").length });

  const bot = createBot(cfg.TELEGRAM_BOT_TOKEN);

  bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;

    if (e instanceof GrammyError) {
      logger.warn("telegram.api_error", {
        method: e.method,
        description: e.description,
      });
      return;
    }

    if (e instanceof HttpError) {
      logger.warn("telegram.http_error", { err: String(e) });
      return;
    }

    logger.error("telegram.unknown_error", { err: logger.safeErr(e) });
  });

  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
  } catch (e) {
    logger.warn("telegram.deleteWebhook_failed", { err: logger.safeErr(e) });
  }

  // runner concurrency MUST be 1 (keeps memory stable on slow media)
  let backoffMs = 2000;
  while (true) {
    logger.info("polling.start", { backoffMs });
    try {
      const runner = run(bot, { concurrency: 1 });

      // lightweight mem log
      const memTimer = setInterval(() => {
        const m = process.memoryUsage();
        logger.info("mem", {
          rssMB: Math.round(m.rss / 1e6),
          heapUsedMB: Math.round(m.heapUsed / 1e6),
        });
      }, 60000);

      await runner.task();
      clearInterval(memTimer);

      // If runner.task resolves, treat as unexpected stop.
      logger.warn("polling.stopped", {});
      await sleep(backoffMs);
      backoffMs = Math.min(20000, Math.round(backoffMs * 1.8));
    } catch (e) {
      const msg = logger.safeErr(e);
      const is409 = String(msg).includes("409") || String(msg).toLowerCase().includes("conflict");
      logger.warn("polling.failure", { err: msg, backoffMs, is409 });
      await sleep(backoffMs);
      backoffMs = Math.min(20000, Math.round(backoffMs * 1.8));
    }
  }
}

boot().catch((e) => {
  logger.error("boot.failure", { err: logger.safeErr(e) });
  process.exit(1);
});
