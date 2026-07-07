import { Link } from 'react-router-dom';
import { Shield, Lock, Eye, AlertTriangle, ChevronRight, CheckCircle, Search } from 'lucide-react';
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
    desc: 'Fraud, bribery, AML violations, harassment, data breaches, and policy misconduct.',
    color: '#ef4444',
  },
];

const categories = [
  'Fraud', 'Bribery', 'Corruption', 'Harassment',
  'AML Violation', 'Data Breach', 'Policy Violation', 'Other'
];

const steps = [
  { n: '01', title: 'Remain Anonymous', desc: 'Complete a quick privacy-preserving CAPTCHA. No account required.' },
  { n: '02', title: 'Submit Your Report', desc: 'Describe the misconduct in detail and attach evidence securely.' },
  { n: '03', title: 'Receive Reference Code', desc: 'Get a unique, random tracking code — never sequential or guessable.' },
  { n: '04', title: 'Track & Correspond', desc: 'Check investigation progress and communicate with investigators safely.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-slate-50)' }}>

      {/* ── Hero Section ──────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-16"
        style={{ background: 'linear-gradient(135deg, #060f1e 0%, var(--color-navy-900) 50%, #0d2d52 100%)' }}>

        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, var(--color-gold-500), transparent)' }} />
          <div className="absolute bottom-0 -left-24 w-64 h-64 rounded-full opacity-5"
            style={{ background: 'radial-gradient(circle, var(--color-gold-500), transparent)' }} />
          <div className="absolute top-1/2 left-1/4 w-px h-32 opacity-20"
            style={{ background: 'linear-gradient(to bottom, transparent, var(--color-gold-500), transparent)' }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-24 text-center">
          {/* Bank logo area */}
          <div className="inline-flex items-center gap-3 mb-8 px-6 py-3 rounded-full glass-panel">
            <div className="px-3 py-1 rounded-lg" style={{ background: 'white' }}>
              <img
                src={rammisLogo}
                alt="Rammis Bank"
                className="h-16 w-auto object-contain"
              />
            </div>
            <span className="text-sm font-semibold text-white/80">Official Reporting Channel</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight"
            style={{ fontFamily: 'var(--font-family-display)', color: 'white' }}>
            Digital Whistleblowing<br />
            <span style={{ color: 'white' }}>System</span>
          </h1>

          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            Report financial misconduct, fraud, or ethical violations at Rammis Bank
            with complete anonymity and the highest level of security protection.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/report" className="btn btn-gold text-base px-8 py-3.5">
              <AlertTriangle size={18} />
              Submit a Report
              <ChevronRight size={18} />
            </Link>
            <Link to="/track" className="btn text-base px-8 py-3.5"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
              <Search size={18} />
              Track Existing Report
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-6">
            {['256-bit AES Encryption', 'Zero IP Logging', 'CAPTCHA Protected', 'Immutable Audit Trail'].map(t => (
              <div key={t} className="flex items-center gap-2">
                <CheckCircle size={14} style={{ color: 'var(--color-gold-500)' }} />
                <span className="text-sm text-white/60">{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Wave divider */}
        <div className="relative h-12 overflow-hidden">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="absolute bottom-0 w-full" preserveAspectRatio="none">
            <path d="M0 48L1440 48L1440 12C1200 48 960 0 720 12C480 24 240 48 0 12L0 48Z"
              fill="var(--color-slate-50)" />
          </svg>
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--color-navy-900)' }}>
              Why Use the DWBS?
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Built to the highest enterprise security standards to protect those who speak up.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card p-6 hover:shadow-lg transition-shadow fade-in-up">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${f.color}18`, color: f.color }}>
                  <f.icon size={24} />
                </div>
                <h3 className="text-base font-bold mb-2" style={{ color: 'var(--color-navy-900)' }}>{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ background: 'var(--color-slate-100)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--color-navy-900)' }}>
              How It Works
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              A simple, four-step process designed to protect your identity from start to finish.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div key={s.n} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-full w-full h-px z-0"
                    style={{ background: 'linear-gradient(to right, var(--color-gold-500), transparent)', width: 'calc(100% - 3rem)' }} />
                )}
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-extrabold mb-4"
                    style={{ background: 'var(--color-navy-900)', color: 'var(--color-gold-500)' }}>
                    {s.n}
                  </div>
                  <h3 className="text-base font-bold mb-2" style={{ color: 'var(--color-navy-900)' }}>{s.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--color-navy-900)' }}>
            What Can You Report?
          </h2>
          <p className="text-slate-500 mb-10">
            All categories of financial and ethical misconduct are covered.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map(cat => (
              <span key={cat} className="badge"
                style={{ background: 'var(--color-navy-900)', color: 'var(--color-gold-500)', fontSize: '0.8125rem', padding: '0.5rem 1.25rem' }}>
                {cat}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-brand-gradient text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-family-display)', color: 'white' }}>
            Ready to Report?
          </h2>
          <p className="text-white/70 mb-8">
            Your report is protected by enterprise-grade cryptography. No one will know it was you.
          </p>
          <Link to="/report" className="btn btn-gold text-base px-10 py-4">
            <AlertTriangle size={18} />
            Submit Anonymous Report
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="py-8 px-6 text-center text-sm text-slate-400"
        style={{ background: 'var(--color-navy-950)', color: 'rgba(255,255,255,0.4)' }}>
        <p>© {new Date().getFullYear()} Rammis Bank S.C. — Digital Whistleblowing System</p>
        <p className="mt-1 text-xs opacity-60">Baankii Raammis • ሓሚስ ባንከ • Flow to the highest!</p>
      </footer>
    </div>
  );
}
