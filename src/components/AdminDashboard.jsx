import React, { useState, useEffect } from 'react';
import { dbService } from '../db/dbService';
import { auth, isFirebaseEnabled } from '../db/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  Lock, 
  Unlock,
  Scissors, 
  DollarSign, 
  Settings, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  LogOut, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Edit2, 
  Save,
  Phone,
  Clock,
  Sparkles,
  Crown,
  Wind,
  Smile,
  AlertCircle,
  Database,
  MessageCircle,
  User
} from 'lucide-react';

const ICON_MAP = {
  Scissors: Scissors,
  Sparkles: Sparkles,
  Crown: Crown,
  Wind: Wind,
  Smile: Smile
};

const TIME_OPTIONS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', 
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', 
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', 
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', 
  '22:00', '22:30', '23:00', '23:30'
];

export default function AdminDashboard({ onDataChange }) {
  // Authentication
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState('bookings');

  // DB States
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [settings, setSettings] = useState({});

  // Filters
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [financePeriod, setFinancePeriod] = useState('all'); // 'today' | 'week' | 'month' | 'all'

  // Modals
  const [showAddBookingModal, setShowAddBookingModal] = useState(false);
  const [newBooking, setNewBooking] = useState({ clientName: '', clientPhone: '', serviceId: '', time: '' });
  const [availableSlots, setAvailableSlots] = useState([]);

  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [newTx, setNewTx] = useState({ type: 'expense', amount: '', category: '', description: '', date: new Date().toISOString().split('T')[0] });

  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [newServiceData, setNewServiceData] = useState({ name: '', price: '', duration: '30', description: '', type: 'regular', icon: 'Scissors' });

  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editServiceData, setEditServiceData] = useState({ name: '', price: '', duration: '', description: '', type: 'regular' });

  // Schedule blocks for barber view
  const [timelineBlocks, setTimelineBlocks] = useState([]);

  useEffect(() => {
    // Wait for the Firebase sign-in triggered by the PIN to actually complete
    // before fetching — otherwise bookingDetails (client name/phone) reads
    // happen while still unauthenticated and silently come back empty.
    if (isAuthenticated) {
      loadAllData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (bookings.length >= 0 && settings.workingHours) {
      generateTimelineBlocks();
    }
  }, [bookings, selectedDate, settings]);

  useEffect(() => {
    if (showAddBookingModal && newBooking.serviceId) {
      generateManualSlots();
    }
  }, [newBooking.serviceId, selectedDate, showAddBookingModal]);

  const loadAllData = async () => {
    const b = await dbService.getBookingsWithDetails();
    const s = await dbService.getServices();
    const t = await dbService.getTransactions();
    const setts = await dbService.getSettings();

    setBookings(b);
    setServices(s);
    setTransactions(t);
    setSettings(setts);
  };

  const handlePinKeyPress = async (val) => {
    setErrorMsg('');
    if (val === 'clear') {
      setPin('');
      return;
    }

    if (pin.length < 4) {
      const newPin = pin + val;
      setPin(newPin);

      if (newPin.length === 4) {
        if (newPin === (settings.pinCode || '7777')) {
          setPin('');
          if (isFirebaseEnabled) {
            const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
            const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
            if (!adminEmail || !adminPassword) {
              setErrorMsg("Admin hisobi sozlanmagan (.env VITE_ADMIN_EMAIL/PASSWORD)");
              return;
            }
            try {
              await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
              setIsAuthenticated(true);
            } catch (e) {
              console.error(e);
              setErrorMsg("Firebase'ga kirishda xatolik. Admin hisobini tekshiring.");
            }
          } else {
            setIsAuthenticated(true);
          }
        } else {
          setErrorMsg('PIN-kod noto\'g\'ri!');
          setPin('');
        }
      }
    }
  };

  const handleLogout = async () => {
    if (isFirebaseEnabled) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error(e);
      }
    }
    setIsAuthenticated(false);
    setActiveTab('bookings');
  };

  const handleCompleteBooking = async (id) => {
    await dbService.updateBookingStatus(id, 'completed');
    loadAllData();
    if (onDataChange) onDataChange();
  };

  const handleCancelBooking = async (id) => {
    await dbService.updateBookingStatus(id, 'cancelled');
    loadAllData();
    if (onDataChange) onDataChange();
  };

  const handleDeleteBooking = async (id) => {
    if (window.confirm("Navbatni butunlay o'chirasizmi?")) {
      await dbService.deleteBooking(id);
      loadAllData();
      if (onDataChange) onDataChange();
    }
  };

  const generateTimelineBlocks = () => {
    const workingHours = settings.workingHours || { start: '09:00', end: '20:00' };
    const interval = settings.slotInterval || 30;
    
    const startHour = parseInt(workingHours.start.split(':')[0]);
    const startMin = parseInt(workingHours.start.split(':')[1]);
    const endHour = parseInt(workingHours.end.split(':')[0]);
    const endMin = parseInt(workingHours.end.split(':')[1]);
    
    const todayBookings = bookings.filter(b => b.date === selectedDate && b.status !== 'cancelled');
    
    let current = new Date();
    current.setHours(startHour, startMin, 0, 0);
    
    const endLimit = new Date();
    endLimit.setHours(endHour, endMin, 0, 0);
    
    const blocks = [];
    
    while (current < endLimit) {
      const hours = current.getHours().toString().padStart(2, '0');
      const mins = current.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${mins}`;
      
      const booking = todayBookings.find(b => b.slots && b.slots.includes(timeStr));
      let status = 'free';
      let tooltip = `${timeStr} - Bo'sh`;
      
      if (booking) {
        const isGroom = booking.serviceName.toLowerCase().includes('kuyov');
        status = isGroom ? 'groom' : 'busy';
        tooltip = `${timeStr} - ${booking.clientName} (${booking.serviceName})`;
      }
      
      blocks.push({
        time: timeStr,
        status,
        tooltip,
        booking
      });
      
      current.setMinutes(current.getMinutes() + interval);
    }
    setTimelineBlocks(blocks);
  };

  const generateManualSlots = () => {
    const workingHours = settings.workingHours || { start: '09:00', end: '20:00' };
    const interval = settings.slotInterval || 30;
    const service = services.find(s => s.id === newBooking.serviceId);
    const duration = service ? service.duration : 30;
    
    const startHour = parseInt(workingHours.start.split(':')[0]);
    const startMin = parseInt(workingHours.start.split(':')[1]);
    const endHour = parseInt(workingHours.end.split(':')[0]);
    const endMin = parseInt(workingHours.end.split(':')[1]);
    
    const slots = [];
    let current = new Date();
    current.setHours(startHour, startMin, 0, 0);
    
    const endLimit = new Date();
    endLimit.setHours(endHour, endMin, 0, 0);
    
    const bookedSlotsList = [];
    bookings
      .filter(b => b.date === selectedDate && b.status !== 'cancelled')
      .forEach(b => {
        if (b.slots) bookedSlotsList.push(...b.slots);
      });

    while (current < endLimit) {
      const hours = current.getHours().toString().padStart(2, '0');
      const mins = current.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${mins}`;
      
      const slotsNeeded = Math.ceil(duration / interval);
      let available = true;
      
      const blockDate = new Date();
      blockDate.setHours(current.getHours(), current.getMinutes(), 0, 0);
      
      const slotsToBook = [];
      for (let i = 0; i < slotsNeeded; i++) {
        const sh = blockDate.getHours().toString().padStart(2, '0');
        const sm = blockDate.getMinutes().toString().padStart(2, '0');
        slotsToBook.push(`${sh}:${sm}`);
        blockDate.setMinutes(blockDate.getMinutes() + interval);
      }
      
      const overlap = slotsToBook.some(s => bookedSlotsList.includes(s));
      const lastSlot = slotsToBook[slotsToBook.length - 1];
      const endWorkingStr = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
      
      if (overlap || lastSlot > endWorkingStr) {
        available = false;
      }
      
      slots.push({
        time: timeStr,
        available
      });
      
      current.setMinutes(current.getMinutes() + interval);
    }
    
    setAvailableSlots(slots);
  };

  const handleManualBookingSubmit = async (e) => {
    e.preventDefault();
    if (!newBooking.clientName || !newBooking.clientPhone || !newBooking.serviceId || !newBooking.time) {
      alert("Iltimos barcha maydonlarni to'ldiring!");
      return;
    }

    const service = services.find(s => s.id === newBooking.serviceId);
    const interval = settings.slotInterval || 30;
    const slotsNeeded = Math.ceil(service.duration / interval);
    
    const [h, m] = newBooking.time.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    
    const slots = [];
    for (let i = 0; i < slotsNeeded; i++) {
      const sh = date.getHours().toString().padStart(2, '0');
      const sm = date.getMinutes().toString().padStart(2, '0');
      slots.push(`${sh}:${sm}`);
      date.setMinutes(date.getMinutes() + interval);
    }

    const endH = date.getHours().toString().padStart(2, '0');
    const endM = date.getMinutes().toString().padStart(2, '0');
    const endTime = `${endH}:${endM}`;

    await dbService.addBooking({
      clientName: newBooking.clientName,
      clientPhone: newBooking.clientPhone,
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      date: selectedDate,
      time: newBooking.time,
      endTime,
      slots
    });

    setShowAddBookingModal(false);
    setNewBooking({ clientName: '', clientPhone: '', serviceId: '', time: '' });
    loadAllData();
    if (onDataChange) onDataChange();
  };

  const handleAddTxSubmit = async (e) => {
    e.preventDefault();
    if (!newTx.amount || !newTx.category) return;

    await dbService.addTransaction({
      type: newTx.type,
      amount: parseFloat(newTx.amount),
      category: newTx.category,
      description: newTx.description,
      date: newTx.date
    });

    setShowAddTxModal(false);
    setNewTx({ type: 'expense', amount: '', category: '', description: '', date: new Date().toISOString().split('T')[0] });
    loadAllData();
  };

  const handleDeleteTx = async (id) => {
    if (window.confirm("Tranzaksiyani o'chirasizmi?")) {
      await dbService.deleteTransaction(id);
      loadAllData();
    }
  };

  const handleEditServiceClick = (service) => {
    setEditingServiceId(service.id);
    setEditServiceData({
      name: service.name,
      price: service.price,
      duration: service.duration,
      description: service.description,
      type: service.type || 'regular'
    });
  };

  const handleSaveService = async (id) => {
    const original = services.find(s => s.id === id);
    const updated = {
      ...original,
      name: editServiceData.name,
      price: parseFloat(editServiceData.price),
      duration: parseInt(editServiceData.duration),
      description: editServiceData.description,
      type: editServiceData.type
    };
    await dbService.updateService(updated);
    setEditingServiceId(null);
    loadAllData();
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    if (!newServiceData.name || !newServiceData.price) {
      alert("Xizmat nomi va narxini kiriting!");
      return;
    }
    await dbService.addService({
      name: newServiceData.name,
      price: parseFloat(newServiceData.price),
      duration: parseInt(newServiceData.duration || 30),
      description: newServiceData.description || '',
      type: newServiceData.type || 'regular',
      icon: newServiceData.icon || 'Scissors'
    });
    setShowAddServiceModal(false);
    setNewServiceData({ name: '', price: '', duration: '30', description: '', type: 'regular', icon: 'Scissors' });
    loadAllData();
    if (onDataChange) onDataChange();
  };

  const handleDeleteService = async (id) => {
    if (window.confirm("Ushbu xizmatni o'chirasizmi?")) {
      await dbService.deleteService(id);
      loadAllData();
      if (onDataChange) onDataChange();
    }
  };

  const handleSettingsSave = async (e) => {
    e.preventDefault();
    await dbService.saveSettings(settings);
    alert("Sozlamalar saqlandi!");
    loadAllData();
  };

  const handleResetAllData = async () => {
    const confirmFirst = window.confirm(
      "DIQQAT! Barcha kiritilgan navbatlar hamda moliya amallari butunlay o'chiriladi va tizim 0 holatiga keltiriladi. Davom etasizmi?"
    );
    if (!confirmFirst) return;

    const confirmSecond = window.confirm(
      "Tasdiqlaysizmi? Ushbu amalni ortga qaytarib bo'lmaydi! Loyiha yangi mijozga topshirish uchun toza holatga keladi."
    );
    if (!confirmSecond) return;

    await dbService.clearAllData();
    alert("Barcha navbatlar va moliya ma'lumotlari tozalandi! Tizim 0 dan ishga tushdi.");
    loadAllData();
    if (onDataChange) onDataChange();
  };

  const isDateInPeriod = (dateStr, period) => {
    if (period === 'all') return true;
    const d = new Date(dateStr);
    const now = new Date();
    if (period === 'today') {
      return dateStr === now.toISOString().split('T')[0];
    }
    if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo && d <= now;
    }
    if (period === 'month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    return true;
  };

  const getStats = () => {
    let income = 0;
    let expense = 0;
    transactions
      .filter(t => isDateInPeriod(t.date, financePeriod))
      .forEach(t => {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
      });
    return { income, expense, net: income - expense };
  };

  const stats = getStats();

  const getTodayBookingStats = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayBookings = bookings.filter(b => b.date === todayStr);
    return {
      total: todayBookings.length,
      pending: todayBookings.filter(b => b.status === 'pending').length,
      completed: todayBookings.filter(b => b.status === 'completed').length,
      cancelled: todayBookings.filter(b => b.status === 'cancelled').length
    };
  };

  const todayStats = getTodayBookingStats();

  const filteredBookings = bookings
    .filter(b => b.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  const filteredTransactions = transactions.filter(t => isDateInPeriod(t.date, financePeriod));

  const formatUzCurrency = (val) => {
    return new Intl.NumberFormat('uz-UZ').format(val) + " so'm";
  };

  const handleRestoreDefaultServices = async () => {
    if (window.confirm("Barcha namuna xizmatlarni (Oddiy soch, Soqol, Kuyov paketi) qayta tiklamoqchimisiz?")) {
      await dbService.restoreDefaultServices();
      loadAllData();
      if (onDataChange) onDataChange();
      alert("Namuna xizmatlar muvaffaqiyatli tiklandi!");
    }
  };

  const buildSmsLink = (booking) => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const template = settings.smsTemplate || "Assalomu alaykum, {clientName}! {shopName}dan eslatma: navbatingiz {date} kuni soat {time}da ({serviceName}). Sizni kutamiz!";
    
    const message = template
      .replace(/{clientName}/g, booking.clientName || 'Mijoz')
      .replace(/{shopName}/g, settings.shopName || 'Barber Shop')
      .replace(/{date}/g, booking.date || '')
      .replace(/{time}/g, booking.time || '')
      .replace(/{serviceName}/g, booking.serviceName || 'Xizmat');

    return `sms:${booking.clientPhone}${isIOS ? '&' : '?'}body=${encodeURIComponent(message)}`;
  };

  // PIN-CODE SCREEN FOR SECURITY
  if (!isAuthenticated) {
    return (
      <div className="pin-screen-container card animation-fade-in" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
        <div className="pin-lock-icon">
          <Lock size={36} style={{ color: 'var(--accent-emerald)' }} />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '0.25rem' }}>Sartarosh Paneli</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>
          Tizimga kirish uchun PIN-kodni kiriting
        </p>

        {errorMsg && (
          <p style={{ color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {errorMsg}
          </p>
        )}

        <div className="pin-dots">
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className={`pin-dot ${pin.length >= idx ? 'filled' : ''}`} />
          ))}
        </div>

        <div className="pin-keyboard">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} onClick={() => handlePinKeyPress(num.toString())} className="pin-key">
              {num}
            </button>
          ))}
          <button key="clear" onClick={() => handlePinKeyPress('clear')} className="pin-key" style={{ color: 'var(--danger)' }}>C</button>
          <button key="0" onClick={() => handlePinKeyPress('0')} className="pin-key">0</button>
          <div className="pin-key" style={{ opacity: 0.25, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Unlock size={18} />
          </div>
        </div>
      </div>
    );
  }

  // RENDER ADMIN MAIN
  return (
    <div className="dashboard-layout animation-fade-in">
      
      {/* Sidebar Navigation */}
      <div className="dashboard-sidebar">
        {/* DB Connection indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: isFirebaseEnabled ? 'var(--success-light)' : 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '0.4rem 0.65rem', borderRadius: 'var(--radius-lg)', marginBottom: '0.85rem', fontSize: '0.7rem' }}>
          <Database size={12} style={{ color: isFirebaseEnabled ? 'var(--success)' : 'var(--text-muted)' }} />
          <span style={{ color: isFirebaseEnabled ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 700 }}>
            {isFirebaseEnabled ? 'Online (Firebase)' : 'Offline (Local)'}
          </span>
        </div>

        <h3 style={{ padding: '0 0.5rem 0.35rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Menyu</h3>
        <button onClick={() => setActiveTab('bookings')} className={`sidebar-nav-item ${activeTab === 'bookings' ? 'active' : ''}`}>
          <CalendarIcon size={15} /> Navbatlar
        </button>
        <button onClick={() => setActiveTab('finance')} className={`sidebar-nav-item ${activeTab === 'finance' ? 'active' : ''}`}>
          <CreditCard size={15} /> Kirim-Chiqim (Moliya)
        </button>
        <button onClick={() => setActiveTab('services')} className={`sidebar-nav-item ${activeTab === 'services' ? 'active' : ''}`}>
          <Scissors size={15} /> Xizmatlar & Narxlar
        </button>
        <button onClick={() => setActiveTab('settings')} className={`sidebar-nav-item ${activeTab === 'settings' ? 'active' : ''}`}>
          <Settings size={15} /> Sozlamalar
        </button>
        
        <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
          <button onClick={handleLogout} className="sidebar-nav-item" style={{ color: 'var(--danger)' }}>
            <LogOut size={15} /> Chiqish
          </button>
        </div>
      </div>

      {/* Mobile bottom tab bar — shown instead of the sidebar on narrow screens */}
      <div className="mobile-bottom-nav">
        <button onClick={() => setActiveTab('bookings')} className={`mobile-nav-item ${activeTab === 'bookings' ? 'active' : ''}`}>
          <CalendarIcon size={19} /> <span>Navbatlar</span>
        </button>
        <button onClick={() => setActiveTab('finance')} className={`mobile-nav-item ${activeTab === 'finance' ? 'active' : ''}`}>
          <CreditCard size={19} /> <span>Moliya</span>
        </button>
        <button onClick={() => setActiveTab('services')} className={`mobile-nav-item ${activeTab === 'services' ? 'active' : ''}`}>
          <Scissors size={19} /> <span>Xizmatlar</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`mobile-nav-item ${activeTab === 'settings' ? 'active' : ''}`}>
          <Settings size={19} /> <span>Sozlamalar</span>
        </button>
        <button onClick={handleLogout} className="mobile-nav-item" style={{ color: 'var(--danger)' }}>
          <LogOut size={19} /> <span>Chiqish</span>
        </button>
      </div>

      {/* Main Panel */}
      <div className="dashboard-main">
        
        {/* TAB 1: BOOKINGS LIST */}
        {activeTab === 'bookings' && (
          <>
            <div className="section-header">
              <div>
                <h2 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-emerald)' }}>Navbatlarni Boshqarish</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Kunlik taqvim va navbatlarni belgilash</p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowAddBookingModal(true)}>
                <Plus size={15} /> Yangi Navbat
              </button>
            </div>

            {/* Today's booking stats */}
            <div className="stats-grid">
              <div className="stat-card card">
                <div className="stat-icon bookings"><CalendarIcon size={16} /></div>
                <div className="stat-details">
                  <h5>Bugungi jami navbat</h5>
                  <div className="stat-value">{todayStats.total}</div>
                </div>
              </div>
              <div className="stat-card card">
                <div className="stat-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}><Clock size={16} /></div>
                <div className="stat-details">
                  <h5>Kutilmoqda</h5>
                  <div className="stat-value" style={{ color: 'var(--warning)' }}>{todayStats.pending}</div>
                </div>
              </div>
              <div className="stat-card card">
                <div className="stat-icon income"><Check size={16} /></div>
                <div className="stat-details">
                  <h5>Tugatildi</h5>
                  <div className="stat-value text-success" style={{ color: 'var(--success)' }}>{todayStats.completed}</div>
                </div>
              </div>
              <div className="stat-card card">
                <div className="stat-icon expense"><X size={16} /></div>
                <div className="stat-details">
                  <h5>Bekor bo'ldi</h5>
                  <div className="stat-value text-danger" style={{ color: 'var(--danger)' }}>{todayStats.cancelled}</div>
                </div>
              </div>
            </div>

            {/* Date Filters */}
            <div className="card" style={{ padding: '0.85rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Sana:</span>
              <input 
                type="date" 
                className="form-input" 
                style={{ width: 'auto', padding: '0.4rem 0.65rem', fontSize: '0.85rem' }} 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)} 
              />
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem' }} onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}>Bugun</button>
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem' }} onClick={() => {
                const tom = new Date(); tom.setDate(tom.getDate() + 1); setSelectedDate(tom.toISOString().split('T')[0]);
              }}>Ertaga</button>
            </div>

            {/* Mobile Native Schedule Grid for Barber */}
            {timelineBlocks.length > 0 && (
              <div className="card" style={{ padding: '1.15rem 1rem' }}>
                <div className="timeline-title-row" style={{ marginBottom: '0.65rem' }}>
                  <h4 style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-body)', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <Clock size={15} style={{ color: 'var(--accent-brass)' }} /> Bandlik jadvali ({selectedDate})
                  </h4>
                  <div className="timeline-legend">
                    <div className="legend-item"><span className="legend-dot free" /> Bo'sh ({timelineBlocks.filter(b => b.status === 'free').length})</div>
                    <div className="legend-item"><span className="legend-dot busy" /> Band ({timelineBlocks.filter(b => b.status === 'busy').length})</div>
                    <div className="legend-item"><span className="legend-dot groom" /> Kuyov ({timelineBlocks.filter(b => b.status === 'groom').length})</div>
                  </div>
                </div>
                
                <div className="today-slots-wrap-grid">
                  {timelineBlocks.map(block => (
                    <div 
                      key={block.time} 
                      className={`today-slot-pill ${block.status}`}
                      title={block.tooltip}
                    >
                      <span className="pill-dot" />
                      <span>{block.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin bookings cards */}
            <div className="appointments-list">
              {filteredBookings.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  <CalendarIcon size={32} style={{ marginBottom: '0.75rem', opacity: 0.3 }} />
                  <p style={{ fontSize: '0.85rem' }}>Ushbu kunga navbatlar belgilanmagan.</p>
                </div>
              ) : (
                filteredBookings.map(b => {
                  const isGroom = b.serviceName.toLowerCase().includes('kuyov');
                  return (
                    <div key={b.id} className={`appointment-card card ${isGroom ? 'groom-card' : ''}`}>
                      {/* Header row: Time Badge, Service Name & Price, Status Badge */}
                      <div className="apt-card-header">
                        <div className="apt-time-badge" style={{ borderColor: isGroom ? 'var(--accent-brass)' : 'var(--border-color)' }}>
                          <span className="apt-time" style={{ color: isGroom ? 'var(--accent-brass)' : 'var(--accent-emerald)' }}>{b.time}</span>
                          <span className="apt-endtime">{b.endTime} gacha</span>
                        </div>
                        
                        <div className="apt-service-meta">
                          <div className="apt-service-name">
                            {b.serviceName}
                            {isGroom && <Crown size={14} style={{ color: 'var(--accent-brass)' }} />}
                          </div>
                          <div className="apt-price">{formatUzCurrency(b.price)}</div>
                        </div>

                        <span className={`badge badge-${b.status}`}>
                          {b.status === 'pending' ? 'Kutilmoqda' : b.status === 'completed' ? 'Tugatildi' : 'Bekor bo\'ldi'}
                        </span>
                      </div>

                      {/* Client Info row */}
                      <div className="apt-client-row">
                        <div className="apt-client-details">
                          <User size={15} style={{ color: 'var(--text-muted)' }} />
                          <span className="apt-client-name">{b.clientName}</span>
                          <a href={`tel:${b.clientPhone}`} className="apt-client-phone">
                            <Phone size={12} /> {b.clientPhone}
                          </a>
                        </div>

                        <a href={buildSmsLink(b)} className="btn-sms-link" title="SMS eslatma yuborish">
                          <MessageCircle size={14} /> SMS yuborish
                        </a>
                      </div>

                      {/* Action Buttons row */}
                      <div className="apt-actions-row">
                        {b.status === 'pending' ? (
                          <>
                            <button onClick={() => handleCompleteBooking(b.id)} className="btn btn-success btn-apt-action">
                              <Check size={16} /> Tugatish
                            </button>
                            <button onClick={() => handleCancelBooking(b.id)} className="btn btn-danger btn-apt-action">
                              <X size={16} /> Bekor qilish
                            </button>
                            <button onClick={() => handleDeleteBooking(b.id)} className="btn btn-secondary btn-apt-action-delete" title="O'chirish">
                              <Trash2 size={15} />
                            </button>
                          </>
                        ) : (
                          <div className="apt-completed-footer">
                            <span className="apt-completed-text">
                              {b.status === 'completed' ? '✅ Ushbu navbat yakunlangan' : '❌ Navbat bekor qilingan'}
                            </span>
                            <button onClick={() => handleDeleteBooking(b.id)} className="btn btn-danger-soft">
                              <Trash2 size={14} /> O'chirish
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* TAB 2: FINANCIAL TRACKER */}
        {activeTab === 'finance' && (
          <>
            <div className="section-header">
              <div>
                <h2 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-emerald)' }}>Kirim-Chiqim Moliyasi</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Daromadlar va xarajatlar monitoringi</p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowAddTxModal(true)}>
                <Plus size={15} /> Tranzaksiya qo'shish
              </button>
            </div>

            {/* Period Filter */}
            <div className="card" style={{ padding: '0.6rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[
                { key: 'today', label: 'Bugun' },
                { key: 'week', label: 'Hafta' },
                { key: 'month', label: 'Oy' },
                { key: 'all', label: 'Umumiy' }
              ].map(p => (
                <button
                  key={p.key}
                  className={financePeriod === p.key ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', flex: 1 }}
                  onClick={() => setFinancePeriod(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card card">
                <div className="stat-icon income"><TrendingUp size={16} /></div>
                <div className="stat-details">
                  <h5>Jami Kirim</h5>
                  <div className="stat-value text-success" style={{ color: 'var(--success)' }}>{formatUzCurrency(stats.income)}</div>
                </div>
              </div>
              <div className="stat-card card">
                <div className="stat-icon expense"><TrendingDown size={16} /></div>
                <div className="stat-details">
                  <h5>Jami Chiqim</h5>
                  <div className="stat-value text-danger" style={{ color: 'var(--danger)' }}>{formatUzCurrency(stats.expense)}</div>
                </div>
              </div>
              <div className="stat-card card">
                <div className="stat-icon net"><DollarSign size={16} /></div>
                <div className="stat-details">
                  <h5>Sof Foyda</h5>
                  <div className="stat-value" style={{ color: stats.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatUzCurrency(stats.net)}</div>
                </div>
              </div>
            </div>

            {/* Split layout */}
            <div className="finance-split">
              <div className="card">
                <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>Moliyaviy amallar ro'yxati</h3>
                {filteredTransactions.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.8rem' }}>Bu davrda amallar yo'q.</p>
                ) : (
                  <div className="transactions-list-container">
                    {filteredTransactions.map(t => (
                      <div key={t.id} className="transaction-item-card">
                        <div className="tx-main-details">
                          <span className="tx-category">{t.category}</span>
                          <span className="tx-desc">{t.date} {t.description ? `• ${t.description}` : ''}</span>
                        </div>

                        <div className="tx-right">
                          <span className={`tx-amount-badge ${t.type}`}>
                            {t.type === 'income' ? '+' : '-'}{formatUzCurrency(t.amount)}
                          </span>
                          <button 
                            onClick={() => handleDeleteTx(t.id)} 
                            className="btn btn-secondary btn-icon" 
                            style={{ width: '2.1rem', height: '2.1rem', color: 'var(--danger)', borderColor: 'rgba(244, 63, 94, 0.2)' }}
                            title="Tranzaksiyani o'chirish"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card" style={{ height: 'fit-content', padding: '1rem' }}>
                <h3 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem', fontWeight: 700 }}>
                  <Sparkles size={15} className="text-gold" style={{ color: 'var(--accent-brass)' }} /> Moliya Haqida
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Tugatilgan navbatlar puli avtomatik tarzda kirim qilinadi. Boshqa kirim va chiqimlarni qo'lda tranzaksiya kiritib hisoblab boring.
                </p>
              </div>
            </div>
          </>
        )}

        {/* TAB 3: SERVICES AND PRICES */}
        {activeTab === 'services' && (
          <>
            <div className="section-header">
              <div>
                <h2 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-emerald)' }}>Xizmatlar & Narxlar Sozlamalari</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Xizmat narxlarini va navbat davomiyligini belgilash</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={handleRestoreDefaultServices} title="Standart namuna xizmatlarni qayta tiklash">
                  <Sparkles size={14} /> Namuna Xizmatlar
                </button>
                <button className="btn btn-primary" onClick={() => setShowAddServiceModal(true)}>
                  <Plus size={15} /> Yangi Xizmat
                </button>
              </div>
            </div>

            <div className="grid-2">
              {services.map(s => {
                const IconComponent = ICON_MAP[s.icon] || Scissors;
                const isEditing = editingServiceId === s.id;
                const isGroom = s.type === 'groom';

                return (
                  <div key={s.id} className={`card ${isGroom ? 'groom-card' : ''}`}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <div className="service-icon-wrapper" style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-xl)', color: isGroom ? 'var(--accent-brass)' : 'var(--accent-emerald)' }}>
                        {isGroom ? <Crown size={18} /> : <IconComponent size={18} />}
                      </div>

                      <div style={{ flex: 1 }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Xizmat nomi</label>
                              <input type="text" className="form-input" value={editServiceData.name} onChange={(e) => setEditServiceData({...editServiceData, name: e.target.value})} />
                            </div>

                            <div className="grid-2">
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Narxi (so'm)</label>
                                <input type="number" className="form-input" value={editServiceData.price} onChange={(e) => setEditServiceData({...editServiceData, price: e.target.value})} />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Davomiyligi (daqiqa)</label>
                                <select className="form-select" value={editServiceData.duration} onChange={(e) => setEditServiceData({...editServiceData, duration: e.target.value})}>
                                  <option value={15}>15 daq</option>
                                  <option value={30}>30 daq</option>
                                  <option value={45}>45 daq</option>
                                  <option value={60}>60 daq (1 soat)</option>
                                  <option value={90}>90 daq (1.5 soat)</option>
                                  <option value={120}>120 daq (2 soat)</option>
                                  <option value={180}>180 daq (3 soat)</option>
                                </select>
                              </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Turi</label>
                              <select className="form-select" value={editServiceData.type} onChange={(e) => setEditServiceData({...editServiceData, type: e.target.value})}>
                                <option value="regular">Oddiy Xizmat</option>
                                <option value="groom">Kuyov Paketi (Tillada)</option>
                              </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Tavsif</label>
                              <textarea className="form-input" rows="2" value={editServiceData.description} onChange={(e) => setEditServiceData({...editServiceData, description: e.target.value})} />
                            </div>

                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                              <button onClick={() => handleSaveService(s.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}><Save size={13} /> Saqlash</button>
                              <button onClick={() => setEditingServiceId(null)} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>Bekor qilish</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <h4 style={{ fontSize: '1.05rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                                {s.name}
                                {isGroom && <span className="badge badge-pending" style={{ color: 'var(--accent-brass)', background: 'var(--accent-brass-light)', fontSize: '0.55rem', marginLeft: '0.35rem' }}>Premium</span>}
                              </h4>
                              <div style={{ display: 'flex', gap: '0.2rem' }}>
                                <button onClick={() => handleEditServiceClick(s)} className="btn btn-secondary btn-icon" style={{ width: '1.75rem', height: '1.75rem', border: 'none', background: 'transparent' }} title="Tahrirlash"><Edit2 size={13} /></button>
                                <button onClick={() => handleDeleteService(s.id)} className="btn btn-secondary btn-icon" style={{ width: '1.75rem', height: '1.75rem', border: 'none', background: 'transparent', color: 'var(--danger)' }} title="O'chirish"><Trash2 size={13} /></button>
                              </div>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.15rem', marginBottom: '0.5rem' }}>{s.description}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              <span>Vaqt oralig'i: {s.duration} daqiqa</span>
                              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: isGroom ? 'var(--accent-brass)' : 'var(--accent-emerald)', fontSize: '1rem' }}>{formatUzCurrency(s.price)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* TAB 4: SETTINGS */}
        {activeTab === 'settings' && (
          <>
            <div className="section-header">
              <div>
                <h2 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-emerald)' }}>Tizim Sozlamalari</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Sartaroshxona sozlamalarini boshqarish</p>
              </div>
            </div>

            <form onSubmit={handleSettingsSave} className="card" style={{ maxWidth: '520px' }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Sartaroshxona Nomi</label>
                  <input type="text" className="form-input" required value={settings.shopName || ''} onChange={(e) => handleSettingsChange('shopName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefon Raqami</label>
                  <input type="text" className="form-input" required value={settings.phone || ''} onChange={(e) => handleSettingsChange('phone', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Manzili</label>
                <input type="text" className="form-input" required value={settings.address || ''} onChange={(e) => handleSettingsChange('address', e.target.value)} />
              </div>

              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Ish boshi</label>
                  <select className="form-select" value={settings.workingHours?.start || '09:00'} onChange={(e) => handleWorkingHoursChange('start', e.target.value)}>
                    {TIME_OPTIONS.map(t => <option key={`start-${t}`} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ish yakuni</label>
                  <select className="form-select" value={settings.workingHours?.end || '20:00'} onChange={(e) => handleWorkingHoursChange('end', e.target.value)}>
                    {TIME_OPTIONS.map(t => <option key={`end-${t}`} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Slot oralig'i (daqiqa)</label>
                  <select className="form-select" value={settings.slotInterval || 30} onChange={(e) => handleSettingsChange('slotInterval', parseInt(e.target.value))}>
                    <option value={15}>15 daqiqa</option>
                    <option value={30}>30 daqiqa</option>
                    <option value={45}>45 daqiqa</option>
                    <option value={60}>60 daqiqa</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">SMS Xabar Shabloni (Mijozga boradigan eslatma matni)</label>
                <textarea 
                  className="form-input" 
                  rows={3} 
                  value={settings.smsTemplate || "Assalomu alaykum, {clientName}! {shopName}dan eslatma: navbatingiz {date} kuni soat {time}da ({serviceName}). Sizni kutamiz!"} 
                  onChange={(e) => handleSettingsChange('smsTemplate', e.target.value)} 
                />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  O'zgaruvchilar: <b>&#123;clientName&#125;</b>, <b>&#123;shopName&#125;</b>, <b>&#123;date&#125;</b>, <b>&#123;time&#125;</b>, <b>&#123;serviceName&#125;</b>
                </p>
              </div>

              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-emerald)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Crown size={15} style={{ color: 'var(--accent-brass)' }} /> Sartarosh (Usta) Profili Sozlamalari
                </h4>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Usta (Sartarosh) Ismi</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Masalan: Abdulloh Sartarosh" 
                      value={settings.barberName || ''} 
                      onChange={(e) => handleSettingsChange('barberName', e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Usta Rasmi (Telefon galereyasidan yuklash)</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="form-input" 
                      style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          if (file.size > 2.5 * 1024 * 1024) {
                            alert("Rasm hajmi 2.5MB dan kichik bo'lishi kerak!");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            handleSettingsChange('barberImage', reader.result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                    {settings.barberImage && (
                      <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <img src={settings.barberImage} alt="Preview" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-gold)' }} />
                        <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 700 }}>Rasm yuklandi!</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Usta Haqida Ma'lumot (Bio / Tajriba)</label>
                  <textarea 
                    className="form-input" 
                    rows={2} 
                    placeholder="10 yillik tajribaga ega master..." 
                    value={settings.barberBio || ''} 
                    onChange={(e) => handleSettingsChange('barberBio', e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-group" style={{ maxWidth: '160px' }}>
                <label className="form-label">Kirish PIN-kodi</label>
                <input type="password" maxLength={4} className="form-input" placeholder="7777" required value={settings.pinCode || ''} onChange={(e) => handleSettingsChange('pinCode', e.target.value)} />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.25rem' }}><Save size={14} /> O'zgarishlarni Saqlash</button>
            </form>

            <div className="card" style={{ maxWidth: '520px', marginTop: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '1rem' }}>Telegram Bot Sozlamalari</h3>

              <div className="form-group">
                <label className="form-label">Bot Token (@BotFather'dan olingan)</label>
                <input type="password" className="form-input" placeholder="123456:ABC-DEF..." value={settings.telegramBotToken || ''} onChange={(e) => handleSettingsChange('telegramBotToken', e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Admin Chat ID</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" className="form-input" placeholder="Masalan: 123456789" value={settings.telegramChatId || ''} onChange={(e) => handleSettingsChange('telegramChatId', e.target.value)} />
                  <button type="button" className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }} onClick={handleDetectChatId}>Avtomatik topish</button>
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Avval Telegram'da botingizga <b>/start</b> deb yozing, keyin "Avtomatik topish" tugmasini bosing.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Web App Sayt Havolasi (https://...)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="https://sartarosh.vercel.app" 
                  value={settings.webAppUrl || ''} 
                  onChange={(e) => handleSettingsChange('webAppUrl', e.target.value)} 
                />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Vercel havolangiz (masalan: <b>https://sartarosh.vercel.app</b>). Telegram faqat https havolalarni qabul qiladi.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" onClick={handleConnectBotMenu}>Botni shu saytga ulash</button>
                <button type="button" className="btn btn-secondary" onClick={handleSettingsSave}><Save size={14} /> Telegram sozlamalarini saqlash</button>
              </div>
            </div>

            {/* RESET ALL DATA FOR NEW OWNER / CLEAN SLATE */}
            <div className="card" style={{ maxWidth: '520px', marginTop: '1.25rem', borderColor: 'rgba(244, 63, 94, 0.35)', background: 'linear-gradient(150deg, #ffffff 0%, rgba(244, 63, 94, 0.03) 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--danger)', marginBottom: '0.5rem' }}>
                <AlertCircle size={18} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Tizim Ma'lumotlarini Tozalash (0 dan boshlash)</h3>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1rem' }}>
                Loyihani yangi egasiga topshirish oldidan barcha sinov navbatlarini hamda moliya kirim-chiqimlarini to'liq tozalar va <b>0 dan toza holatga</b> keltiradi.
              </p>
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleResetAllData}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <Trash2 size={15} /> Barcha Navbat va Moliya Ma'lumotlarini Tozalash
              </button>
            </div>
          </>
        )}

      </div>

      {/* MODAL 1: MANUAL ADD BOOKING */}
      {showAddBookingModal && (
        <div className="modal-overlay">
          <div className="modal-content animation-slide-up">
            <button className="modal-close" onClick={() => setShowAddBookingModal(false)}><X size={18} /></button>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-emerald)' }}>Yangi Navbat Qo'shish ({selectedDate})</h3>
            
            <form onSubmit={handleManualBookingSubmit}>
              <div className="form-group">
                <label className="form-label">Xizmat turi</label>
                <select className="form-select" required value={newBooking.serviceId} onChange={(e) => setNewBooking({...newBooking, serviceId: e.target.value})}>
                  <option value="">Tanlang...</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({formatUzCurrency(s.price)})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Vaqti</label>
                <select className="form-select" required disabled={!newBooking.serviceId} value={newBooking.time} onChange={(e) => setNewBooking({...newBooking, time: e.target.value})}>
                  <option value="">Tanlang...</option>
                  {availableSlots.map(slot => (
                    <option key={slot.time} value={slot.time} disabled={!slot.available}>
                      {slot.time} {!slot.available ? '(Band)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Mijoz Ismi</label>
                <input type="text" className="form-input" required placeholder="Ismi" value={newBooking.clientName} onChange={(e) => setNewBooking({...newBooking, clientName: e.target.value})} />
              </div>

              <div className="form-group">
                <label className="form-label">Telefon Raqami</label>
                <input type="tel" className="form-input" required placeholder="+998 90 123 45 67" value={newBooking.clientPhone} onChange={(e) => setNewBooking({...newBooking, clientPhone: e.target.value})} />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>Saqlash</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL ADD TRANSACTION */}
      {showAddTxModal && (
        <div className="modal-overlay">
          <div className="modal-content animation-slide-up">
            <button className="modal-close" onClick={() => setShowAddTxModal(false)}><X size={18} /></button>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-emerald)' }}>Moliyaviy Amal Qo'shish</h3>
            
            <form onSubmit={handleAddTxSubmit}>
              <div className="form-group">
                <label className="form-label">Turi</label>
                <div style={{ display: 'flex', gap: '1.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input type="radio" name="txType" checked={newTx.type === 'expense'} onChange={() => setNewTx({...newTx, type: 'expense'})} />
                    <span>Chiqim (Xarajat)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input type="radio" name="txType" checked={newTx.type === 'income'} onChange={() => setNewTx({...newTx, type: 'income'})} />
                    <span>Kirim (Daromad)</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Sana</label>
                <input type="date" className="form-input" required value={newTx.date} onChange={(e) => setNewTx({...newTx, date: e.target.value})} />
              </div>

              <div className="form-group">
                <label className="form-label">Miqdori (so'm)</label>
                <input type="number" className="form-input" required placeholder="50000" value={newTx.amount} onChange={(e) => setNewTx({...newTx, amount: e.target.value})} />
              </div>

              <div className="form-group">
                <label className="form-label">Kategoriya</label>
                <input type="text" className="form-input" required placeholder="Ijara, Material, Reklama..." value={newTx.category} onChange={(e) => setNewTx({...newTx, category: e.target.value})} />
              </div>

              <div className="form-group">
                <label className="form-label">Tavsif</label>
                <input type="text" className="form-input" placeholder="Tavsif yozing..." value={newTx.description} onChange={(e) => setNewTx({...newTx, description: e.target.value})} />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>Kiritish</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MANUAL ADD SERVICE */}
      {showAddServiceModal && (
        <div className="modal-overlay">
          <div className="modal-content animation-slide-up">
            <button className="modal-close" onClick={() => setShowAddServiceModal(false)}><X size={18} /></button>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-emerald)' }}>Yangi Xizmat Qo'shish</h3>
            
            <form onSubmit={handleCreateService}>
              <div className="form-group">
                <label className="form-label">Xizmat Nomi</label>
                <input type="text" className="form-input" required placeholder="Masalan: Soch boyash" value={newServiceData.name} onChange={(e) => setNewServiceData({...newServiceData, name: e.target.value})} />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Narxi (so'm)</label>
                  <input type="number" className="form-input" required placeholder="60000" value={newServiceData.price} onChange={(e) => setNewServiceData({...newServiceData, price: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Davomiyligi</label>
                  <select className="form-select" value={newServiceData.duration} onChange={(e) => setNewServiceData({...newServiceData, duration: e.target.value})}>
                    <option value={15}>15 daqiqa</option>
                    <option value={30}>30 daqiqa</option>
                    <option value={45}>45 daqiqa</option>
                    <option value={60}>60 daqiqa (1 soat)</option>
                    <option value={90}>90 daqiqa (1.5 soat)</option>
                    <option value={120}>120 daqiqa (2 soat)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Turi</label>
                <select className="form-select" value={newServiceData.type} onChange={(e) => setNewServiceData({...newServiceData, type: e.target.value})}>
                  <option value="regular">Oddiy Xizmat</option>
                  <option value="groom">Kuyov Paketi (Tillada)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tavsif</label>
                <input type="text" className="form-input" placeholder="Xizmat haqida qisqacha..." value={newServiceData.description} onChange={(e) => setNewServiceData({...newServiceData, description: e.target.value})} />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>Qo'shish</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );

  function handleSettingsChange(field, value) {
    setSettings(prev => ({ ...prev, [field]: value }));
  }

  function handleWorkingHoursChange(subField, value) {
    setSettings(prev => ({
      ...prev,
      workingHours: { ...prev.workingHours, [subField]: value }
    }));
  }

  async function handleDetectChatId() {
    if (!settings.telegramBotToken) {
      alert("Avval Bot Tokenni kiriting!");
      return;
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/getUpdates`);
      const data = await res.json();
      if (!data.ok) {
        alert("Bot Token noto'g'ri ko'rinadi. Qaytadan tekshiring.");
        return;
      }
      if (data.result.length === 0) {
        alert("Hali botga hech kim yozmagan. Avval Telegram'da botingizga /start deb yozing, so'ng qayta urinib ko'ring.");
        return;
      }
      const last = data.result[data.result.length - 1];
      const chatId = last.message?.chat?.id;
      if (!chatId) {
        alert("Chat ID topilmadi, qayta urinib ko'ring.");
        return;
      }
      handleSettingsChange('telegramChatId', String(chatId));
      alert(`Chat ID topildi: ${chatId}. Endi pastdagi "O'zgarishlarni Saqlash" tugmasini bosing.`);
    } catch (e) {
      console.error(e);
      alert("Xatolik yuz berdi. Internet aloqasi va Bot Tokenni tekshiring.");
    }
  }

  async function handleConnectBotMenu() {
    if (!settings.telegramBotToken) {
      alert("Avval Bot Tokenni kiriting va saqlang!");
      return;
    }

    const appUrl = (settings.webAppUrl || window.location.origin).trim().replace(/\/$/, '');
    if (!appUrl.startsWith('https://')) {
      alert("DIQQAT! Telegram Bot WebApp va Webhook ishlashi uchun havola albatta 'https://' bilan boshlanishi kerak (Masalan: https://sartarosh.vercel.app). Vercel havolangizni yozing va saqlang!");
      return;
    }

    try {
      // 1. Set WebApp menu button
      const res1 = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/setChatMenuButton`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_button: { type: 'web_app', text: '✂️ Navbat olish', web_app: { url: appUrl } }
        })
      });
      const data1 = await res1.json();

      // 2. Set Bot Commands list (/start, /navbat, /xizmatlar, /manzil)
      const res2 = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: [
            { command: 'start', description: '✂️ Sartaroshxona Mini Ilovasini Ochish' },
            { command: 'navbat', description: '📅 Online Navbat Olish' },
            { command: 'xizmatlar', description: '💈 Xizmatlar Va Narxlar' },
            { command: 'manzil', description: '📍 Sartaroshxona Manzili Va Telefon' }
          ]
        })
      });
      const data2 = await res2.json();

      // 3. Set Webhook URL so bot responds automatically to /start with buttons in chat
      const params = new URLSearchParams({
        token: settings.telegramBotToken,
        appUrl: appUrl,
        shopName: settings.shopName || '',
        phone: settings.phone || ''
      });
      const webhookUrl = `${appUrl}/api/telegram-webhook?${params.toString()}`;
      const res3 = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      });
      const data3 = await res3.json();

      if (data1.ok && data2.ok && data3.ok) {
        alert(`🎉 Bot muvaffaqiyatli ulana oldi!\n\nSayt URL: ${appUrl}\n\n1. Telegram botda "✂️ Navbat olish" tugmasi o'rnatildi.\n2. Botingizga /start deb yozganda endi avtomatik javob va tugmalar chiqadi!`);
      } else {
        alert("Telegram Xatosi: " + (data1.description || data2.description || data3.description || "Bot Token yoki HTTPS havolani tekshiring"));
      }
    } catch (e) {
      console.error(e);
      alert("Xatolik yuz berdi. Internet aloqasi va Bot Tokenni tekshiring.");
    }
  }
}
