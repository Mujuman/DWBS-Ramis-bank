import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  ArrowLeft, FileText, Lock, Send, User,
  Paperclip, Download, Edit3, Shield, AlertTriangle
} from 'lucide-react';

const STATUSES = ['New', 'Under_Review', 'Investigation_In_Progress', 'Awaiting_Response', 'Resolved', 'Closed', 'Escalated'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUS_BADGE = {
  New: 'badge-new', Under_Review: 'badge-review',
  Investigation_In_Progress: 'badge-progress', Awaiting_Response: 'badge-escalated',
  Resolved: 'badge-resolved', Closed: 'badge-closed', Escalated: 'badge-escalated',
};

export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [caseData, setCaseData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteBody, setNoteBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [users, setUsers] = useState([]);
  const [assignTo, setAssignTo] = useState('');
  const [updating, setUpdating] = useState(false);

  const canEdit = ['Investigator', 'Compliance_Officer', 'CEO', 'System_Admin'].includes(user?.role);
  const canViewEvidence = ['Investigator', 'Compliance_Officer', 'CEO', 'System_Admin'].includes(user?.role);

  useEffect(() => {
    const load = async () => {
      try {
        const [cRes, nRes] = await Promise.all([
          api.get(`/cases/${id}`),
          api.get(`/cases/${id}/notes`),
        ]);
        setCaseData(cRes.data.case);
        setNotes(nRes.data.notes);
        setNewStatus(cRes.data.case.status);
        setNewPriority(cRes.data.case.priority);

        if (canViewEvidence) {
          const eRes = await api.get(`/cases/${id}/evidence`);
          setEvidence(eRes.data.evidence);
        }
        if (canEdit) {
          const uRes = await api.get('/users');
          setUsers(uRes.data.users?.filter(u => ['Investigator', 'Compliance_Officer'].includes(u.role)) || []);
        }
      } catch (err) {
        toast.error('Failed to load case');
        navigate('/cases');
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const sendNote = async () => {
    if (!noteBody.trim()) return;
    setSendingNote(true);
    try {
      await api.post(`/cases/${id}/notes`, { body: noteBody, is_internal_only: isInternal });
      setNoteBody('');
      const res = await api.get(`/cases/${id}/notes`);
      setNotes(res.data.notes);
      toast.success('Note added');
    } catch (_) {
      toast.error('Failed to send note');
    }
    setSendingNote(false);
  };

  const updateCase = async () => {
    setUpdating(true);
    try {
      const body = {};
      if (newStatus !== caseData.status) body.status = newStatus;
      if (newPriority !== caseData.priority) body.priority = newPriority;
      if (assignTo) body.assigned_to = parseInt(assignTo);
      if (Object.keys(body).length === 0) { setEditMode(false); return; }
      await api.patch(`/cases/${id}/status`, body);
      const res = await api.get(`/cases/${id}`);
      setCaseData(res.data.case);
      setEditMode(false);
      toast.success('Case updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    }
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="spinner spinner-navy" />
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
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Case header */}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Reference Code</p>
                <h1 className="text-2xl font-mono font-bold tracking-widest" style={{ color: 'var(--color-navy-900)' }}>
                  {caseData.reference_id}
                </h1>
              </div>
              <span className={`badge ${STATUS_BADGE[caseData.status] || 'badge-review'} text-sm`}>
                {caseData.status?.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                ['Category', caseData.category?.replace(/_/g, ' ')],
                ['Priority', caseData.priority],
                ['Submitted By', caseData.submitted_by_type === 'anonymous' ? '🔒 Anonymous' : '👤 Staff'],
                ['Date Submitted', format(new Date(caseData.created_at), 'MMM d, yyyy HH:mm')],
                caseData.incident_date && ['Incident Date', format(new Date(caseData.incident_date), 'MMM d, yyyy')],
                caseData.incident_location && ['Location', caseData.incident_location],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} className="p-3 rounded-lg" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-slate-700">{value}</p>
                </div>
              ))}
            </div>

            {caseData.description && (
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 rounded-xl p-4">
                  {caseData.description}
                </p>
              </div>
            )}
          </div>

          {/* Correspondence thread */}
          <div className="card p-6">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>
              Correspondence
            </h2>

            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
              {notes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No correspondence yet.</p>
              ) : notes.map(n => (
                <div key={n.id}
                  className={`p-4 rounded-xl ${n.author_type === 'anonymous' ? 'ml-6' : ''}`}
                  style={{
                    background: n.is_internal_only
                      ? 'rgba(139,92,246,0.06)'
                      : n.author_type === 'staff'
                      ? 'rgba(10,29,55,0.05)'
                      : 'rgba(249,168,38,0.07)',
                    border: '1px solid',
                    borderColor: n.is_internal_only
                      ? 'rgba(139,92,246,0.2)'
                      : n.author_type === 'staff'
                      ? 'rgba(10,29,55,0.1)'
                      : 'rgba(249,168,38,0.2)',
                  }}>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2">
                      {n.author_type === 'staff'
                        ? <User size={12} className="text-slate-400" />
                        : <Shield size={12} style={{ color: 'var(--color-gold-500)' }} />}
                      <span className="text-xs font-semibold text-slate-600">
                        {n.author_name || (n.author_type === 'staff' ? 'Staff Member' : 'Reporter')}
                      </span>
                      {n.is_internal_only && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(139,92,246,0.12)', color: '#7c3aed' }}>
                          Internal Only
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

            {/* Add note */}
            {canEdit && (
              <div className="border-t border-slate-100 pt-4">
                <textarea
                  className="form-textarea mb-3"
                  rows={3}
                  placeholder="Add a note or reply to the reporter..."
                  value={noteBody}
                  onChange={e => setNoteBody(e.target.value)}
                />
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)}
                      className="w-4 h-4 rounded" />
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Lock size={11} /> Internal note only
                    </span>
                  </label>
                  <button onClick={sendNote} disabled={sendingNote || !noteBody.trim()}
                    className="btn btn-primary text-sm">
                    {sendingNote ? <span className="spinner" /> : <Send size={14} />}
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">

          {/* Actions */}
          {canEdit && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>Case Actions</h3>
                <button onClick={() => setEditMode(e => !e)} className="btn btn-ghost text-xs py-1 px-2">
                  <Edit3 size={12} /> {editMode ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {editMode ? (
                <div className="space-y-3">
                  <div>
                    <label className="form-label text-xs">Status</label>
                    <select className="form-select text-sm" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label text-xs">Priority</label>
                    <select className="form-select text-sm" value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label text-xs">Assign to Investigator</label>
                    <select className="form-select text-sm" value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                      <option value="">Keep current</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.display_name} ({u.role})</option>)}
                    </select>
                  </div>
                  <button onClick={updateCase} disabled={updating} className="btn btn-gold w-full text-sm">
                    {updating ? <span className="spinner spinner-navy" /> : null}
                    Save Changes
                  </button>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status</span>
                    <span className={`badge ${STATUS_BADGE[caseData.status]}`}>
                      {caseData.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Priority</span>
                    <span className="font-semibold text-slate-700">{caseData.priority}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Assigned To</span>
                    <span className="font-semibold text-slate-700 text-right text-xs">
                      {caseData.assigned_investigator || 'Unassigned'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Evidence */}
          {canViewEvidence && (
            <div className="card p-5">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-navy-900)' }}>
                <Paperclip size={14} /> Evidence Files ({evidence.length})
              </h3>
              {evidence.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">No evidence attached</p>
              ) : (
                <ul className="space-y-2">
                  {evidence.map(f => (
                    <li key={f.id} className="flex items-center gap-2 p-2 rounded-lg"
                      style={{ background: 'var(--color-slate-50)' }}>
                      <FileText size={14} className="text-slate-400 flex-shrink-0" />
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-medium text-slate-700 truncate">{f.original_filename}</p>
                        <p className="text-xs text-slate-400">
                          {(f.file_size_bytes / 1024).toFixed(0)} KB
                          {f.exif_stripped ? ' • EXIF stripped' : ''}
                        </p>
                      </div>
                      <a href={`/api/cases/${id}/evidence/${f.id}/download`}
                        className="text-slate-400 hover:text-navy-900 transition-colors">
                        <Download size={13} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Case meta */}
          <div className="card p-5">
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-navy-900)' }}>Timeline</h3>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Created</span>
                <span className="font-medium">{format(new Date(caseData.created_at), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Updated</span>
                <span className="font-medium">{format(new Date(caseData.updated_at), 'MMM d, yyyy HH:mm')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
