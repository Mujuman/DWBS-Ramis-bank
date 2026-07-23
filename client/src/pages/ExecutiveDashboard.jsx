import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TrendingUp, AlertTriangle, Clock, CheckCircle, FileText,
  Activity, UserCheck, X, Briefcase, Zap, RefreshCw,
  MessageSquare, Send, Shield, ChevronRight, Edit3, Trash2, Check, XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { STATUS_BADGE, formatStatus } from '../constants/caseWorkflow';
const CATEGORY_COLORS = {
  Fraud:                '#e11d48',   // rose-600
  Corruption:           '#7c3aed',   // violet-600
  Bribery:              '#d97706',   // amber-600
  Abuse_of_Power:       '#0369a1',   // sky-700
  Procurement_Violation:'#059669',   // emerald-600
  System_Misuse:        '#0891b2',   // cyan-600
};
const PIE_COLORS = [
  '#0A1D37', '#F9A826', '#7c3aed', '#059669',
  '#e11d48', '#0891b2', '#d97706', '#64748b',
];

// Gradient IDs for bar charts
const CHART_GRADIENT = [
  { id: 'g0', from: '#e11d48', to: '#fb7185' },
  { id: 'g1', from: '#7c3aed', to: '#a78bfa' },
  { id: 'g2', from: '#d97706', to: '#fbbf24' },
  { id: 'g3', from: '#0369a1', to: '#38bdf8' },
  { id: 'g4', from: '#059669', to: '#34d399' },
  { id: 'g5', from: '#0891b2', to: '#22d3ee' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(10,29,55,0.97)',
      border: '1px solid rgba(249,168,38,0.3)',
      borderRadius: '12px',
      padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(10,29,55,0.35)',
    }}>
      <p style={{ color: '#F9A826', fontWeight: 700, fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: '#fff', fontSize: 12 }}>
          {p.name}: <strong style={{ color: p.color || '#F9A826' }}>{p.value}</strong>
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

  // CEO chat note edit/delete
  const [editingChatNoteId,   setEditingChatNoteId]   = useState(null);
  const [editingChatNoteBody, setEditingChatNoteBody] = useState('');
  const [savingChatNote,      setSavingChatNote]      = useState(false);
  const [deletingChatNoteId,  setDeletingChatNoteId]  = useState(null);

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
  // chatSessionStart: timestamp when the chat panel was opened — used to
  // hide all pre-existing historical messages (only show new ones sent this session).
  const loadChatNotes = async (caseId, sessionStart) => {
    setChatLoading(true);
    try {
      const res = await api.get(`/cases/${caseId}/notes`);
      const relevant = (res.data.notes || []).filter(n =>
        (n.author_type === 'CEO' ||
        (n.author_type === 'Compliance_Officer' && n.audience_type === 'CEO') ||
        (n.author_type === 'Reporter' && n.audience_type === 'CEO')) &&
        // Only show messages created after this chat session was opened
        new Date(n.created_at) > sessionStart
      );
      setChatNotes(relevant);
    } catch { setChatNotes([]); }
    setChatLoading(false);
  };

  const selectChatCase = async (c) => {
    const sessionStart = new Date(); // record when user opened this chat
    setSelectedChatCase({ ...c, _sessionStart: sessionStart });
    setChatMessage('');
    setShowChat(true);
    await loadChatNotes(c.id, sessionStart);
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
      await loadChatNotes(selectedChatCase.id, selectedChatCase._sessionStart);
      toast.success('Message sent to Ethics & Anti-Corruption Office');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send message');
    }
    setSendingChat(false);
  };

  const startEditChatNote = (note) => {
    setEditingChatNoteId(note.id);
    setEditingChatNoteBody(note.body);
  };

  const cancelEditChatNote = () => {
    setEditingChatNoteId(null);
    setEditingChatNoteBody('');
  };

  const saveEditChatNote = async (noteId) => {
    if (!editingChatNoteBody.trim() || !selectedChatCase) return;
    setSavingChatNote(true);
    try {
      await api.patch(`/cases/${selectedChatCase.id}/notes/${noteId}`, { body: editingChatNoteBody.trim() });
      setChatNotes(prev => prev.map(n => n.id === noteId ? { ...n, body: editingChatNoteBody.trim() } : n));
      setEditingChatNoteId(null);
      setEditingChatNoteBody('');
      toast.success('Message updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update message');
    }
    setSavingChatNote(false);
  };

  const deleteChatNote = async (noteId) => {
    if (!window.confirm('Delete this message? This cannot be undone.')) return;
    setDeletingChatNoteId(noteId);
    try {
      await api.delete(`/cases/${selectedChatCase.id}/notes/${noteId}`);
      setChatNotes(prev => prev.filter(n => n.id !== noteId));
      toast.success('Message deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete message');
    }
    setDeletingChatNoteId(null);
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
    { name: 'New',          value: o.new_cases  || 0, fill: '#F9A826' },
    { name: 'Under Review', value: o.under_review|| 0, fill: '#38bdf8' },
    { name: 'In Progress',  value: o.in_progress || 0, fill: '#818cf8' },
    { name: 'Substantiated',value: o.substantiated||0, fill: '#34d399' },
    { name: 'Dismissed',    value: (o.complaint_dismissed||0)+(o.dismissed_no_evidence||0), fill: '#94a3b8' },
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
                const isReporter = note.author_type === 'Reporter';
                const isEditing = editingChatNoteId === note.id;
                return (
                  <div key={note.id || i} className={`p-3 rounded-xl ${isCEO ? 'ml-12' : 'mr-12'}`}
                    style={{
                      background: isCEO
                        ? 'rgba(249,168,38,0.08)'
                        : isReporter
                        ? 'rgba(16,185,129,0.07)'
                        : 'rgba(37,99,235,0.06)',
                      border: `1px solid ${isCEO
                        ? 'rgba(249,168,38,0.22)'
                        : isReporter
                        ? 'rgba(16,185,129,0.22)'
                        : 'rgba(37,99,235,0.16)'}`,
                    }}>
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <span className="text-xs font-bold" style={{
                        color: isCEO ? '#92400e' : isReporter ? '#065f46' : '#1d4ed8'
                      }}>
                        {isCEO ? 'CEO (You)' : isReporter ? 'Reporter' : 'Ethics & Anti-Corruption Office'}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-slate-400">{format(new Date(note.created_at), 'MMM d, HH:mm')}</span>
                        {/* Edit/Delete — only for CEO's own messages */}
                        {isCEO && !isEditing && (
                          <>
                            <button onClick={() => startEditChatNote(note)}
                              className="p-0.5 rounded hover:bg-amber-100 transition-colors" title="Edit">
                              <Edit3 size={11} className="text-amber-600" />
                            </button>
                            <button onClick={() => deleteChatNote(note.id)}
                              disabled={deletingChatNoteId === note.id}
                              className="p-0.5 rounded hover:bg-red-100 transition-colors" title="Delete">
                              {deletingChatNoteId === note.id
                                ? <span className="spinner" style={{ width: 11, height: 11 }} />
                                : <Trash2 size={11} className="text-slate-400 hover:text-red-500" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="space-y-2 mt-1">
                        <textarea
                          className="form-textarea w-full text-sm resize-none"
                          rows={2}
                          value={editingChatNoteBody}
                          onChange={e => setEditingChatNoteBody(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={cancelEditChatNote} className="btn btn-ghost text-xs py-1 px-2">
                            <XCircle size={11} /> Cancel
                          </button>
                          <button
                            onClick={() => saveEditChatNote(note.id)}
                            disabled={savingChatNote || !editingChatNoteBody.trim()}
                            className="btn btn-primary text-xs py-1 px-2">
                            {savingChatNote ? <span className="spinner" /> : <Check size={11} />} Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{note.body}</p>
                    )}
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
              Monthly Submission Trend (12 Months)
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(10,29,55,0.07)', color: 'var(--color-navy-900)' }}>
              {stats?.monthly_trend?.reduce((a, b) => a + b.total, 0) || 0} total
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats?.monthly_trend || []} margin={{ top: 8, right: 12, bottom: 5, left: -20 }}>
              <defs>
                <linearGradient id="lineAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0A1D37" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#0A1D37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="total" stroke="#0A1D37" strokeWidth={3}
                dot={{ fill: '#F9A826', r: 5, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 7, fill: '#F9A826', stroke: '#0A1D37', strokeWidth: 2 }} name="Cases" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Cases by Status */}
        <div className="card p-6">
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>Cases by Status</h2>
          {statusChartData.every(s => s.value === 0) ? (
            <div className="flex items-center justify-center h-40 text-slate-300 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={statusChartData} layout="vertical" margin={{ top: 2, right: 36, bottom: 2, left: 74 }}
                barCategoryGap="28%">
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} width={72} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(10,29,55,0.04)' }} />
                <Bar dataKey="value" name="Cases" radius={[0, 6, 6, 0]}>
                  {statusChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Cases by Category bar */}
        <div className="card p-6">
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>Cases by Category</h2>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={pieData} layout="vertical" margin={{ top: 2, right: 24, bottom: 2, left: 84 }}
              barCategoryGap="28%">
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(10,29,55,0.04)' }} />
              <Bar dataKey="value" name="Cases" radius={[0, 6, 6, 0]}>
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
          <div className="space-y-3.5">
            {(stats?.by_category || []).map((cat, idx) => {
              const total = o.total || 1;
              const pct = Math.round((cat.total / total) * 100);
              const color = CATEGORY_COLORS[cat.category] || PIE_COLORS[idx % PIE_COLORS.length];
              return (
                <div key={cat.category}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-700">{cat.category?.replace(/_/g, ' ')}</span>
                    <span className="font-bold tabular-nums" style={{ color }}>{cat.total} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }} />
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
