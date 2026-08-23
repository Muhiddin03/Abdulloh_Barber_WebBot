import { db, auth, isFirebaseEnabled } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';

const STORAGE_KEYS = {
  SERVICES: 'sartarosh_services',
  BOOKINGS: 'sartarosh_bookings',
  TRANSACTIONS: 'sartarosh_transactions',
  SETTINGS: 'sartarosh_settings'
};

const DEFAULT_SERVICES = [
  { id: 's1', name: 'Oddiy Soch olish', price: 50000, duration: 30, description: 'Soch olish va yuvish, turmaklash', icon: 'Scissors', type: 'regular' },
  { id: 's2', name: 'Soqol olish', price: 30000, duration: 30, description: 'Soqolni ustarada tekislash va parvarishlash jeli', icon: 'Sparkles', type: 'regular' },
  { id: 's3', name: 'Kombinatsiya (Soch + Soqol)', price: 70000, duration: 60, description: 'Soch va soqol, yuvish va styling', icon: 'Wind', type: 'regular' },
  { id: 's4', name: 'Kuyov paketi (Maxsus premium)', price: 200000, duration: 120, description: 'Kuyovlar uchun soch-soqol, yuz parvarishi, piling va maxsus styling', icon: 'Crown', type: 'groom' },
  { id: 's5', name: 'Soch yuvish va fen', price: 20000, duration: 30, description: 'Maxsus shampun bilan yuvish va fenlash', icon: 'Smile', type: 'regular' }
];

const DEFAULT_SETTINGS = {
  shopName: 'Elite Barber Shop',
  phone: '+998 90 123 45 67',
  address: 'Toshkent sh., Chilonzor tumani',
  pinCode: '7777',
  workingHours: { start: '09:00', end: '20:00' },
  slotInterval: 30,
  smsTemplate: "Assalomu alaykum, {clientName}! {shopName}dan eslatma: navbatingiz {date} kuni soat {time}da ({serviceName}). Sizni kutamiz!",
  telegramBotToken: '',
  telegramChatId: '',
  webAppUrl: '',
  barberName: 'Abdulloh Master',
  barberBio: '10 yillik tajribaga ega professional erkaklar sartaroshi va stilist. Zamonaviy soch va soqol uslublari bo\'yicha yuqori malakali mutaxassis.',
  barberImage: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&q=80&w=400',
  barberInstagram: 'https://instagram.com'
};

