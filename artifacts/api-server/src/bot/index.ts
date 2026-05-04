import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger";
import { setupHandlers } from "./handlers";

export function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.error("TELEGRAM_BOT_TOKEN is not set");
    return;
  }

  const bot = new TelegramBot(token, { polling: true });
  setupHandlers(bot);

  bot.on("polling_error", (err) => {
    logger.error(err, "Telegram polling error");
  });

  logger.info("Telegram bot started");
  return bot;
}
