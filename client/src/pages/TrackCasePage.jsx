import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import api from '../services/api';
import { Search, Clock, CheckCircle, AlertTriangle, MessageSquare, Edit3, Trash2, X, Upload, FileText, Type, Bold, Italic, Underline, Heading, List, Code, Strikethrough } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { STATUS_BADGE, formatStatus } from '../constants/caseWorkflow';
import { renderRichText } from '../utils/formatting';

const STATUS_LABELS = {
  New: { label: 'New', class: STATUS_BADGE.New },
  Under_Review: { label: 'Analyse the Complaint', class: STATUS_BADGE.Under_Review },
  Assigned: { label: 'Refer to A&RC / Assign to Case Investigator', class: STATUS_BADGE.Assigned },
  Investigating: { label: 'Investigation in Progress', class: STATUS_BADGE.Investigating },
  Pending_Evidence: { label: 'Pending Evidence', class: STATUS_BADGE.Pending_Evidence },
  Substantiated: { label: 'Substantiated', class: STATUS_BADGE.Substantiated },
  Complaint_Dismissed: { label: 'Complaint Dismissed', class: STATUS_BADGE.Complaint_Dismissed },
  Dismissed_No_Evidence: { label: 'Dismissed due to Lack of Evidence', class: STATUS_BADGE.Dismissed_No_Evidence },
};

const PRIORITY_LABELS = {
  Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high', Critical: 'badge-critical'
};

