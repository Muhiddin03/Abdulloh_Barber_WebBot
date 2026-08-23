import React, { useState, useEffect } from 'react';
import { dbService } from '../db/dbService';
import { notifyAdminNewBooking } from '../telegram';
import { 
  Scissors, 
  Sparkles, 
  Crown, 
  Wind, 
  Smile, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Phone, 
  CheckCircle2, 
  ChevronRight, 
  PhoneCall,
  MapPin,
  AlertCircle
} from 'lucide-react';

const ICON_MAP = {
  Scissors: Scissors,
  Sparkles: Sparkles,
  Crown: Crown,
  Wind: Wind,
  Smile: Smile
};

export default function ClientBooking({ onBookingSuccess }) {
  const [services, setServices] = useState([]);
  const [settings, setSettings] = useState({});
  const [bookings, setBookings] = useState([]);
  
  // Navigation
  const [step, setStep] = useState(1);
  
  // Selections
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  
  // Generated slots
  const [availableDays, setAvailableDays] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [todayTimelineBlocks, setTodayTimelineBlocks] = useState([]);
  const [barberStatus, setBarberStatus] = useState({ isBusy: false, currentActivity: '', nextFreeTime: '' });

  // Receipt
  const [createdBooking, setCreatedBooking] = useState(null);

  useEffect(() => {
    const initLoad = async () => {
      const fetchedServices = await dbService.getServices();
      const fetchedSettings = await dbService.getSettings();
      const fetchedBookings = await dbService.getBookings();
      
      setServices(fetchedServices);
      setSettings(fetchedSettings);
      setBookings(fetchedBookings);
      
      generateDays();
    };
    initLoad();
  }, []);

  useEffect(() => {
    if (selectedDate && bookings.length >= 0) {
      generateTimeSlots(selectedDate);
    }
  }, [selectedDate, selectedService, bookings]);

  useEffect(() => {
    if (bookings.length >= 0 && settings.workingHours) {
      calculateBarberStatus();
      generateTodayTimeline();
    }
  }, [bookings, settings]);

  const generateDays = () => {
    const days = [];
    const uzDays = ['Yak', 'Dush', 'Sech', 'Chor', 'Pay', 'Jum', 'Shan'];
    const uzMonths = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyil', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      const dateString = date.toISOString().split('T')[0];
      const dayNum = date.getDate();
      const dayName = uzDays[date.getDay()];
      const monthName = uzMonths[date.getMonth()];
      
      days.push({
        dateString,
        dayNum,
        dayName,
        monthName,
        isToday: i === 0
      });
    }
    
    setAvailableDays(days);
    setSelectedDate(days[0].dateString);
  };

  const checkSlotsAvailability = (startStr, durationMins, intervalMins, bookedSlots) => {
    const slotsNeeded = Math.ceil(durationMins / intervalMins);
    const slotsToBook = [];
    
    const [h, m] = startStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);

    for (let i = 0; i < slotsNeeded; i++) {
      const sh = date.getHours().toString().padStart(2, '0');
      const sm = date.getMinutes().toString().padStart(2, '0');
      const slotTime = `${sh}:${sm}`;
      
      slotsToBook.push(slotTime);
      date.setMinutes(date.getMinutes() + intervalMins);
    }

    const hasOverlap = slotsToBook.some(slot => bookedSlots.includes(slot));
    const lastSlotTime = slotsToBook[slotsToBook.length - 1];
    const workingEnd = settings.workingHours?.end || '20:00';
    
    if (lastSlotTime > workingEnd) {
      return { available: false, slots: [] };
    }

    return { available: !hasOverlap, slots: slotsToBook };
  };

  const generateTimeSlots = (dateStr) => {
    const workingHours = settings.workingHours || { start: '09:00', end: '20:00' };
    const interval = settings.slotInterval || 30;
    const duration = selectedService ? selectedService.duration : 30;
    
    const startHour = parseInt(workingHours.start.split(':')[0]);
    const startMin = parseInt(workingHours.start.split(':')[1]);
    const endHour = parseInt(workingHours.end.split(':')[0]);
    const endMin = parseInt(workingHours.end.split(':')[1]);
    
    const slots = [];
    let current = new Date();
    current.setHours(startHour, startMin, 0, 0);
    
    const endLimit = new Date();
    endLimit.setHours(endHour, endMin, 0, 0);
    
    const now = new Date();
    const isToday = dateStr === now.toISOString().split('T')[0];
    
    const dayBookings = bookings.filter(b => b.date === dateStr && b.status !== 'cancelled');
    const bookedSlotsList = [];
    dayBookings.forEach(b => {
      if (b.slots && Array.isArray(b.slots)) {
        bookedSlotsList.push(...b.slots);
      } else {
        bookedSlotsList.push(b.time);
      }
    });

    while (current < endLimit) {
      const hours = current.getHours().toString().padStart(2, '0');
      const mins = current.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${mins}`;
      
      let isPast = false;
      if (isToday) {
        const slotDateTime = new Date();
        slotDateTime.setHours(current.getHours(), current.getMinutes(), 0, 0);
        isPast = slotDateTime <= now;
      }

      let available = !isPast;
      
      if (available) {
        const check = checkSlotsAvailability(timeStr, duration, interval, bookedSlotsList);
        available = check.available;
      }
      
      slots.push({
        time: timeStr,
        available: available
      });
      
      current.setMinutes(current.getMinutes() + interval);
    }
    
    setTimeSlots(slots);
  };

  const calculateBarberStatus = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayBookings = bookings.filter(b => b.date === todayStr && b.status !== 'cancelled');
    
    const now = new Date();
    const currentHourMin = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const currentBooking = todayBookings.find(b => {
      if (b.slots && Array.isArray(b.slots)) {
        const start = b.time;
        const end = b.endTime || b.slots[b.slots.length - 1];
        return currentHourMin >= start && currentHourMin < end;
      }
      return currentHourMin === b.time;
    });

    if (currentBooking) {
      setBarberStatus({
        isBusy: true,
        currentActivity: currentBooking.serviceName,
        nextFreeTime: currentBooking.endTime || 'Yaqinda'
      });
    } else {
      const upcoming = todayBookings
        .filter(b => b.time > currentHourMin)
        .sort((a, b) => a.time.localeCompare(b.time));
        
      setBarberStatus({
        isBusy: false,
        currentActivity: 'Kutmoqda',
        nextFreeTime: upcoming.length > 0 ? upcoming[0].time : 'Kunning qolgan qismi bo\'sh'
      });
    }
  };

  const generateTodayTimeline = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const workingHours = settings.workingHours || { start: '09:00', end: '20:00' };
    const interval = settings.slotInterval || 30;
    
    const startHour = parseInt(workingHours.start.split(':')[0]);
    const startMin = parseInt(workingHours.start.split(':')[1]);
    const endHour = parseInt(workingHours.end.split(':')[0]);
    const endMin = parseInt(workingHours.end.split(':')[1]);
    
    const todayBookings = bookings.filter(b => b.date === todayStr && b.status !== 'cancelled');
    
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
        tooltip = `${timeStr} - Band (${isGroom ? 'Kuyov' : 'Soch/Soqol'})`;
      }
      
      blocks.push({
        time: timeStr,
        status,
        tooltip
      });
      
      current.setMinutes(current.getMinutes() + interval);
    }
    setTodayTimelineBlocks(blocks);
  };

  const handleServiceSelect = (service) => {
    setSelectedService(service);
    setSelectedTime('');
    setStep(2);
  };

  const formatUzCurrency = (val) => {
    return new Intl.NumberFormat('uz-UZ').format(val) + " so'm";
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!clientName || !clientPhone || !selectedService || !selectedDate || !selectedTime) {
      alert("Barcha maydonlarni to'ldiring!");
      return;
    }
    
    const allBookings = await dbService.getBookings();
    const dayBookings = allBookings.filter(b => b.date === selectedDate && b.status !== 'cancelled');
    const bookedSlotsList = [];
    dayBookings.forEach(b => {
      if (b.slots && Array.isArray(b.slots)) {
        bookedSlotsList.push(...b.slots);
      } else {
        bookedSlotsList.push(b.time);
      }
    });

    const check = checkSlotsAvailability(
      selectedTime, 
      selectedService.duration, 
      settings.slotInterval || 30, 
      bookedSlotsList
    );

    if (!check.available) {
      alert("Bu vaqt band bo'lib qoldi, iltimos boshqasini tanlang!");
      generateTimeSlots(selectedDate);
      return;
    }

    const [h, m] = selectedTime.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    date.setMinutes(date.getMinutes() + selectedService.duration);
    const endH = date.getHours().toString().padStart(2, '0');
    const endM = date.getMinutes().toString().padStart(2, '0');
    const endTime = `${endH}:${endM}`;

    let newBooking;
    try {
      newBooking = await dbService.addBooking({
        clientName,
        clientPhone,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: selectedService.price,
        date: selectedDate,
        time: selectedTime,
        endTime: endTime,
        slots: check.slots
      });
    } catch (err) {
      console.error(err);
      alert("Navbat saqlanmadi, iltimos qaytadan urinib ko'ring.");
      return;
    }

    const updatedBookings = await dbService.getBookings();
    setBookings(updatedBookings);

    setCreatedBooking(newBooking);
    setStep(4);
    notifyAdminNewBooking(newBooking);
    if (onBookingSuccess) {
      onBookingSuccess();
    }
  };

  const resetForm = () => {
    setSelectedService(null);
    setSelectedTime('');
    setClientName('');
    setClientPhone('');
    setCreatedBooking(null);
    setStep(1);
    generateDays();
  };

  return (
    <div className="client-booking-wrapper animation-fade-in">
      
      {/* Barber Live Status Panel */}
      {step < 4 && (
        <div className={`barber-status-widget ${barberStatus.isBusy ? 'busy' : ''}`}>
          <div className="status-indicator-left">
            <div className="pulse-dot" />
            <span className="status-label">
              Sartarosh hozir: <strong>{barberStatus.isBusy ? 'Ish band ✂️' : 'Mijoz kutmoqda ☕'}</strong>
              {barberStatus.isBusy && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}> ({barberStatus.currentActivity})</span>}
            </span>
          </div>
          <div className="status-time">
            {barberStatus.isBusy ? `Bo'shaydi: ${barberStatus.nextFreeTime}` : `Keyingi bo'sh vaqt: ${barberStatus.nextFreeTime}`}
          </div>
        </div>
      )}

      {/* Visual Timeline Widget */}
      {step < 4 && todayTimelineBlocks.length > 0 && (
        <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
          <div className="visual-timeline-container">
            <div className="timeline-title-row">
              <h4 style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'var(--font-body)', fontWeight: 700 }}>
                <Clock size={14} className="text-gold" style={{ color: 'var(--accent-brass)' }} /> Bugungi bandlik jadvali
              </h4>
              <div className="timeline-legend">
                <div className="legend-item"><span className="legend-dot free" /> Bo'sh</div>
                <div className="legend-item"><span className="legend-dot busy" /> Band</div>
                <div className="legend-item"><span className="legend-dot groom" /> Kuyov</div>
              </div>
            </div>
            
            <div className="timeline-track">
              <div className="timeline-hours-row">
                {todayTimelineBlocks.filter((_, idx) => idx % 2 === 0).map(block => (
                  <span key={block.time} className="timeline-hour-mark">{block.time}</span>
                ))}
              </div>
              <div className="timeline-blocks-container">
                {todayTimelineBlocks.map(block => (
                  <div 
                    key={block.time} 
                    className={`timeline-block ${block.status}`}
                  >
                    <span className="timeline-block-tooltip">{block.tooltip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Salon Info Header */}
      {step < 4 && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.65rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                {settings.shopName || 'Elite Barber Shop'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                <MapPin size={14} style={{ color: 'var(--accent-brass)' }} /> {settings.address}
              </p>
            </div>
            <a href={`tel:${settings.phone}`} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}>
              <PhoneCall size={14} />
              <span style={{ fontSize: '0.85rem' }}>Qo'ng'iroq</span>
            </a>
          </div>
        </div>
      )}

      {/* Steps indicator */}
      {step < 4 && (
        <div className="booking-steps-nav">
          <div className={`step-indicator ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>1</div>
          <div className={`step-indicator ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>2</div>
          <div className={`step-indicator ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>3</div>
        </div>
      )}

      {/* STEP 1: SERVICE LIST */}
      {step === 1 && (
        <div className="booking-step-content animation-slide-up">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.85rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-emerald)' }}>Xizmatni tanlang</h3>
          
          <div className="services-list">
            {services.map(service => {
              const IconComponent = ICON_MAP[service.icon] || Scissors;
              const isGroom = service.type === 'groom';
              
              return (
                <button 
                  key={service.id}
                  onClick={() => handleServiceSelect(service)}
                  className={`service-item ${isGroom ? 'premium-groom' : ''} ${selectedService?.id === service.id ? 'selected' : ''}`}
                >
                  <div className="service-icon-wrapper">
                    {isGroom ? <Crown size={20} /> : <IconComponent size={20} />}
                  </div>
                  <div className="service-details">
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {service.name}
                      {isGroom && <span className="badge badge-pending" style={{ color: 'var(--accent-brass)', background: 'var(--accent-brass-light)', fontSize: '0.6rem' }}>Premium</span>}
                    </h4>
                    <p>{service.description} ({service.duration} daqiqa)</p>
                  </div>
                  <div className="service-price">
                    {formatUzCurrency(service.price)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: CALENDAR AND TIME SLOTS */}
      {step === 2 && (
        <div className="booking-step-content animation-slide-up">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.85rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-emerald)' }}>Kun va vaqtni tanlang</h3>
          
          <div className="calendar-container card">
            <div>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                <CalendarIcon size={14} className="text-gold" style={{ color: 'var(--accent-brass)' }} /> Sanani tanlang
              </h4>
              <div className="calendar-days-scroll">
                {availableDays.map(day => (
                  <button
                    key={day.dateString}
                    onClick={() => setSelectedDate(day.dateString)}
                    className={`calendar-day-btn ${selectedDate === day.dateString ? 'selected' : ''}`}
                  >
                    <span className="day-name">{day.dayName}</span>
                    <span className="day-number">{day.dayNum}</span>
                    <span style={{ fontSize: '0.6rem', marginTop: '2px', opacity: 0.8 }}>
                      {day.isToday ? 'Bugun' : day.monthName.substring(0, 3)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                <Clock size={14} className="text-gold" style={{ color: 'var(--accent-brass)' }} /> Bo'sh soatlar
              </h4>
              
              {selectedService?.type === 'groom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--accent-brass-light)', border: '1px solid rgba(184,144,71,0.2)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-lg)', marginBottom: '0.85rem', fontSize: '0.75rem' }}>
                  <AlertCircle size={14} style={{ color: 'var(--accent-brass)', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Kuyov paketi uchun <b>2 soat (4 ta ketma-ket slot)</b> bo'sh joy kerak.</span>
                </div>
              )}

              {timeSlots.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.8rem' }}>Yuklanmoqda...</p>
              ) : timeSlots.filter(s => s.available).length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--danger)', padding: '1rem', fontSize: '0.8rem', fontWeight: 600 }}>
                  Kechirasiz, tanlangan kunda bo'sh vaqtlar qolmagan.
                </p>
              ) : (
                <div className="slots-grid">
                  {timeSlots.map(slot => (
                    <button
                      key={slot.time}
                      disabled={!slot.available}
                      onClick={() => setSelectedTime(slot.time)}
                      className={`slot-btn ${selectedTime === slot.time ? 'selected' : ''}`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>
              Orqaga
            </button>
            <button 
              className="btn btn-primary" 
              style={{ flex: 2 }} 
              disabled={!selectedDate || !selectedTime}
              onClick={() => setStep(3)}
            >
              Keyingi <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CONTACT FORM */}
      {step === 3 && (
        <div className="booking-step-content animation-slide-up">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.85rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-emerald)' }}>Ma'lumotlaringizni kiriting</h3>
          
          <form onSubmit={handleBookingSubmit} className="card">
            
            {/* Booking Summary */}
            <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-xl)', marginBottom: '1.25rem', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Xizmat:</span>
                <span style={{ fontWeight: 700 }}>{selectedService?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Sana & Vaqt:</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>{selectedDate} da, {selectedTime} soatda</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Davomiyligi:</span>
                <span style={{ fontWeight: 700 }}>{selectedService?.duration} daqiqa</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Jami to'lov:</span>
                <span style={{ fontWeight: 800, color: selectedService?.type === 'groom' ? 'var(--accent-brass)' : 'var(--accent-emerald)', fontSize: '1rem' }}>
                  {formatUzCurrency(selectedService?.price)}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Sizning ismingiz</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ paddingLeft: '2.4rem' }}
                  required 
                  placeholder="Ismingiz"
                  value={clientName} 
                  onChange={(e) => setClientName(e.target.value)} 
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Telefon raqamingiz</label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="tel" 
                  className="form-input" 
                  style={{ paddingLeft: '2.4rem' }}
                  required 
                  placeholder="+998 90 123 45 67" 
                  value={clientPhone} 
                  onChange={(e) => setClientPhone(e.target.value)} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(2)}>
                Orqaga
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                Navbatni Tasdiqlash
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 4: SUCCESS RECEIPT */}
      {step === 4 && createdBooking && (
        <div className="success-screen card animation-fade-in" style={{ textAlign: 'center', padding: '1.75rem' }}>
          <div className="success-icon-container" style={{ width: '4rem', height: '4rem', background: 'var(--success-light)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.85rem' }}>
            <CheckCircle2 size={36} />
          </div>
          
          <h2 style={{ fontSize: '1.45rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '0.25rem' }}>Navbatingiz Olindi!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
            Ro'yxatga kiritildingiz, sizni belgilangan vaqtda kutamiz.
          </p>
          
          {/* Ticket Receipt style */}
          <div style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-xl)', padding: '1rem', margin: '0 0 1.25rem', textAlign: 'left', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Mijoz:</span>
              <span style={{ fontWeight: 700 }}>{createdBooking.clientName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Xizmat turi:</span>
              <span style={{ fontWeight: 700 }}>{createdBooking.serviceName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Sana:</span>
              <span style={{ fontWeight: 700 }}>{createdBooking.date}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Vaqt oralig'i:</span>
              <span style={{ fontWeight: 800, color: 'var(--accent-emerald)' }}>{createdBooking.time} - {createdBooking.endTime}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0 0', borderBottom: 'none' }}>
              <span style={{ color: 'var(--text-secondary)' }}>To'lov miqdori:</span>
              <span style={{ fontWeight: 800, color: 'var(--success)' }}>{formatUzCurrency(createdBooking.price)}</span>
            </div>
          </div>
          
          <button className="btn btn-primary" onClick={resetForm} style={{ width: '100%' }}>
            Yangi navbat olish
          </button>
        </div>
      )}

    </div>
  );
}
