import admin from 'firebase-admin';

function getDb() {
  if (admin.apps.length) {
    return admin.firestore();
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      const certObj = JSON.parse(raw);
      admin.initializeApp({
        credential: admin.credential.cert(certObj)
      });
      return admin.firestore();
    } catch (e) {
      console.error('Firebase Admin init warning:', e.message);
    }
  }
  return null;
}

export default async function handler(req, res) {
  // GET check for browser testing
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Telegram Bot Webhook is ACTIVE' });
  }

  if (req.method !== 'POST') {
    return res.status(200).send('Telegram Bot Webhook Active');
  }

  try {
    let update = req.body;
    if (typeof update === 'string') {
      try {
        update = JSON.parse(update);
      } catch (e) {
        console.error('Body parse error:', e);
      }
    }

    if (!update || typeof update !== 'object') {
      return res.status(200).json({ ok: true, note: 'No valid payload' });
    }

    const msg = update.message || update.edited_message || update.callback_query?.message;
    const chatId = msg?.chat?.id || update.callback_query?.from?.id;
    const rawText = (msg?.text || update.callback_query?.data || '').trim();
    const text = rawText.toLowerCase();

    if (!chatId) {
      return res.status(200).json({ ok: true, note: 'No chatId' });
    }

    // Default settings overridden by Query Params first, then Firestore
    let shopName = req.query?.shopName || 'Elite Barber Shop';
    let phone = req.query?.phone || '+998 90 123 45 67';
    let address = req.query?.address || 'Toshkent sh., Chilonzor tumani';
    let barberName = req.query?.barberName || 'Abdulloh Master';
    let barberBio = req.query?.barberBio || '10 yillik tajribaga ega professional erkaklar sartaroshi va stilist.';
    let startWork = req.query?.startWork || '09:00';
    let endWork = req.query?.endWork || '20:00';
    let botToken = req.query?.token || process.env.VITE_TELEGRAM_BOT_TOKEN;
    let webAppUrl = req.query?.appUrl || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `https://${req.headers.host}`);
    let servicesRaw = req.query?.services || '';

    // Read from Firestore if available
    try {
      const db = getDb();
      if (db) {
        const snap = await db.collection('settings').doc('shop_settings').get();
        if (snap.exists) {
          const s = snap.data();
          if (s.shopName) shopName = s.shopName;
          if (s.phone) phone = s.phone;
          if (s.address) address = s.address;
          if (s.telegramBotToken) botToken = s.telegramBotToken;
          if (s.webAppUrl) webAppUrl = s.webAppUrl;
          if (s.barberName) barberName = s.barberName;
          if (s.barberBio) barberBio = s.barberBio;
          if (s.workingHours?.start) startWork = s.workingHours.start;
          if (s.workingHours?.end) endWork = s.workingHours.end;
        }

        const servicesSnap = await db.collection('services').get();
        if (!servicesSnap.empty) {
          const list = [];
          servicesSnap.forEach(doc => {
            const data = doc.data();
            list.push(`${data.name}:${data.price}`);
          });
          if (list.length > 0) {
            servicesRaw = list.join('|');
          }
        }
      }
    } catch (e) {
      console.error('Firestore settings read error:', e.message);
    }

    if (!botToken) {
      return res.status(200).json({ ok: true, warning: 'No bot token found' });
    }

    // Format webAppUrl
    webAppUrl = (webAppUrl || '').trim();
    if (!webAppUrl.startsWith('https://')) {
      webAppUrl = 'https://' + webAppUrl.replace(/^http:\/\//, '');
    }

    let replyText = `Assalomu alaykum! 💈 <b>${shopName}</b> rasmiy Telegram botiga xush kelibsiz!\n\n` +
      `👑 <b>Usta Sartarosh:</b> ${barberName}\n` +
      `📝 <b>Ma'lumot:</b> ${barberBio}\n\n` +
      `📍 <b>Manzil:</b> ${address}\n` +
      `📞 <b>Telefon:</b> ${phone}\n` +
      `🕒 <b>Ish vaqti:</b> Har kuni ${startWork} - ${endWork}\n\n` +
      `Online navbat olish hamda xizmatlar bilan tanishish uchun pastdagi <b>"✂️ Online Navbat Olish"</b> tugmasini bosing 👇`;

    if (text.includes('xizmat') || text.includes('narx')) {
      let servicesFormattedText = '';
      if (servicesRaw) {
        const items = servicesRaw.split('|').filter(Boolean);
        servicesFormattedText = items.map(item => {
          const parts = item.split(':');
          const name = parts[0] ? parts[0].trim() : 'Xizmat';
          const priceVal = parts[1] ? parseFloat(parts[1]) : 0;
          const formattedPrice = new Intl.NumberFormat('uz-UZ').format(priceVal) + " so'm";
          return `• <b>${name}</b> — ${formattedPrice}`;
        }).join('\n');
      }

      if (!servicesFormattedText) {
        servicesFormattedText = `• <b>Oddiy Soch Olish</b> — 50,000 so'm\n` +
          `• <b>Soqol Olish / Shakl berish</b> — 30,000 so'm\n` +
          `• <b>Kombinatsiya (Soch + Soqol)</b> — 70,000 so'm\n` +
          `• <b>Kuyov Paketi</b> — 200,000 so'm`;
      }

      replyText = `💈 <b>${shopName} Xizmatlari va Narxlari:</b>\n\n` +
        `${servicesFormattedText}\n\n` +
        `Navbat olish uchun pastdagi <b>"✂️ Online Navbat Olish"</b> tugmasini bosing 👇`;
    } else if (text.includes('manzil') || text.includes('telefon') || text.includes('aloqa')) {
      replyText = `📍 <b>Manzil va Bog'lanish:</b>\n\n` +
        `🏢 <b>Sartaroshxona:</b> ${shopName}\n` +
        `👑 <b>Usta:</b> ${barberName}\n` +
        `📍 <b>Manzil:</b> ${address}\n` +
        `📞 <b>Telefon:</b> ${phone}\n` +
        `🕒 <b>Ish vaqti:</b> ${startWork} - ${endWork}\n\n` +
        `Navbat band qilish uchun pastdagi <b>"✂️ Online Navbat Olish"</b> tugmasini bosing!`;
    }

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

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });

    const tgData = await tgRes.json();
    return res.status(200).json({ ok: true, telegramResponse: tgData });
  } catch (err) {
    console.error('Webhook global error:', err);
    return res.status(200).json({ ok: true, error: err.message });
  }
}
