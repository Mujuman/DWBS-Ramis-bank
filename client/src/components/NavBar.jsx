import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Menu, X, Bell, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import rammisLogo from '../assets/rammis-logo.png';

const BRAND_NAVY = '#1a3a6b';
const BRAND_GOLD = '#c8a84b';

const roleColors = {
  System_Admin:       'bg-purple-100 text-purple-700',
  CEO:                'bg-amber-100 text-amber-700',
  Compliance_Officer: 'bg-blue-100 text-blue-700',
  Investigator:       'bg-teal-100 text-teal-700',
  Branch_Manager:     'bg-indigo-100 text-indigo-700',
  Employee:           'bg-slate-100 text-slate-600',
};

export default function NavBar({ onMenuToggle, sidebarOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Add shadow when page is scrolled
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/');
  };

  return (
    // Navbar slides down on mount
    <motion.header
      className="fixed top-0 left-0 right-0 z-50"
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      style={{
        background: 'white',
        borderBottom: `3px solid ${BRAND_GOLD}`,
        boxShadow: scrolled
          ? '0 4px 24px rgba(26,58,107,0.18)'
          : '0 2px 12px rgba(26,58,107,0.08)',
        height: '72px',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      <div className="flex items-center justify-between h-full px-6 gap-4">

        {/* ── Left: hamburger + logo ── */}
        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait">
            {user && (
              <motion.button
                key={sidebarOpen ? 'close' : 'open'}
                onClick={onMenuToggle}
                aria-label="Toggle sidebar"
                className="p-2 rounded-lg"
                style={{ color: BRAND_NAVY }}
                initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                whileHover={{ background: '#f1f5f9' }}
                whileTap={{ scale: 0.9 }}
              >
                {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Logo with hover scale */}
          <motion.div
            whileHover={{ scale: 1.03 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Link to={user ? '/dashboard' : '/'} className="flex items-center no-underline">
              <img
                src={rammisLogo}
                alt="Rammis Bank"
                style={{ height: '56px', width: 'auto', objectFit: 'contain' }}
              />
            </Link>
          </motion.div>
        </div>

        {/* ── Right ── */}
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
        >
          {user ? (
            <>
              {/* Bell with wiggle on hover */}
              <motion.button
                className="relative p-2 rounded-lg"
                style={{ color: BRAND_NAVY }}
                whileHover={{ background: '#f1f5f9', rotate: [0, -15, 15, -10, 10, 0] }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.4 }}
              >
                <Bell size={20} />
                <motion.span
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                  style={{ background: BRAND_GOLD }}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.button>

              {/* User dropdown */}
              <div className="relative">
                <motion.button
                  onClick={() => setDropdownOpen(o => !o)}
                  className="flex items-center gap-2 py-1.5 px-3 rounded-lg"
                  whileHover={{ background: '#f1f5f9' }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                >
                  <motion.div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: BRAND_NAVY, color: BRAND_GOLD }}
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                  >
                    {user.display_name?.charAt(0).toUpperCase() || 'U'}
                  </motion.div>
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-semibold leading-tight" style={{ color: BRAND_NAVY }}>
                      {user.display_name}
                    </div>
                    <div className={`text-xs px-1.5 py-0.5 rounded-full inline-block font-semibold ${roleColors[user.role] || 'bg-slate-100 text-slate-600'}`}>
                      {user.role?.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: dropdownOpen ? 180 : 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    <ChevronDown size={15} style={{ color: '#94a3b8' }} />
                  </motion.div>
                </motion.button>

                {/* Animated dropdown */}
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      className="absolute right-0 top-full mt-2 w-48 card py-1 z-50"
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      style={{ transformOrigin: 'top right' }}
                    >
                      <div className="px-4 py-2 border-b border-slate-100">
                        <div className="text-xs text-slate-500">Signed in as</div>
                        <div className="text-sm font-semibold truncate" style={{ color: BRAND_NAVY }}>
                          {user.username}
                        </div>
                      </div>
                      <motion.button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 transition-colors"
                        whileHover={{ background: '#fef2f2', x: 2 }}
                        transition={{ duration: 0.15 }}
                      >
                        <LogOut size={14} />
                        Sign Out
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/report"
                  className="text-sm font-semibold py-2 px-5 rounded-lg inline-block"
                  style={{ background: BRAND_GOLD, color: BRAND_NAVY }}
                >
                  Submit Report
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/login"
                  className="text-sm font-semibold py-2 px-5 rounded-lg inline-block transition-colors"
                  style={{ color: BRAND_NAVY, border: `2px solid ${BRAND_NAVY}`, background: 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.background = BRAND_NAVY; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = BRAND_NAVY; }}
                >
                  Staff Login
                </Link>
              </motion.div>
            </div>
          )}
        </motion.div>

      </div>
    </motion.header>
  );
}
