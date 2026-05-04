import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger";
import {
  isMainAdmin, isAdmin, getAdminRole,
  addAdmin, removeAdmin, listAdmins,
  addProfile, removeProfile, listProfiles, getProfile,
  getProfileStats, getUserReview, upsertReview,
  getProfileReviews, getRecentReviews,
  deleteReviewComment, deleteReviewFully,
} from "./db";
import {
  getState, setState, clearState, BotState,
} from "./state";
import {
  mainAdminKeyboard, moderatorKeyboard, visitorKeyboard,
  cancelKeyboard, ratingKeyboard, skipCommentKeyboard,
  profileActionsKeyboard, moderateReviewKeyboard,
  staffActionsKeyboard, deleteProfileKeyboard,
} from "./keyboards";

function starsStr(n: number) {
  return "⭐".repeat(n);
}

async function getKeyboard(userId: number, username?: string) {
  if (await isMainAdmin(username)) return mainAdminKeyboard();
  if (await isAdmin(userId)) return moderatorKeyboard();
  return visitorKeyboard();
}

export function setupHandlers(bot: TelegramBot) {
  // /start command
  bot.onText(/\/start/, async (msg) => {
    const userId = msg.from!.id;
    const username = msg.from?.username;
    clearState(userId);
    const keyboard = await getKeyboard(userId, username);
    const isMA = await isMainAdmin(username);
    const isA = await isAdmin(userId);
    let greeting = "Добро пожаловать в базу анкет!\n\nВыберите действие:";
    if (isMA) greeting = "Добро пожаловать, Главный Админ!\n\nВыберите действие:";
    else if (isA) greeting = "Добро пожаловать, Модератор!\n\nВыберите действие:";
    await bot.sendMessage(msg.chat.id, greeting, { reply_markup: keyboard });
  });

  // Main text message handler
  bot.on("message", async (msg) => {
    if (!msg.text || !msg.from) return;
    const userId = msg.from.id;
    const username = msg.from.username;
    const chatId = msg.chat.id;
    const text = msg.text;
    const state = getState(userId);

    // --- Cancel ---
    if (text === "❌ Отмена") {
      clearState(userId);
      const keyboard = await getKeyboard(userId, username);
      await bot.sendMessage(chatId, "Действие отменено.", { reply_markup: keyboard });
      return;
    }

    // --- State machine ---
    if (state.step !== "idle") {
      await handleState(bot, msg, state, userId, username, chatId, text);
      return;
    }

    // --- Menu buttons ---
    if (text === "📖 Каталог") {
      await showCatalog(bot, chatId, userId, username);
      return;
    }

    if (text === "👥 Управление персоналом") {
      if (!await isMainAdmin(username)) {
        await bot.sendMessage(chatId, "⛔ Доступ запрещён.");
        return;
      }
      await bot.sendMessage(chatId, "Управление персоналом:", { reply_markup: staffActionsKeyboard() });
      return;
    }

    if (text === "➕ Добавить анкету") {
      if (!await isMainAdmin(username)) {
        await bot.sendMessage(chatId, "⛔ Доступ запрещён.");
        return;
      }
      setState(userId, { step: "awaiting_profile_name" });
      await bot.sendMessage(chatId, "Введите имя человека для анкеты:", { reply_markup: cancelKeyboard() });
      return;
    }

    if (text === "📋 Список анкет") {
      if (!await isMainAdmin(username)) {
        await bot.sendMessage(chatId, "⛔ Доступ запрещён.");
        return;
      }
      await showProfileList(bot, chatId, true);
      return;
    }

    if (text === "🛡 Модерация комментариев") {
      if (!await isAdmin(userId) && !await isMainAdmin(username)) {
        await bot.sendMessage(chatId, "⛔ Доступ запрещён.");
        return;
      }
      await showModerationList(bot, chatId);
      return;
    }
  });

  // Photo handler (for adding profile)
  bot.on("photo", async (msg) => {
    if (!msg.from) return;
    const userId = msg.from.id;
    const state = getState(userId);
    if (state.step !== "awaiting_profile_photo") return;

    const chatId = msg.chat.id;
    const username = msg.from.username;
    const fileId = msg.photo![msg.photo!.length - 1].file_id;

    try {
      const profile = await addProfile(state.name, fileId);
      clearState(userId);
      const keyboard = await getKeyboard(userId, username);
      await bot.sendMessage(chatId, `✅ Анкета «${profile.name}» добавлена!`, { reply_markup: keyboard });
    } catch (err) {
      logger.error(err, "Failed to add profile");
      await bot.sendMessage(chatId, "Ошибка при добавлении анкеты.");
    }
  });

  // Callback query handler
  bot.on("callback_query", async (query) => {
    if (!query.data || !query.from) return;
    const userId = query.from.id;
    const username = query.from.username;
    const chatId = query.message?.chat.id!;
    const data = query.data;

    try {
      await handleCallback(bot, query, userId, username, chatId, data);
    } catch (err) {
      logger.error(err, "Callback error");
    } finally {
      await bot.answerCallbackQuery(query.id);
    }
  });
}

