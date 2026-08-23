import React, { useState, useEffect } from 'react';
import ClientBooking from './components/ClientBooking';
import AdminDashboard from './components/AdminDashboard';
import { dbService } from './db/dbService';
import { Scissors, ShieldCheck, User } from 'lucide-react';

function App() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    // Initialize or load settings
    const loadSettings = async () => {
      const setts = await dbService.getSettings();
      setSettings(setts);
    };
    loadSettings();

    // Check if running inside Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
      try {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand(); // Expand the Mini App to full height on mobile
        
        // Apply Telegram colors if available
        if (tg.setHeaderColor) {
          tg.setHeaderColor('#f7f9fc');
        }
      } catch (e) {
        console.error("Telegram SDK failed to initialize:", e);
      }
    }
  }, [isAdminMode]); // Refresh settings when mode toggles

  const handleDataChange = async () => {
    const setts = await dbService.getSettings();
    setSettings(setts);
  };

  return (
    <div className="app-container">
      
      {/* App Global Header */}
      <header>
        <div className="header-content">
          <div className="logo-section">
            <Scissors className="logo-icon" size={28} />
            <h1>{settings.shopName || 'Elite Barber'}</h1>
          </div>
          
          <button 
            onClick={() => setIsAdminMode(!isAdminMode)}
            className={`nav-toggle-btn ${isAdminMode ? 'active' : ''}`}
          >
            {isAdminMode ? (
              <>
                <User size={16} />
                <span>Mijoz bo'limi</span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                <span>Sartarosh bo'limi</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Application Body */}
      <main>
        {isAdminMode ? (
          <AdminDashboard onDataChange={handleDataChange} />
        ) : (
          <ClientBooking onBookingSuccess={handleDataChange} />
        )}
      </main>

      {/* Footer */}
      <footer style={{ 
        textAlign: 'center', 
        padding: '2rem 1.5rem', 
        borderTop: '1px solid var(--border-color)', 
        color: 'var(--text-muted)',
        fontSize: '0.8rem',
        marginTop: 'auto',
        background: 'var(--bg-secondary)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <p>© 2026 {settings.shopName || 'Elite Barber'}. Barcha huquqlar himoyalangan.</p>
          <p style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Avtomatlashtirilgan oson navbat va moliya tizimi.
          </p>
        </div>
      </footer>

    </div>
  );
}

export default App;