// Seed Local Database
const seedLocalDB = () => {
  if (!localStorage.getItem(STORAGE_KEYS.SERVICES)) {
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(DEFAULT_SERVICES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.BOOKINGS)) {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify([
      {
        id: 'b1',
        clientName: 'Sardorbek',
        clientPhone: '+998 93 111 22 33',
        serviceId: 's1',
        serviceName: 'Oddiy Soch olish',
        price: 50000,
        date: today,
        time: '10:00',
        endTime: '10:30',
        slots: ['10:00'],
        status: 'completed',
        createdAt: new Date().toISOString()
      },
      {
        id: 'b2',
        clientName: 'Azizbek (Kuyov)',
        clientPhone: '+998 90 999 88 77',
        serviceId: 's4',
        serviceName: 'Kuyov paketi (Maxsus premium)',
        price: 200000,
        date: today,
        time: '14:00',
        endTime: '16:00',
        slots: ['14:00', '14:30', '15:00', '15:30'],
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    ]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([
      {
        id: 't1',
        type: 'income',
        amount: 50000,
        date: today,
        category: 'Oddiy Soch olish',
        description: 'Sardorbek navbati',
        createdAt: new Date().toISOString()
      },
      {
        id: 't2',
        type: 'expense',
        amount: 120000,
        date: today,
        category: 'Asbob-uskunalar',
        description: 'Soqol jeli va shampunlar xaridi',
        createdAt: new Date().toISOString()
      }
    ]));
  }
};

seedLocalDB();

export const dbService = {
  // --- SERVICES ---
  getServices: async () => {
    if (isFirebaseEnabled) {
      try {
        const snap = await getDocs(collection(db, 'services'));
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (list.length === 0) {
          // Nothing in Firestore yet. Only an authenticated admin session may
          // seed it (public writes are blocked by the security rules) —
          // everyone else just sees the in-memory defaults for now.
          if (auth?.currentUser) {
            for (const s of DEFAULT_SERVICES) {
              await setDoc(doc(db, 'services', s.id), s);
            }
          }
          return DEFAULT_SERVICES;
        }
        return list;
      } catch (e) {
        console.error(e);
      }
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SERVICES)) || [];
  },
  
  saveServices: async (services) => {
    if (isFirebaseEnabled) {
      for (const s of services) {
        await setDoc(doc(db, 'services', s.id), s);
      }
      return;
    }
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
  },

  updateService: async (updatedService) => {
    if (isFirebaseEnabled) {
      await setDoc(doc(db, 'services', updatedService.id), updatedService);
      return true;
    }
    const services = await dbService.getServices();
    const index = services.findIndex(s => s.id === updatedService.id);
    if (index !== -1) {
      services[index] = updatedService;
      await dbService.saveServices(services);
      return true;
    }
    return false;
  },

  addService: async (serviceData) => {
    const newService = {
      id: 's_' + Math.random().toString(36).substr(2, 9),
      icon: 'Scissors',
      type: 'regular',
      ...serviceData
    };
    if (isFirebaseEnabled) {
      await setDoc(doc(db, 'services', newService.id), newService);
      return newService;
    }
    const services = await dbService.getServices();
    services.push(newService);
    await dbService.saveServices(services);
    return newService;
  },

  deleteService: async (serviceId) => {
    if (isFirebaseEnabled) {
      await deleteDoc(doc(db, 'services', serviceId));
      return true;
    }
    const services = await dbService.getServices();
    const filtered = services.filter(s => s.id !== serviceId);
    if (filtered.length !== services.length) {
      await dbService.saveServices(filtered);
      return true;
    }
    return false;
  },

  restoreDefaultServices: async () => {
    if (isFirebaseEnabled) {
      for (const s of DEFAULT_SERVICES) {
        await setDoc(doc(db, 'services', s.id), s);
      }
      return DEFAULT_SERVICES;
    }
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(DEFAULT_SERVICES));
    return DEFAULT_SERVICES;
  },

  // --- BOOKINGS ---
  // Public fields only (date/time/status/service) — no client PII. Safe for the
  // public booking page to read so it can compute free/busy slots.
  getBookings: async () => {
    if (isFirebaseEnabled) {
      try {
        const snap = await getDocs(collection(db, 'bookings'));
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {
        console.error(e);
      }
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKINGS)) || [];
  },

  // Same as getBookings but joined with clientName/clientPhone. Only the admin
  // dashboard should call this — Firestore rules only let authenticated reads
  // through on the bookingDetails collection.
  getBookingsWithDetails: async () => {
    const bookings = await dbService.getBookings();
    if (!isFirebaseEnabled) return bookings;

    try {
      const snap = await getDocs(collection(db, 'bookingDetails'));
      const detailsMap = {};
      snap.docs.forEach((d) => { detailsMap[d.id] = d.data(); });
      return bookings.map((b) => ({ ...b, ...(detailsMap[b.id] || {}) }));
    } catch (e) {
      console.error(e);
      return bookings;
    }
  },

  addBooking: async (bookingData) => {
    const { clientName, clientPhone, ...publicData } = bookingData;
    const newBooking = {
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...publicData
    };

    if (isFirebaseEnabled) {
      const docRef = await addDoc(collection(db, 'bookings'), newBooking);
      await setDoc(doc(db, 'bookingDetails', docRef.id), { clientName, clientPhone });
      return { id: docRef.id, ...newBooking, clientName, clientPhone };
    }

    const bookings = await dbService.getBookings();
    const localBooking = { ...newBooking, clientName, clientPhone };
    localBooking.id = 'b_' + Math.random().toString(36).substr(2, 9);
    bookings.push(localBooking);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    return localBooking;
  },

  updateBookingStatus: async (bookingId, status) => {
    let bookingToUpdate = null;

    if (isFirebaseEnabled) {
      const docRef = doc(db, 'bookings', bookingId);
      await updateDoc(docRef, { status });
      const bookingSnap = await getDoc(docRef);
      let clientName = '';
      try {
        const detailsSnap = await getDoc(doc(db, 'bookingDetails', bookingId));
        clientName = detailsSnap.exists() ? detailsSnap.data().clientName : '';
      } catch (e) {
        console.error(e);
      }
      bookingToUpdate = bookingSnap.exists() ? { ...bookingSnap.data(), clientName } : null;
    } else {
      const bookings = await dbService.getBookings();
      const index = bookings.findIndex(b => b.id === bookingId);
      if (index !== -1) {
        bookings[index].status = status;
        bookingToUpdate = bookings[index];
        localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
      }
    }

    // Auto log transaction if completed
    if (status === 'completed' && bookingToUpdate) {
      await dbService.addTransaction({
        type: 'income',
        amount: bookingToUpdate.price,
        date: bookingToUpdate.date,
        category: bookingToUpdate.serviceName,
        description: `${bookingToUpdate.clientName} navbati (Tugallandi)`
      });
    }
    return true;
  },

  deleteBooking: async (bookingId) => {
    if (isFirebaseEnabled) {
      await deleteDoc(doc(db, 'bookings', bookingId));
      try {
        await deleteDoc(doc(db, 'bookingDetails', bookingId));
      } catch (e) {
        console.error(e);
      }
      return true;
    }
    const bookings = await dbService.getBookings();
    const filtered = bookings.filter(b => b.id !== bookingId);
    if (filtered.length !== bookings.length) {
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(filtered));
      return true;
    }
    return false;
  },

  // --- TRANSACTIONS ---
  getTransactions: async () => {
    if (isFirebaseEnabled) {
      try {
        const snap = await getDocs(collection(db, 'transactions'));
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return list.sort((a, b) => new Date(b.date) - new Date(a.date));
      } catch (e) {
        console.error(e);
      }
    }
    const tx = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) || [];
    return tx.sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  addTransaction: async (txData) => {
    const newTx = {
      createdAt: new Date().toISOString(),
      ...txData
    };
    
    if (isFirebaseEnabled) {
      const docRef = await addDoc(collection(db, 'transactions'), newTx);
      return { id: docRef.id, ...newTx };
    }
    
    const transactions = await dbService.getTransactions();
    newTx.id = 't_' + Math.random().toString(36).substr(2, 9);
    transactions.push(newTx);
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    return newTx;
  },

  deleteTransaction: async (txId) => {
    if (isFirebaseEnabled) {
      await deleteDoc(doc(db, 'transactions', txId));
      return true;
    }
    const transactions = await dbService.getTransactions();
    const filtered = transactions.filter(t => t.id !== txId);
    if (filtered.length !== transactions.length) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(filtered));
      return true;
    }
    return false;
  },

  // --- SETTINGS ---
  getSettings: async () => {
    if (isFirebaseEnabled) {
      try {
        const snap = await getDocs(collection(db, 'settings'));
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (list.length > 0) {
          return list[0]; // Just return the first document
        } else {
          // Same rule as services: only an authenticated admin can seed it.
          if (auth?.currentUser) {
            await setDoc(doc(db, 'settings', 'shop_settings'), DEFAULT_SETTINGS);
          }
          return DEFAULT_SETTINGS;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || DEFAULT_SETTINGS;
  },

  saveSettings: async (settings) => {
    if (isFirebaseEnabled) {
      const id = settings.id || 'shop_settings';
      await setDoc(doc(db, 'settings', id), settings);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  clearAllData: async () => {
    if (isFirebaseEnabled) {
      try {
        const bookingsSnap = await getDocs(collection(db, 'bookings'));
        for (const d of bookingsSnap.docs) {
          await deleteDoc(doc(db, 'bookings', d.id));
        }
        const detailsSnap = await getDocs(collection(db, 'bookingDetails'));
        for (const d of detailsSnap.docs) {
          await deleteDoc(doc(db, 'bookingDetails', d.id));
        }
        const txSnap = await getDocs(collection(db, 'transactions'));
        for (const d of txSnap.docs) {
          await deleteDoc(doc(db, 'transactions', d.id));
        }
      } catch (e) {
        console.error(e);
      }
    }
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
    return true;
  }
};
