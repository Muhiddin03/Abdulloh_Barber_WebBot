const ENV_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const ENV_ADMIN_CHAT_ID = import.meta.env.VITE_TELEGRAM_ADMIN_CHAT_ID;

// Settings (admin panel) values take priority over .env — this lets each
// deployment of this app be reconfigured for a different bot/owner without
// touching code or redeploying.
export async function notifyAdminNewBooking(booking, settings = {}) {
  const BOT_TOKEN = settings.telegramBotToken || ENV_BOT_TOKEN;
  const ADMIN_CHAT_ID = settings.telegramChatId || ENV_ADMIN_CHAT_ID;
  if (!BOT_TOKEN || !ADMIN_CHAT_ID) return;

  const text =
    `🆕 <b>Yangi navbat!</b>\n\n` +
    `👤 ${booking.clientName}\n` +
    `📞 ${booking.clientPhone}\n` +
    `✂️ ${booking.serviceName}\n` +
    `📅 ${booking.date}, soat ${booking.time}`;

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.warn("Telegram xabarini yuborib bo'lmadi:", e);
  }
}
