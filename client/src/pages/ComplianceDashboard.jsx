import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  RefreshCw, Search, ArrowUpCircle,
  AlertTriangle, CheckCircle, Clock, FileText,
  TrendingUp, Users, ChevronRight, X, Filter,
  BarChart3, Send, Shield, Zap,
  Paperclip, Trash2, XCircle,
} from 'lucide-react';
import { CASE_STATUSES, STATUS_BADGE, formatStatus } from '../constants/caseWorkflow';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const STATUSES = CASE_STATUSES;
const SEVERITIES = ['Low', 'Medium', 'High'];
const CATEGORIES = ['Fraud', 'Corruption', 'Bribery', 'Abuse_of_Power', 'Procurement_Violation', 'System_Misuse'];
const SEVERITY_BADGE = {
  Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high',
};

const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(10,29,55,0.97)',
      border: '1px solid rgba(249,168,38,0.3)',
      borderRadius: '12px',
      padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(10,29,55,0.35)',
    }}>
      <p style={{ color: '#F9A826', fontWeight: 700, fontSize: 11, marginBottom: 4 }}>
        {label || payload[0]?.name}
      </p>
      <p style={{ color: '#fff', fontSize: 12 }}>
        Cases: <strong style={{ color: payload[0]?.fill || '#F9A826' }}>{payload[0]?.value}</strong>
      </p>
    </div>
  );
};

