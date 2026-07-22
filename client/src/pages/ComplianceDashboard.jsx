import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { CASE_STATUSES, STATUS_BADGE, formatStatus } from '../constants/caseWorkflow';

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

      const [cRes, sRes, uRes] = await Promise.all([
        api.get('/cases', { params }),
        api.get('/cases/stats'),
        api.get('/users'),
      ]);
      setCases(cRes.data.cases || []);
      setPagination(cRes.data.pagination || { total: 0, page: 1, total_pages: 1 });
      setStats(sRes.data);
      setInvestigators((uRes.data.users || []).filter(u => u.role === 'Investigator' && u.is_active));

      // Load escalated cases for CEO chat tab
      const escalated = (sRes.data.escalated_cases || []);
      setCeoChatCases(escalated);
    } catch {
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
      // Show only notes involving CEO or Compliance_Officer (Ethics office)
      const relevant = (res.data.notes || []).filter(n =>
        n.author_type === 'CEO' || n.author_type === 'Compliance_Officer' ||
        (n.audience_type === 'CEO' || n.audience_type === 'Compliance_Officer')
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

  // ── Workload: count cases per investigator ─────────────────
  const workload = investigators.map(inv => ({
    ...inv,
    count: cases.filter(c => c.assigned_investigator === inv.username).length,
  })).sort((a, b) => b.count - a.count);

  const ov = stats?.overview || {};
  const statCards = [
    { label: 'Total Cases', value: ov.total || 0, icon: FileText, color: 'var(--color-navy-900)', bg: '#e8edf5' },
    { label: 'New', value: ov.new_cases || 0, icon: AlertTriangle, color: 'var(--color-gold-600)', bg: '#fef3c7' },
    { label: 'In Progress', value: ov.in_progress || 0, icon: Clock, color: '#3b82f6', bg: '#dbeafe' },
    { label: 'Substantiated', value: ov.substantiated || 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7' },
    { label: 'Critical', value: ov.critical || 0, icon: TrendingUp, color: '#dc2626', bg: '#fee2e2' },
    { label: 'Unassigned', value: cases.filter(c => !c.assigned_investigator).length, icon: Users, color: '#7c3aed', bg: '#ede9fe' },
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
                              onClick={() => { setEscalateModal(c); setEscalationNote(''); }}
                              className="btn btn-ghost text-xs py-1 px-2 text-red-600 hover:bg-red-50"
                              title="Escalate to CEO with Report">
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

      {/* ══════════════ INVESTIGATOR WORKLOAD TAB ══════════════ */}
      {activeTab === 'workload' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} style={{ color: 'var(--color-navy-900)' }} />
              <h2 className="text-base font-bold" style={{ color: 'var(--color-navy-900)' }}>
                Investigator Workload
              </h2>
            </div>
            <span className="text-xs text-slate-400">{investigators.length} active investigators</span>
          </div>

          {loading ? (
            <div className="py-16 text-center"><span className="spinner spinner-navy mx-auto" /></div>
          ) : investigators.length === 0 ? (
            <div className="py-16 text-center">
              <Users size={32} className="mx-auto mb-3 text-slate-300" />
              <p className="text-slate-400">No active investigators found.</p>
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
                      const unassigned = cases.filter(c => !c.assigned_investigator);
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
                <h3 className="text-base font-bold" style={{ color: 'var(--color-navy-900)' }}>Assign Investigator</h3>
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
                    {assignModal.assigned_investigator || 'Unassigned'}
                  </span>
                </div>
              </div>
              <label className="form-label">Select Investigator</label>
              <select className="form-select text-sm w-full" value={assignTarget} onChange={e => setAssignTarget(e.target.value)}>
                <option value="">— Choose an investigator —</option>
                {investigators.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.username} {inv.department ? `(${inv.department})` : ''}
                  </option>
                ))}
              </select>
              {assignTarget && (() => {
                const sel = investigators.find(i => String(i.id) === String(assignTarget));
                const cnt = sel ? cases.filter(c => c.assigned_investigator === sel.username).length : 0;
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

      {/* ══════════════ ESCALATE TO CEO MODAL ══════════════ */}
      {escalateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,29,55,0.5)' }}>
          <div className="card p-0 w-full max-w-lg mx-4 fade-in-up" style={{ maxHeight: '90vh', overflow: 'auto' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-red-600" />
                  <h3 className="text-base font-bold" style={{ color: 'var(--color-navy-900)' }}>
                    Escalate to CEO
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Case: <span className="font-mono font-bold">{escalateModal.reference_id}</span>
                </p>
              </div>
              <button onClick={() => { setEscalateModal(null); setEscalationNote(''); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5">
              {/* Case summary */}
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Category</span>
                    <p className="font-semibold mt-0.5" style={{ color: 'var(--color-navy-900)' }}>{escalateModal.category?.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Priority</span>
                    <p className="mt-0.5"><span className={`badge ${PRIORITY_BADGE[escalateModal.priority] || 'badge-medium'}`}>{escalateModal.priority}</span></p>
                  </div>
                </div>
              </div>

              {/* Escalation note / report */}
              <label className="form-label">
                Critical Report to CEO <span className="text-slate-400 font-normal">(recommended)</span>
              </label>
              <textarea
                className="form-textarea w-full text-sm"
                rows={6}
                placeholder="Describe the critical findings, evidence reviewed, and why this case requires CEO-level intervention...

Example:
- Allegations of fraud involving senior management
- Supporting documents reviewed: [list evidence]
- Immediate action required: suspend implicated accounts pending investigation"
                value={escalationNote}
                onChange={e => setEscalationNote(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1.5">
                This report will be sent directly to the CEO and attached to the case. If left empty, a standard escalation notice will be sent.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setEscalateModal(null); setEscalationNote(''); }} className="btn btn-ghost text-sm">Cancel</button>
              <button onClick={doEscalate} disabled={escalating} className="btn btn-primary text-sm"
                style={{ background: '#dc2626', borderColor: '#dc2626' }}>
                {escalating ? <><span className="spinner" /> Escalating...</> : <><Zap size={14} /> Escalate to CEO</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
