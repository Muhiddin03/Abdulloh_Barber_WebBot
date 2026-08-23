import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
  });
}

const db = admin.firestore();

function pad(n) {
  return n.toString().padStart(2, '0');
}

async function sendTelegramMessage(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return res.json();
}

// Called on a schedule (every few minutes) by a GitHub Actions workflow.
// Sends a Telegram reminder to customers 15 minutes before their booking,
// and another right when their turn arrives.
export default async function handler(req, res) {
  try {
    const settingsSnap = await db.collection('settings').doc('shop_settings').get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const botToken = settings.telegramBotToken;

    if (!botToken) {
      return res.status(200).json({ ok: true, skipped: 'Telegram bot token sozlanmagan' });
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const snap = await db.collection('bookings')
      .where('date', '==', todayStr)
      .where('status', '==', 'pending')
      .get();

    let sent15 = 0;
    let sentArrived = 0;

    for (const doc of snap.docs) {
      const booking = doc.data();
      if (!booking.telegramUserId) continue;

      const [h, m] = booking.time.split(':').map(Number);
      const diff = (h * 60 + m) - nowMinutes;

      const detailsSnap = await db.collection('bookingDetails').doc(doc.id).get();
      const clientName = detailsSnap.exists ? detailsSnap.data().clientName : '';

      if (diff <= 15 && diff > 10 && !booking.reminder15Sent) {
        await sendTelegramMessage(
          botToken,
          booking.telegramUserId,
          `Hurmatli ${clientName}, navbatingizga 15 daqiqa qoldi (soat ${booking.time}). Kutamiz!`
        );
        await doc.ref.update({ reminder15Sent: true });
        sent15++;
      }

      if (diff <= 0 && diff > -5 && !booking.reminderArrivedSent) {
        await sendTelegramMessage(
          botToken,
          booking.telegramUserId,
          `Hurmatli ${clientName}, navbatingiz keldi! Iltimos sartaroshxonaga tashrif buyuring.`
        );
        await doc.ref.update({ reminderArrivedSent: true });
        sentArrived++;
      }
    }

    res.status(200).json({ ok: true, checked: snap.size, sent15, sentArrived });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
}