async function handleState(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  state: BotState,
  userId: number,
  username: string | undefined,
  chatId: number,
  text: string,
) {
  if (state.step === "awaiting_profile_name") {
    setState(userId, { step: "awaiting_profile_photo", name: text });
    await bot.sendMessage(chatId, `Имя: «${text}»\n\nТеперь отправьте фото для анкеты:`, { reply_markup: cancelKeyboard() });
    return;
  }

  if (state.step === "awaiting_admin_id_add") {
    const tgId = parseInt(text.trim(), 10);
    if (isNaN(tgId)) {
      await bot.sendMessage(chatId, "Неверный формат. Введите числовой Telegram ID:");
      return;
    }
    await addAdmin(tgId, undefined, "moderator");
    clearState(userId);
    const keyboard = await getKeyboard(userId, username);
    await bot.sendMessage(chatId, `✅ Модератор с ID ${tgId} добавлен.`, { reply_markup: keyboard });
    return;
  }

  if (state.step === "awaiting_admin_id_remove") {
    const tgId = parseInt(text.trim(), 10);
    if (isNaN(tgId)) {
      await bot.sendMessage(chatId, "Неверный формат. Введите числовой Telegram ID:");
      return;
    }
    await removeAdmin(tgId);
    clearState(userId);
    const keyboard = await getKeyboard(userId, username);
    await bot.sendMessage(chatId, `✅ Модератор с ID ${tgId} удалён.`, { reply_markup: keyboard });
    return;
  }

  if (state.step === "awaiting_comment") {
    const comment = text.trim() || undefined;
    await upsertReview(state.profileId, userId, state.rating, comment);
    clearState(userId);
    const keyboard = await getKeyboard(userId, username);
    await bot.sendMessage(
      chatId,
      `✅ Ваш отзыв сохранён!\n\nОценка: ${starsStr(state.rating)}\n${comment ? `Комментарий: «${comment}»` : ""}`,
      { reply_markup: keyboard },
    );
    return;
  }
}

