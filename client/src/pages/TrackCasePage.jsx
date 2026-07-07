import { useState } from 'react';
import { useForm } from 'react-hook-form';
import api from '../services/api';
import { Search, Clock, CheckCircle, AlertTriangle, MessageSquare, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_LABELS = {
  New: { label: 'New', class: 'badge-new' },
  Under_Review: { label: 'Under Review', class: 'badge-review' },
  Investigation_In_Progress: { label: 'Investigation In Progress', class: 'badge-progress' },
  Awaiting_Response: { label: 'Awaiting Your Response', class: 'badge-escalated' },
  Resolved: { label: 'Resolved', class: 'badge-resolved' },
  Closed: { label: 'Closed', class: 'badge-closed' },
  Escalated: { label: 'Escalated', class: 'badge-escalated' },
};

const PRIORITY_LABELS = {
  Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high', Critical: 'badge-critical'
};

export default function TrackCasePage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSearch = async ({ reference_id }) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.get('/cases/track', { params: { reference_id: reference_id.toUpperCase().trim() } });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No case found with that reference ID');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-16 pb-12" style={{ background: 'var(--color-slate-50)' }}>
      <div className="max-w-2xl mx-auto px-4 pt-12">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'var(--color-navy-900)' }}>
            <Search size={28} style={{ color: 'var(--color-gold-500)' }} />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-navy-900)' }}>
            Track Your Report
          </h1>
          <p className="text-slate-500">Enter your reference code to check the status of your report.</p>
        </div>

        {/* Search Form */}
        <div className="card p-6 mb-6">
          <form onSubmit={handleSubmit(onSearch)}>
            <label className="form-label">Reference Code</label>
            <div className="flex gap-3">
              <input
                type="text"
                className="form-input font-mono text-lg tracking-widest uppercase"
                placeholder="e.g. AB3C5D7EFG2H"
                maxLength={12}
                style={{ letterSpacing: '0.15em' }}
                {...register('reference_id', {
                  required: 'Please enter your reference code',
                  pattern: { value: /^[A-Z2-9]{12}$/i, message: 'Invalid reference code format (12 characters)' },
                })}
              />
              <button type="submit" disabled={loading} className="btn btn-primary px-6 flex-shrink-0">
                {loading ? <span className="spinner" /> : <Search size={18} />}
              </button>
            </div>
            {errors.reference_id && <p className="form-error mt-1">{errors.reference_id.message}</p>}
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl p-4 mb-6 flex items-center gap-3"
            style={{ background: 'var(--color-danger-100)', border: '1px solid #fca5a5' }}>
            <AlertTriangle size={18} style={{ color: 'var(--color-danger-500)', flexShrink: 0 }} />
            <p className="text-sm" style={{ color: 'var(--color-danger-500)' }}>{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 fade-in-up">
            {/* Case Info */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Reference Code</p>
                  <p className="text-xl font-mono font-bold" style={{ color: 'var(--color-navy-900)', letterSpacing: '0.1em' }}>
                    {result.case.reference_id}
                  </p>
                </div>
                <span className={`badge ${STATUS_LABELS[result.case.status]?.class || 'badge-review'}`}>
                  {STATUS_LABELS[result.case.status]?.label || result.case.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs text-slate-400 mb-1">Category</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {result.case.category?.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs text-slate-400 mb-1">Priority</p>
                  <span className={`badge ${PRIORITY_LABELS[result.case.priority] || 'badge-medium'}`}>
                    {result.case.priority}
                  </span>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs text-slate-400 mb-1">Submitted</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {format(new Date(result.case.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs text-slate-400 mb-1">Last Updated</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {format(new Date(result.case.updated_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="card p-6">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-navy-900)' }}>
                <Clock size={16} /> Status Timeline
              </h3>
              <div className="space-y-3">
                {['New', 'Under_Review', 'Investigation_In_Progress', 'Resolved'].map((s, i) => {
                  const statuses = ['New', 'Under_Review', 'Investigation_In_Progress', 'Awaiting_Response', 'Resolved', 'Closed', 'Escalated'];
                  const currentIdx = statuses.indexOf(result.case.status);
                  const thisIdx = statuses.indexOf(s);
                  const isComplete = thisIdx <= currentIdx;
                  const isCurrent = s === result.case.status;
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isComplete ? (isCurrent ? '' : 'bg-green-100') : 'bg-slate-100'
                      }`}
                        style={isCurrent ? { background: 'var(--color-gold-500)' } : {}}>
                        {isComplete && !isCurrent
                          ? <CheckCircle size={14} style={{ color: '#16a34a' }} />
                          : isCurrent
                          ? <span className="w-2.5 h-2.5 rounded-full bg-white block" />
                          : <span className="w-2 h-2 rounded-full bg-slate-300 block" />}
                      </div>
                      <p className={`text-sm ${isComplete ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                        {STATUS_LABELS[s]?.label || s.replace(/_/g, ' ')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Correspondence */}
            {result.correspondence?.length > 0 && (
              <div className="card p-6">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-navy-900)' }}>
                  <MessageSquare size={16} /> Correspondence
                </h3>
                <div className="space-y-3">
                  {result.correspondence.map((note, i) => (
                    <div key={i} className={`p-4 rounded-xl ${
                      note.author_type === 'staff'
                        ? 'ml-4'
                        : 'mr-4'
                    }`}
                      style={{
                        background: note.author_type === 'staff'
                          ? 'rgba(10,29,55,0.05)'
                          : 'rgba(249,168,38,0.08)',
                        border: '1px solid',
                        borderColor: note.author_type === 'staff'
                          ? 'rgba(10,29,55,0.1)'
                          : 'rgba(249,168,38,0.2)',
                      }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold"
                          style={{ color: note.author_type === 'staff' ? 'var(--color-navy-900)' : 'var(--color-gold-700)' }}>
                          {note.author_type === 'staff' ? 'Investigation Team' : 'You (Reporter)'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {format(new Date(note.created_at), 'MMM d, HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{note.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
