import { Link } from 'react-router-dom';
import { Shield, Lock, Eye, AlertTriangle, ChevronRight, CheckCircle, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import rammisLogo from '../assets/rammis-logo.png';

const features = [
  {
    icon: Lock,
    title: 'Fully Anonymous',
    desc: 'Zero IP tracking or browser fingerprinting. Your identity is cryptographically protected.',
    color: 'var(--color-gold-500)',
  },

  {
    icon: Shield,
    title: 'Bank-Grade Security',
    desc: 'AES-256 encrypted storage, LDAP-secured staff access, and immutable audit trails.',
    color: '#22c55e',
  },
  {
    icon: Eye,
    title: 'Track Your Report',
    desc: 'Use your secure reference code to follow up and correspond with investigators.',
    color: '#3b82f6',
  },
  {
    icon: AlertTriangle,
    title: 'Report All Violations',
    desc: 'Fraud, corruption, bribery, abuse of power, procurement violations, and system misuse.',
    color: '#ef4444',
  },
];

const categories = [
  'Fraud', 'Corruption', 'Bribery', 'Abuse of Power',
  'Procurement Violation', 'System Misuse',
];

const steps = [
  { n: '01', title: 'Remain Anonymous',     desc: 'Complete a quick privacy-preserving CAPTCHA. No account required.' },
  { n: '02', title: 'Submit Your Report',   desc: 'Describe the misconduct in detail and attach evidence securely.' },
  { n: '03', title: 'Receive Reference Code', desc: 'Get a unique, random tracking code — never sequential or guessable.' },
  { n: '04', title: 'Track & Correspond',   desc: 'Check investigation progress and communicate with investigators safely.' },
];

const trustBadges = [
  '256-bit AES Encryption',
  'Zero IP Logging',
  'CAPTCHA Protected',
  'Immutable Audit Trail',
];

// Fade-up variant for section entries
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const staggerContainer = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1 } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-slate-50)' }}>





      {/* ══════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #060f1e 0%, var(--color-navy-900) 50%, #0d2d52 100%)' }}
      >
        {/* Decorative blobs — hidden on very small screens */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-64 h-64 sm:w-96 sm:h-96 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, var(--color-gold-500), transparent)' }} />
          <div className="absolute bottom-0 -left-16 w-48 h-48 sm:w-64 sm:h-64 rounded-full opacity-5"
            style={{ background: 'radial-gradient(circle, var(--color-gold-500), transparent)' }} />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">

          {/* Logo badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-3 mb-8 px-4 sm:px-6 py-2 sm:py-3 rounded-full glass-panel"
          >
            <div className="px-2 py-1 rounded-lg" style={{ background: 'white' }}>
              <img
                src={rammisLogo}
                alt="Rammis Bank"
                className="h-10 sm:h-14 w-auto object-contain"
              />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-white/80">Official Reporting Channel</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="font-extrabold mb-5 leading-tight"
            style={{
              fontFamily: 'var(--font-family-display)',
              color: 'white',
              fontSize: 'clamp(2rem, 6vw, 3.75rem)',
            }}
          >
            Digital Whistleblowing<br />
            <span style={{ color: 'white' }}>System</span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-white/70 max-w-xl mx-auto mb-8 leading-relaxed px-2"
            style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.125rem)' }}
          >
            Report financial misconduct, fraud, or ethical violations at Rammis Bank
            with complete anonymity and enterprise-grade security.
          </motion.p>

          {/* CTA buttons — stack on mobile */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center mb-12 px-4 sm:px-0"
          >
            <Link to="/staff-login" className="btn btn-gold text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-3.5 w-full sm:w-auto">
              <AlertTriangle size={16} />
              Staff Login
              <ChevronRight size={16} />
            </Link>
            <Link
              to="/track"
              className="btn text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-3.5 w-full sm:w-auto"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <Search size={16} />
              Track Existing Report
            </Link>
          </motion.div>

          {/* Trust badges — 2×2 on mobile, 1 row on sm+ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-3 sm:gap-6 px-4 sm:px-0"
          >
            {trustBadges.map(t => (
              <div key={t} className="flex items-center gap-1.5 justify-center sm:justify-start">
                <CheckCircle size={13} style={{ color: 'var(--color-gold-500)', flexShrink: 0 }} />
                <span className="text-xs sm:text-sm text-white/60">{t}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Wave divider */}
        <div className="relative h-10 sm:h-12 overflow-hidden">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="absolute bottom-0 w-full" preserveAspectRatio="none">
            <path d="M0 48L1440 48L1440 12C1200 48 960 0 720 12C480 24 240 48 0 12L0 48Z"
              fill="var(--color-slate-50)" />
          </svg>
        </div>
      </section>





      {/* ══════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════ */}
      <section className="py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="text-center mb-10 sm:mb-14"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: 'var(--color-navy-900)' }}>
              Why Use the DWBS?
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
              Built to the highest enterprise security standards to protect those who speak up.
            </p>
          </motion.div>

          {/* 1 col mobile → 2 col md → 4 col lg */}
          <motion.div
            variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="card p-5 sm:p-6 hover-lift"
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${f.color}18`, color: f.color }}>
                  <f.icon size={22} />
                </div>
                <h3 className="text-sm sm:text-base font-bold mb-2" style={{ color: 'var(--color-navy-900)' }}>{f.title}</h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>




      {/* ══════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════ */}
      <section className="py-14 sm:py-20 px-4 sm:px-6" style={{ background: 'var(--color-slate-100)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="text-center mb-10 sm:mb-14"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: 'var(--color-navy-900)' }}>
              How It Works
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
              A simple, four-step process designed to protect your identity from start to finish.
            </p>
          </motion.div>

          {/* 1 col mobile → 2 col md → 4 col lg */}
          <motion.div
            variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8"
          >
            {steps.map((s, i) => (
              <motion.div key={s.n} variants={fadeUp} className="relative">
                {/* Connector line — desktop only */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-full h-px z-0"
                    style={{
                      background: 'linear-gradient(to right, var(--color-gold-500), transparent)',
                      width: 'calc(100% - 3rem)',
                    }} />
                )}
                <div className="relative z-10 flex lg:block items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-extrabold flex-shrink-0 mb-0 lg:mb-4"
                    style={{ background: 'var(--color-navy-900)', color: 'var(--color-gold-500)' }}
                  >
                    {s.n}
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold mb-1" style={{ color: 'var(--color-navy-900)' }}>{s.title}</h3>
                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>



      {/* ══════════════════════════════════════════════
          CATEGORIES
      ══════════════════════════════════════════════ */}
      <section className="py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: 'var(--color-navy-900)' }}>
              What Can You Report?
            </h2>
            <p className="text-slate-500 mb-8 text-sm sm:text-base">
              All categories of financial and ethical misconduct are covered.
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {categories.map(cat => (
                <motion.span
                  key={cat}
                  whileHover={{ scale: 1.06 }}
                  className="badge"
                  style={{
                    background: 'var(--color-navy-900)',
                    color: 'var(--color-gold-500)',
                    fontSize: 'clamp(0.75rem, 2vw, 0.8125rem)',
                    padding: '0.4rem 1rem',
                  }}
                >
                  {cat}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>



      {/* ══════════════════════════════════════════════
          CTA
      ══════════════════════════════════════════════ */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 bg-brand-gradient text-center">
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
          className="max-w-xl mx-auto"
        >
          <h2
            className="font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-family-display)', color: 'white', fontSize: 'clamp(1.5rem, 4vw, 1.875rem)' }}
          >
            Ready to Report?
          </h2>
          <p className="text-white/70 mb-8 text-sm sm:text-base">
            Your report is protected by enterprise-grade cryptography. No one will know it was you.
          </p>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link to="/report" className="btn btn-gold text-sm sm:text-base px-8 sm:px-10 py-3 sm:py-4 w-full sm:w-auto">
              <AlertTriangle size={16} />
              Submit Anonymous Report
            </Link>
          </motion.div>
        </motion.div>
      </section>




      {/* ══════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════ */}
      <footer
        className="py-6 sm:py-8 px-4 sm:px-6 text-center text-xs sm:text-sm"
        style={{ background: 'var(--color-navy-950)', color: 'rgba(255,255,255,0.4)' }}
      >
        <div className="max-w-4xl mx-auto">
          <img
            src={rammisLogo}
            alt="Rammis Bank"
            className="h-8 w-auto object-contain mx-auto mb-4 opacity-60"
          />
          <p>© {new Date().getFullYear()} Rammis Bank S.C. — Digital Whistleblowing System</p>
          <p className="mt-1 text-xs opacity-60">Baankii Raammis • ራሚስ ባንከ • Flow to the highest!</p>
        </div>
      </footer>
      
    </div>
  );
}
