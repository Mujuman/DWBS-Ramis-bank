import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  RefreshCw, Search, UserCheck, ArrowUpCircle,
  AlertTriangle, CheckCircle, Clock, FileText,
  TrendingUp, Users, ChevronRight, X, Filter,
  Briefcase, BarChart3, MessageSquare, Send, Shield, Zap,
  Paperclip, Trash2, Bold, Italic, List, Type,
} from 'lucide-react';
import { CASE_STATUSES, STATUS_BADGE, formatStatus } from '../constants/caseWorkflow';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const STATUSES = CASE_STATUSES;
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const CATEGORIES = ['Fraud', 'Corruption', 'Bribery', 'Abuse_of_Power', 'Procurement_Violation', 'System_Misuse'];
const PRIORITY_BADGE = {
  Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high', Critical: 'badge-critical',
};

export default function EthicsDashboard() {
  const { user } = useAuth();

  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [investigators, setInvestigators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 });
  const [activeTab, setActiveTab] = useState('queue');
  const [filters, setFilters] = useState({ status: '', priority: '', category: '', search: '', page: 1 });

  // assign modal
  const [assignModal, setAssignModal] = useState(null);
  const [assignTarget, setAssignTarget] = useState('');
  const [assigning, setAssigning] = useState(false);

  // severity override modal
  const [severityModal, setSeverityModal] = useState(null);
  const [newSeverity, setNewSeverity] = useState('');
  const [overriding, setOverriding] = useState(false);

  // escalation modal (with description)
  const [escalateModal, setEscalateModal] = useState(null);
  const [escalationNote, setEscalationNote] = useState('');
  const [escalating, setEscalating] = useState(false);

  // Gmail-style compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeCase, setComposeCase] = useState(null);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeFile, setComposeFile] = useState(null);
  const [composeSending, setComposeSending] = useState(false);
  const composeFileRef = useRef(null);

  // CEO chat state
  const [ceoChatCases, setCeoChatCases] = useState([]);
  const [selectedChatCase, setSelectedChatCase] = useState(null);
  const [chatNotes, setChatNotes] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const loadAll = useCallback(async (f = filters) => {
    setLoading(true);
    try {
      const params = { page: f.page, limit: 20 };
      if (f.status) params.status = f.status;
      if (f.priority) params.severity_level = f.priority;
      if (f.category) params.category = f.category;
      if (f.search) params.search = f.search;

      const [cRes, sRes, uRes, escalatedRes] = await Promise.allSettled([
        api.get('/cases', { params }),
        api.get('/cases/stats'),
        api.get('/users'),
        api.get('/cases', { params: { is_escalated: 1, limit: 100 } }),
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

      if (uRes.status === 'fulfilled') {
        setInvestigators((uRes.value.data.users || []).filter(u => u.role === 'Compliance_Officer' && u.is_active));
      } else {
        console.error('[EthicsDashboard] users fetch failed:', uRes.reason);
      }

      if (escalatedRes.status === 'fulfilled') {
        setCeoChatCases(escalatedRes.value.data.cases || []);
      } else {
        console.error('[EthicsDashboard] escalated cases fetch failed:', escalatedRes.reason);
        setCeoChatCases([]);
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

  // ── Load chat notes for selected case ─────────────────────
  const loadChatNotes = async (caseId) => {
    setChatLoading(true);
    try {
      const res = await api.get(`/cases/${caseId}/notes`);
      // Only show notes that are actually in the CEO ↔ Ethics thread:
      // - sent BY Compliance_Officer TO CEO
      // - sent BY CEO (replies back to Ethics)
      // This excludes Ethics messages directed at Investigator, Reporter, or General
      const relevant = (res.data.notes || []).filter(n =>
        n.author_type === 'CEO' ||
        (n.author_type === 'Compliance_Officer' && n.audience_type === 'CEO')
      );
      setChatNotes(relevant);
    } catch {
      setChatNotes([]);
    }
    setChatLoading(false);
  };

  const selectChatCase = async (c) => {
    setSelectedChatCase(c);
    setChatMessage('');
    await loadChatNotes(c.id);
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim() || !selectedChatCase) return;
    setSendingChat(true);
    try {
      await api.post(`/cases/${selectedChatCase.id}/notes`, {
        body: chatMessage.trim(),
        recipient_role: 'CEO',
        is_internal_only: false,
      });
      setChatMessage('');
      await loadChatNotes(selectedChatCase.id);
      toast.success('Message sent to CEO');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send message');
    }
    setSendingChat(false);
  };

  // ── Assign / Reassign ──────────────────────────────────────
  const doAssign = async () => {
    if (!assignTarget) { toast.error('Select an investigator'); return; }
    setAssigning(true);
    try {
      await api.patch(`/cases/${assignModal.id}/status`, {
        assigned_to: parseInt(assignTarget),
        status: 'Assigned',
      });
      toast.success('Case assigned successfully');
      setAssignModal(null); setAssignTarget('');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Assignment failed');
    }
    setAssigning(false);
  };

  // ── Override severity ──────────────────────────────────────
  const doOverride = async () => {
    if (!newSeverity) { toast.error('Select a severity level'); return; }
    setOverriding(true);
    try {
      await api.patch(`/cases/${severityModal.id}/status`, { priority: newSeverity });
      toast.success(`Severity updated to ${newSeverity}`);
      setSeverityModal(null); setNewSeverity('');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Override failed');
    }
    setOverriding(false);
  };

  // ── Escalate to CEO (with description) ────────────────────
  const doEscalate = async () => {
    if (!escalateModal) return;
    setEscalating(true);
    try {
      await api.post(`/cases/${escalateModal.id}/escalate`, {
        escalation_note: escalationNote,
      });
      toast.success('Case escalated to CEO with report');
      setEscalateModal(null);
      setEscalationNote('');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Escalation failed');
    }
    setEscalating(false);
  };

  // ── Open Gmail compose for a case ──────────────────────────
  const openCompose = (c) => {
    setComposeCase(c);
    setComposeSubject(`[${c.reference_id}] ${c.category?.replace(/_/g, ' ')} — Escalation Report`);
    setComposeBody('');
    setComposeFile(null);
    setComposeOpen(true);
  };

  // ── Send report to CEO ─────────────────────────────────────
  const sendReport = async () => {
    if (!composeSubject.trim()) { toast.error('Subject is required'); return; }
    if (!composeBody.trim()) { toast.error('Report body is required'); return; }
    setComposeSending(true);
    try {
      const formData = new FormData();
      formData.append('subject', composeSubject.trim());
      formData.append('body', composeBody.trim());
      if (composeFile) formData.append('file', composeFile);
      await api.post(`/cases/${composeCase.id}/reports`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Report sent to CEO successfully');
      setComposeOpen(false);
      setComposeCase(null);
      setComposeSubject('');
      setComposeBody('');
      setComposeFile(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send report');
    }
    setComposeSending(false);
  };

  // ── Workload: count cases per handler ─────────────────
  const workload = investigators.map(inv => ({
    ...inv,
    count: cases.filter(c => (c.assigned_handler || c.assigned_investigator) === inv.username).length,
  })).sort((a, b) => b.count - a.count);

  const ov = stats?.overview || {};
  const statCards = [
    { label: 'Total Cases', value: ov.total || 0, icon: FileText, color: 'var(--color-navy-900)', bg: '#e8edf5' },
    { label: 'New', value: ov.new_cases || 0, icon: AlertTriangle, color: 'var(--color-gold-600)', bg: '#fef3c7' },
    { label: 'In Progress', value: ov.in_progress || 0, icon: Clock, color: '#3b82f6', bg: '#dbeafe' },
    { label: 'Substantiated', value: ov.substantiated || 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7' },
    { label: 'Critical', value: ov.critical || 0, icon: TrendingUp, color: '#dc2626', bg: '#fee2e2' },
    { label: 'Unassigned', value: cases.filter(c => !c.assigned_handler && !c.assigned_investigator).length, icon: Users, color: '#7c3aed', bg: '#ede9fe' },
  ];

  const maxWorkload = Math.max(1, ...workload.map(w => w.count));

  const getNoteLabel = (note) => {
    if (note.author_type === 'Compliance_Officer') return 'Ethics & Anti-Corruption Office (You)';
    if (note.author_type === 'CEO') return 'CEO';
    return 'Staff';
  };

  const getNoteTone = (note) => {
    if (note.author_type === 'CEO') {
      return { bg: 'rgba(249,168,38,0.08)', border: 'rgba(249,168,38,0.25)', label: '#92400e' };
    }
    return { bg: 'rgba(37,99,235,0.06)', border: 'rgba(37,99,235,0.18)', label: '#1d4ed8' };
  };

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
        <button onClick={() => loadAll()} className="btn btn-ghost">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
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
          ['workload', 'Investigator Workload'],
          ['ceo_chat', 'CEO Messages'],
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
                value={filters.priority} onChange={e => applyFilter('priority', e.target.value)}>
                <option value="">All Priorities</option>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
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
                      <th>Priority</th>
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
                        <td><span className={`badge ${PRIORITY_BADGE[c.priority] || 'badge-low'}`}>{c.priority}</span></td>
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
                          {c.assigned_investigator || <span className="text-red-400 font-medium italic">Unassigned</span>}
                        </td>
                        <td className="text-xs text-slate-400">{format(new Date(c.created_at), 'MMM d, yyyy')}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Link to={`/cases/${c.id}`} className="btn btn-ghost text-xs py-1 px-2">
                              Open <ChevronRight size={11} />
                            </Link>
                            <button
                              onClick={() => { setAssignModal(c); setAssignTarget(c.assigned_investigator_id || ''); }}
                              className="btn btn-outline text-xs py-1 px-2"
                              title="Assign / Reassign">
                              <UserCheck size={12} /> Assign
                            </button>
                            <button
                              onClick={() => { setSeverityModal(c); setNewSeverity(c.priority || 'Medium'); }}
                              className="btn btn-ghost text-xs py-1 px-2"
                              title="Override severity">
                              <TrendingUp size={12} />
                            </button>
                            <button
                              onClick={() => openCompose(c)}
                              className="btn btn-ghost text-xs py-1 px-2 text-red-600 hover:bg-red-50"
                              title="Send Report to CEO">
                              <Zap size={13} />
                            </button>
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

      {/* ══════════════ COMPLIANCE WORKLOAD TAB ══════════════ */}
      {activeTab === 'workload' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} style={{ color: 'var(--color-navy-900)' }} />
              <h2 className="text-base font-bold" style={{ color: 'var(--color-navy-900)' }}>
                Compliance Staff Workload
              </h2>
            </div>
            <span className="text-xs text-slate-400">{investigators.length} active compliance staff</span>
          </div>

          {loading ? (
            <div className="py-16 text-center"><span className="spinner spinner-navy mx-auto" /></div>
          ) : investigators.length === 0 ? (
            <div className="py-16 text-center">
              <Users size={32} className="mx-auto mb-3 text-slate-300" />
              <p className="text-slate-400">No active compliance staff found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {workload.map(inv => (
                <div key={inv.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: 'var(--color-navy-900)', color: 'var(--color-gold-500)' }}>
                    {inv.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-navy-900)' }}>
                        {inv.username}
                      </span>
                      {inv.department && <span className="text-xs text-slate-400 truncate">· {inv.department}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#e8edf5' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(2, (inv.count / maxWorkload) * 100)}%`,
                            background: inv.count >= 5 ? '#dc2626' : inv.count >= 3 ? '#f59e0b' : '#16a34a',
                          }} />
                      </div>
                      <span className="text-xs font-bold w-16 text-right" style={{
                        color: inv.count >= 5 ? '#dc2626' : inv.count >= 3 ? '#f59e0b' : '#16a34a',
                      }}>
                        {inv.count} {inv.count === 1 ? 'case' : 'cases'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const unassigned = cases.filter(c => !c.assigned_handler && !c.assigned_investigator);
                      if (unassigned.length > 0) {
                        setAssignModal(unassigned[0]);
                        setAssignTarget(String(inv.id));
                      } else {
                        toast('No unassigned cases available', { icon: 'ℹ️' });
                      }
                    }}
                    className="btn btn-outline text-xs py-1.5 px-3 flex-shrink-0"
                    title={`Assign a case to ${inv.username}`}
                  >
                    <Briefcase size={12} /> Assign Case
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ ANALYTICS TAB ══════════════ */}
      {activeTab === 'analytics' && (() => {
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
        const priorityData = [
          { name: 'Critical', value: ov.critical || 0, fill: '#e11d48' },
          { name: 'High',     value: ov.high     || 0, fill: '#d97706' },
          { name: 'Medium',   value: Math.max(0, (ov.total||0)-(ov.critical||0)-(ov.high||0)), fill: '#3b82f6' },
        ];
        const categoryData = (stats?.by_category || []).map((c, i) => ({
          name: c.category?.replace(/_/g, ' '),
          value: c.total,
          fill: CATEGORY_COLORS[c.category] || PIE_COLORS[i % PIE_COLORS.length],
        }));
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
        return (
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

            {/* Row 2: Category + Priority */}
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
                <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>Priority Distribution</h2>
                {priorityData.every(p => p.value <= 0) ? (
                  <div className="flex items-center justify-center h-52 text-slate-300 text-sm">No data yet</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={170}>
                      <BarChart data={priorityData} margin={{ top: 8, right: 20, bottom: 5, left: 10 }} barCategoryGap="35%">
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTip />} cursor={{ fill: 'rgba(10,29,55,0.04)' }} />
                        <Bar dataKey="value" name="Cases" radius={[6, 6, 0, 0]}>
                          {priorityData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      {[
                        { label: 'Critical', value: ov.critical||0, color: '#e11d48', bg: 'linear-gradient(135deg, #fff1f2, #fecdd3)' },
                        { label: 'High',     value: ov.high||0,     color: '#d97706', bg: 'linear-gradient(135deg, #fffbeb, #fde68a)' },
                        { label: 'Others',   value: Math.max(0,(ov.total||0)-(ov.critical||0)-(ov.high||0)), color: '#3b82f6', bg: 'linear-gradient(135deg, #eff6ff, #bfdbfe)' },
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
        );
      })()}

      {/* ══════════════ CEO MESSAGES TAB ══════════════ */}
      {activeTab === 'ceo_chat' && (
        <div className="grid lg:grid-cols-5 gap-5">
          {/* Case List */}
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} style={{ color: 'var(--color-navy-900)' }} />
                <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
                  Escalated Cases
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">Select a case to chat with the CEO</p>
            </div>
            {ceoChatCases.length === 0 ? (
              <div className="py-12 text-center">
                <Shield size={28} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-400 text-sm">No escalated cases yet.</p>
                <p className="text-xs text-slate-300 mt-1">Escalate a critical case to start a CEO conversation.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-y-auto" style={{ maxHeight: '520px' }}>
                {ceoChatCases.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectChatCase(c)}
                    className={`w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors ${selectedChatCase?.id === c.id ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-mono font-bold" style={{ color: 'var(--color-navy-900)' }}>
                          {c.reference_id}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{c.category?.replace(/_/g, ' ')}</p>
                      </div>
                      <span className={`badge badge-${c.priority?.toLowerCase()} text-xs flex-shrink-0`}>{c.priority}</span>
                    </div>
                    <div className="mt-1.5">
                      <span className={`badge ${STATUS_BADGE[c.status] || 'badge-review'} text-xs`}>
                        {formatStatus(c.status)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chat Window */}
          <div className="lg:col-span-3 card overflow-hidden flex flex-col" style={{ minHeight: '520px' }}>
            {!selectedChatCase ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: '#e8edf5' }}>
                  <MessageSquare size={24} style={{ color: 'var(--color-navy-900)' }} />
                </div>
                <p className="text-slate-500 font-medium">Select a case to view the CEO conversation</p>
                <p className="text-xs text-slate-400 mt-1">Messages between you and the CEO appear here</p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
                      Case {selectedChatCase.reference_id}
                    </p>
                    <p className="text-xs text-slate-400">{selectedChatCase.category?.replace(/_/g, ' ')} · CEO Conversation</p>
                  </div>
                  <Link to={`/cases/${selectedChatCase.id}`} className="btn btn-ghost text-xs py-1 px-2">
                    Open Case <ChevronRight size={11} />
                  </Link>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ maxHeight: '340px' }}>
                  {chatLoading ? (
                    <div className="text-center py-8"><span className="spinner spinner-navy mx-auto" /></div>
                  ) : chatNotes.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-slate-400 text-sm">No messages yet. Start the conversation with the CEO.</p>
                    </div>
                  ) : (
                    chatNotes.map((note, i) => {
                      const isMe = note.author_type === 'Compliance_Officer';
                      const tone = getNoteTone(note);
                      return (
                        <div key={i} className={`p-3 rounded-xl ${isMe ? 'ml-8' : 'mr-8'}`}
                          style={{ background: tone.bg, border: `1px solid ${tone.border}` }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold" style={{ color: tone.label }}>
                              {getNoteLabel(note)}
                            </span>
                            <span className="text-xs text-slate-400">
                              {format(new Date(note.created_at), 'MMM d, HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.body}</p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Message input */}
                <div className="px-5 py-4 border-t border-slate-100">
                  <div className="flex gap-2">
                    <textarea
                      className="form-textarea flex-1 text-sm resize-none"
                      rows={2}
                      placeholder="Type a message to the CEO..."
                      value={chatMessage}
                      onChange={e => setChatMessage(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendChatMessage();
                        }
                      }}
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={sendingChat || !chatMessage.trim()}
                      className="btn btn-primary px-4 flex-shrink-0"
                      title="Send message to CEO"
                    >
                      {sendingChat ? <span className="spinner" /> : <Send size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">Press Enter to send · Shift+Enter for new line</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ ASSIGN MODAL ══════════════ */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,29,55,0.5)' }}>
          <div className="card p-0 w-full max-w-md mx-4 fade-in-up" style={{ maxHeight: '90vh', overflow: 'auto' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--color-navy-900)' }}>Assign Case Handler</h3>
                <p className="text-xs text-slate-400 mt-0.5">Case: <span className="font-mono font-bold">{assignModal.reference_id}</span></p>
              </div>
              <button onClick={() => { setAssignModal(null); setAssignTarget(''); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(10,29,55,0.03)' }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Current Status</span>
                  <span className={`badge ${STATUS_BADGE[assignModal.status] || 'badge-review'}`}>{formatStatus(assignModal.status)}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-slate-500">Currently Assigned</span>
                  <span className="font-medium" style={{ color: 'var(--color-navy-900)' }}>
                    {assignModal.assigned_handler || assignModal.assigned_investigator || 'Unassigned'}
                  </span>
                </div>
              </div>
              <label className="form-label">Select Case Handler</label>
              <select className="form-select text-sm w-full" value={assignTarget} onChange={e => setAssignTarget(e.target.value)}>
                <option value="">— Choose a case handler —</option>
                {investigators.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.username} {inv.department ? `(${inv.department})` : ''}
                  </option>
                ))}
              </select>
              {assignTarget && (() => {
                const sel = investigators.find(i => String(i.id) === String(assignTarget));
                const cnt = sel ? cases.filter(c => (c.assigned_handler || c.assigned_investigator) === sel.username).length : 0;
                return (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <Briefcase size={12} className="text-slate-400" />
                    <span className="text-slate-500">Current workload:</span>
                    <span className="font-bold" style={{ color: cnt >= 5 ? '#dc2626' : cnt >= 3 ? '#f59e0b' : '#16a34a' }}>
                      {cnt} active {cnt === 1 ? 'case' : 'cases'}
                    </span>
                  </div>
                );
              })()}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setAssignModal(null); setAssignTarget(''); }} className="btn btn-ghost text-sm">Cancel</button>
              <button onClick={doAssign} disabled={assigning || !assignTarget} className="btn btn-primary text-sm">
                {assigning ? <><span className="spinner" /> Assigning...</> : <><UserCheck size={14} /> Assign Case</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ SEVERITY OVERRIDE MODAL ══════════════ */}
      {severityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,29,55,0.5)' }}>
          <div className="card p-0 w-full max-w-md mx-4 fade-in-up" style={{ maxHeight: '90vh', overflow: 'auto' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--color-navy-900)' }}>Override Severity</h3>
                <p className="text-xs text-slate-400 mt-0.5">Case: <span className="font-mono font-bold">{severityModal.reference_id}</span></p>
              </div>
              <button onClick={() => { setSeverityModal(null); setNewSeverity(''); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(10,29,55,0.03)' }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Current Severity</span>
                  <span className={`badge ${PRIORITY_BADGE[severityModal.priority] || 'badge-medium'}`}>{severityModal.priority}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-slate-500">Category</span>
                  <span className="font-medium" style={{ color: 'var(--color-navy-900)' }}>{severityModal.category?.replace(/_/g, ' ')}</span>
                </div>
              </div>
              <label className="form-label">New Severity Level</label>
              <div className="grid grid-cols-2 gap-2">
                {PRIORITIES.map(p => (
                  <button key={p} onClick={() => setNewSeverity(p)}
                    className={`py-2.5 px-4 rounded-xl text-sm font-semibold border-2 transition-all ${newSeverity === p ? 'border-current shadow-sm' : 'border-transparent'}`}
                    style={{
                      background: newSeverity === p ? (p === 'Critical' ? '#fee2e2' : p === 'High' ? '#fef3c7' : p === 'Medium' ? '#dbeafe' : '#dcfce7') : 'rgba(10,29,55,0.03)',
                      color: p === 'Critical' ? '#dc2626' : p === 'High' ? '#d97706' : p === 'Medium' ? '#3b82f6' : '#16a34a',
                    }}>
                    {p}
                  </button>
                ))}
              </div>
              {newSeverity === 'Critical' && severityModal.priority !== 'Critical' && (
                <div className="mt-3 rounded-xl p-3 flex items-start gap-2" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                  <p className="text-xs" style={{ color: '#991b1b' }}>
                    Setting severity to <strong>Critical</strong> will automatically escalate this case to the CEO dashboard.
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setSeverityModal(null); setNewSeverity(''); }} className="btn btn-ghost text-sm">Cancel</button>
              <button onClick={doOverride} disabled={overriding || !newSeverity || newSeverity === severityModal.priority} className="btn btn-primary text-sm">
                {overriding ? <><span className="spinner" /> Updating...</> : <><TrendingUp size={14} /> Update Severity</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ GMAIL-STYLE COMPOSE — SEND REPORT TO CEO ══════════════ */}
      {composeOpen && composeCase && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-6"
          style={{ background: 'rgba(10,29,55,0.45)', backdropFilter: 'blur(2px)' }}>
          <div className="w-full max-w-2xl fade-in-up"
            style={{
              background: '#fff',
              borderRadius: '1.25rem',
              boxShadow: '0 32px 80px rgba(10,29,55,0.32)',
              border: '1px solid rgba(10,29,55,0.1)',
              overflow: 'hidden',
            }}>

            {/* ── Compose header ── */}
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ background: 'linear-gradient(135deg, #0A1D37 0%, #1e3a5f 100%)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(249,168,38,0.2)' }}>
                  <Zap size={14} style={{ color: '#F9A826' }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">New Report to CEO</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    Case {composeCase.reference_id} · {composeCase.category?.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <button onClick={() => { setComposeOpen(false); setComposeCase(null); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <X size={15} />
              </button>
            </div>

            {/* ── To field ── */}
            <div className="flex items-center gap-3 px-5 py-3"
              style={{ borderBottom: '1px solid #f1f5f9' }}>
              <span className="text-xs font-semibold text-slate-400 w-10">To</span>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: '#fee2e2', color: '#b91c1c' }}>
                <Shield size={11} /> CEO
              </div>
              <span className="text-xs text-slate-300">·</span>
              <span className="text-xs text-slate-400 font-mono">{composeCase.reference_id}</span>
            </div>

            {/* ── Subject ── */}
            <div className="flex items-center gap-3 px-5 py-3"
              style={{ borderBottom: '1px solid #f1f5f9' }}>
              <span className="text-xs font-semibold text-slate-400 w-10">Subject</span>
              <input
                className="flex-1 text-sm font-semibold focus:outline-none"
                style={{ color: 'var(--color-navy-900)', background: 'transparent' }}
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
                placeholder="Report subject…"
              />
            </div>

            {/* ── Body ── */}
            <textarea
              className="w-full text-sm px-5 py-4 resize-none focus:outline-none"
              rows={10}
              placeholder={`Write your formal report to the CEO…\n\nExample:\n\nDear CEO,\n\nFollowing our investigation into case ${composeCase.reference_id}, we have identified the following critical findings:\n\n1. [Finding one]\n2. [Finding two]\n\nWe recommend immediate action regarding…\n\nRegards,\nEthics & Anti-Corruption Office`}
              value={composeBody}
              onChange={e => setComposeBody(e.target.value)}
              style={{ background: '#fff', lineHeight: '1.7' }}
            />

            {/* ── Attachment preview ── */}
            {composeFile && (
              <div className="mx-5 mb-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: '#e8edf5' }}>
                  <Paperclip size={14} style={{ color: 'var(--color-navy-900)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{composeFile.name}</p>
                  <p className="text-xs text-slate-400">{(composeFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={() => setComposeFile(null)}
                  className="p-1 rounded-lg hover:bg-slate-200 transition-colors text-slate-400">
                  <Trash2 size={13} />
                </button>
              </div>
            )}

            {/* ── Footer toolbar ── */}
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}>
              <div className="flex items-center gap-1">
                {/* Attach file */}
                <input
                  ref={composeFileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
                  onChange={e => setComposeFile(e.target.files[0] || null)}
                />
                <button
                  onClick={() => composeFileRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                  style={{ color: '#475569' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  title="Attach evidence file">
                  <Paperclip size={14} />
                  {composeFile ? 'Change file' : 'Attach evidence'}
                </button>
                <span className="text-xs text-slate-300 mx-1">|</span>
                <span className="text-xs text-slate-400">
                  PDF, Word, Excel, Images · Max 10MB
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setComposeOpen(false); setComposeCase(null); }}
                  className="btn btn-ghost text-sm">
                  Discard
                </button>
                <button
                  onClick={sendReport}
                  disabled={composeSending || !composeSubject.trim() || !composeBody.trim()}
                  className="btn btn-primary text-sm flex items-center gap-1.5"
                  style={{
                    background: 'linear-gradient(135deg, #0A1D37, #1e3a5f)',
                    opacity: (!composeSubject.trim() || !composeBody.trim()) ? 0.5 : 1,
                  }}>
                  {composeSending
                    ? <><span className="spinner" /> Sending…</>
                    : <><Send size={14} /> Send Report to CEO</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
