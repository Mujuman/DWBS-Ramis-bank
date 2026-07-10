import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import {
  Shield, CheckCircle, ChevronRight, ChevronLeft,
  Upload, X, AlertTriangle, Lock, FileText, Copy
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const CATEGORIES = [
  { value: 'Fraud',                 label: 'Fraud',                 icon: '💳' },
  { value: 'Corruption',            label: 'Corruption',            icon: '⚖️' },
  { value: 'Bribery',               label: 'Bribery',               icon: '💰' },
  { value: 'Abuse_of_Power',        label: 'Abuse of Power',        icon: '⚡' },
  { value: 'Procurement_Violation', label: 'Procurement Violation', icon: '📦' },
  { value: 'System_Misuse',         label: 'System Misuse',         icon: '🖥️' },
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const STEPS = ['Privacy Shield', 'Incident Details', 'Evidence', 'Review & Submit'];

export default function SubmitReportPage() {
  const { user, anonToken, initAnonymousSession } = useAuth();
  const navigate = useNavigate();

  const isStaffAuthenticated = Boolean(user);
  const [step, setStep]               = useState(isStaffAuthenticated ? 1 : 0);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaToken, setCaptchaToken]     = useState(null);
  const [sessionToken, setSessionToken]     = useState(anonToken || null);
  const [files, setFiles]             = useState([]);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(null);
  const captchaRef = useRef(null);

  useEffect(() => {
    setStep(isStaffAuthenticated ? 1 : 0);
  }, [isStaffAuthenticated]);

  const { register, handleSubmit, watch, formState: { errors }, getValues } = useForm({
    defaultValues: { category: '', description: '', branch_or_dept: '', severity_level: 'Medium' },
  });

  // ── hCaptcha verified → create anonymous session ──────────
  const onCaptchaVerify = async (token) => {
    setCaptchaToken(token);
    setCaptchaLoading(true);
    try {
      const anonSessionToken = await initAnonymousSession(token);
      setSessionToken(anonSessionToken);
      toast.success('Privacy shield activated — you are now anonymous');
      setStep(1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed. Please try again.');
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setCaptchaLoading(false);
    }
  };

  // ── File dropzone ─────────────────────────────────────────
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 5,
    onDrop: (accepted, rejected) => {
      if (rejected.length > 0) toast.error('Some files were rejected. Max 10MB, allowed: PDF, DOC, XLS, JPG, PNG');
      setFiles(prev => [...prev, ...accepted].slice(0, 5));
    },
  });

  // ── Final submission ──────────────────────────────────────
  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      const token = sessionToken || anonToken;

      const payload = {
        category: data.category,
        description: data.description,
        branch_or_dept: data.branch_or_dept || 'General',
        severity_level: data.severity_level || 'Medium',
      };

      const caseRes = isStaffAuthenticated
        ? await api.post('/cases', payload)
        : await api.post('/cases', payload, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        if (isStaffAuthenticated) {
            await api.post(`/cases/${caseRes.data.case_id}/evidence`, formData).catch(() => {});
          } else {
            formData.append('reference_id', caseRes.data.reference_id);
            formData.append('verification_token', caseRes.data.verification_token);
            await api.post('/cases/anonymous/evidence', formData).catch(() => {});
        reference_id: caseRes.data.reference_id,
        verification_token: caseRes.data.verification_token,
        created_at: new Date().toISOString()
      });
      toast.success('Report submitted successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-slate-50)' }}>
        <div className="card p-10 max-w-lg w-full text-center fade-in-up">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: '#dcfce7' }}>
            <CheckCircle size={40} style={{ color: '#16a34a' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-navy-900)' }}>
            Report Submitted
          </h2>
          <p className="text-slate-500 mb-8">
            Your report has been received and encrypted. Save the credentials below.
          </p>

          <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--color-navy-900)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--color-gold-500)' }}>
              Your Secure Reference Code
            </p>
            <div className="text-3xl font-bold tracking-widest text-white font-mono mb-3">
              {submitted.reference_id}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(submitted.reference_id); toast.success('Reference code copied!'); }}
              className="flex items-center gap-2 mx-auto text-sm px-3 py-1.5 rounded-lg transition-colors mb-4"
              style={{ color: 'var(--color-gold-500)', background: 'rgba(249,168,38,0.1)' }}>
              <Copy size={14} /> Copy Reference Code
            </button>

            <div className="border-t border-slate-800 my-4" />

            <p className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--color-gold-500)' }}>
              Your Secure Verification Token
            </p>
            <div className="text-sm font-bold text-white font-mono break-all bg-slate-950 p-3 rounded-lg mb-3 select-all">
              {submitted.verification_token}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(submitted.verification_token); toast.success('Verification token copied!'); }}
              className="flex items-center gap-2 mx-auto text-sm px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-gold-500)', background: 'rgba(249,168,38,0.1)' }}>
              <Copy size={14} /> Copy Verification Token
            </button>
          </div>

          <div className="rounded-xl p-4 mb-6 text-sm text-left"
            style={{ background: 'var(--color-slate-50)', border: '1px solid var(--color-slate-200)' }}>
            <p className="font-semibold text-slate-700 mb-2">⚠️ Important Security Instructions</p>
            <ul className="text-slate-500 space-y-1">
              <li>• Save **both** your Reference Code and Verification Token. They cannot be recovered.</li>
              <li>• The Reference Code is public and allows you to view status.</li>
              <li>• The Verification Token is private and acts as a password to edit or delete your report.</li>
              <li>• No account or email is linked to this report.</li>
            </ul>
          </div>

          <button onClick={() => navigate('/track')} className="btn btn-primary w-full">
            Track This Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 pb-12 px-4" style={{ background: 'var(--color-slate-50)' }}>
      <div className="max-w-2xl mx-auto pt-10">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full text-sm font-medium"
            style={{ background: 'var(--color-navy-900)', color: 'var(--color-gold-500)' }}>
            <Lock size={14} /> Fully Anonymous Submission
          </div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-navy-900)' }}>
            {isStaffAuthenticated ? 'Submit a Staff Request' : 'Submit a Report'}
          </h1>
          <p className="text-slate-500 mt-2">
            {isStaffAuthenticated
              ? 'Provide a detailed request with your identity and the relevant branch or department context.'
              : 'Your identity is fully protected. Complete each step below.'}
          </p>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 gap-2">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < step ? 'text-white' : i === step ? '' : 'bg-slate-200 text-slate-400'
                  }`}
                  style={
                    i < step
                      ? { background: '#16a34a' }
                      : i === step
                      ? { background: 'var(--color-gold-500)', color: 'var(--color-navy-900)' }
                      : {}
                  }
                >
                  {i < step ? <CheckCircle size={16} /> : i + 1}
                </div>
                <span className={`text-xs mt-1 font-medium hidden sm:block ${i === step ? '' : 'text-slate-400'}`}
                  style={i === step ? { color: 'var(--color-navy-900)' } : {}}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`step-line mb-4 ${i < step ? 'active' : ''}`} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 0: Privacy Shield / hCaptcha ─────────────── */}
        {step === 0 && !isStaffAuthenticated && (
          <div className="card p-8 fade-in-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--color-navy-900)' }}>
                <Shield size={24} style={{ color: 'var(--color-gold-500)' }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-navy-900)' }}>Privacy Shield</h2>
                <p className="text-sm text-slate-500">Verify you are human — no personal data is collected</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {[
                ['No IP Logging',     'Your IP address is never stored or logged'],
                ['No Fingerprinting', 'No browser fingerprint or device ID is collected'],
                ['30-Min Session',    'Your anonymous session expires after submission'],
              ].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-3 p-3 rounded-lg"
                  style={{ background: 'var(--color-slate-50)' }}>
                  <CheckCircle size={16} style={{ color: '#16a34a', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-navy-900)' }}>{title}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── hCaptcha / Dev bypass ── */}
            <div className="flex flex-col items-center gap-3 py-4">

              {/* Render real widget when not in dev, or when a real site key is configured in dev */}
              {/* Always render the real hCaptcha widget — no dev bypass */}
              <HCaptcha
                ref={captchaRef}
                sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY}
                onVerify={onCaptchaVerify}
                onExpire={() => {
                  setCaptchaToken(null);
                  toast.error('CAPTCHA expired. Please verify again.');
                }}
                onError={(err) => {
                  console.error('[hCaptcha] error:', err);
                  setCaptchaToken(null);
                }}
                theme="light"
                size="normal"
              />

              {captchaLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="spinner spinner-navy" />
                  Activating privacy shield...
                </div>
              )}

              {!captchaToken && !captchaLoading && !import.meta.env.DEV && (
                <p className="text-xs text-slate-400">Complete the verification above to proceed.</p>
              )}

              {/* No dev bypass — users must complete hCaptcha */}
            </div>
          </div>
        )}

        {/* ── Step 1: Incident Details ──────────────────────── */}
        {step === 1 && (
          <div className="card p-8 fade-in-up">
            <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--color-navy-900)' }}>
              Incident Details
            </h2>

            <div className="space-y-5">
              <div>
                <label className="form-label">Category of Misconduct *</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => (
                    <label key={cat.value}
                      className="flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all"
                      style={watch('category') === cat.value
                        ? { borderColor: 'var(--color-gold-500)', background: 'rgba(249,168,38,0.06)' }
                        : { borderColor: 'var(--color-slate-200)' }}>
                      <input type="radio" value={cat.value}
                        {...register('category', { required: 'Please select a category' })}
                        className="sr-only" />
                      <span className="text-lg">{cat.icon}</span>
                      <span className="text-sm font-medium text-slate-700">{cat.label}</span>
                    </label>
                  ))}
                </div>
                {errors.category && <p className="form-error">{errors.category.message}</p>}
              </div>

              <div>
                <label className="form-label">Branch / Department *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Retail Banking"
                  {...register('branch_or_dept', { required: 'Branch or department is required' })}
                />
                {errors.branch_or_dept && <p className="form-error">{errors.branch_or_dept.message}</p>}
              </div>

              <div>
                <label className="form-label">Severity Level *</label>
                <select className="form-select" defaultValue="Medium" {...register('severity_level', { required: 'Severity is required' })}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
                {errors.severity_level && <p className="form-error">{errors.severity_level.message}</p>}
              </div>

              <div>
                <label className="form-label">Description of Misconduct *</label>
                <textarea
                  className="form-textarea"
                  rows={6}
                  placeholder="Describe the incident in detail: what happened, who was involved (without revealing your own identity), where it occurred, and any other relevant information..."
                  {...register('description', {
                    required: 'Description is required',
                    minLength: { value: 20, message: 'Please provide at least 20 characters' },
                  })}
                />
                {errors.description && <p className="form-error">{errors.description.message}</p>}
                <p className="text-xs text-slate-400 mt-1">{watch('description')?.length || 0} characters</p>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button type="button" onClick={() => setStep(0)} className="btn btn-ghost flex-1">
                <ChevronLeft size={16} /> Back
              </button>
              <button type="button" onClick={handleSubmit(() => setStep(2))} className="btn btn-primary flex-1">
                Continue <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Evidence Upload ───────────────────────── */}
        {step === 2 && (
          <div className="card p-8 fade-in-up">
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-navy-900)' }}>Attach Evidence</h2>
            <p className="text-sm text-slate-500 mb-6">
              Optional. All files are AES-256 encrypted and EXIF metadata is stripped from images before storage.
            </p>

            <div {...getRootProps()}
              className="rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all"
              style={isDragActive
                ? { borderColor: 'var(--color-gold-500)', background: 'rgba(249,168,38,0.05)' }
                : { borderColor: 'var(--color-slate-300)' }}>
              <input {...getInputProps()} />
              <Upload size={32} className="mx-auto mb-3 text-slate-400" />
              <p className="text-sm font-medium text-slate-600">
                {isDragActive ? 'Drop files here...' : 'Drag & drop files, or click to browse'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                PDF, DOC, DOCX, XLS, XLSX, JPG, PNG — Max 10MB per file, up to 5 files
              </p>
            </div>

            {files.length > 0 && (
              <ul className="mt-4 space-y-2">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ background: 'var(--color-slate-50)' }}>
                    <FileText size={16} className="text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-700 flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                      className="text-slate-400 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-3 mt-8">
              <button type="button" onClick={() => setStep(1)} className="btn btn-ghost flex-1">
                <ChevronLeft size={16} /> Back
              </button>
              <button type="button" onClick={() => setStep(3)} className="btn btn-primary flex-1">
                Continue <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review & Submit ───────────────────────── */}
        {step === 3 && (
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="card p-8 fade-in-up">
              <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--color-navy-900)' }}>Review & Submit</h2>

              <div className="space-y-4 mb-6">
                <div className="p-4 rounded-xl" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Category</p>
                  <p className="text-sm font-semibold text-slate-800">{getValues('category')?.replace(/_/g, ' ')}</p>
                </div>

                <div className="p-4 rounded-xl" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Branch / Department</p>
                  <p className="text-sm font-semibold text-slate-800">{getValues('branch_or_dept') || 'General'}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Severity</p>
                  <p className="text-sm font-semibold text-slate-800">{getValues('severity_level') || 'Medium'}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Description</p>
                  <p className="text-sm text-slate-700 leading-relaxed line-clamp-4">{getValues('description')}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Evidence Files</p>
                  <p className="text-sm text-slate-700">{files.length > 0 ? `${files.length} file(s) attached` : 'None attached'}</p>
                </div>
              </div>



              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="btn btn-ghost flex-1">
                  <ChevronLeft size={16} /> Back
                </button>
                <button type="submit" disabled={submitting} className="btn btn-gold flex-1">
                  {submitting
                    ? <><span className="spinner spinner-navy" /> Submitting...</>
                    : <><CheckCircle size={16} /> Submit Report</>}
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
