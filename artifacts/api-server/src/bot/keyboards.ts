import TelegramBot from "node-telegram-bot-api";

export function mainAdminKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: "👥 Управление персоналом" }, { text: "➕ Добавить анкету" }],
      [{ text: "📋 Список анкет" }, { text: "📖 Каталог" }],
    ],
    resize_keyboard: true,
  };
}

export function moderatorKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: "🛡 Модерация комментариев" }],
      [{ text: "📖 Каталог" }],
    ],
    resize_keyboard: true,
  };
}

export function visitorKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [[{ text: "📖 Каталог" }]],
    resize_keyboard: true,
  };
}

export function cancelKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [[{ text: "❌ Отмена" }]],
    resize_keyboard: true,
  };
}

export function ratingKeyboard(profileId: number): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [1, 2, 3, 4, 5].map((n) => ({
        text: "⭐".repeat(n),
        callback_data: `rate:${profileId}:${n}`,
      })),
    ],
  };
}

export function skipCommentKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{ text: "Пропустить комментарий", callback_data: "skip_comment" }]],
  };
}

export function profileActionsKeyboard(profileId: number, hasReview: boolean): TelegramBot.InlineKeyboardMarkup {
  const buttons: TelegramBot.InlineKeyboardButton[][] = [
    [{ text: "⭐ Оставить отзыв", callback_data: `review:${profileId}` }],
    [{ text: "📝 Читать отзывы", callback_data: `reviews:${profileId}` }],
  ];
  if (hasReview) {
    buttons.splice(1, 0, [{ text: "✏️ Изменить отзыв", callback_data: `change_review:${profileId}` }]);
  }
  return { inline_keyboard: buttons };
}

export function moderateReviewKeyboard(reviewId: number): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "🗑 Удалить комментарий", callback_data: `del_comment:${reviewId}` },
        { text: "❌ Удалить отзыв полностью", callback_data: `del_review:${reviewId}` },
      ],
    ],
  };
}

export function staffActionsKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "➕ Добавить модератора", callback_data: "add_admin" }],
      [{ text: "➖ Удалить модератора", callback_data: "remove_admin" }],
      [{ text: "📋 Список модераторов", callback_data: "list_admins" }],
    ],
  };
}

export function deleteProfileKeyboard(profileId: number): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "🗑 Удалить эту анкету", callback_data: `delete_profile:${profileId}` }],
    ],
  };
}