export default function EthicsDashboard() {
  const { user } = useAuth();

  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 });
  const [activeTab, setActiveTab] = useState('queue');
  const [filters, setFilters] = useState({ status: '', severity_level: '', category: '', search: '', page: 1 });

  const loadAll = useCallback(async (f = filters) => {
    setLoading(true);
    try {
      const params = { page: f.page, limit: 20 };
      if (f.status) params.status = f.status;
      if (f.severity_level) params.severity_level = f.severity_level;
      if (f.category) params.category = f.category;
      if (f.search) params.search = f.search;

      const [cRes, sRes] = await Promise.allSettled([
        api.get('/cases', { params }),
        api.get('/cases/stats'),
      ]);

      if (cRes.status === 'fulfilled') {
        setCases(cRes.value.data.cases || []);
        setPagination(cRes.value.data.pagination || { total: 0, page: 1, total_pages: 1 });
      } else {
        console.error('[EthicsDashboard] cases fetch failed:', cRes.reason);
        toast.error('Failed to load cases');
      }

      if (sRes.status === 'fulfilled') {
        setStats(sRes.value.data);
      } else {
        console.error('[EthicsDashboard] stats fetch failed:', sRes.reason);
      }

    } catch (err) {
      console.error('[EthicsDashboard] loadAll error:', err);
      toast.error('Failed to load dashboard data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, []);

  const applyFilter = (key, val) => {
    const nf = { ...filters, [key]: val, page: 1 };
    setFilters(nf); loadAll(nf);
  };
  const goPage = (p) => {
    const nf = { ...filters, page: p };
    setFilters(nf); loadAll(nf);
  };


  const ov = stats?.overview || {};
  const CATEGORY_COLORS = {
    Fraud:                 '#e11d48',
    Corruption:            '#7c3aed',
    Bribery:               '#d97706',
    Abuse_of_Power:        '#0369a1',
    Procurement_Violation: '#059669',
    System_Misuse:         '#0891b2',
  };
  const PIE_COLORS = ['#0A1D37','#F9A826','#7c3aed','#059669','#e11d48','#0891b2'];
  const statusData = [
    { name: 'New',          value: ov.new_cases   || 0, fill: '#F9A826' },
    { name: 'Under Review', value: ov.under_review || 0, fill: '#38bdf8' },
    { name: 'Assigned',     value: ov.assigned    || 0, fill: '#818cf8' },
    { name: 'In Progress',  value: ov.in_progress || 0, fill: '#a78bfa' },
    { name: 'Substantiated',value: ov.substantiated||0, fill: '#34d399' },
    { name: 'Dismissed',    value: (ov.complaint_dismissed||0)+(ov.dismissed_no_evidence||0), fill: '#94a3b8' },
  ];
  const severityData = [
    { name: 'High',   value: ov.high   || 0, fill: '#d97706' },
    { name: 'Medium', value: ov.medium || 0, fill: '#3b82f6' },
    { name: 'Low',    value: ov.low    || 0, fill: '#10b981' },
  ];
  const categoryData = (stats?.by_category || []).map((c, i) => ({
    name: c.category?.replace(/_/g, ' '),
    value: c.total,
    fill: CATEGORY_COLORS[c.category] || PIE_COLORS[i % PIE_COLORS.length],
  }));

  const statCards = [
    { label: 'Total Cases', value: ov.total || 0, icon: FileText, color: 'var(--color-navy-900)', bg: '#e8edf5' },
    { label: 'New Cases', value: ov.new_cases || 0, icon: AlertTriangle, color: 'var(--color-gold-600)', bg: '#fef3c7' },
    { label: 'Under Review', value: ov.under_review || 0, icon: Search, color: '#0891b2', bg: '#cffafe' },
    { label: 'In Progress', value: ov.in_progress || 0, icon: Clock, color: '#3b82f6', bg: '#dbeafe' },
    { label: 'Substantiated', value: ov.substantiated || 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7' },
    { label: 'Dismissed', value: (ov.complaint_dismissed || 0) + (ov.dismissed_no_evidence || 0), icon: XCircle, color: '#64748b', bg: '#f1f5f9' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-navy-900)' }}>
            <Shield size={20} style={{ color: 'var(--color-gold-500)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy-900)' }}>
              Ethics & Anti-Corruption Dashboard
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Team Lead · {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/report-ceo" className="btn btn-primary text-xs py-2 px-3 flex items-center gap-1.5" style={{ background: 'var(--color-navy-900)' }}>
            <FileText size={15} className="text-amber-400" /> Send Report to CEO
          </Link>
          <button onClick={() => loadAll()} className="btn btn-ghost">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                <s.icon size={18} style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-extrabold" style={{ color: 'var(--color-navy-900)' }}>{s.value}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: 'var(--color-slate-100)' }}>
        {[
          ['queue', 'Case Queue'],
          ['analytics', '📊 Analytics'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === key ? 'shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            style={activeTab === key ? { background: 'var(--color-navy-900)', color: 'var(--color-gold-500)' } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════ CASE QUEUE TAB ══════════════ */}
      {activeTab === 'queue' && (
        <>
          {/* Filters */}
          <div className="card p-4 mb-5">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" className="form-input pl-9 text-sm"
                  placeholder="Search reference ID..."
                  value={filters.search}
                  onChange={e => applyFilter('search', e.target.value)} />
              </div>
              <select className="form-select text-sm min-w-36"
                value={filters.status} onChange={e => applyFilter('status', e.target.value)}>
                <option value="">All Statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
              </select>
              <select className="form-select text-sm min-w-32"
                value={filters.severity_level} onChange={e => applyFilter('severity_level', e.target.value)}>
                <option value="">All Severities</option>
                {SEVERITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className="form-select text-sm min-w-36"
                value={filters.category} onChange={e => applyFilter('category', e.target.value)}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="py-16 text-center"><span className="spinner spinner-navy mx-auto" /></div>
            ) : cases.length === 0 ? (
              <div className="py-16 text-center">
                <Filter size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-400">No cases match the current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Category</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Submitted By</th>
                      <th>Assigned To</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map(c => (
                      <tr key={c.id}>
                        <td>
                          <span className="font-mono text-xs font-bold" style={{ color: 'var(--color-navy-900)' }}>
                            {c.reference_id}
                          </span>
                        </td>
                        <td className="text-slate-600 text-sm">{c.category?.replace(/_/g, ' ')}</td>
                        <td><span className={`badge ${SEVERITY_BADGE[c.severity_level] || 'badge-low'}`}>{c.severity_level}</span></td>
                        <td><span className={`badge ${STATUS_BADGE[c.status] || 'badge-review'}`}>{formatStatus(c.status)}</span></td>
                        <td>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: c.submitted_by_type === 'anonymous' ? 'rgba(10,29,55,0.08)' : 'rgba(249,168,38,0.1)',
                              color: c.submitted_by_type === 'anonymous' ? 'var(--color-navy-700)' : 'var(--color-gold-700)',
                            }}>
                            {c.submitted_by_type === 'anonymous' ? '🔒 Anonymous' : '👤 Staff'}
                          </span>
                        </td>
                        <td className="text-xs text-slate-500">
                          {c.assigned_handler || c.assigned_investigator || <span className="text-red-400 font-medium italic">Unassigned</span>}
                        </td>
                        <td className="text-xs text-slate-400">{format(new Date(c.created_at), 'MMM d, yyyy')}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Link to={`/cases/${c.id}`} className="btn btn-ghost text-xs py-1 px-2">
                              Open <ChevronRight size={11} />
                            </Link>
                            <Link
                              to={`/report-ceo?case_id=${c.id}`}
                              className="btn btn-ghost text-xs py-1 px-2 text-amber-700 hover:bg-amber-50 flex items-center gap-1"
                              title="Send Report to CEO">
                              <FileText size={13} /> Report to CEO
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                <p className="text-sm text-slate-500">
                  Page {pagination.page} of {pagination.total_pages} ({pagination.total} cases)
                </p>
                <div className="flex gap-2">
                  {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => goPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === pagination.page ? 'text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                      style={p === pagination.page ? { background: 'var(--color-navy-900)' } : {}}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════ ANALYTICS TAB ══════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
            {/* Row 1: Monthly trend + Status */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="card p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>Monthly Submission Trend (12 Months)</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: 'rgba(10,29,55,0.07)', color: 'var(--color-navy-900)' }}>
                    {stats?.monthly_trend?.reduce((a, b) => a + b.total, 0) || 0} total
                  </span>
                </div>
                {(stats?.monthly_trend || []).length === 0 ? (
                  <div className="flex items-center justify-center h-52 text-slate-300 text-sm">No trend data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={stats.monthly_trend} margin={{ top: 8, right: 12, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTip />} />
                      <Line type="monotone" dataKey="total" stroke="#0A1D37" strokeWidth={3}
                        dot={{ fill: '#F9A826', r: 5, strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 7, fill: '#F9A826', stroke: '#0A1D37', strokeWidth: 2 }} name="Cases" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="card p-6">
                <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>Cases by Status</h2>
                {statusData.every(s => s.value === 0) ? (
                  <div className="flex items-center justify-center h-52 text-slate-300 text-sm">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={statusData} layout="vertical" margin={{ top: 2, right: 36, bottom: 2, left: 74 }} barCategoryGap="28%">
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} width={72} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTip />} cursor={{ fill: 'rgba(10,29,55,0.04)' }} />
                      <Bar dataKey="value" name="Cases" radius={[0, 6, 6, 0]}>
                        {statusData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Row 2: Category + Severity */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>Cases by Category</h2>
                {categoryData.length === 0 ? (
                  <div className="flex items-center justify-center h-52 text-slate-300 text-sm">No data yet</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={categoryData} layout="vertical" margin={{ top: 2, right: 24, bottom: 2, left: 102 }} barCategoryGap="28%">
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} width={100} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTip />} cursor={{ fill: 'rgba(10,29,55,0.04)' }} />
                        <Bar dataKey="value" name="Cases" radius={[0, 6, 6, 0]}>
                          {categoryData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="space-y-2.5 mt-3">
                      {categoryData.map((cat) => {
                        const pct = Math.round((cat.value / Math.max(1, ov.total || 1)) * 100);
                        return (
                          <div key={cat.name}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-semibold text-slate-700">{cat.name}</span>
                              <span className="font-bold tabular-nums" style={{ color: cat.fill }}>
                                {cat.value} <span className="text-slate-400 font-normal">({pct}%)</span>
                              </span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cat.fill}, ${cat.fill}cc)` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="card p-6">
                <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>Severity Distribution</h2>
                {severityData.every(p => p.value <= 0) ? (
                  <div className="flex items-center justify-center h-52 text-slate-300 text-sm">No data yet</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={170}>
                      <BarChart data={severityData} margin={{ top: 8, right: 20, bottom: 5, left: 10 }} barCategoryGap="35%">
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTip />} cursor={{ fill: 'rgba(10,29,55,0.04)' }} />
                        <Bar dataKey="value" name="Cases" radius={[6, 6, 0, 0]}>
                          {severityData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      {[
                        { label: 'High',   value: ov.high||0,   color: '#d97706', bg: 'linear-gradient(135deg, #fffbeb, #fde68a)' },
                        { label: 'Medium', value: ov.medium||0, color: '#3b82f6', bg: 'linear-gradient(135deg, #eff6ff, #bfdbfe)' },
                        { label: 'Low',    value: ov.low||0,    color: '#10b981', bg: 'linear-gradient(135deg, #ecfdf5, #a7f3d0)' },
                      ].map(p => (
                        <div key={p.label} className="rounded-xl p-3 text-center" style={{ background: p.bg }}>
                          <p className="text-2xl font-extrabold" style={{ color: p.color }}>{p.value}</p>
                          <p className="text-xs font-bold mt-0.5" style={{ color: p.color }}>{p.label}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
          </div>
        </div>
      )}

    </div>
  );
}
