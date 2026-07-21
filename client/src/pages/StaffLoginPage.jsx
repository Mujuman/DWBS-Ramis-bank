import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, LogIn, AlertTriangle } from 'lucide-react';
import rammisLogo from '../assets/rammis-logo.png';

export default function StaffLoginPage() {
  const { staffLogin } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const otpRequired = import.meta.env.VITE_OTP_REQUIRED === 'true';

  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { username: '', password: '', otp: '' } });

  const onLogin = async ({ username, password, otp }) => {
    setLoading(true);
    try {
      const user = await staffLogin(username, password, otp);
      toast.success(`Welcome, ${user.display_name}`);
      if (user.role === 'CEO') navigate('/executive');
      else if (user.role === 'Compliance_Officer') navigate('/compliance');
      else if (user.role === 'System_Admin') navigate('/admin');
      else if (user.role === 'Auditor') navigate('/audit');
      else navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-brand-gradient">
      {/* Left: Brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-5/12 p-12"
        style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div>
          {/* Rammis Bank logo */}
          <div className="mb-12">
            <div className="inline-block px-4 py-2 rounded-xl" style={{ background: 'white' }}>
              <img
                src={rammisLogo}
                alt="Rammis Bank"
                className="h-24 w-auto object-contain"
              />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-family-display)' }}>
            Staff Portal
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-8">
            Secure access for authorized Rammis Bank staff. Authentication is powered by
            Active Directory via LDAPS with role-based access control.
          </p>

          <div className="space-y-3">
            {[
              ['🔐', 'Active Directory Authentication', 'LDAPS TLS on port 636'],
              ['🛡️', 'Role-Based Access Control', 'Granular permissions by role'],
              ['📋', 'Immutable Audit Trail', 'All actions permanently logged'],
            ].map(([icon, title, sub]) => (
              <div key={title} className="glass-panel p-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-xs text-white/50">{sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-white/30">
          © {new Date().getFullYear()} Rammis Bank S.C. — DWBS v1.0<br />
          Baankii Raammis • ራሚስ ባንከ
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="card p-8 fade-in-up">
            {/* Mobile logo */}
            <div className="flex lg:hidden items-center mb-6">
              <img
                src={rammisLogo}
                alt="Rammis Bank"
                className="h-14 w-auto object-contain"
              />
            </div>

            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-navy-900)' }}>
              Sign In
            </h1>
            <p className="text-sm text-slate-500 mb-6">Use your Active Directory credentials</p>

            <div className="rounded-xl p-3 mb-6 flex items-center gap-2"
              style={{ background: 'rgba(249,168,38,0.08)', border: '1px solid rgba(249,168,38,0.25)' }}>
              <AlertTriangle size={14} style={{ color: 'var(--color-gold-600)', flexShrink: 0 }} />
              <p className="text-xs" style={{ color: 'var(--color-navy-800)' }}>
                This system is restricted to authorized personnel only. Unauthorized access is a criminal offence.
              </p>
            </div>

            <form onSubmit={handleSubmit(onLogin)} className="space-y-4">
              <div>
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. sysadmin"
                  autoComplete="username"
                  {...register('username', {
                    required: 'Username is required',
                    pattern: { value: /^[a-zA-Z0-9._-]+$/, message: 'Invalid username format' },
                  })}
                />
                {errors.username && <p className="form-error">{errors.username.message}</p>}
              </div>

              <div>
                <label className="form-label">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="form-input pr-10"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    {...register('password', { required: 'Password is required' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="form-error">{errors.password.message}</p>}
              </div>

              {otpRequired && (
                <div>
                  <label className="form-label">OTP</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter your OTP"
                    autoComplete="one-time-code"
                    {...register('otp', { required: 'OTP is required' })}
                  />
                  {errors.otp && <p className="form-error">{errors.otp.message}</p>}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary w-full mt-6">
                {loading
                  ? <><span className="spinner" /> Authenticating...</>
                  : <><LogIn size={16} /> Sign In</>}
              </button>
            </form>

            {/* Default admin credentials — remove or disable in production */}
            <div className="mt-5 rounded-xl p-3.5"
              style={{ background: 'rgba(6,15,30,0.04)', border: '1px solid rgba(6,15,30,0.1)' }}>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-navy-900)' }}>
                Default Admin Credentials
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Username</span>
                  <code className="font-mono font-semibold px-2 py-0.5 rounded"
                    style={{ background: 'var(--color-navy-900)', color: 'var(--color-gold-400)' }}>
                    sysadmin
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Password</span>
                  <code className="font-mono font-semibold px-2 py-0.5 rounded"
                    style={{ background: 'var(--color-navy-900)', color: 'var(--color-gold-400)' }}>
                    Admin@Rammis2025!
                  </code>
                </div>
              </div>
              <p className="text-xs mt-2.5 font-medium" style={{ color: '#dc2626' }}>
                ⚠ Change this password immediately after first login.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400 mb-2">
                Forgot your password? Contact IT Support<br />
                or the Active Directory administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
