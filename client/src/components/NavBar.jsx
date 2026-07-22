import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Menu, X, Bell, ChevronDown, CheckCheck, FileText, UserCheck, MessageSquare, AlertTriangle, ArrowUpCircle, FolderOpen } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';
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

// Map notification types to icons and colors
const NOTIF_ICONS = {
  new_case:       { icon: FileText,       color: '#c8a84b', bg: '#fef3c7' },
  case_assigned:  { icon: UserCheck,      color: '#0d9488', bg: '#ccfbf1' },
  new_message:    { icon: MessageSquare,  color: '#3b82f6', bg: '#dbeafe' },
  case_escalated: { icon: AlertTriangle,  color: '#dc2626', bg: '#fee2e2' },
  status_change:  { icon: ArrowUpCircle,  color: '#7c3aed', bg: '#ede9fe' },
};

export default function NavBar({ onMenuToggle, sidebarOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // ── Notification state ──────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadCases, setUnreadCases] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef(null);

  // Add shadow when page is scrolled
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Poll unread count every 30 seconds ──────────────────────
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications/count');
      setUnreadCount(res.data.count || 0);
      setUnreadCases(res.data.unread_cases || 0);
      setUnreadMessages(res.data.unread_messages || 0);
    } catch (_) {}
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // ── Fetch full notifications when panel opens ───────────────
  const fetchNotifications = async () => {
    setNotifLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
    } catch (_) {}
    setNotifLoading(false);
  };

  const handleBellClick = async () => {
    const isOpening = !notifOpen;
    setNotifOpen(o => !o);
    setDropdownOpen(false);

    if (isOpening) {
      // Fetch notifications then immediately mark all as read —
      // opening the panel counts as "viewed"
      setNotifLoading(true);
      try {
        const res = await api.get('/notifications');
        setNotifications(res.data.notifications || []);
        // Mark all read in background so badge clears immediately
        if (unreadCount > 0) {
          await api.patch('/notifications/read-all');
          setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
          setUnreadCount(0);
          setUnreadCases(0);
          setUnreadMessages(0);
        }
      } catch (_) {}
      setNotifLoading(false);
    }
  };

  // ── Mark single notification as read ────────────────────────
  const markAsRead = async (notif) => {
    if (!notif.is_read) {
      try {
        await api.patch(`/notifications/${notif.id}/read`);
        setNotifications(prev =>
          prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (_) {}
    }
    // Navigate to case if there's a case_id
    if (notif.case_id) {
      setNotifOpen(false);
      navigate(`/cases/${notif.case_id}`);
    }
  };

  // ── Mark all as read ────────────────────────────────────────
  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
      setUnreadCases(0);
      setUnreadMessages(0);
    } catch (_) {}
  };

  // ── Close panels on outside click ───────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    setNotifOpen(false);
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
        height: '80px',
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
            <Link to={user ? (user.role === 'Compliance_Officer' ? '/compliance' : user.role === 'CEO' ? '/executive' : user.role === 'System_Admin' ? '/admin' : '/dashboard') : '/'} className="flex items-center no-underline">
              <img
                src={rammisLogo}
                alt="Rammis Bank"
                style={{ height: '64px', width: 'auto', objectFit: 'contain' }}
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
              {/* ── Notification Bell ── */}
              <div className="relative" ref={notifRef}>
                <motion.button
                  id="notification-bell"
                  className="relative p-2 rounded-lg"
                  style={{ color: BRAND_NAVY }}
                  onClick={handleBellClick}
                  whileHover={{ background: '#f1f5f9', rotate: [0, -15, 15, -10, 10, 0] }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                >
                  <Bell size={20} />
                  {/* Unread count badge — only visible when > 0 */}
                  <AnimatePresence>
                    {unreadCount > 0 && (
                      <motion.span
                        key="badge"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute flex items-center justify-center rounded-full font-bold"
                        style={{
                          top: '2px',
                          right: '0px',
                          minWidth: '18px',
                          height: '18px',
                          padding: '0 4px',
                          fontSize: '10px',
                          background: '#ef4444',
                          color: 'white',
                          lineHeight: 1,
                          boxShadow: '0 0 0 2px white',
                        }}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                {/* ── Notification Dropdown Panel ── */}
                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      className="absolute right-0 top-full mt-2 z-50 card"
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      style={{
                        width: '380px',
                        maxHeight: '480px',
                        transformOrigin: 'top right',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {/* Panel header */}
                      <div className="px-4 py-3 border-b border-slate-100"
                        style={{ flexShrink: 0 }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: BRAND_NAVY }}>
                              Notifications
                            </span>
                            {unreadCount > 0 && (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: '#fee2e2', color: '#dc2626' }}>
                                {unreadCount} new
                              </span>
                            )}
                          </div>
                          {unreadCount > 0 && (
                            <button
                              onClick={markAllAsRead}
                              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors"
                              style={{ color: BRAND_NAVY }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <CheckCheck size={13} /> Mark all read
                            </button>
                          )}
                        </div>
                        {/* Breakdown badges */}
                        {unreadCount > 0 && (unreadCases > 0 || unreadMessages > 0) && (
                          <div className="flex items-center gap-1.5 mt-2">
                            {unreadCases > 0 && (
                              <span className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full"
                                style={{ background: '#fef3c7', color: '#92400e' }}>
                                <FolderOpen size={10} />{unreadCases} case{unreadCases !== 1 ? 's' : ''}
                              </span>
                            )}
                            {unreadMessages > 0 && (
                              <span className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full"
                                style={{ background: '#dbeafe', color: '#1e40af' }}>
                                <MessageSquare size={10} />{unreadMessages} msg{unreadMessages !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Notification list */}
                      <div style={{ overflowY: 'auto', flex: 1 }}>
                        {notifLoading ? (
                          <div className="py-10 text-center">
                            <span className="spinner spinner-navy mx-auto" />
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="py-10 text-center">
                            <Bell size={28} className="mx-auto mb-2" style={{ color: '#cbd5e1' }} />
                            <p className="text-sm text-slate-400">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map(notif => {
                            const typeInfo = NOTIF_ICONS[notif.type] || NOTIF_ICONS.new_case;
                            const IconComponent = typeInfo.icon;
                            return (
                              <motion.button
                                key={notif.id}
                                onClick={() => markAsRead(notif)}
                                className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
                                style={{
                                  background: notif.is_read ? 'transparent' : 'rgba(26,58,107,0.03)',
                                  borderBottom: '1px solid #f1f5f9',
                                }}
                                whileHover={{ background: '#f8fafc' }}
                              >
                                {/* Icon */}
                                <div
                                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                                  style={{ background: typeInfo.bg }}
                                >
                                  <IconComponent size={15} style={{ color: typeInfo.color }} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="text-xs font-bold truncate"
                                      style={{ color: notif.is_read ? '#64748b' : BRAND_NAVY }}
                                    >
                                      {notif.title}
                                    </span>
                                    {!notif.is_read && (
                                      <span
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ background: '#3b82f6' }}
                                      />
                                    )}
                                  </div>
                                  <p
                                    className="text-xs mt-0.5 leading-relaxed"
                                    style={{
                                      color: notif.is_read ? '#94a3b8' : '#475569',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {notif.message}
                                  </p>
                                  <span className="text-xs mt-1 block" style={{ color: '#94a3b8' }}>
                                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                              </motion.button>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* User dropdown */}
              <div className="relative">
                <motion.button
                  onClick={() => { setDropdownOpen(o => !o); setNotifOpen(false); }}
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
                      {user.role === 'Compliance_Officer' ? 'Ethics & Anti-Corruption' : user.role?.replace(/_/g, ' ')}
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
                  className="text-xs sm:text-sm font-semibold py-1.5 sm:py-2 px-3 sm:px-5 rounded-lg inline-block"
                  style={{ background: BRAND_GOLD, color: BRAND_NAVY }}
                >
                  Anonymous user
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/login"
                  className="text-xs sm:text-sm font-semibold py-1.5 sm:py-2 px-3 sm:px-5 rounded-lg inline-block transition-colors"
                  style={{ color: BRAND_NAVY, border: `2px solid ${BRAND_NAVY}`, background: 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.background = BRAND_NAVY; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = BRAND_NAVY; }}
                >
                  Non Anonymous
                </Link>
              </motion.div>
            </div>
          )}
        </motion.div>

      </div>
    </motion.header>
  );
}
