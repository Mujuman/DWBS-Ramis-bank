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
  MessageSquare, Send, Shield, ChevronRight
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

export default function ExecutiveDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [investigators, setInvestigators] = useState([]);

  // Assign investigator modal
  const [assignModal, setAssignModal] = useState(null);
  const [assignTarget, setAssignTarget] = useState('');
  const [assigning, setAssigning] = useState(false);

  // CEO ↔ Ethics chat
  const [selectedChatCase, setSelectedChatCase] = useState(null);
  const [chatNotes, setChatNotes] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      api.get('/cases/stats'),
      api.get('/users'),
    ]).then(([statsResult, usersResult]) => {
      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value.data);
      }
      if (usersResult.status === 'fulfilled') {
        setInvestigators(
          (usersResult.value.data.users || [])
            .filter(u => u.role === 'Investigator' && u.is_active)
            .sort((a, b) => (a.username || '').localeCompare(b.username || ''))
        );
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, []);

  // ── CEO ↔ Ethics chat ──────────────────────────────────────
  const loadChatNotes = async (caseId) => {
    setChatLoading(true);
    try {
      const res = await api.get(`/cases/${caseId}/notes`);
      const relevant = (res.data.notes || []).filter(n =>
        n.author_type === 'CEO' || n.author_type === 'Compliance_Officer' ||
        n.audience_type === 'CEO' || n.audience_type === 'Compliance_Officer'
      );
      setChatNotes(relevant);
    } catch { setChatNotes([]); }
    setChatLoading(false);
  };

  const selectChatCase = async (c) => {
    setSelectedChatCase(c);
    setChatMessage('');
    setShowChat(true);
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

  // ── Assign investigator ────────────────────────────────────
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

  // CEO only sees cases with Priority = Critical
  const escalatedCases = (stats?.escalated_cases || []).filter(
    c => c.priority === 'Critical'
  );

  const kpiCards = [
    { label: 'Total Reports', value: o.total || 0, icon: FileText, color: '#0A1D37', bg: '#e8edf5', change: 'All time' },
    { label: 'Critical Cases', value: o.critical || 0, icon: AlertTriangle, color: '#ef4444', bg: '#fee2e2', change: 'Requires action' },
    { label: 'In Investigation', value: o.in_progress || 0, icon: Activity, color: '#3b82f6', bg: '#dbeafe', change: 'Active investigations' },
    { label: 'Substantiated', value: o.substantiated || 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7', change: 'Evidence confirmed' },
    { label: 'Avg. Resolution', value: stats?.avg_resolution_hours ? `${stats.avg_resolution_hours}h` : 'N/A', icon: Clock, color: '#8b5cf6', bg: '#ede9fe', change: 'Average hours' },
    { label: 'High Priority', value: o.high || 0, icon: TrendingUp, color: '#f59e0b', bg: '#fef3c7', change: 'High severity' },
  ];

  const pieData = (stats?.by_category || []).map(c => ({
    name: c.category.replace(/_/g, ' '),
    value: c.total,
  }));

  const statusChartData = [
    { name: 'New', value: o.new_cases || 0, fill: '#F9A826' },
    { name: 'Under Review', value: o.under_review || 0, fill: '#3b82f6' },
    { name: 'In Progress', value: o.in_progress || 0, fill: '#f59e0b' },
    { name: 'Substantiated', value: o.substantiated || 0, fill: '#22c55e' },
    { name: 'Dismissed', value: (o.complaint_dismissed || 0) + (o.dismissed_no_evidence || 0), fill: '#94a3b8' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up">

      {/* ── Header ── */}
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
              {new Date().toLocaleDateString('en-ET', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <button onClick={loadData} className="btn btn-ghost">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {kpiCards.map(k => (
          <div key={k.label} className="card p-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: k.bg }}>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <p className="text-2xl font-extrabold mb-0.5" style={{ color: 'var(--color-navy-900)' }}>{k.value}</p>
            <p className="text-xs font-semibold text-slate-600 mb-0.5">{k.label}</p>
            <p className="text-xs text-slate-400">{k.change}</p>
          </div>
        ))}
      </div>

      {/* ── Critical Cases (CEO Action Required) ── */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#fee2e2' }}>
            <Zap size={18} className="text-red-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
              Critical Cases — Escalated by Ethics & Anti-Corruption Office
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Showing only <span className="inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded text-red-700" style={{background:'#fee2e2'}}>🔴 Priority = Critical</span> cases escalated to you. Assign an investigator to proceed.
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: '#fee2e2', color: '#dc2626' }}>
            {escalatedCases.length} critical
          </span>
        </div>

        {escalatedCases.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle size={32} className="mx-auto mb-3 text-green-400" />
            <p className="text-slate-400 text-sm font-medium">No critical cases require your action.</p>
            <p className="text-xs text-slate-300 mt-1">
              Cases appear here when the Ethics & Anti-Corruption Office escalates a critical case to you.
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {escalatedCases.map(c => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/cases/${c.id}`} className="font-mono text-xs font-bold hover:underline"
                        style={{ color: 'var(--color-navy-900)' }}>
                        {c.reference_id}
                      </Link>
                    </td>
                    <td className="text-slate-600">{c.category?.replace(/_/g, ' ') || '—'}</td>
                    <td>
                      <span className="badge badge-critical">🔴 Critical</span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[c.status] || 'badge-review'}`}>
                        {formatStatus(c.status)}
                      </span>
                    </td>
                    <td className="text-slate-500">{format(new Date(c.created_at), 'MMM d, yyyy')}</td>
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
                          className={`btn text-xs py-1 px-2 ${!c.assigned_investigator ? 'btn-primary' : 'btn-outline'}`}>
                          <UserCheck size={12} /> {!c.assigned_investigator ? 'Assign' : 'Reassign'}
                        </button>
                        <button
                          onClick={() => selectChatCase(c)}
                          className="btn btn-ghost text-xs py-1 px-2"
                          title="Chat with Ethics & Anti-Corruption Office">
                          <MessageSquare size={12} />
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

      {/* ── CEO ↔ Ethics Chat Panel (inline, shown when a case is selected) ── */}
      {showChat && selectedChatCase && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#dbeafe' }}>
                <MessageSquare size={15} className="text-blue-700" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
                  Ethics & Anti-Corruption Office — Case {selectedChatCase.reference_id}
                </p>
                <p className="text-xs text-slate-400">{selectedChatCase.category?.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <button onClick={() => { setShowChat(false); setSelectedChatCase(null); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <X size={15} className="text-slate-400" />
            </button>
          </div>

          {/* Messages */}
          <div className="rounded-xl overflow-y-auto p-4 space-y-3 mb-3"
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', maxHeight: '280px' }}>
            {chatLoading ? (
              <div className="text-center py-6"><span className="spinner spinner-navy mx-auto" /></div>
            ) : chatNotes.length === 0 ? (
              <div className="text-center py-8">
                <Shield size={22} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-400">No messages yet.</p>
                <p className="text-xs text-slate-300 mt-1">The Ethics office may have attached an escalation report. Check the case notes.</p>
              </div>
            ) : (
              chatNotes.map((note, i) => {
                const isCEO = note.author_type === 'CEO';
                return (
                  <div key={i} className={`p-3 rounded-xl ${isCEO ? 'ml-12' : 'mr-12'}`}
                    style={{
                      background: isCEO ? 'rgba(249,168,38,0.08)' : 'rgba(37,99,235,0.06)',
                      border: `1px solid ${isCEO ? 'rgba(249,168,38,0.22)' : 'rgba(37,99,235,0.16)'}`,
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
          <div className="flex gap-2">
            <textarea className="form-textarea flex-1 text-sm resize-none" rows={2}
              placeholder="Reply to Ethics & Anti-Corruption Office... (Enter to send)"
              value={chatMessage}
              onChange={e => setChatMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
            />
            <button onClick={sendChatMessage} disabled={sendingChat || !chatMessage.trim()}
              className="btn btn-primary px-4 flex-shrink-0">
              {sendingChat ? <span className="spinner" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Charts ── */}
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

        {/* Cases by Status */}
        <div className="card p-6">
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>Cases by Status</h2>
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
        {/* Cases by Category bar */}
        <div className="card p-6">
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>Cases by Category</h2>
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

        {/* Category distribution % */}
        <div className="card p-6">
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>Category Distribution</h2>
          <div className="space-y-3">
            {(stats?.by_category || []).map((cat, idx) => {
              const total = o.total || 1;
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

      {/* ── Assign Investigator Modal ── */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,29,55,0.5)' }}>
          <div className="card p-0 w-full max-w-md mx-4 fade-in-up" style={{ maxHeight: '90vh', overflow: 'auto' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--color-navy-900)' }}>Assign Investigator</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Case: <span className="font-mono font-bold">{assignModal.reference_id}</span>
                </p>
              </div>
              <button onClick={() => { setAssignModal(null); setAssignTarget(''); }}
                className="p-1.5 rounded-lg hover:bg-slate-100">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(10,29,55,0.03)' }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Category</span>
                  <span className="font-medium text-slate-700">{assignModal.category?.replace(/_/g, ' ') || '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-slate-500">Currently Assigned</span>
                  <span className="font-medium" style={{ color: 'var(--color-navy-900)' }}>
                    {assignModal.assigned_investigator || 'Unassigned'}
                  </span>
                </div>
              </div>
              <label className="form-label">Select Investigator</label>
              {investigators.length === 0 ? (
                <p className="text-sm text-slate-400 mt-2">No active investigators found.</p>
              ) : (
                <select className="form-select text-sm w-full" value={assignTarget}
                  onChange={e => setAssignTarget(e.target.value)}>
                  <option value="">— Choose an investigator —</option>
                  {investigators.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.username} {inv.department ? `(${inv.department})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setAssignModal(null); setAssignTarget(''); }} className="btn btn-ghost text-sm">
                Cancel
              </button>
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