export default function TrackCasePage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { register, handleSubmit, formState: { errors } } = useForm();

  // Edit and Delete Modals states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form states for Edit
  const [editToken, setEditToken] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Form states for Delete
  const [deleteToken, setDeleteToken] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form states for anonymous reply
  const [replyToken, setReplyToken] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replyRecipient, setReplyRecipient] = useState('Investigator');
  const [replyLoading, setReplyLoading] = useState(false);
  
  const [evidenceToken, setEvidenceToken] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const editDescriptionRef = useRef(null);

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
        return trimmed.includes('\n')
          ? `\`\`\`\n${trimmed}\n\`\`\``
          : `\`${trimmed || 'code'}\``;
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

  const updateEditDescriptionHtml = () => {
    const html = editDescriptionRef.current?.innerHTML || '';
    setEditDescription(html);
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

    // Update the corresponding state value
    if (ref === editDescriptionRef) updateEditDescriptionHtml();
  };

  const getCorrespondenceLabel = (note) => {
    if (note.author_label) return note.author_label;
    if (note.sender_role === 'Compliance_Officer') return 'Ethics & Anticorruption Officer';
    if (note.sender_role === 'Investigator') return 'Case Investigator';
    return 'You (Anonymous Reporter)';
  };

  const getCorrespondenceTone = (note) => {
    if (note.sender_role === 'Compliance_Officer') {
      return {
        background: 'rgba(37,99,235,0.06)',
        borderColor: 'rgba(37,99,235,0.18)',
        labelColor: '#1d4ed8',
      };
    }
    if (note.author_type === 'staff') {
      return {
        background: 'rgba(10,29,55,0.05)',
        borderColor: 'rgba(10,29,55,0.1)',
        labelColor: 'var(--color-navy-900)',
      };
    }
    return {
      background: 'rgba(249,168,38,0.08)',
      borderColor: 'rgba(249,168,38,0.2)',
      labelColor: 'var(--color-gold-700)',
    };
  };

  const onSearch = async ({ reference_id }) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.get('/cases/track', { params: { reference_id: reference_id.toUpperCase().trim() } });
      setResult(res.data);
      setEvidence([]);
      setEvidenceFile(null);
      const hasInvestigatorMessage = res.data.correspondence?.some(note => note.sender_role === 'Investigator');
      const hasComplianceMessage = res.data.correspondence?.some(note => note.sender_role === 'Compliance_Officer');
      setReplyRecipient(hasInvestigatorMessage ? 'Investigator' : hasComplianceMessage ? 'Compliance_Officer' : 'Investigator');
      setEditCategory(res.data.case.category);
      setEditDescription(res.data.case.description || '');
      setEditLocation(res.data.case.branch_or_dept || '');
    } catch (err) {
      setError(err.response?.data?.error || 'No case found with that reference ID');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editToken) {
      toast.error('Verification token is required');
      return;
    }
    if (editDescription && editDescription.length < 20) {
      toast.error('Description must be at least 20 characters');
      return;
    }
    setEditLoading(true);
    try {
      await api.patch('/cases/anonymous', {
        reference_id: result.case.reference_id,
        verification_token: editToken.trim(),
        category: editCategory,
        description: editDescription || undefined,
        branch_or_dept: editLocation || undefined,
      });
      toast.success('Report updated successfully!');
      setIsEditModalOpen(false);
      
      // Refresh tracked case info
      const res = await api.get('/cases/track', { params: { reference_id: result.case.reference_id } });
      setResult(res.data);
      // Reset form input values
      setEditToken('');
      setEditDescription('');
      setEditLocation('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update case. Please check your token.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    if (!deleteToken) {
      toast.error('Verification token is required');
      return;
    }
    setDeleteLoading(true);
    try {
      await api.delete('/cases/anonymous', {
        data: {
          reference_id: result.case.reference_id,
          verification_token: deleteToken.trim(),
        }
      });
      toast.success('Report deleted successfully.');
      setIsDeleteModalOpen(false);
      setResult(null); // Clear result since it's deleted
      setDeleteToken('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete case. Please check your token.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyToken) {
      toast.error('Verification token is required to send your response');
      return;
    }
    if (!replyBody || replyBody.length < 5) {
      toast.error('Please enter a response of at least 5 characters');
      return;
    }
    setReplyLoading(true);

    try {
      await api.post('/cases/anonymous/notes', {
        reference_id: result.case.reference_id,
        verification_token: replyToken.trim(),
        recipient_role: replyRecipient,
        body: replyBody,
      });
      toast.success('Your reply has been submitted.');
      setReplyBody('');
      setReplyToken('');
      const res = await api.get('/cases/track', { params: { reference_id: result.case.reference_id } });
      setResult(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send response. Please check your token.');
    } finally {
      setReplyLoading(false);
    }
  };

  const availableReplyRecipients = result?.correspondence?.reduce((roles, note) => {
    if (note.sender_role === 'Investigator' && !roles.includes('Investigator')) roles.push('Investigator');
    if (note.sender_role === 'Compliance_Officer' && !roles.includes('Compliance_Officer')) roles.push('Compliance_Officer');
    return roles;
  }, []) || [];

  const loadAnonymousEvidence = async (token = evidenceToken) => {
    if (!token) {
      toast.error('Verification token is required');
      return;
    }
    setEvidenceLoading(true);
    try {
      const res = await api.get('/cases/anonymous/evidence', {
        params: {
          reference_id: result.case.reference_id,
          verification_token: token.trim(),
        },
      });
      setEvidence(res.data.evidence || []);
      toast.success('Evidence list updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load evidence');
    } finally {
      setEvidenceLoading(false);
    }
  };

  const deleteAnonymousEvidence = async (fileId) => {
    if (!evidenceToken) {
      toast.error('Verification token is required to delete evidence');
      return;
    }
    setEvidenceLoading(true);
    try {
      await api.delete(`/cases/anonymous/evidence/${fileId}`, {
        data: {
          reference_id: result.case.reference_id,
          verification_token: evidenceToken.trim(),
        },
      });
      toast.success('Evidence deleted successfully');
      await loadAnonymousEvidence(evidenceToken);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete evidence');
    } finally {
      setEvidenceLoading(false);
    }
  };

  const handleAnonymousEvidenceSubmit = async (e) => {
    e.preventDefault();
    if (!evidenceToken) {
      toast.error('Verification token is required');
      return;
    }
    if (!evidenceFile) {
      toast.error('Choose an evidence file to upload');
      return;
    }
    setEvidenceLoading(true);
    try {
      const formData = new FormData();
      formData.append('reference_id', result.case.reference_id);
      formData.append('verification_token', evidenceToken.trim());
      formData.append('file', evidenceFile);
      await api.post('/cases/anonymous/evidence', formData);
      toast.success('Evidence uploaded');
      setEvidenceFile(null);
      await loadAnonymousEvidence(evidenceToken);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Evidence upload failed');
    } finally {
      setEvidenceLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-16 pb-12" style={{ background: 'var(--color-slate-50)' }}>
      <div className="max-w-2xl mx-auto px-4 pt-12">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'var(--color-navy-900)' }}>
            <Search size={28} style={{ color: 'var(--color-gold-500)' }} />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-navy-900)' }}>
            Track Your Report
          </h1>
          <p className="text-slate-500">Enter your reference code to check the status of your report.</p>
        </div>

        {/* Search Form */}
        <div className="card p-6 mb-6">
          <form onSubmit={handleSubmit(onSearch)}>
            <label className="form-label">Reference Code</label>
            <div className="flex gap-3">
              <input
                type="text"
                className="form-input font-mono text-lg tracking-widest uppercase"
                placeholder="e.g. AB3C5D7EFG2H"
                maxLength={12}
                style={{ letterSpacing: '0.15em' }}
                {...register('reference_id', {
                  required: 'Please enter your reference code',
                  pattern: { value: /^[A-Z2-9]{12}$/i, message: 'Invalid reference code format (12 characters)' },
                })}
              />
              <button type="submit" disabled={loading} className="btn btn-primary px-6 flex-shrink-0">
                {loading ? <span className="spinner" /> : <Search size={18} />}
              </button>
            </div>
            {errors.reference_id && <p className="form-error mt-1">{errors.reference_id.message}</p>}
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl p-4 mb-6 flex items-center gap-3"
            style={{ background: 'var(--color-danger-100)', border: '1px solid #fca5a5' }}>
            <AlertTriangle size={18} style={{ color: 'var(--color-danger-500)', flexShrink: 0 }} />
            <p className="text-sm" style={{ color: 'var(--color-danger-500)' }}>{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 fade-in-up">
            {/* Case Info */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Reference Code</p>
                  <p className="text-xl font-mono font-bold" style={{ color: 'var(--color-navy-900)', letterSpacing: '0.1em' }}>
                    {result.case.reference_id}
                  </p>
                </div>
                <span className={`badge ${STATUS_BADGE[result.case.status] || 'badge-review'}`}>
                  {formatStatus(result.case.status)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs text-slate-400 mb-1">Category</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {result.case.category?.replace(/_/g, ' ')}
                  </p>
                </div>

                <div className="p-3 rounded-lg" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs text-slate-400 mb-1">Submitted</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {format(new Date(result.case.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs text-slate-400 mb-1">Branch / Department</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {result.case.branch_or_dept || 'General'}
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs text-slate-400 mb-1">Last Updated</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {format(new Date(result.case.updated_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              {result.case.description && (
                <div className="mt-6 p-4 rounded-xl" style={{ background: 'var(--color-slate-50)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Current Description</p>
                  <div
                    className="text-sm text-slate-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderRichText(result.case.description) }}
                  />
                </div>
              )}
              <div className="border-t border-slate-100 mt-6 pt-4 flex gap-3 justify-end">
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="btn btn-secondary px-4 py-2 flex items-center gap-1.5 text-sm"
                >
                  <Edit3 size={14} /> Edit Report
                </button>
                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="btn btn-danger-outline px-4 py-2 flex items-center gap-1.5 text-sm"
                  style={{ borderColor: 'var(--color-danger-500)', color: 'var(--color-danger-500)', border: '1px solid', borderRadius: 'var(--radius-lg)' }}
                >
                  <Trash2 size={14} /> Delete Report
                </button>
              </div>
            </div>

            {/* Evidence Management */}
            <div className="card p-6">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-navy-900)' }}>
                <Upload size={16} /> Evidence
              </h3>
              <form onSubmit={handleAnonymousEvidenceSubmit} className="space-y-4">
                <div>
                  <label className="form-label font-semibold">Verification Token</label>
                  <input
                    type="text"
                    value={evidenceToken}
                    onChange={(e) => setEvidenceToken(e.target.value)}
                    className="form-input font-mono"
                    placeholder="Enter your secret token"
                  />
                </div>
                <div>
                  <label className="form-label font-semibold">Additional Evidence</label>
                  <input
                    type="file"
                    className="form-input"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                  />
                  {evidenceFile && (
                    <p className="text-xs text-slate-500 mt-1">{evidenceFile.name}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="btn btn-primary px-5 py-2" disabled={evidenceLoading}>
                    {evidenceLoading ? 'Uploading...' : 'Upload Evidence'}
                  </button>
                  <button type="button" className="btn btn-ghost px-5 py-2" disabled={evidenceLoading} onClick={() => loadAnonymousEvidence()}>
                    View Evidence
                  </button>
                </div>
              </form>

              {evidence.length > 0 && (
                <ul className="mt-5 space-y-2">
                  {evidence.map(file => (
                    <li key={file.id} className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: 'var(--color-slate-50)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText size={15} className="text-slate-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{file.original_filename}</p>
                            <p className="text-xs text-slate-400">{format(new Date(file.uploaded_at), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-danger px-3 py-2 text-sm rounded-full shadow-sm transition-all duration-150 hover:shadow-lg"
                            onClick={() => deleteAnonymousEvidence(file.id)}
                            disabled={evidenceLoading}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Status Timeline */}
            <div className="card p-6">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-navy-900)' }}>
                <Clock size={16} /> Status Timeline
              </h3>
              <div className="space-y-3">
                {(() => {
                  const terminalStatuses = ['Substantiated', 'Complaint_Dismissed', 'Dismissed_No_Evidence'];
                  const terminalStatus = terminalStatuses.includes(result.case.status)
                    ? result.case.status
                    : 'Substantiated';
                  const visiblePath = ['New', 'Under_Review', 'Assigned', 'Investigating', terminalStatus];
                  const progressOrder = ['New', 'Under_Review', 'Assigned', 'Investigating', 'Pending_Evidence', terminalStatus];
                  const currentIdx = progressOrder.indexOf(result.case.status);

                  return visiblePath.map((s) => {
                  const thisIdx = progressOrder.indexOf(s);
                  const isComplete = thisIdx <= currentIdx;
                  const isCurrent = s === result.case.status;
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isComplete ? (isCurrent ? '' : 'bg-green-100') : 'bg-slate-100'
                      }`}
                        style={isCurrent ? { background: 'var(--color-gold-500)' } : {}}>
                        {isComplete && !isCurrent
                          ? <CheckCircle size={14} style={{ color: '#16a34a' }} />
                          : isCurrent
                          ? <span className="w-2.5 h-2.5 rounded-full bg-white block" />
                          : <span className="w-2 h-2 rounded-full bg-slate-300 block" />}
                      </div>
                      <p className={`text-sm ${isComplete ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                        {STATUS_LABELS[s]?.label || formatStatus(s)}
                      </p>
                    </div>
                  );
                  });
                })()}
              </div>
            </div>

            {/* Correspondence */}
            {result.correspondence?.length > 0 && (
              <div className="card p-6">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-navy-900)' }}>
                  <MessageSquare size={16} /> Correspondence
                </h3>
                <div className="space-y-3">
                  {result.correspondence.map((note, i) => {
                    const tone = getCorrespondenceTone(note);
                    return (
                    <div key={i} className={`p-4 rounded-xl ${
                      note.author_type === 'staff'
                        ? 'ml-4'
                        : 'mr-4'
                    }`}
                      style={{
                        background: tone.background,
                        border: '1px solid',
                        borderColor: tone.borderColor,
                      }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold"
                          style={{ color: tone.labelColor }}>
                          {getCorrespondenceLabel(note)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {format(new Date(note.created_at), 'MMM d, HH:mm')}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderRichText(note.body) }} />
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(result.correspondence?.some(note => note.author_type === 'staff')) ? (
              <div className="card p-6">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-navy-900)' }}>
                  <MessageSquare size={16} /> Send a Response
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Reply securely to the investigation team using your reference code and verification token.
                </p>
                <form onSubmit={handleReplySubmit} className="space-y-4">
                  <div>
                    <label className="form-label font-semibold">Verification Token</label>
                    <input
                      type="text"
                      value={replyToken}
                      onChange={(e) => setReplyToken(e.target.value)}
                      className="form-input font-mono"
                      placeholder="Enter your secret token"
                    />
                  </div>
                  <div>
                    <label className="form-label font-semibold">Reply To</label>
                    <select
                      value={replyRecipient}
                      onChange={(e) => setReplyRecipient(e.target.value)}
                      className="form-select"
                    >
                      {availableReplyRecipients.includes('Investigator') && (
                        <option value="Investigator">Case Investigator</option>
                      )}
                      {availableReplyRecipients.includes('Compliance_Officer') && (
                        <option value="Compliance_Officer">Ethics & Anticorruption Officer</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="form-label font-semibold">Your Response</label>
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      className="form-textarea min-h-[140px]"
                      placeholder="Write your response to the investigator or ethics officer..."
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary px-5 py-2"
                    disabled={replyLoading}
                  >
                    {replyLoading ? 'Sending...' : 'Send Response'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="card p-6">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-navy-900)' }}>
                  <MessageSquare size={16} /> Reply Unavailable
                </h3>
                <p className="text-sm text-slate-500">
                  You can only send a reply after the investigation team has posted a public response to your report.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-lg p-6 relative animate-in fade-in zoom-in-95 duration-200" style={{ background: '#fff' }}>
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-navy-900)' }}>
              Edit Report Details
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Provide your secret verification token and enter the fields you wish to update.
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-left">
              <div>
                <label className="form-label font-semibold">Secret Verification Token *</label>
                <input
                  type="text"
                  required
                  className="form-input font-mono"
                  placeholder="Enter the 64-character hex token"
                  value={editToken}
                  onChange={(e) => setEditToken(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label font-semibold">Category</label>
                <select
                  className="form-input"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                >
                  <option value="Fraud">Fraud</option>
                  <option value="Corruption">Corruption</option>
                  <option value="Bribery">Bribery</option>
                  <option value="Abuse_of_Power">Abuse of Power</option>
                  <option value="Procurement_Violation">Procurement Violation</option>
                  <option value="System_Misuse">System Misuse</option>
                </select>
              </div>

              <div>
                <label className="form-label font-semibold">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      <Edit3 size={14} /> Updated Description Rich Text Editor (Min 20 chars)
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <button type="button" aria-label="Plain text" className="text-slate-400 hover:text-slate-900 transition" onClick={() => applyFormatting('type')}><Type size={14} /></button>
                      <button type="button" aria-label="Bold" className="text-slate-400 hover:text-slate-900 transition" onClick={() => applyFormatting('bold')}><Bold size={14} /></button>
                      <button type="button" aria-label="Italic" className="text-slate-400 hover:text-slate-900 transition" onClick={() => applyFormatting('italic')}><Italic size={14} /></button>
                      <button type="button" aria-label="Underline" className="text-slate-400 hover:text-slate-900 transition" onClick={() => applyFormatting('underline')}><Underline size={14} /></button>
                      <button type="button" aria-label="Heading" className="text-slate-400 hover:text-slate-900 transition" onClick={() => applyFormatting('heading')}><Heading size={14} /></button>
                      <button type="button" aria-label="List" className="text-slate-400 hover:text-slate-900 transition" onClick={() => applyFormatting('list')}><List size={14} /></button>
                      <button type="button" aria-label="Code" className="text-slate-400 hover:text-slate-900 transition" onClick={() => applyFormatting('code')}><Code size={14} /></button>
                      <button type="button" aria-label="Strikethrough" className="text-slate-400 hover:text-slate-900 transition" onClick={() => applyFormatting('strikethrough')}><Strikethrough size={14} /></button>
                    </span>
                  </div>
                </label>
                <div
                  ref={editDescriptionRef}
                  id="edit-description"
                  className="form-input min-h-[120px] overflow-auto"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={updateEditDescriptionHtml}
                  dangerouslySetInnerHTML={{ __html: editDescription || '' }}
                />
              </div>

              <div>
                <label className="form-label font-semibold">Branch / Department</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter updated branch or department"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-secondary px-4 py-2"
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-6 py-2"
                  disabled={editLoading}
                >
                  {editLoading ? <span className="spinner" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200" style={{ background: '#fff' }}>
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle size={24} style={{ color: 'var(--color-danger-500)' }} />
            </div>

            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-navy-900)' }}>
              Request Case Deletion
            </h3>
            <p className="text-sm text-slate-500 mb-6 text-left">
              This will request a soft delete of your case. It will no longer be visible or trackable in the system. An audit log of the case lifecycle is retained.
            </p>

            <form onSubmit={handleDeleteSubmit} className="space-y-4 text-left">
              <div>
                <label className="form-label font-semibold">Secret Verification Token *</label>
                <input
                  type="text"
                  required
                  className="form-input font-mono"
                  placeholder="Enter the 64-character hex token"
                  value={deleteToken}
                  onChange={(e) => setDeleteToken(e.target.value)}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="btn btn-secondary px-4 py-2"
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger px-6 py-2"
                  style={{ background: 'var(--color-danger-500)', color: 'white' }}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? <span className="spinner" /> : 'Confirm Deletion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