async function handleCallback(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  userId: number,
  username: string | undefined,
  chatId: number,
  data: string,
) {
  // --- View profile ---
  if (data.startsWith("profile:")) {
    const profileId = parseInt(data.split(":")[1], 10);
    await showProfile(bot, chatId, userId, username, profileId);
    return;
  }

  // --- Start rating ---
  if (data.startsWith("review:") || data.startsWith("change_review:")) {
    const profileId = parseInt(data.split(":")[1], 10);
    setState(userId, { step: "awaiting_rating", profileId });
    await bot.sendMessage(chatId, "Выберите оценку:", { reply_markup: ratingKeyboard(profileId) });
    return;
  }

  // --- Rating selected ---
  if (data.startsWith("rate:")) {
    const [, pid, ratingStr] = data.split(":");
    const profileId = parseInt(pid, 10);
    const rating = parseInt(ratingStr, 10);
    setState(userId, { step: "awaiting_comment", profileId, rating });
    await bot.sendMessage(
      chatId,
      `Оценка ${starsStr(rating)} принята!\n\nНапишите комментарий или нажмите «Пропустить»:`,
      { reply_markup: skipCommentKeyboard() },
    );
    return;
  }

  // --- Skip comment ---
  if (data === "skip_comment") {
    const state = getState(userId);
    if (state.step !== "awaiting_comment") return;
    await upsertReview(state.profileId, userId, state.rating);
    clearState(userId);
    const keyboard = await getKeyboard(userId, username);
    await bot.sendMessage(
      chatId,
      `✅ Отзыв сохранён! Оценка: ${starsStr(state.rating)}`,
      { reply_markup: keyboard },
    );
    return;
  }

  // --- Show reviews ---
  if (data.startsWith("reviews:")) {
    const profileId = parseInt(data.split(":")[1], 10);
    await showReviews(bot, chatId, profileId);
    return;
  }

  // --- Moderation: delete comment only ---
  if (data.startsWith("del_comment:")) {
    if (!await isAdmin(userId) && !await isMainAdmin(username)) {
      await bot.sendMessage(chatId, "⛔ Доступ запрещён.");
      return;
    }
    const reviewId = parseInt(data.split(":")[1], 10);
    await deleteReviewComment(reviewId);
    await bot.sendMessage(chatId, "✅ Комментарий удалён. Оценка сохранена.");
    return;
  }

  // --- Moderation: delete review fully ---
  if (data.startsWith("del_review:")) {
    if (!await isAdmin(userId) && !await isMainAdmin(username)) {
      await bot.sendMessage(chatId, "⛔ Доступ запрещён.");
      return;
    }
    const reviewId = parseInt(data.split(":")[1], 10);
    await deleteReviewFully(reviewId);
    await bot.sendMessage(chatId, "✅ Отзыв полностью удалён.");
    return;
  }

  // --- Staff management ---
  if (data === "add_admin") {
    if (!await isMainAdmin(username)) {
      await bot.sendMessage(chatId, "⛔ Доступ запрещён.");
      return;
    }
    setState(userId, { step: "awaiting_admin_id_add" });
    await bot.sendMessage(chatId, "Введите Telegram ID нового модератора:", { reply_markup: cancelKeyboard() });
    return;
  }

  if (data === "remove_admin") {
    if (!await isMainAdmin(username)) {
      await bot.sendMessage(chatId, "⛔ Доступ запрещён.");
      return;
    }
    setState(userId, { step: "awaiting_admin_id_remove" });
    await bot.sendMessage(chatId, "Введите Telegram ID модератора для удаления:", { reply_markup: cancelKeyboard() });
    return;
  }

  if (data === "list_admins") {
    if (!await isMainAdmin(username)) {
      await bot.sendMessage(chatId, "⛔ Доступ запрещён.");
      return;
    }
    const admins = await listAdmins();
    if (admins.length === 0) {
      await bot.sendMessage(chatId, "Список модераторов пуст.");
      return;
    }
    const lines = admins.map((a, i) => `${i + 1}. ID: ${a.telegramId}${a.username ? ` (@${a.username})` : ""} — ${a.role}`);
    await bot.sendMessage(chatId, `Список модераторов:\n\n${lines.join("\n")}`);
    return;
  }

  // --- Delete profile (main admin only) ---
  if (data.startsWith("delete_profile:")) {
    if (!await isMainAdmin(username)) {
      await bot.sendMessage(chatId, "⛔ Доступ запрещён.");
      return;
    }
    const profileId = parseInt(data.split(":")[1], 10);
    await removeProfile(profileId);
    await bot.sendMessage(chatId, "✅ Анкета удалена.");
    return;
  }
}

