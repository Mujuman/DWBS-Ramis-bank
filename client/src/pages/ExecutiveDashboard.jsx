import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  TrendingUp, AlertTriangle, Clock, CheckCircle, FileText,
  Activity, UserCheck, X, RefreshCw, Shield, ChevronRight,
  Inbox, Paperclip, Download, Eye, Send, MessageSquare,
  Zap, Star, Circle, CheckCircle2, Calendar, Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { STATUS_BADGE, formatStatus } from '../constants/caseWorkflow';

const CATEGORY_COLORS = {
  Fraud: '#e11d48', Corruption: '#7c3aed', Bribery: '#d97706',
  Abuse_of_Power: '#0369a1', Procurement_Violation: '#059669', System_Misuse: '#0891b2',
};

// ── parse subject from bold prefix in note body ─────────────
const parseReport = (body = '') => {
  const match = body.match(/^\*\*(.+?)\*\*\n\n([\s\S]*)$/);
  if (match) return { subject: match[1], content: match[2] };
  return { subject: 'EAAC Report', content: body };
};

// ── file icon by mime type ───────────────────────────────────
const fileIcon = (mime = '') => {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime === 'application/pdf') return '📄';
  if (mime.includes('word')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  return '📎';
};

export default function ExecutiveDashboard() {
  const [loading, setLoading]               = useState(true);
  const [escalatedCases, setEscalatedCases] = useState([]);
  const [investigators, setInvestigators]   = useState([]);
  const [stats, setStats]                   = useState(null);

  // inbox state
  const [selectedCase, setSelectedCase]     = useState(null);
  const [reports, setReports]               = useState([]);       // CEO-directed notes
  const [evidence, setEvidence]             = useState([]);       // attached files
  const [reportsLoading, setReportsLoading] = useState(false);
  const [readIds, setReadIds]               = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ceo_read') || '[]')); }
    catch { return new Set(); }
  });

  // reply state
  const [replyText, setReplyText]           = useState('');
  const [sending, setSending]               = useState(false);

  // assign modal
  const [assignModal, setAssignModal]       = useState(null);
  const [assignTarget, setAssignTarget]     = useState('');
  const [assigning, setAssigning]           = useState(false);

  const bottomRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, reportsRes] = await Promise.allSettled([
        api.get('/cases/stats'),
        api.get('/users'),
        // Only load cases where EAAC has written and sent a formal report to CEO
        api.get('/cases/ceo-reports'),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (usersRes.status === 'fulfilled') {
        setInvestigators(
          (usersRes.value.data.users || [])
            .filter(u => u.role === 'Compliance_Officer' && u.is_active)
            .sort((a, b) => a.username.localeCompare(b.username))
        );
      }
      if (reportsRes.status === 'fulfilled') {
        setEscalatedCases(reportsRes.value.data.cases || []);
      } else {
        console.error('[CEO] ceo-reports fetch failed:', reportsRes.reason);
        setEscalatedCases([]);
      }
    } catch (err) {
      console.error('[CEO] loadData error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── open a case / load its reports & evidence ───────────────
  const openCase = async (c) => {
    setSelectedCase(c);
    setReplyText('');
    setReportsLoading(true);
    try {
      const [notesRes, evidRes] = await Promise.allSettled([
        api.get(`/cases/${c.id}/notes`),
        api.get(`/cases/${c.id}/evidence`),
      ]);
      if (notesRes.status === 'fulfilled') {
        const ceoNotes = (notesRes.value.data.notes || []).filter(n =>
          n.author_type === 'CEO' ||
          (n.author_type === 'Compliance_Officer' && n.audience_type === 'CEO') ||
          (n.author_type === 'Reporter' && n.audience_type === 'CEO')
        );
        setReports(ceoNotes);
        // mark as read
        const newRead = new Set(readIds);
        ceoNotes.forEach(n => newRead.add(n.id));
        setReadIds(newRead);
        localStorage.setItem('ceo_read', JSON.stringify([...newRead]));
      } else { setReports([]); }
      if (evidRes.status === 'fulfilled') {
        setEvidence(evidRes.value.data.evidence || []);
      } else { setEvidence([]); }
    } catch { setReports([]); setEvidence([]); }
    setReportsLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // ── send reply from CEO to EAAC ─────────────────────────────
  const sendReply = async () => {
    if (!replyText.trim() || !selectedCase) return;
    setSending(true);
    try {
      await api.post(`/cases/${selectedCase.id}/notes`, {
        body: replyText.trim(),
        recipient_role: 'Compliance_Officer',
        is_internal_only: false,
      });
      setReplyText('');
      await openCase(selectedCase);
      toast.success('Reply sent to Ethics & Anti-Corruption Office');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send reply');
    }
    setSending(false);
  };

  // ── assign handler ──────────────────────────────────────
  const doAssign = async () => {
    if (!assignTarget) { toast.error('Select a case handler'); return; }
    setAssigning(true);
    try {
      await api.patch(`/cases/${assignModal.id}/status`, {
        status: 'Assigned',
        assigned_to: parseInt(assignTarget),
      });
      toast.success('Case handler assigned');
      setAssignModal(null); setAssignTarget('');
      loadData();
      if (selectedCase?.id === assignModal.id) {
        setSelectedCase(prev => ({ ...prev, assigned_handler: assignTarget, assigned_investigator: assignTarget }));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Assignment failed');
    }
    setAssigning(false);
  };

  // ── download evidence file ───────────────────────────────────
  const downloadFile = async (caseId, file) => {
    try {
      const res = await api.get(
        `/cases/${caseId}/evidence/${file.id}/download`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: file.mime_type || 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url; a.download = file.original_filename; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download file'); }
  };

  const previewFile = async (caseId, file) => {
    try {
      const res = await api.get(
        `/cases/${caseId}/evidence/${file.id}/download`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: file.mime_type || 'application/octet-stream' }));
      window.open(url, '_blank');
    } catch { toast.error('Failed to preview file'); }
  };

  // ── unread count per case ────────────────────────────────────
  const getUnreadCount = (c) => {
    // We don't have per-case note data in the list — use is_escalated as proxy for "new"
    return !readIds.has(`case_${c.id}`) ? 1 : 0;
  };

  const o = stats?.overview || {};

  const kpiCards = [
    { label: 'Reports Received', value: escalatedCases.length, icon: Inbox, color: '#b91c1c', bg: '#fee2e2' },
    { label: 'In Progress', value: o.in_progress || 0, icon: Activity, color: '#3b82f6', bg: '#dbeafe' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <span className="spinner spinner-navy" />
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-navy-900)' }}>
            <TrendingUp size={20} style={{ color: 'var(--color-gold-500)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy-900)' }}>
              Executive Dashboard
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        </div>
        <button onClick={loadData} className="btn btn-ghost">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {kpiCards.map(k => (
          <div key={k.label} className="card p-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: k.bg }}>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <p className="text-2xl font-extrabold mb-0.5" style={{ color: 'var(--color-navy-900)' }}>{k.value}</p>
            <p className="text-xs font-semibold text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Gmail-style Inbox ── */}
      <div className="card overflow-hidden mb-6" style={{ minHeight: '600px' }}>
        {/* Inbox header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100"
          style={{ background: 'linear-gradient(135deg, #0A1D37 0%, #1e3a5f 100%)' }}>
          <Inbox size={18} className="text-yellow-400" />
          <h2 className="text-sm font-bold text-white">EAAC Reports Inbox</h2>
          {escalatedCases.length > 0 && (
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#F9A826', color: '#0A1D37' }}>
              {escalatedCases.length} escalated
            </span>
          )}
        </div>

        <div className="flex" style={{ minHeight: '550px' }}>
          {/* ── Left: case list (inbox sidebar) ── */}
          <div className="border-r border-slate-100 overflow-y-auto flex-shrink-0"
            style={{ width: '320px', maxHeight: '550px' }}>
            {escalatedCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: '#f1f5f9' }}>
                  <Inbox size={28} className="text-slate-300" />
                </div>
                <p className="text-slate-400 font-semibold text-sm">No reports yet</p>
                <p className="text-xs text-slate-300 mt-1">
                  Reports appear here only when the Ethics & Anti-Corruption Office writes and sends a formal report to you.
                </p>
              </div>
            ) : (
              escalatedCases.map(c => {
                const isActive = selectedCase?.id === c.id;
                const catColor = CATEGORY_COLORS[c.category] || '#64748b';
                const isRead = readIds.has(`case_${c.id}`);
                return (
                  <button key={c.id} onClick={() => {
                    openCase(c);
                    setReadIds(prev => { const n = new Set(prev); n.add(`case_${c.id}`); localStorage.setItem('ceo_read', JSON.stringify([...n])); return n; });
                  }}
                    className="w-full text-left px-4 py-3.5 transition-all border-b border-slate-100"
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(10,29,55,0.06), rgba(249,168,38,0.06))'
                        : 'transparent',
                      borderLeft: isActive ? '3px solid #F9A826' : '3px solid transparent',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                    <div className="flex items-start gap-3">
                      {/* unread dot */}
                      <div className="mt-1.5 flex-shrink-0">
                        {!isRead
                          ? <div className="w-2 h-2 rounded-full" style={{ background: '#F9A826' }} />
                          : <div className="w-2 h-2 rounded-full" style={{ background: '#e2e8f0' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono font-bold truncate"
                            style={{ color: 'var(--color-navy-900)' }}>
                            {c.reference_id}
                          </span>
                          <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                            {format(new Date(c.created_at), 'MMM d')}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 truncate mb-1">
                          Ethics & Anti-Corruption Office
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {c.category?.replace(/_/g, ' ')}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: `${catColor}18`, color: catColor }}>
                            {c.priority}
                          </span>
                          <span className={`badge ${STATUS_BADGE[c.status] || 'badge-review'} text-xs`}>
                            {formatStatus(c.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* ── Right: report viewer ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedCase ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: 'linear-gradient(135deg, #e8edf5, #dbeafe)' }}>
                  <MessageSquare size={36} style={{ color: 'var(--color-navy-900)', opacity: 0.4 }} />
                </div>
                <p className="text-slate-500 font-semibold text-base">Select a report to read</p>
                <p className="text-xs text-slate-400 mt-2 max-w-xs">
                  Reports from the Ethics & Anti-Corruption Office will appear here with their findings and attached evidence files.
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Report header */}
                <div className="px-6 py-4 border-b border-slate-100"
                  style={{ background: 'rgba(10,29,55,0.02)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                          style={{ background: '#e8edf5', color: 'var(--color-navy-900)' }}>
                          {selectedCase.reference_id}
                        </span>
                        <span className={`badge ${STATUS_BADGE[selectedCase.status] || 'badge-review'} text-xs`}>
                          {formatStatus(selectedCase.status)}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: `${CATEGORY_COLORS[selectedCase.category] || '#64748b'}18`,
                            color: CATEGORY_COLORS[selectedCase.category] || '#64748b',
                          }}>
                          {selectedCase.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Shield size={11} /> Ethics & Anti-Corruption Office
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> {format(new Date(selectedCase.created_at), 'MMMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Tag size={11} /> {selectedCase.category?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => { setAssignModal(selectedCase); setAssignTarget(''); }}
                        className="btn btn-primary text-xs py-1.5 px-3">
                        <UserCheck size={13} />
                        {selectedCase.assigned_handler || selectedCase.assigned_investigator ? 'Reassign' : 'Assign Handler'}
                      </button>
                      <Link to={`/cases/${selectedCase.id}`}
                        className="btn btn-ghost text-xs py-1.5 px-3">
                        Full Case <ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Messages thread */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
                  style={{ maxHeight: '340px', background: '#fafbfc' }}>
                  {reportsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <span className="spinner spinner-navy" />
                    </div>
                  ) : reports.length === 0 ? (
                    <div className="text-center py-12">
                      <Inbox size={28} className="mx-auto mb-3 text-slate-300" />
                      <p className="text-slate-400 text-sm">No messages yet for this case.</p>
                    </div>
                  ) : (
                    reports.map((note, i) => {
                      const isCEO = note.author_type === 'CEO';
                      const { subject, content } = parseReport(note.body);
                      return (
                        <div key={note.id || i}
                          className={`flex flex-col rounded-2xl p-4 ${isCEO ? 'ml-16' : 'mr-4'}`}
                          style={{
                            background: isCEO
                              ? 'linear-gradient(135deg, rgba(249,168,38,0.08), rgba(249,168,38,0.04))'
                              : '#ffffff',
                            border: `1px solid ${isCEO ? 'rgba(249,168,38,0.25)' : '#e2e8f0'}`,
                            boxShadow: '0 1px 4px rgba(10,29,55,0.06)',
                          }}>
                          {/* message header */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{
                                  background: isCEO ? '#F9A826' : 'var(--color-navy-900)',
                                  color: isCEO ? '#0A1D37' : '#F9A826',
                                }}>
                                {isCEO ? 'C' : 'E'}
                              </div>
                              <div>
                                <p className="text-xs font-bold leading-tight"
                                  style={{ color: isCEO ? '#92400e' : 'var(--color-navy-900)' }}>
                                  {isCEO ? 'CEO (You)' : 'Ethics & Anti-Corruption Office'}
                                </p>
                                {!isCEO && subject !== 'EAAC Report' && (
                                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                    Re: {subject}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-slate-400">
                              {format(new Date(note.created_at), 'MMM d, HH:mm')}
                            </span>
                          </div>
                          {/* subject line for EAAC reports */}
                          {!isCEO && subject !== 'EAAC Report' && (
                            <div className="mb-2 pb-2 border-b border-slate-100">
                              <p className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
                                {subject}
                              </p>
                            </div>
                          )}
                          {/* body */}
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {content}
                          </p>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Evidence attachments */}
                {evidence.length > 0 && (
                  <div className="px-6 py-3 border-t border-slate-100"
                    style={{ background: 'rgba(10,29,55,0.02)' }}>
                    <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                      <Paperclip size={12} /> {evidence.length} Attached File{evidence.length > 1 ? 's' : ''}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {evidence.map(f => (
                        <div key={f.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                          style={{
                            background: '#fff',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 3px rgba(10,29,55,0.06)',
                          }}>
                          <span>{fileIcon(f.mime_type)}</span>
                          <span className="text-slate-700 max-w-32 truncate">{f.original_filename}</span>
                          <button onClick={() => previewFile(selectedCase.id, f)}
                            className="text-blue-500 hover:text-blue-700 transition-colors" title="Preview">
                            <Eye size={12} />
                          </button>
                          <button onClick={() => downloadFile(selectedCase.id, f)}
                            className="text-slate-400 hover:text-slate-700 transition-colors" title="Download">
                            <Download size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reply box - DISABLED: CEO cannot send messages to EAAC */}
                {/* 
                <div className="px-6 py-4 border-t border-slate-100">
                  <div className="rounded-2xl overflow-hidden"
                    style={{ border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(10,29,55,0.06)' }}>
                    <div className="px-4 py-2 flex items-center gap-2"
                      style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                      <span className="text-xs font-semibold text-slate-400">To:</span>
                      <span className="text-xs font-bold" style={{ color: 'var(--color-navy-900)' }}>
                        Ethics & Anti-Corruption Office
                      </span>
                      <span className="text-xs text-slate-400 ml-1">· Case {selectedCase.reference_id}</span>
                    </div>
                    <textarea
                      className="w-full text-sm px-4 py-3 resize-none focus:outline-none"
                      rows={3}
                      placeholder="Write your reply to the Ethics & Anti-Corruption Office…"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); sendReply(); } }}
                      style={{ background: '#fff' }}
                    />
                    <div className="px-4 py-2.5 flex items-center justify-between"
                      style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                      <span className="text-xs text-slate-400">Ctrl+Enter to send</span>
                      <button onClick={sendReply}
                        disabled={sending || !replyText.trim()}
                        className="btn btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5">
                        {sending ? <span className="spinner" /> : <Send size={13} />}
                        Send Reply
                      </button>
                    </div>
                  </div>
                </div>
                */}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Assign Case Handler Modal ── */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10,29,55,0.55)', backdropFilter: 'blur(3px)' }}>
          <div className="card p-0 w-full max-w-md mx-auto fade-in-up"
            style={{ boxShadow: '0 24px 64px rgba(10,29,55,0.25)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--color-navy-900)' }}>
                  Assign Case Handler
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Case: <span className="font-mono font-bold">{assignModal.reference_id}</span>
                </p>
              </div>
              <button onClick={() => { setAssignModal(null); setAssignTarget(''); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(10,29,55,0.03)' }}>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Category</span>
                    <p className="font-semibold text-slate-700 mt-0.5">
                      {assignModal.category?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Currently Assigned</span>
                    <p className="font-semibold mt-0.5" style={{ color: 'var(--color-navy-900)' }}>
                      {assignModal.assigned_handler || assignModal.assigned_investigator || 'Unassigned'}
                    </p>
                  </div>
                </div>
              </div>
              <label className="form-label text-xs">Select Case Handler</label>
              {investigators.length === 0 ? (
                <p className="text-sm text-slate-400 mt-2">No active compliance staff found.</p>
              ) : (
                <select className="form-select text-sm w-full" value={assignTarget}
                  onChange={e => setAssignTarget(e.target.value)}>
                  <option value="">— Choose a case handler —</option>
                  {investigators.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.username}{inv.department ? ` (${inv.department})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setAssignModal(null); setAssignTarget(''); }}
                className="btn btn-ghost text-sm">Cancel</button>
              <button onClick={doAssign} disabled={assigning || !assignTarget}
                className="btn btn-primary text-sm">
                {assigning
                  ? <><span className="spinner" /> Assigning…</>
                  : <><UserCheck size={14} /> Assign Handler</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
