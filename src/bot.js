import { Bot } from "grammy";
import { registerCommands } from "./commands/loader.js";
import { registerTikTokHandler } from "./features/tiktokHandler.js";

export function createBot(token) {
  const bot = new Bot(token);

  // Commands first (order matters)
  registerCommands(bot);

  // Auto TikTok link handler after commands
  registerTikTokHandler(bot);

  return bot;
}
