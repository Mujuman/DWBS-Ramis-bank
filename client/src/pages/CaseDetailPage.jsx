import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  ArrowLeft, FileText, Lock, Send, User,
  Paperclip, Download, Edit3, Shield, AlertTriangle, Info, Zap
} from 'lucide-react';

// ── Must match DB enum exactly ────────────────────────────────
const STATUSES = ['New', 'Under_Review', 'Assigned', 'Investigating', 'Pending_Evidence', 'Resolved', 'Closed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const COMPLIANCE_OFFICER_STATUSES = ['New', 'Assigned'];
const INVESTIGATOR_STATUSES = ['Under_Review', 'Investigating', 'Pending_Evidence', 'Resolved', 'Closed'];

const STATUS_BADGE = {
  New:              'badge-new',
  Under_Review:     'badge-review',
  Assigned:         'badge-review',
  Investigating:    'badge-progress',
  Pending_Evidence: 'badge-escalated',
  Resolved:         'badge-resolved',
  Closed:           'badge-closed',
};

const PRIORITY_COLOR = {
  Low:      'text-green-600',
  Medium:   'text-yellow-600',
  High:     'text-orange-600',
  Critical: 'text-red-600',
};

export default function CaseDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const [caseData,    setCaseData]    = useState(null);
  const [notes,       setNotes]       = useState([]);
  const [evidence,    setEvidence]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [noteBody,    setNoteBody]    = useState('');
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isInternal,  setIsInternal]  = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [editMode,    setEditMode]    = useState(false);
  const [newStatus,   setNewStatus]   = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestBranch, setRequestBranch] = useState('');
  const [requestSeverity, setRequestSeverity] = useState('Medium');
  const [investigators, setInvestigators] = useState([]);
  const [assignTo,    setAssignTo]    = useState('');
  const [updating,    setUpdating]    = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // ── Per-spec permission flags ─────────────────────────────
  // JWT payload uses `userId` (not `id`)
  const myUserId       = user?.userId ?? user?.id;
  const isInvestigator = user?.role === 'Investigator';
  const isSenior       = user?.role === 'Compliance_Officer';
  const isCEO          = user?.role === 'CEO';
  const isOwner        = Boolean(caseData && caseData.owner_id === myUserId);
  const canManageOwnRequest = ['Employee', 'Branch_Manager'].includes(user?.role) && isOwner && caseData?.submitted_by_type !== 'anonymous';
  const canViewEvidence = ['Investigator', 'Compliance_Officer'].includes(user?.role) || canManageOwnRequest;
  // Only Compliance_Officer / Team Lead can assign/reassign cases
  const canAssign      = isSenior;

  // Investigators can ONLY edit cases explicitly assigned to them (assigned_to = their userId)
  const isAssignedToMe = caseData ? (caseData.assigned_to === myUserId) : false;
  const canEditNow     = isSenior || (isInvestigator && isAssignedToMe) || canManageOwnRequest;

  const allowedStatusOptions = caseData
    ? [...new Set([caseData.status, ...(isSenior ? COMPLIANCE_OFFICER_STATUSES : INVESTIGATOR_STATUSES)])].filter(Boolean)
    : (isSenior ? COMPLIANCE_OFFICER_STATUSES : INVESTIGATOR_STATUSES);

  useEffect(() => {
    loadCase();
  }, [id]);

  const loadCase = async () => {
    setLoading(true);
    setError(null);
    try {
      // Case detail + notes in parallel
      const [cRes, nRes] = await Promise.all([
        api.get(`/cases/${id}`),
        api.get(`/cases/${id}/notes`),
      ]);

      const c = cRes.data.case;
      setCaseData(c);
      setNotes(nRes.data.notes || []);
      
      // Validate status is in allowed list for this user's role
      const allowedStatuses = isSenior ? COMPLIANCE_OFFICER_STATUSES : INVESTIGATOR_STATUSES;
      setNewStatus(c.status || allowedStatuses[0]);
      
      setNewPriority(c.priority || 'Medium');
      setRequestDescription(c.description || '');
      setRequestBranch(c.incident_location || '');
      setRequestSeverity(c.priority || 'Medium');
      setAssignTo(c.assigned_to?.toString() || '');

      // Evidence — only for privileged roles
      if (canViewEvidence) {
        try {
          const eRes = await api.get(`/cases/${id}/evidence`);
          setEvidence(eRes.data.evidence || []);
        } catch (_) {
          setEvidence([]);
        }
      }

      // Investigator list — only for those who can assign
      if (canAssign) {
        try {
          const uRes = await api.get('/users');
          const inv = (uRes.data.users || [])
            .filter(u => ['Investigator', 'Compliance_Officer'].includes(u.role))
            .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
          setInvestigators(inv);
        } catch (err) {
          console.warn('Failed to load investigators:', err.message);
          setInvestigators([]);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to load case';
      setError(msg);
      toast.error(msg);
    }
    setLoading(false);
  };

  const sendNote = async () => {
    if (!noteBody.trim()) return;
    setSendingNote(true);
    try {
      await api.post(`/cases/${id}/notes`, { body: noteBody, is_internal_only: isInternal });
      setNoteBody('');
      const res = await api.get(`/cases/${id}/notes`);
      setNotes(res.data.notes || []);
      toast.success('Note added');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send note');
    }
    setSendingNote(false);
  };

  const downloadEvidence = async (fileId, filename) => {
    try {
      const response = await api.get(`/cases/${id}/evidence/${fileId}/download`, {
        responseType: 'blob',
      });
      const mime = response.headers['content-type'] || response.headers['Content-Type'] || '';
      const blob = new Blob([response.data], { type: mime });
      const url = window.URL.createObjectURL(blob);

      // Preview inline for images, video, and PDFs; otherwise force download
      if (mime.startsWith('image/') || mime.startsWith('video/') || mime === 'application/pdf') {
        // Open in new tab for preview
        window.open(url, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Download failed');
      console.error('Download error:', err);
    }
  };

  const updateCase = async () => {
    setUpdating(true);
    try {
      const body = {};
      if (canManageOwnRequest) {
        body.description = requestDescription;
        body.branch_or_dept = requestBranch;
        body.severity_level = requestSeverity;
      } else {
        body.status = newStatus;
        body.priority = newPriority;
        if (assignTo) body.assigned_to = parseInt(assignTo, 10);
      }

      await api.patch(`/cases/${id}`, body);
      await loadCase();
      setEditMode(false);
      toast.success('Case updated successfully');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Update failed';
      toast.error(msg);
      console.error('Update failed:', err);
    }
    setUpdating(false);
  ;}

  const uploadEvidence = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingEvidence(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/cases/${id}/evidence`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadCase();
      toast.success('Additional evidence uploaded');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Evidence upload failed');
    } finally {
      setUploadingEvidence(false);
      event.target.value = '';
    }
  };

  const deleteCaseRequest = async () => {
    const justification = window.prompt('Please provide a justification for deleting this request (10+ characters):');
    if (!justification || justification.trim().length < 10) {
      toast.error('A justification of at least 10 characters is required.');
      return;
    }

    try {
      await api.delete(`/cases/${id}`, { data: { justification, requires_approval: false } });
      toast.success('Request deleted successfully');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  // ── Loading / Error states ────────────────────────────────
  if (user?.role === 'System_Admin') {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-20 fade-in-up">
        <div className="card p-8 border border-red-100 shadow-sm">
          <Lock size={48} className="mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Ethical Wall - Access Denied</h2>
          <p className="text-slate-500 text-sm mb-6">
            System Administrators are strictly prohibited from viewing case contents, notes, or evidence.
          </p>
          <button onClick={() => navigate(-1)} className="btn btn-primary">Go Back</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="spinner spinner-navy" />
          <p className="text-sm text-slate-400 mt-3">Loading case details...</p>
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="btn btn-ghost mb-6">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="card p-8 text-center">
          <AlertTriangle size={40} className="mx-auto mb-3 text-red-400" />
          <p className="text-lg font-semibold text-slate-700 mb-1">Failed to Load Case</p>
          <p className="text-sm text-slate-400 mb-4">{error || 'Case not found or access denied.'}</p>
          <button onClick={loadCase} className="btn btn-primary">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto fade-in-up">

      {/* Back */}
      <button onClick={() => navigate(-1)} className="btn btn-ghost mb-6 -ml-2">
        <ArrowLeft size={16} /> Back to Cases
      </button>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* ── Main column ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Case Header */}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  Reference Code
                </p>
                <h1 className="text-2xl font-mono font-bold tracking-widest"
                  style={{ color: 'var(--color-navy-900)' }}>
                  {caseData.reference_id}
                </h1>
              </div>
              <span className={`badge ${STATUS_BADGE[caseData.status] || 'badge-review'} text-sm`}>
                {caseData.status?.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                ['Category',      caseData.category?.replace(/_/g, ' ')],
                ['Priority',      caseData.priority],
                ['Submitted By',  caseData.submitted_by_type === 'anonymous' ? '🔒 Anonymous' : '👤 Staff'],
                ['Date Submitted',format(new Date(caseData.created_at), 'MMM d, yyyy HH:mm')],
                caseData.incident_location && ['Location', caseData.incident_location],
                ['Last Updated',  format(new Date(caseData.updated_at), 'MMM d, yyyy HH:mm')],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} className="p-3 rounded-lg" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                  <p className={`text-sm font-semibold ${label === 'Priority' ? PRIORITY_COLOR[value] : 'text-slate-700'}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Description — not shown to Branch Manager (low-priv) */}
            {caseData.description && (
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                  Report Description
                </p>

                {/* Responsive description: wrap long words, allow pre-formatted newlines, and limit height on small screens */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p
                    className={`text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words ${
                      showFullDescription ? 'max-h-[none]' : 'max-h-40'
                    } overflow-auto`}
                    style={{ wordBreak: 'break-word' }}
                  >
                    {caseData.description}
                  </p>

                  {/* Show more/less toggle for long descriptions */}
                  {String(caseData.description).length > 300 && (
                    <div className="mt-2 text-right">
                      <button
                        onClick={() => setShowFullDescription(s => !s)}
                        className="text-xs font-semibold text-navy-900 underline"
                      >
                        {showFullDescription ? 'Show less' : 'Show more'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Investigator restriction notice */}
            {isInvestigator && !isAssignedToMe && (
              <div className="mt-4 p-3 rounded-lg flex items-start gap-2 bg-amber-50 border border-amber-200">
                <Info size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  {caseData.assigned_to === null
                    ? 'This case is unassigned. A Compliance Officer must assign it to you before you can make changes.'
                    : 'This case belongs to another investigator. You can view it but cannot make changes.'}
                </p>
              </div>
            )}
          </div>

          {/* Correspondence */}
          <div className="card p-6">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>
              Correspondence & Notes
            </h2>

            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto pr-1">
              {notes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No notes yet.</p>
              ) : notes.map((n, i) => (
                <div key={n.id || i}
                  className={`p-4 rounded-xl ${n.author_type === 'Reporter' ? 'ml-6' : ''}`}
                  style={{
                    background: n.is_internal_only
                      ? 'rgba(139,92,246,0.06)'
                      : n.author_type === 'Investigator'
                      ? 'rgba(10,29,55,0.05)'
                      : 'rgba(249,168,38,0.07)',
                    border: '1px solid',
                    borderColor: n.is_internal_only
                      ? 'rgba(139,92,246,0.2)'
                      : n.author_type === 'Investigator'
                      ? 'rgba(10,29,55,0.1)'
                      : 'rgba(249,168,38,0.2)',
                  }}>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2">
                      {n.author_type === 'Investigator'
                        ? <User size={12} className="text-slate-400" />
                        : <Shield size={12} style={{ color: 'var(--color-gold-500)' }} />}
                      <span className="text-xs font-semibold text-slate-600">
                        {n.author_type === 'Investigator' ? 'Investigation Team' : 'Reporter'}
                      </span>
                      {n.is_internal_only === 1 && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(139,92,246,0.12)', color: '#7c3aed' }}>
                          <Lock size={9} className="inline mr-0.5" />Internal Only
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">
                      {format(new Date(n.created_at), 'MMM d, HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{n.body}</p>
                </div>
              ))}
            </div>

            {/* Add note — only for editors or own request owners */}
            {canEditNow && (
              <div className="border-t border-slate-100 pt-4">
                <textarea
                  className="form-textarea mb-3"
                  rows={3}
                  placeholder={isInvestigator
                    ? 'Add an internal note or send a message to the reporter...'
                    : 'Add a note...'}
                  value={noteBody}
                  onChange={e => setNoteBody(e.target.value)}
                />
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={e => setIsInternal(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Lock size={11} /> Internal note only (hidden from reporter)
                    </span>
                  </label>
                  <button
                    onClick={sendNote}
                    disabled={sendingNote || !noteBody.trim()}
                    className="btn btn-primary text-sm"
                  >
                    {sendingNote ? <span className="spinner" /> : <Send size={14} />}
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Case Actions */}
          {canEditNow && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
                  Case Actions
                </h3>
                <button
                  onClick={() => setEditMode(e => !e)}
                  className="btn btn-ghost text-xs py-1 px-2"
                >
                  <Edit3 size={12} /> {editMode ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {editMode ? (
                <div className="space-y-3">
                  {canManageOwnRequest ? (
                    <>
                      <div>
                        <label className="form-label text-xs">Description</label>
                        <textarea
                          className="form-textarea text-sm"
                          rows={4}
                          value={requestDescription}
                          onChange={e => setRequestDescription(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label text-xs">Branch / Department</label>
                        <input
                          type="text"
                          className="form-input text-sm"
                          value={requestBranch}
                          onChange={e => setRequestBranch(e.target.value)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="form-label text-xs">Status</label>
                        <select
                          className="form-select text-sm"
                          value={newStatus}
                          onChange={e => setNewStatus(e.target.value)}
                        >
                          {allowedStatusOptions.map(s => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="form-label text-xs">Severity / Priority</label>
                          <span className="text-xs text-slate-400">(Compliance Officer only)</span>
                        </div>
                        {isSenior ? (
                          <>
                            <select
                              className="form-select text-sm"
                              value={newPriority}
                              onChange={e => setNewPriority(e.target.value)}
                            >
                              {PRIORITIES.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                            {newPriority === 'Critical' && !caseData.is_escalated && (
                              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                <Zap size={12} /> Setting to Critical will escalate to CEO
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="text-sm font-semibold">{caseData.priority}</div>
                        )}
                      </div>
                      {canAssign && (
                        <div>
                          <label className="form-label text-xs">Assign To</label>
                          <select
                            className="form-select text-sm"
                            value={assignTo}
                            onChange={e => setAssignTo(e.target.value)}
                          >
                            <option value="">{caseData.assigned_investigator ? 'Reassign...' : 'Assign investigator'}</option>
                            {investigators.length > 0 ? investigators.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.username}
                              </option>
                            )) : (
                              <option disabled>No investigators</option>
                            )}
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    onClick={updateCase}
                    disabled={updating}
                    className="btn btn-gold w-full text-sm"
                  >
                    {updating ? <span className="spinner spinner-navy" /> : null}
                    Save Changes
                  </button>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {caseData.is_escalated && (
                    <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-md mb-2">
                      <Zap size={14} className="text-red-600" />
                      <span className="text-xs font-semibold text-red-700">Escalated to CEO</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Status</span>
                    <span className={`badge ${STATUS_BADGE[caseData.status] || 'badge-review'}`}>
                      {caseData.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Priority</span>
                    <span className={`font-semibold text-sm ${PRIORITY_COLOR[caseData.priority]}`}>
                      {caseData.priority}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Assigned To</span>
                    <span className="font-semibold text-slate-700 text-xs text-right">
                      {caseData.assigned_investigator || 'Unassigned'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {canManageOwnRequest && (
            <div className="card p-5">
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-navy-900)' }}>
                Manage Request
              </h3>
              <button onClick={deleteCaseRequest} className="btn btn-ghost w-full text-sm mb-3">
                Delete Request
              </button>
            </div>
          )}

          {/* Evidence */}
          {canViewEvidence && (
            <div className="card p-5">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2"
                style={{ color: 'var(--color-navy-900)' }}>
                <Paperclip size={14} /> Evidence Files ({evidence.length})
              </h3>
              {evidence.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">No evidence attached</p>
              ) : (
                <ul className="space-y-2">
                  {evidence.map(f => (
                    <li key={f.id}
                      className="flex items-center gap-2 p-2 rounded-lg"
                      style={{ background: 'var(--color-slate-50)' }}>
                      <FileText size={14} className="text-slate-400 flex-shrink-0" />
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-medium text-slate-700 truncate">
                          {f.original_filename}
                        </p>
                        <p className="text-xs text-slate-400">
                          {format(new Date(f.uploaded_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <a
                        onClick={() => downloadEvidence(f.id, f.original_filename)}
                        className="text-slate-400 hover:text-navy-900 transition-colors cursor-pointer"
                      >
                        <Download size={13} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="card p-5">
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-navy-900)' }}>
              Timeline
            </h3>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Created</span>
                <span className="font-medium">
                  {format(new Date(caseData.created_at), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last Updated</span>
                <span className="font-medium">
                  {format(new Date(caseData.updated_at), 'MMM d, yyyy HH:mm')}
                </span>
              </div>
            </div>
          </div>

          {/* Investigator restriction note */}
          {isInvestigator && (
            <div className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: 'rgba(6,15,30,0.04)', border: '1px solid rgba(6,15,30,0.1)' }}>
              <Shield size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-navy-900)' }} />
              <p className="text-xs text-slate-500 leading-relaxed">
                You cannot edit, delete, or alter original report content. All your actions are permanently logged.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
