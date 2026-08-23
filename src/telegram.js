const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = import.meta.env.VITE_TELEGRAM_ADMIN_CHAT_ID;

export async function notifyAdminNewBooking(booking) {
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