async function showCatalog(bot: TelegramBot, chatId: number, userId: number, username?: string) {
  const profiles = await listProfiles();
  if (profiles.length === 0) {
    await bot.sendMessage(chatId, "Каталог пуст. Анкеты ещё не добавлены.");
    return;
  }
  await bot.sendMessage(chatId, `📖 Каталог анкет (${profiles.length} чел.):`);
  for (const p of profiles) {
    const stats = await getProfileStats(p.id);
    const userReview = await getUserReview(p.id, userId);
    const caption =
      `👤 ${p.name}\n` +
      `⭐ Рейтинг: ${stats.avg > 0 ? stats.avg.toFixed(1) : "нет"} (${stats.count} отзывов)`;
    await bot.sendPhoto(chatId, p.photoUrl, {
      caption,
      reply_markup: profileActionsKeyboard(p.id, !!userReview),
    });
  }
}

async function showProfile(bot: TelegramBot, chatId: number, userId: number, username: string | undefined, profileId: number) {
  const p = await getProfile(profileId);
  if (!p) {
    await bot.sendMessage(chatId, "Анкета не найдена.");
    return;
  }
  const stats = await getProfileStats(p.id);
  const userReview = await getUserReview(p.id, userId);
  let caption = `👤 ${p.name}\n⭐ Рейтинг: ${stats.avg > 0 ? stats.avg.toFixed(1) : "нет"} (${stats.count} отзывов)`;
  if (userReview) {
    caption += `\n\nВаша оценка: ${starsStr(userReview.rating)}${userReview.comment ? `\nКомментарий: «${userReview.comment}»` : ""}`;
  }
  await bot.sendPhoto(chatId, p.photoUrl, {
    caption,
    reply_markup: profileActionsKeyboard(p.id, !!userReview),
  });
}

async function showProfileList(bot: TelegramBot, chatId: number, withDeleteButton: boolean) {
  const profiles = await listProfiles();
  if (profiles.length === 0) {
    await bot.sendMessage(chatId, "Список анкет пуст.");
    return;
  }
  await bot.sendMessage(chatId, `📋 Список анкет (${profiles.length}):`);
  for (const p of profiles) {
    const stats = await getProfileStats(p.id);
    const caption = `👤 ${p.name}\n⭐ Рейтинг: ${stats.avg > 0 ? stats.avg.toFixed(1) : "нет"} (${stats.count} отзывов)`;
    const markup = withDeleteButton ? deleteProfileKeyboard(p.id) : undefined;
    await bot.sendPhoto(chatId, p.photoUrl, { caption, reply_markup: markup });
  }
}

async function showReviews(bot: TelegramBot, chatId: number, profileId: number) {
  const reviews = await getProfileReviews(profileId);
  if (reviews.length === 0) {
    await bot.sendMessage(chatId, "Отзывов пока нет.");
    return;
  }
  const p = await getProfile(profileId);
  await bot.sendMessage(chatId, `📝 Отзывы на анкету «${p?.name ?? profileId}»:`);
  for (const r of reviews) {
    if (r.commentDeleted && !r.comment) {
      const text = `👤 Анонимный отзыв\nОценка: ${r.rating}⭐️\n[Комментарий удалён модератором]`;
      await bot.sendMessage(chatId, text);
    } else {
      const text =
        `👤 Анонимный отзыв\nОценка: ${r.rating}⭐️` +
        (r.comment ? `\nКомментарий: «${r.comment}»` : "");
      await bot.sendMessage(chatId, text);
    }
  }
}

async function showModerationList(bot: TelegramBot, chatId: number) {
  const recent = await getRecentReviews(20);
  if (recent.length === 0) {
    await bot.sendMessage(chatId, "Отзывов нет.");
    return;
  }
  await bot.sendMessage(chatId, "🛡 Последние отзывы (для модерации):");
  for (const { review: r, profile: p } of recent) {
    const text =
      `Анкета: «${p?.name ?? r.profileId}»\n` +
      `Оценка: ${r.rating}⭐️\n` +
      (r.comment ? `Комментарий: «${r.comment}»` : "[без комментария]");
    await bot.sendMessage(chatId, text, { reply_markup: moderateReviewKeyboard(r.id) });
  }
}
