import admin from 'firebase-admin';

if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
    });
  } catch (e) {
    console.error('Firebase Admin init error:', e);
  }
}

export default async function handler(req, res) {
  // Always return 200 OK to Telegram so it doesn't retry unnecessarily
  if (req.method !== 'POST') {
    return res.status(200).send('Telegram Bot Webhook Active');
  }

  try {
    const update = req.body;
    if (!update || !update.message) {
      return res.status(200).json({ ok: true, note: 'No message update' });
    }

    const chatId = update.message.chat?.id;
    const text = (update.message.text || '').toLowerCase().trim();

    if (!chatId) {
      return res.status(200).json({ ok: true });
    }

    const queryToken = req.query?.token;
    const queryAppUrl = req.query?.appUrl;
    const queryShopName = req.query?.shopName;
    const queryPhone = req.query?.phone;

    // Default settings fallback
    let shopName = queryShopName || 'Elite Barber Shop';
    let phone = queryPhone || '+998 90 123 45 67';
    let address = 'Toshkent shahri';
    let botToken = queryToken || process.env.VITE_TELEGRAM_BOT_TOKEN;
    let webAppUrl = queryAppUrl || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `https://${req.headers.host}`);

    const queryBarberName = req.query?.barberName;
    const queryBarberBio = req.query?.barberBio;

    let barberName = queryBarberName || 'Abdulloh Master';
    let barberBio = queryBarberBio || '10 yillik tajribaga ega professional erkaklar sartaroshi va stilist.';

    if (admin.apps.length) {
      try {
        const db = admin.firestore();
        const settingsSnap = await db.collection('settings').doc('shop_settings').get();
        if (settingsSnap.exists) {
          const s = settingsSnap.data();
          if (s.shopName) shopName = s.shopName;
          if (s.phone) phone = s.phone;
          if (s.address) address = s.address;
          if (s.telegramBotToken) botToken = s.telegramBotToken;
          if (s.webAppUrl) webAppUrl = s.webAppUrl;
          if (s.barberName) barberName = s.barberName;
          if (s.barberBio) barberBio = s.barberBio;
        }
      } catch (e) {
        console.error('Firestore read error in webhook:', e);
      }
    }

    if (!botToken) {
      return res.status(200).json({ ok: true, warning: 'No bot token configured' });
    }

    // Ensure webAppUrl uses https protocol
    webAppUrl = webAppUrl.trim();
    if (!webAppUrl.startsWith('https://')) {
      webAppUrl = 'https://' + webAppUrl.replace(/^http:\/\//, '');
    }

    let replyText = `Assalomu alaykum! 💈 <b>${shopName}</b> rasmiy Telegram botiga xush kelibsiz!\n\n` +
      `👑 <b>Usta Sartarosh:</b> ${barberName}\n` +
      `📝 <b>Ma'lumot:</b> ${barberBio}\n\n` +
      `📍 <b>Manzil:</b> ${address}\n` +
      `📞 <b>Telefon:</b> ${phone}\n` +
      `🕒 <b>Ish vaqti:</b> Har kuni 09:00 - 20:00\n\n` +
      `Online navbat olish hamda xizmatlar bilan tanishish uchun pastdagi <b>"✂️ Online Navbat Olish"</b> tugmasini bosing 👇`;

    if (text.includes('xizmat') || text.includes('narx')) {
      replyText = `💈 <b>${shopName} Xizmatlari va Narxlari:</b>\n\n` +
        `• Oddiy Soch Olish — 50,000 so'm\n` +
        `• Soqol Olish / Shakl berish — 30,000 so'm\n` +
        `• Kombinatsiya (Soch + Soqol) — 70,000 so'm\n` +
        `• Kuyov Paketi — 200,000 so'm\n\n` +
        `Navbat olish uchun pastdagi <b>"✂️ Online Navbat Olish"</b> tugmasini bosing 👇`;
    } else if (text.includes('manzil') || text.includes('telefon') || text.includes('aloqa')) {
      replyText = `📍 <b>Manzil va Bog'lanish:</b>\n\n` +
        `🏢 <b>Sartaroshxona:</b> ${shopName}\n` +
        `👑 <b>Usta:</b> ${barberName}\n` +
        `📍 <b>Manzil:</b> ${address}\n` +
        `📞 <b>Telefon:</b> ${phone}\n\n` +
        `Navbat band qilish uchun pastdagi <b>"✂️ Online Navbat Olish"</b> tugmasini bosing!`;
    }

    // Reply Keyboard Grid (Bottom of screen under message box, like in screenshot)
    const replyMarkup = {
      keyboard: [
        [
          {
            text: '✂️ Online Navbat Olish',
            web_app: { url: webAppUrl }
          }
        ],
        [
          { text: '💈 Xizmatlar va Narxlar' },
          { text: '📍 Manzil va Telefon' }
        ]
      ],
      resize_keyboard: true
    };

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook execution error:', err);
    return res.status(200).json({ ok: true, error: err.message });
  }
}
