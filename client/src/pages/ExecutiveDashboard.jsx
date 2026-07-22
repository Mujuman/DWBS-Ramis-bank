import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, AlertTriangle, Clock, CheckCircle, FileText,
  Activity, UserCheck, X, Briefcase, Zap, RefreshCw,
  MessageSquare, Send, Shield, ChevronRight, Search, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { STATUS_BADGE, formatStatus } from '../constants/caseWorkflow';

const CATEGORY_COLORS = {
  Fraud: '#ef4444', Corruption: '#8b5cf6', Bribery: '#f59e0b',
  Abuse_of_Power: '#f43f5e', Procurement_Violation: '#10b981', System_Misuse: '#0ea5e9',
};

const PIE_COLORS = ['#0A1D37', '#F9A826', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#94a3b8'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-3 text-xs shadow-lg">
      <p className="font-bold text-slate-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const PRIORITY_BADGE = {
  Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high', Critical: 'badge-critical',
};

export default function ExecutiveDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [investigators, setInvestigators] = useState([]);
  const [fraudOnly, setFraudOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('escalated');

  // All cases for CEO browse tab
  const [allCases, setAllCases] = useState([]);
  const [allCasesLoading, setAllCasesLoading] = useState(false);
  const [allCasesPagination, setAllCasesPagination] = useState({ total: 0, page: 1, total_pages: 1 });
  const [caseFilters, setCaseFilters] = useState({ priority: 'Critical', status: '', search: '', page: 1 });

  // Assign investigator modal state
  const [assignModal, setAssignModal] = useState(null);
  const [assignTarget, setAssignTarget] = useState('');
  const [assigning, setAssigning] = useState(false);

  // CEO ↔ Ethics chat state
  const [selectedChatCase, setSelectedChatCase] = useState(null);
  const [chatNotes, setChatNotes] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/cases/stats'),
      api.get('/users'),
    ])
      .then(([statsRes, usersRes]) => {
        setStats(statsRes.data);
        setInvestigators(
          (usersRes.data.users || [])
            .filter(u => u.role === 'Investigator' && u.is_active)
            .sort((a, b) => (a.username || '').localeCompare(b.username || ''))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadAllCases = useCallback(async (f = caseFilters) => {
    setAllCasesLoading(true);
    try {
      const params = { page: f.page, limit: 20 };
      if (f.priority) params.severity_level = f.priority;
      if (f.status) params.status = f.status;
      if (f.search) params.search = f.search;
      const res = await api.get('/cases', { params });
      setAllCases(res.data.cases || []);
      setAllCasesPagination(res.data.pagination || { total: 0, page: 1, total_pages: 1 });
    } catch {
      toast.error('Failed to load cases');
    }
    setAllCasesLoading(false);
  }, []);

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (activeTab === 'all_cases') loadAllCases();
  }, [activeTab]);

  const applyFilter = (key, val) => {
    const nf = { ...caseFilters, [key]: val, page: 1 };
    setCaseFilters(nf);
    loadAllCases(nf);
  };

  // ── CEO ↔ Ethics chat functions ────────────────────────────
  const loadChatNotes = async (caseId) => {
    setChatLoading(true);
    try {
      const res = await api.get(`/cases/${caseId}/notes`);
      const relevant = (res.data.notes || []).filter(n =>
        n.author_type === 'CEO' || n.author_type === 'Compliance_Officer' ||
        n.audience_type === 'CEO' || n.audience_type === 'Compliance_Officer'
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
        recipient_role: 'Compliance_Officer',
        is_internal_only: false,
      });
      setChatMessage('');
      await loadChatNotes(selectedChatCase.id);
      toast.success('Message sent to Ethics & Anti-Corruption Office');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send message');
    }
    setSendingChat(false);
  };

  // ── Assign investigator (CEO action) ───────────────────────
  const doAssign = async () => {
    if (!assignTarget) { toast.error('Select an investigator'); return; }
    setAssigning(true);
    try {
      await api.patch(`/cases/${assignModal.id}/status`, {
        status: 'Assigned',
        assigned_to: parseInt(assignTarget),
      });
      toast.success(`Investigator assigned to case ${assignModal.reference_id}`);
      setAssignModal(null);
      setAssignTarget('');
      loadData();
      if (activeTab === 'all_cases') loadAllCases();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Assignment failed');
    }
    setAssigning(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="spinner spinner-navy" />
      </div>
    );
  }

  const o = stats?.overview || {};
  const escalatedCases = stats?.escalated_cases || [];
  const filteredEscalated = fraudOnly
    ? escalatedCases.filter(c => ['Fraud', 'Corruption', 'Bribery'].includes(c.category))
    : escalatedCases;

  const kpiCards = [
    { label: 'Total Reports', value: o.total || 0, icon: FileText, color: '#0A1D37', bg: '#e8edf5', change: 'All time' },
    { label: 'Critical Cases', value: o.critical || 0, icon: AlertTriangle, color: '#ef4444', bg: '#fee2e2', change: 'Requires action' },
    { label: 'In Investigation', value: o.in_progress || 0, icon: Activity, color: '#3b82f6', bg: '#dbeafe', change: 'Active investigations' },
    { label: 'Substantiated', value: o.substantiated || 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7', change: 'Evidence confirmed' },
    { label: 'Avg. Resolution', value: stats?.avg_resolution_hours ? `${stats.avg_resolution_hours}h` : 'N/A', icon: Clock, color: '#8b5cf6', bg: '#ede9fe', change: 'Average hours' },
    { label: 'High Priority', value: o.high || 0, icon: TrendingUp, color: '#f59e0b', bg: '#fef3c7', change: 'High severity' },
  ];

  const pieData = stats?.by_category?.map(c => ({
    name: c.category.replace(/_/g, ' '),
    value: c.total,
  })) || [];

  const statusChartData = [
    { name: 'New', value: o.new_cases || 0, fill: '#F9A826' },
    { name: 'Under Review', value: o.under_review || 0, fill: '#3b82f6' },
    { name: 'In Progress', value: o.in_progress || 0, fill: '#f59e0b' },
    { name: 'Substantiated', value: o.substantiated || 0, fill: '#22c55e' },
    { name: 'Dismissed', value: (o.complaint_dismissed || 0) + (o.dismissed_no_evidence || 0), fill: '#94a3b8' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-navy-900)' }}>
            <TrendingUp size={20} style={{ color: 'var(--color-gold-500)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy-900)' }}>
              Executive Dashboard
            </h1>
            <p className="text-slate-500 text-sm">
              Whistleblowing system overview — {new Date().toLocaleDateString('en-ET', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <button onClick={loadData} className="btn btn-ghost">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {kpiCards.map(k => (
          <div key={k.label} className="card p-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: k.bg }}>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <p className="text-2xl font-extrabold mb-0.5" style={{ color: 'var(--color-navy-900)' }}>{k.value}</p>
            <p className="text-xs font-semibold text-slate-600 mb-0.5">{k.label}</p>
            <p className="text-xs text-slate-400">{k.change}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: 'var(--color-slate-100)' }}>
        {[
          ['escalated', `🚨 Escalated Cases (${escalatedCases.length})`],
          ['all_cases', '📋 All Cases'],
          ['ceo_chat', '💬 Ethics Office Chat'],
          ['analytics', '📊 Analytics'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === key ? 'shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            style={activeTab === key ? { background: 'var(--color-navy-900)', color: 'var(--color-gold-500)' } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════ ESCALATED CASES TAB ══════════════ */}
      {activeTab === 'escalated' && (
        <div className="card p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#fee2e2' }}>
              <Zap size={18} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
                Critical Cases — Escalated by Ethics & Anti-Corruption Office
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                These cases have been reported to you by the Ethics & Anti-Corruption Office.
                Review each case and <strong>assign an investigator</strong> to proceed.
              </p>
              <p className="text-xs mt-2 rounded-lg px-3 py-1.5 inline-block"
                style={{ background: '#fef3c7', color: '#92400e' }}>
                💡 Cases appear here when: (1) the Ethics office manually escalates a case, or (2) a case is submitted with <strong>Corruption / Bribery</strong> category — both auto-set as critical.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <label className="text-xs text-slate-500 flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="fraudOnly" className="w-4 h-4" onChange={e => setFraudOnly(e.target.checked)} />
              Show fraud/financial crime only
            </label>
            <span className="text-xs text-slate-400">{filteredEscalated.length} escalated case{filteredEscalated.length !== 1 ? 's' : ''}</span>
          </div>

          {filteredEscalated.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle size={32} className="mx-auto mb-3 text-green-400" />
              <p className="text-slate-400 text-sm font-medium">No escalated cases awaiting your action.</p>
              <p className="text-xs text-slate-300 mt-1">
                Cases show here when the Ethics & Anti-Corruption Office escalates them, or when Corruption/Bribery cases are submitted.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table text-xs">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Assigned To</th>
                    <th>Action Required</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEscalated.map(c => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/cases/${c.id}`} className="font-mono text-xs font-bold hover:underline" style={{ color: 'var(--color-navy-900)' }}>
                          {c.reference_id}
                        </Link>
                      </td>
                      <td className="text-slate-600">{c.category?.replace(/_/g, ' ')}</td>
                      <td>
                        <span className={`badge ${PRIORITY_BADGE[c.priority] || 'badge-critical'}`}>{c.priority}</span>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[c.status] || 'badge-review'}`}>
                          {formatStatus(c.status)}
                        </span>
                      </td>
                      <td className="text-slate-500">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-slate-600">
                        {c.assigned_investigator || <span className="text-red-400 font-medium italic">Unassigned</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link to={`/cases/${c.id}`} className="btn btn-ghost text-xs py-1 px-2">
                            View <ChevronRight size={11} />
                          </Link>
                          <button
                            onClick={() => { setAssignModal(c); setAssignTarget(''); }}
                            className={`btn text-xs py-1 px-2 ${!c.assigned_investigator ? 'btn-primary' : 'btn-outline'}`}
                          >
                            <UserCheck size={12} /> {!c.assigned_investigator ? 'Assign' : 'Reassign'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ ALL CASES TAB ══════════════ */}
      {activeTab === 'all_cases' && (
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#e8edf5' }}>
              <FileText size={18} style={{ color: 'var(--color-navy-900)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>All Cases</h2>
              <p className="text-xs text-slate-500 mt-0.5">Browse all cases in the system. Filter by priority to find critical cases.</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-40">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" className="form-input pl-9 text-sm"
                placeholder="Search reference ID..."
                value={caseFilters.search}
                onChange={e => applyFilter('search', e.target.value)} />
            </div>
            <select className="form-select text-sm" value={caseFilters.priority}
              onChange={e => applyFilter('priority', e.target.value)}>
              <option value="">All Priorities</option>
              <option value="Critical">🔴 Critical</option>
              <option value="High">🟠 High</option>
              <option value="Medium">🟡 Medium</option>
              <option value="Low">🟢 Low</option>
            </select>
            <select className="form-select text-sm" value={caseFilters.status}
              onChange={e => applyFilter('status', e.target.value)}>
              <option value="">All Statuses</option>
              <option value="New">New</option>
              <option value="Under_Review">Under Review</option>
              <option value="Assigned">Assigned</option>
              <option value="Investigating">Investigating</option>
              <option value="Pending_Evidence">Pending Evidence</option>
              <option value="Substantiated">Substantiated</option>
              <option value="Complaint_Dismissed">Dismissed</option>
            </select>
          </div>

          {allCasesLoading ? (
            <div className="py-16 text-center"><span className="spinner spinner-navy mx-auto" /></div>
          ) : allCases.length === 0 ? (
            <div className="py-12 text-center">
              <Filter size={28} className="mx-auto mb-3 text-slate-300" />
              <p className="text-slate-400 text-sm">No cases match the selected filters.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table text-xs">
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
                    {allCases.map(c => (
                      <tr key={c.id}>
                        <td>
                          <Link to={`/cases/${c.id}`} className="font-mono text-xs font-bold hover:underline"
                            style={{ color: 'var(--color-navy-900)' }}>
                            {c.reference_id}
                          </Link>
                        </td>
                        <td className="text-slate-600">{c.category?.replace(/_/g, ' ')}</td>
                        <td>
                          <span className={`badge ${PRIORITY_BADGE[c.priority] || 'badge-low'}`}>{c.priority}</span>
                        </td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[c.status] || 'badge-review'}`}>{formatStatus(c.status)}</span>
                        </td>
                        <td>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: c.submitted_by_type === 'anonymous' ? 'rgba(10,29,55,0.08)' : 'rgba(249,168,38,0.1)',
                              color: c.submitted_by_type === 'anonymous' ? 'var(--color-navy-700)' : 'var(--color-gold-700)',
                            }}>
                            {c.submitted_by_type === 'anonymous' ? '🔒 Anonymous' : '👤 Staff'}
                          </span>
                        </td>
                        <td className="text-slate-500">
                          {c.assigned_investigator || <span className="text-red-400 italic">Unassigned</span>}
                        </td>
                        <td className="text-slate-400">{format(new Date(c.created_at), 'MMM d, yyyy')}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Link to={`/cases/${c.id}`} className="btn btn-ghost text-xs py-1 px-2">
                              View <ChevronRight size={11} />
                            </Link>
                            {c.is_escalated && (
                              <button onClick={() => { setAssignModal(c); setAssignTarget(''); }}
                                className="btn btn-outline text-xs py-1 px-2">
                                <UserCheck size={12} /> Assign
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {allCasesPagination.total_pages > 1 && (
                <div className="flex items-center justify-between px-2 py-4 border-t border-slate-100 mt-2">
                  <p className="text-xs text-slate-500">
                    Page {allCasesPagination.page} of {allCasesPagination.total_pages} ({allCasesPagination.total} cases)
                  </p>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, allCasesPagination.total_pages) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => { const nf = { ...caseFilters, page: p }; setCaseFilters(nf); loadAllCases(nf); }}
                        className={`w-7 h-7 rounded-lg text-xs font-medium ${p === allCasesPagination.page ? 'text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        style={p === allCasesPagination.page ? { background: 'var(--color-navy-900)' } : {}}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════ CEO ↔ ETHICS CHAT TAB ══════════════ */}
      {activeTab === 'ceo_chat' && (
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#dbeafe' }}>
              <MessageSquare size={18} className="text-blue-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
                Messages with Ethics & Anti-Corruption Office
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Direct channel for escalated case discussions</p>
            </div>
          </div>

          {escalatedCases.length === 0 ? (
            <div className="py-12 text-center">
              <Shield size={28} className="mx-auto mb-3 text-slate-300" />
              <p className="text-slate-400 text-sm">No escalated cases yet.</p>
              <p className="text-xs text-slate-300 mt-1">Messages appear here once the Ethics office escalates a case.</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-5 gap-4">
              {/* Case list */}
              <div className="lg:col-span-2 rounded-xl overflow-hidden border border-slate-100">
                <div className="px-4 py-2.5 border-b border-slate-100" style={{ background: 'rgba(10,29,55,0.03)' }}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Escalated Cases</p>
                </div>
                <div className="divide-y divide-slate-100 overflow-y-auto" style={{ maxHeight: '400px' }}>
                  {escalatedCases.map(c => (
                    <button key={c.id} onClick={() => selectChatCase(c)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selectedChatCase?.id === c.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}>
                      <p className="text-xs font-mono font-bold" style={{ color: 'var(--color-navy-900)' }}>{c.reference_id}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{c.category?.replace(/_/g, ' ')}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`badge ${PRIORITY_BADGE[c.priority] || 'badge-critical'} text-xs`}>{c.priority}</span>
                        <span className={`badge ${STATUS_BADGE[c.status] || 'badge-review'} text-xs`}>{formatStatus(c.status)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat window */}
              <div className="lg:col-span-3 flex flex-col rounded-xl border border-slate-100 overflow-hidden" style={{ minHeight: '400px' }}>
                {!selectedChatCase ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                    <MessageSquare size={24} className="text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">Select a case to view the conversation</p>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between" style={{ background: 'rgba(10,29,55,0.02)' }}>
                      <div>
                        <p className="text-xs font-bold" style={{ color: 'var(--color-navy-900)' }}>{selectedChatCase.reference_id}</p>
                        <p className="text-xs text-slate-400">{selectedChatCase.category?.replace(/_/g, ' ')}</p>
                      </div>
                      <Link to={`/cases/${selectedChatCase.id}`} className="btn btn-ghost text-xs py-1 px-2">
                        Open Case <ChevronRight size={11} />
                      </Link>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '280px' }}>
                      {chatLoading ? (
                        <div className="text-center py-6"><span className="spinner spinner-navy mx-auto" /></div>
                      ) : chatNotes.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-sm text-slate-400">No messages yet.</p>
                          <p className="text-xs text-slate-300 mt-1">The Ethics office may have attached a report. Check the case notes.</p>
                        </div>
                      ) : (
                        chatNotes.map((note, i) => {
                          const isCEO = note.author_type === 'CEO';
                          return (
                            <div key={i} className={`p-3 rounded-xl ${isCEO ? 'ml-8' : 'mr-8'}`}
                              style={{
                                background: isCEO ? 'rgba(249,168,38,0.08)' : 'rgba(37,99,235,0.06)',
                                border: `1px solid ${isCEO ? 'rgba(249,168,38,0.2)' : 'rgba(37,99,235,0.15)'}`,
                              }}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold" style={{ color: isCEO ? '#92400e' : '#1d4ed8' }}>
                                  {isCEO ? 'CEO (You)' : 'Ethics & Anti-Corruption Office'}
                                </span>
                                <span className="text-xs text-slate-400">{format(new Date(note.created_at), 'MMM d, HH:mm')}</span>
                              </div>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{note.body}</p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Input */}
                    <div className="px-4 py-3 border-t border-slate-100">
                      <div className="flex gap-2">
                        <textarea
                          className="form-textarea flex-1 text-sm resize-none"
                          rows={2}
                          placeholder="Reply to Ethics & Anti-Corruption Office..."
                          value={chatMessage}
                          onChange={e => setChatMessage(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                        />
                        <button onClick={sendChatMessage} disabled={sendingChat || !chatMessage.trim()}
                          className="btn btn-primary px-4 flex-shrink-0">
                          {sendingChat ? <span className="spinner" /> : <Send size={15} />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Enter to send · Shift+Enter for new line</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ ANALYTICS TAB ══════════════ */}
      {activeTab === 'analytics' && (
        <>
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            {/* Monthly Trend */}
            <div className="card p-6 lg:col-span-2">
              <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>
                Monthly Submission Trend (12 Months)
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats?.monthly_trend || []} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="total" stroke="#0A1D37" strokeWidth={2.5}
                    dot={{ fill: '#F9A826', r: 4 }} activeDot={{ r: 6, fill: '#F9A826' }} name="Cases" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Status breakdown pie */}
            <div className="card p-6">
              <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>
                Cases by Status
              </h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                    dataKey="value" nameKey="name">
                    {statusChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {statusChartData.filter(s => s.value > 0).map(s => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.fill }} />
                      <span className="text-slate-600">{s.name}</span>
                    </div>
                    <span className="font-bold" style={{ color: 'var(--color-navy-900)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Category breakdown bar chart */}
            <div className="card p-6">
              <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>
                Cases by Category
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pieData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Cases" radius={[0, 4, 4, 0]}>
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={CATEGORY_COLORS[entry.name?.replace(/ /g, '_')] || PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category table */}
            <div className="card p-6">
              <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>
                Category Distribution
              </h2>
              <div className="space-y-3">
                {(stats?.by_category || []).map((cat, idx) => {
                  const total = stats?.overview?.total || 1;
                  const pct = Math.round((cat.total / total) * 100);
                  const color = CATEGORY_COLORS[cat.category] || PIE_COLORS[idx % PIE_COLORS.length];
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">{cat.category?.replace(/_/g, ' ')}</span>
                        <span className="font-bold" style={{ color }}>{cat.total} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#e8edf5' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════ ASSIGN INVESTIGATOR MODAL ══════════════ */}
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
                  <span className="text-slate-500">Case Priority</span>
                  <span className={`badge ${PRIORITY_BADGE[assignModal.priority] || 'badge-critical'}`}>{assignModal.priority}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-slate-500">Currently Assigned</span>
                  <span className="font-medium" style={{ color: 'var(--color-navy-900)' }}>
                    {assignModal.assigned_investigator || 'Unassigned'}
                  </span>
                </div>
              </div>
              <label className="form-label">Select Investigator</label>
              <select className="form-select text-sm w-full" value={assignTarget}
                onChange={e => setAssignTarget(e.target.value)}>
                <option value="">— Choose an investigator —</option>
                {investigators.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.username} {inv.department ? `(${inv.department})` : ''}
                  </option>
                ))}
              </select>
              {assignTarget && (() => {
                const sel = investigators.find(i => String(i.id) === String(assignTarget));
                return sel ? (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <Briefcase size={12} className="text-slate-400" />
                    <span className="text-slate-500">Current workload:</span>
                    <span className="font-bold text-slate-700">{sel.username} selected</span>
                  </div>
                ) : null;
              })()}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setAssignModal(null); setAssignTarget(''); }} className="btn btn-ghost text-sm">Cancel</button>
              <button onClick={doAssign} disabled={assigning || !assignTarget} className="btn btn-primary text-sm">
                {assigning ? <><span className="spinner" /> Assigning...</> : <><UserCheck size={14} /> Assign Investigator</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
