import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  ArrowLeft, FileText, Lock, Send, User,
  Paperclip, Download, Shield, AlertTriangle, Zap, Upload,
  Trash2, Check, XCircle, Edit3
} from 'lucide-react';
import { renderRichText } from '../utils/formatting';

import {
  COMPLIANCE_OFFICER_STATUSES,
  CEO_STATUSES,
  STATUS_BADGE,
  formatStatus,
  getNextStatusesForRole,
} from '../constants/caseWorkflow';

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

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
  const [notesError,  setNotesError]  = useState(null);
  const [evidence,    setEvidence]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [noteBody,    setNoteBody]    = useState('');
  const [replyRecipient, setReplyRecipient] = useState('Compliance_Officer');
  const [requestDescription, setRequestDescription] = useState('');
  const requestDescriptionRef = useRef(null);
  const noteRef = useRef(null);
  // Records the moment this case detail page was opened — notes older than this
  // are hidden for staff chat roles (CEO, Compliance_Officer), Compliance_Officer).
  const sessionStartRef = useRef(new Date());
  

  const formatText = (text, action) => {
    const original = text || '';
    const trimmed = original.trim();
    switch (action) {
      case 'bold':
        return trimmed ? `**${trimmed}**` : '**bold text**';
      case 'italic':
        return trimmed ? `_${trimmed}_` : '_italic text_';
      case 'underline':
        return trimmed ? `<u>${trimmed}</u>` : '<u>underlined text</u>';
      case 'strikethrough':
        return trimmed ? `~~${trimmed}~~` : '~~strikethrough text~~';
      case 'code':
        if (trimmed.includes('\n')) {
          return '```\n' + trimmed + '\n```';
        }
        return '`' + (trimmed || 'code') + '`';
      case 'heading': {
        const lines = (trimmed || 'Heading text').split('\n');
        return lines.map((line) => (line.startsWith('# ') ? line : `# ${line}`)).join('\n');
      }
      case 'list': {
        const lines = (trimmed || 'List item').split('\n');
        return lines.map((line) => line.replace(/^([-*+]\s*)?/, '- ')).join('\n');
      }
      case 'type': {
        let result = trimmed;
        result = result.replace(/^\*\*(.*)\*\*$/s, '$1');
        result = result.replace(/^_(.*)_$/s, '$1');
        result = result.replace(/^~~(.*)~~$/s, '$1');
        result = result.replace(/^<u>(.*)<\/u>$/s, '$1');
        result = result.replace(/^`(.*)`$/s, '$1');
        return result || 'plain text';
      }
      default:
        return trimmed || 'text';
    }
  };

  const updateRequestDescriptionHtml = () => {
    const html = requestDescriptionRef.current?.innerHTML || '';
    setRequestDescription(html);
  };

  const applyFormatting = (action) => {
    const editor = requestDescriptionRef.current;
    if (!editor) return;
    editor.focus();

    switch (action) {
      case 'bold':
        document.execCommand('bold');
        break;
      case 'italic':
        document.execCommand('italic');
        break;
      case 'underline':
        document.execCommand('underline');
        break;
      case 'strikethrough':
        document.execCommand('strikeThrough');
        break;
      case 'code': {
        const selection = document.getSelection();
        const selectedText = selection?.toString() || 'code';
        document.execCommand('insertHTML', false, `<code>${selectedText}</code>`);
        break;
      }
      case 'heading':
        document.execCommand('formatBlock', false, 'H3');
        break;
      case 'list':
        document.execCommand('insertUnorderedList');
        break;
      case 'type':
        document.execCommand('removeFormat');
        break;
      default:
        break;
    }

    updateRequestDescriptionHtml();
  };

  const execFormatting = (ref, action) => {
    const editor = ref?.current;
    if (!editor) return;
    editor.focus();

    switch (action) {
      case 'bold':
        document.execCommand('bold');
        break;
      case 'italic':
        document.execCommand('italic');
        break;
      case 'underline':
        document.execCommand('underline');
        break;
      case 'strikethrough':
        document.execCommand('strikeThrough');
        break;
      case 'code': {
        const selection = document.getSelection();
        const selectedText = selection?.toString() || 'code';
        document.execCommand('insertHTML', false, `<code>${selectedText}</code>`);
        break;
      }
      case 'heading':
        document.execCommand('formatBlock', false, 'H3');
        break;
      case 'list':
        document.execCommand('insertUnorderedList');
        break;
      case 'type':
        document.execCommand('removeFormat');
        break;
      default:
        break;
    }

    if (ref === requestDescriptionRef) updateRequestDescriptionHtml();
  };
  

  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isInternal,  setIsInternal]  = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [editMode,    setEditMode]    = useState(false);
  const [newStatus,   setNewStatus]   = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [requestBranch, setRequestBranch] = useState('');
  const [requestSeverity, setRequestSeverity] = useState('Medium');
  const [handlers,    setHandlers]    = useState([]);
  const [assignTo,    setAssignTo]    = useState('');
  const [updating,    setUpdating]    = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // ── Note edit / delete state ────────────────────────────────
  const [editingNoteId,   setEditingNoteId]   = useState(null);
  const [editingNoteBody, setEditingNoteBody] = useState('');
  const [savingNote,      setSavingNote]      = useState(false);
  const [deletingNoteId,  setDeletingNoteId]  = useState(null);

  // ── Per-spec permission flags ───────────────────────────────
  const myUserId       = user?.userId ?? user?.id;
  const isSenior       = user?.role === 'Compliance_Officer';
  const isCEO          = user?.role === 'CEO';
  const isOwner        = Boolean(caseData && caseData.owner_id === myUserId);
  const canManageOwnRequest = ['Employee', 'Branch_Manager'].includes(user?.role) && isOwner && caseData?.submitted_by_type !== 'anonymous';
  const canViewEvidence = ['Compliance_Officer', 'CEO'].includes(user?.role) || canManageOwnRequest;
  const canAssign      = isSenior || (isCEO && Boolean(caseData?.is_escalated));
  const canEditNow     = isSenior || canManageOwnRequest || (isCEO && Boolean(caseData?.is_escalated));
  const canSendNote    = isSenior || canManageOwnRequest;  // CEO cannot send notes/chat
  const role = isSenior ? 'Compliance_Officer' : isCEO ? 'CEO' : 'Compliance_Officer';

  const getNoteAuthorLabel = (note) => {
    if (note.author_type === 'Compliance_Officer') return 'Ethics & Anti-Corruption Office';
    if (note.author_type === 'CEO') return 'CEO';
    if (note.author_type === 'Reporter') {
      return caseData?.submitted_by_type === 'anonymous' ? 'Anonymous Reporter' : 'Staff Reporter';
    }
    return 'Reporter';
  };

  const getNoteChannelLabel = (note) => {
    if (note.audience_type === 'CEO') {
      return note.author_type === 'Compliance_Officer' ? 'To: CEO' : 'CEO Thread';
    }
    if (note.audience_type === 'Compliance_Officer') {
      return 'Ethics & Anti-Corruption Thread';
    }
    if (note.audience_type === 'Reporter') {
      return 'To: Reporter';
    }
    return 'General Thread';
  };

  const getNoteTone = (note) => {
    if (note.is_internal_only) {
      return {
        background: 'rgba(139,92,246,0.06)',
        borderColor: 'rgba(139,92,246,0.2)',
        labelColor: '#7c3aed',
        icon: 'internal',
      };
    }
    if (note.author_type === 'Compliance_Officer') {
      return {
        background: 'rgba(37,99,235,0.06)',
        borderColor: 'rgba(37,99,235,0.18)',
        labelColor: '#1d4ed8',
        icon: 'staff',
      };
    }
    if (note.author_type === 'CEO') {
      return {
        background: 'rgba(10,29,55,0.05)',
        borderColor: 'rgba(10,29,55,0.1)',
        labelColor: 'var(--color-navy-900)',
        icon: 'staff',
      };
    }
    return {
      background: 'rgba(249,168,38,0.07)',
      borderColor: 'rgba(249,168,38,0.2)',
      labelColor: 'var(--color-gold-700)',
      icon: 'reporter',
    };
  };

  useEffect(() => {
    loadCase();
  }, [id]);

  const loadCase = async () => {
    setLoading(true);
    setError(null);
    setNotesError(null);
    try {
      const cRes = await api.get(`/cases/${id}`);
      const c = cRes.data.case;
      setCaseData(c);

      try {
        const nRes = await api.get(`/cases/${id}/notes`);
        const isStaffReporter = ['Employee', 'Branch_Manager'].includes(user?.role);
        const isPrivilegedStaff = ['CEO', 'Compliance_Officer'].includes(user?.role);
        const allNotes = nRes.data.notes || [];
        const sessionStart = sessionStartRef.current;

        setNotes(isStaffReporter
          ? allNotes.filter(n =>
              n.audience_type === 'Reporter' ||
              n.audience_type === 'General' ||
              n.author_type === 'Reporter'
            )
          : isPrivilegedStaff
          // Staff chat roles only see messages sent during this session (hide old history)
          ? allNotes.filter(n => new Date(n.created_at) > sessionStart)
          : allNotes
        );
      } catch (err) {
        setNotes([]);
        setNotesError(err.response?.data?.error || 'Failed to fetch notes');
      }

      // Validate status is in allowed list for this user's role
      const allowedStatuses = getNextStatusesForRole(
        isSenior ? 'Compliance_Officer' : isCEO ? 'CEO' : 'Compliance_Officer',
        c.status
      );
      // Set newStatus to empty so dropdown shows current status
      setNewStatus('');
      
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

      // Handler list — only for those who can assign
      if (canAssign) {
        try {
          const uRes = await api.get('/users');
          const inv = (uRes.data.users || [])
            .filter(u => u.role === 'Compliance_Officer')
            .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
          setHandlers(inv);
        } catch (err) {
          console.warn('Failed to load compliance staff:', err.message);
          setHandlers([]);
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
      // Determine recipient_role for every role:
      // - CEO always messages Ethics (Compliance_Officer)
      // - Staff reporter (Employee/Branch_Manager) uses the replyRecipient picker
      // - Investigator: if internal, use replyRecipient; if public, send to Reporter
      // - Ethics (Compliance_Officer): if internal, use replyRecipient; if public, send to Reporter
      let recipientRole;
      if (isCEO) {
        recipientRole = 'Compliance_Officer';
      } else if (canManageOwnRequest) {
        recipientRole = replyRecipient;
      } else if (isSenior) {
        recipientRole = isInternal ? replyRecipient : 'Reporter';
      } else {
        recipientRole = replyRecipient;
      }

      await api.post(`/cases/${id}/notes`, {
        body: noteBody,
        is_internal_only: isInternal,
        recipient_role: recipientRole,
      });
      setNoteBody('');
      setIsInternal(false);
      if (noteRef.current) noteRef.current.innerHTML = '';
      const res = await api.get(`/cases/${id}/notes`);
      const isStaffReporter = ['Employee', 'Branch_Manager'].includes(user?.role);
      const isPrivilegedStaff = ['CEO', 'Investigator', 'Compliance_Officer'].includes(user?.role);
      const allNotes = res.data.notes || [];
      const sessionStart = sessionStartRef.current;
      setNotes(isStaffReporter
        ? allNotes.filter(n =>
            n.audience_type === 'Reporter' ||
            n.audience_type === 'General' ||
            n.author_type === 'Reporter'
          )
        : isPrivilegedStaff
        ? allNotes.filter(n => new Date(n.created_at) > sessionStart)
        : allNotes
      );
      toast.success('Note added');
    } catch (err) {
      const details = err.response?.data?.details;
      const message = err.response?.data?.error || (Array.isArray(details) ? details.map(d => d.message).join('; ') : null) || 'Failed to send note';
      toast.error(message);
      console.error('Note send failed:', err);
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

      // If the server returned JSON (error payload) as a blob, parse and display the error
      if (mime.includes('application/json')) {
        try {
          const text = await blob.text();
          const parsed = JSON.parse(text);
          toast.error(parsed.error || 'Download failed');
          return;
        } catch (_) {
          toast.error('Download failed');
          return;
        }
      }
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
    if (!newStatus || !newStatus.trim()) {
      toast.error('Please select a status to update.');
      return;
    }

    if (newStatus === caseData?.status) {
      toast.error('Status is already set to this value.');
      return;
    }

    setUpdating(true);
    console.log('Updating case status to:', newStatus);
    
    try {
      await api.patch(`/cases/${id}/status`, { status: newStatus });
      toast.success('Case status updated successfully');
      
      // Reload case data
      await loadCase();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to update status';
      console.error('Update error:', err.response?.data || err);
      toast.error(errorMsg);
    } finally {
      setUpdating(false);
    }
  };

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

  // ── Note edit / delete handlers ─────────────────────────────
  const startEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditingNoteBody(note.body);
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteBody('');
  };

  const saveEditNote = async (noteId) => {
    if (!editingNoteBody.trim()) return;
    setSavingNote(true);
    try {
      await api.patch(`/cases/${id}/notes/${noteId}`, { body: editingNoteBody.trim() });
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, body: editingNoteBody.trim() } : n));
      setEditingNoteId(null);
      setEditingNoteBody('');
      toast.success('Message updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update message');
    }
    setSavingNote(false);
  };

  const deleteNote = async (noteId) => {
    if (!window.confirm('Delete this message? This cannot be undone.')) return;
    setDeletingNoteId(noteId);
    try {
      await api.delete(`/cases/${id}/notes/${noteId}`);
      setNotes(prev => prev.filter(n => n.id !== noteId));
      toast.success('Message deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete message');
    }
    setDeletingNoteId(null);
  };

  const deleteCaseRequest = async () => {    const justification = window.prompt('Please provide a justification for deleting this request (10+ characters):');
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
                {formatStatus(caseData.status)}
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
                  <div
                    className={`text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words ${
                      showFullDescription ? 'max-h-[none]' : 'max-h-40'
                    } overflow-auto`}
                    style={{ wordBreak: 'break-word' }}
                    dangerouslySetInnerHTML={{ __html: renderRichText(caseData.description) }}
                  />

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
          </div>

          {/* Correspondence */}
          <div className="card p-6">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>
              Correspondence & Notes
            </h2>
 
            {notesError && (
              <div className="rounded-xl p-4 mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200">
                {notesError}
              </div>
            )}
 
            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto pr-1">
              {notes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No notes yet.</p>
              ) : notes.map((n, i) => {
                const tone = getNoteTone(n);
                const isMyNote = (isSenior || isCEO) && n.sender_user_id === myUserId;
                const isEditing = editingNoteId === n.id;
                return (
                <div key={n.id || i}
                  className={`p-4 rounded-xl ${n.author_type === 'Reporter' ? 'ml-6' : ''}`}
                  style={{
                    background: tone.background,
                    border: '1px solid',
                    borderColor: tone.borderColor,
                  }}>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {tone.icon === 'staff'
                        ? <User size={12} className="text-slate-400" />
                        : <Shield size={12} style={{ color: 'var(--color-gold-500)' }} />}
                      <span className="text-xs font-semibold" style={{ color: tone.labelColor }}>
                        {getNoteAuthorLabel(n)}
                      </span>
                      {n.audience_type && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-500">
                          {getNoteChannelLabel(n)}
                        </span>
                      )}
                      {n.is_internal_only === 1 && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(139,92,246,0.12)', color: '#7c3aed' }}>
                          <Lock size={9} className="inline mr-0.5" />Internal Only
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs text-slate-400">
                        {format(new Date(n.created_at), 'MMM d, HH:mm')}
                      </span>
                      {/* Edit / Delete — only for own messages */}
                      {isMyNote && !isEditing && (
                        <>
                          <button
                            onClick={() => startEditNote(n)}
                            className="ml-1 p-1 rounded hover:bg-slate-200 transition-colors"
                            title="Edit message">
                            <Edit3 size={11} className="text-slate-400" />
                          </button>
                          <button
                            onClick={() => deleteNote(n.id)}
                            disabled={deletingNoteId === n.id}
                            className="p-1 rounded hover:bg-red-100 transition-colors"
                            title="Delete message">
                            {deletingNoteId === n.id
                              ? <span className="spinner" style={{ width: 11, height: 11 }} />
                              : <Trash2 size={11} className="text-slate-400 hover:text-red-500" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="mt-1 space-y-2">
                      <textarea
                        className="form-textarea text-sm w-full"
                        rows={3}
                        value={editingNoteBody}
                        onChange={e => setEditingNoteBody(e.target.value)}
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={cancelEditNote} className="btn btn-ghost text-xs py-1 px-2">
                          <XCircle size={12} /> Cancel
                        </button>
                        <button
                          onClick={() => saveEditNote(n.id)}
                          disabled={savingNote || !editingNoteBody.trim()}
                          className="btn btn-primary text-xs py-1 px-2">
                          {savingNote ? <span className="spinner" /> : <Check size={12} />} Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderRichText(n.body) }} />
                  )}
                </div>
                );
              })}
            </div>

            {/* Add note — for editors, CEO on escalated cases, or own request owners */}
            {canSendNote && (
              <div className="border-t border-slate-100 pt-4">
                <textarea
                  className="form-textarea mb-3"
                  rows={3}
                  placeholder={isSenior
                    ? 'Add a note or send a message to the reporter...'
                    : 'Add a note...'}
                  value={noteBody}
                  onChange={e => setNoteBody(e.target.value)}
                />

                {/* ── Staff reporter: always show recipient picker ── */}
                {canManageOwnRequest && (
                  <div className="mb-3">
                    <label className="form-label text-xs">Send To</label>
                    <select
                      className="form-select text-sm"
                      value={replyRecipient}
                      onChange={e => setReplyRecipient(e.target.value)}
                    >
                      <option value="Investigator">Case Investigator</option>
                      <option value="Compliance_Officer">Ethics & Anti-Corruption Office</option>
                    </select>
                  </div>
                )}

                {/* ── CEO: fixed recipient notice ── */}
                {isCEO && (
                  <div className="mb-3 rounded-lg px-3 py-2 text-xs text-slate-500"
                    style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}>
                    💬 This message will be sent to the <strong>Ethics & Anti-Corruption Office</strong>.
                  </div>
                )}

                {/* ── Ethics (Compliance_Officer): recipient depends on internal flag ── */}
                {isSenior && (
                  <div className="mb-3">
                    <label className="form-label text-xs">
                      {isInternal ? 'Internal Note Recipient' : 'Sending public message to'}
                    </label>
                    {isInternal ? (
                      <select
                        className="form-select text-sm"
                        value={replyRecipient}
                        onChange={e => setReplyRecipient(e.target.value)}
                      >
                        <option value="General">General / All Staff</option>
                        <option value="Investigator">Case Investigator</option>
                        <option value="CEO">CEO</option>
                      </select>
                    ) : (
                      <div className="rounded-lg px-3 py-2 text-xs text-slate-500"
                        style={{ background: 'rgba(249,168,38,0.06)', border: '1px solid rgba(249,168,38,0.18)' }}>
                        Reporter (public — visible to the case submitter)
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={e => {
                        setIsInternal(e.target.checked);
                        if (!e.target.checked) {
                          setReplyRecipient('Investigator');
                        } else {
                          setReplyRecipient('General');
                        }
                      }}
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

          {/* Case Info */}
          {(isSenior || isCEO) && (
            <div className="card p-5">
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-navy-900)' }}>
                Case Management
              </h3>
              <div className="space-y-3 text-sm">
                {/* Status display and update for EAAC */}
                {isSenior && caseData && (
                  <div>
                    <label className="form-label text-xs font-semibold mb-1 block">Case Status</label>
                    <select
                      className="form-select text-sm w-full"
                      value={newStatus}
                      onChange={(e) => {
                        console.log('Status changed to:', e.target.value);
                        setNewStatus(e.target.value);
                      }}
                      disabled={updating}
                    >
                      <option value="">-- Select New Status --</option>
                      <option value="New">New</option>
                      <option value="Under_Review">Analyse the Complaint</option>
                      <option value="Investigating">Gather Facts and Analyze Evidence</option>
                      <option value="Pending_Evidence">Pending Evidence</option>
                      <option value="Substantiated">Substantiated (በማስረጃ የተረጋገጠ)</option>
                      <option value="Dismissed_No_Evidence">Dismissed due to Lack of Evidence</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Current: <span className="font-semibold">{caseData.status ? formatStatus(caseData.status) : 'Not Set'}</span>
                    </p>
                  </div>
                )}

                {/* CEO view - read only */}
                {isCEO && (
                  <>
                    {caseData.is_escalated && (
                      <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-md mb-2">
                        <Zap size={14} className="text-red-600" />
                        <span className="text-xs font-semibold text-red-700">Escalated to CEO</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Status</span>
                      <span className={`badge ${STATUS_BADGE[caseData.status] || 'badge-review'}`}>
                        {formatStatus(caseData.status)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Priority</span>
                      <span className={`font-semibold text-sm ${PRIORITY_COLOR[caseData.priority]}`}>
                        {caseData.priority}
                      </span>
                    </div>
                  </>
                )}

                {/* Update button for EAAC */}
                {isSenior && (
                  <button
                    onClick={updateCase}
                    disabled={updating}
                    className="btn btn-primary w-full text-sm mt-2"
                  >
                    {updating ? <><span className="spinner" /> Updating...</> : 'Update Status'}
                  </button>
                )}
              </div>
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
              {(canManageOwnRequest || isSenior) && (
                <label className="btn btn-outline w-full text-xs mb-3 cursor-pointer">
                  {uploadingEvidence ? <span className="spinner" /> : <Upload size={13} />}
                  {uploadingEvidence ? 'Uploading...' : 'Add Evidence'}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploadingEvidence}
                    onChange={uploadEvidence}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  />
                </label>
              )}
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

        </div>
      </div>
    </div>
  );
}
