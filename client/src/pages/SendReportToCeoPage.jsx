import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Send, Shield, Upload, X, FileText, CheckCircle2,
  Type, Bold, Italic, Underline, Heading, List, Code,
  Paperclip, ArrowLeft, RefreshCw, Eye, Sparkles
} from 'lucide-react';
import { renderRichText } from '../utils/formatting';
import { useDropzone } from 'react-dropzone';

export default function SendReportToCeoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCaseId = searchParams.get('case_id');

  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const editorRef = useRef(null);

  // Fetch active cases for EAAC selection
  const fetchCases = async () => {
    setLoadingCases(true);
    try {
      const res = await api.get('/cases', { params: { limit: 100 } });
      const fetchedCases = res.data.cases || [];
      setCases(fetchedCases);

      if (preselectedCaseId) {
        const found = fetchedCases.find(c => String(c.id) === String(preselectedCaseId));
        if (found) selectCase(found);
      } else if (fetchedCases.length > 0 && !selectedCase) {
        selectCase(fetchedCases[0]);
      }
    } catch (err) {
      toast.error('Failed to load case list');
    }
    setLoadingCases(false);
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const selectCase = (c) => {
    setSelectedCase(c);
    if (!subject || subject.includes('Case ')) {
      setSubject(`[EAAC Executive Report] Case ${c.reference_id}: Investigation Findings & Recommendations`);
    }
  };

  // Editor formatting actions
  const updateEditorContent = () => {
    const html = editorRef.current?.innerHTML || '';
    setBodyText(html);
  };

  const applyFormatting = (action) => {
    const editor = editorRef.current;
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
      case 'heading':
        document.execCommand('formatBlock', false, 'H3');
        break;
      case 'list':
        document.execCommand('insertUnorderedList');
        break;
      case 'code': {
        const selection = document.getSelection();
        const selectedText = selection?.toString() || 'code snippet';
        document.execCommand('insertHTML', false, `<code>${selectedText}</code>`);
        break;
      }
      case 'clear':
        document.execCommand('removeFormat');
        break;
      default:
        break;
    }

    updateEditorContent();
  };

  const loadExecutiveTemplate = () => {
    if (!selectedCase) {
      toast.error('Please select a case first');
      return;
    }
    const templateHtml = `
<p>Dear CEO,</p>
<p>Following our investigation into case <strong>${selectedCase.reference_id}</strong> (<em>${selectedCase.category?.replace(/_/g, ' ')}</em> - Department: <strong>${selectedCase.branch_or_dept || 'General'}</strong>), the Ethics & Anti-Corruption Office submits this formal executive report for your review.</p>

<h3>Key Findings:</h3>
<ol>
  <li><strong>Finding 1:</strong> Initial review confirms procedural non-compliance in departmental records.</li>
  <li><strong>Finding 2:</strong> Additional corroborating evidence collected from departmental logs.</li>
</ol>

<h3>Risk Assessment:</h3>
<p>This case poses potential operational and reputational risk to Rammis Bank. Immediate executive oversight is recommended.</p>

<h3>Recommended Actions:</h3>
<ul>
  <li>Assign dedicated Case Handler for full forensic audit.</li>
  <li>Implement preventative control measures across affected branch/department.</li>
</ul>

<p>Attached are full supporting evidence documents for executive review.</p>
<p>Respectfully submitted,<br/><strong>Ethics & Anti-Corruption Office (EAAC)</strong><br/>Rammis Bank S.C.</p>
    `.trim();

    if (editorRef.current) {
      editorRef.current.innerHTML = templateHtml;
      setBodyText(templateHtml);
      toast.success('Sample Executive Report template loaded');
    }
  };

  // Multiple file dropzone setup
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 10,
    onDrop: (accepted, rejected) => {
      if (rejected.length > 0) {
        toast.error('Some files were rejected. Max 10MB each. Allowed: PDF, Word, Excel, JPG, PNG');
      }
      setFiles(prev => [...prev, ...accepted].slice(0, 10));
    },
  });

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!selectedCase) {
      toast.error('Please select a case to report on');
      return;
    }
    if (!subject.trim()) {
      toast.error('Please enter a report subject');
      return;
    }
    const htmlContent = editorRef.current?.innerHTML?.trim() || bodyText.trim();
    const textContent = editorRef.current?.innerText?.trim() || '';
    if (!textContent || textContent.length < 10) {
      toast.error('Please write a detailed report body (at least 10 characters)');
      return;
    }

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('subject', subject.trim());
      formData.append('body', htmlContent);

      // Append all attached files (supports multiple files at once)
      files.forEach((file) => {
        formData.append('files', file);
      });

      await api.post(`/cases/${selectedCase.id}/reports`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(`Formal report sent successfully to the CEO!`);
      navigate(`/compliance`);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to send report to CEO';
      toast.error(msg);
      console.error('Send report error:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto fade-in-up">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div>
          <button
            onClick={() => navigate('/compliance')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition mb-2 font-medium"
          >
            <ArrowLeft size={14} /> Back to Ethics Dashboard
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-navy-900)' }}>
            <Shield className="text-amber-500" size={24} /> Send Formal Report to CEO
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Compose and submit an official executive report directly to the Chief Executive Officer with multi-file evidence attachments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen(!previewOpen)}
            className="btn btn-ghost text-xs py-2 px-3 flex items-center gap-1.5"
          >
            <Eye size={15} /> {previewOpen ? 'Hide Email Preview' : 'Show Email Preview'}
          </button>
          <button
            type="button"
            onClick={loadExecutiveTemplate}
            className="btn btn-ghost text-xs py-2 px-3 flex items-center gap-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100"
          >
            <Sparkles size={15} /> Load Executive Template
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">

        {/* Main Composer Form */}
        <div className={previewOpen ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <form onSubmit={handleSubmitReport} className="card p-6 flex flex-col gap-5">

            {/* Case Selection Dropdown */}
            <div>
              <label className="form-label flex items-center justify-between">
                <span>Select Target Case *</span>
                {loadingCases && <span className="text-xs text-slate-400 flex items-center gap-1"><RefreshCw size={11} className="spin" /> Loading cases...</span>}
              </label>
              <select
                className="form-select text-sm"
                value={selectedCase?.id || ''}
                onChange={(e) => {
                  const found = cases.find(c => String(c.id) === String(e.target.value));
                  if (found) selectCase(found);
                }}
              >
                <option value="" disabled>-- Select a case to report on --</option>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>
                    [{c.reference_id}] {c.category?.replace(/_/g, ' ')} — {c.branch_or_dept || 'General'} ({c.severity_level || 'Medium'})
                  </option>
                ))}
              </select>
              {selectedCase && (
                <div className="mt-2.5 p-3 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs" style={{ background: 'var(--color-slate-50)' }}>
                  <div>
                    <span className="font-mono font-bold text-slate-900 mr-2">{selectedCase.reference_id}</span>
                    <span className="text-slate-500 mr-2">Category: <strong>{selectedCase.category?.replace(/_/g, ' ')}</strong></span>
                    <span className="text-slate-500">Dept: <strong>{selectedCase.branch_or_dept || 'General'}</strong></span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    Severity: {selectedCase.severity_level || 'Medium'}
                  </span>
                </div>
              )}
            </div>

            {/* Subject Line */}
            <div>
              <label className="form-label">Report Subject *</label>
              <input
                type="text"
                className="form-input text-sm font-medium"
                placeholder="Enter report subject for executive review..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            {/* Rich Text Editor for Executive Body */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="form-label mb-0">Executive Findings & Formal Report Body *</label>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
                  <button type="button" title="Heading" className="p-1 rounded hover:bg-slate-200 transition" onClick={() => applyFormatting('heading')}><Heading size={13} /></button>
                  <button type="button" title="Bold" className="p-1 rounded hover:bg-slate-200 transition" onClick={() => applyFormatting('bold')}><Bold size={13} /></button>
                  <button type="button" title="Italic" className="p-1 rounded hover:bg-slate-200 transition" onClick={() => applyFormatting('italic')}><Italic size={13} /></button>
                  <button type="button" title="Underline" className="p-1 rounded hover:bg-slate-200 transition" onClick={() => applyFormatting('underline')}><Underline size={13} /></button>
                  <button type="button" title="Bullet List" className="p-1 rounded hover:bg-slate-200 transition" onClick={() => applyFormatting('list')}><List size={13} /></button>
                  <button type="button" title="Code" className="p-1 rounded hover:bg-slate-200 transition" onClick={() => applyFormatting('code')}><Code size={13} /></button>
                  <button type="button" title="Clear Formatting" className="p-1 rounded hover:bg-slate-200 transition text-slate-500" onClick={() => applyFormatting('clear')}><Type size={13} /></button>
                </div>
              </div>

              <div
                ref={editorRef}
                contentEditable
                onInput={updateEditorContent}
                className="form-textarea min-h-64 text-sm leading-relaxed p-4 bg-white"
                style={{ outline: 'none' }}
                data-placeholder="Write your formal findings, analysis, and recommendations for the CEO..."
              />
            </div>

            {/* Multiple File Attachments Dropzone */}
            <div>
              <label className="form-label flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Paperclip size={14} className="text-slate-600" /> Evidence Attachments (Multiple Files at Once)
                </span>
                <span className="text-xs text-slate-400">Max 10MB each, up to 10 files</span>
              </label>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-amber-500 bg-amber-50/40' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload size={24} className="mx-auto mb-2 text-slate-400" />
                <p className="text-xs font-semibold text-slate-700">
                  {isDragActive ? 'Drop files here...' : 'Drag & drop multiple files here, or click to browse'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Supports PDF, Word (.docx), Excel (.xlsx), JPG, PNG</p>
              </div>

              {/* Selected Files List */}
              {files.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Attached Files ({files.length}):
                  </p>
                  {files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={16} className="text-amber-600 shrink-0" />
                        <span className="font-medium text-slate-800 truncate">{file.name}</span>
                        <span className="text-slate-400 text-[11px] shrink-0">
                          ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate('/compliance')}
                className="btn btn-ghost text-sm py-2.5 px-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending || !selectedCase}
                className="btn btn-primary text-sm py-2.5 px-6 flex items-center gap-2"
                style={{ background: 'var(--color-navy-900)' }}
              >
                {sending ? (
                  <><span className="spinner" /> Submitting to CEO...</>
                ) : (
                  <><Send size={15} /> Send Formal Report to CEO</>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* Live Executive Email Preview Drawer/Column */}
        {previewOpen && (
          <div className="lg:col-span-5 fade-in">
            <div className="card p-5 sticky top-20 shadow-lg border border-amber-200/60 bg-white">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Executive Email Preview
                </span>
                <span className="text-xs text-slate-400">Rammis Bank DWBS</span>
              </div>

              {/* Email Outer Mockup */}
              <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                <div className="bg-slate-900 text-amber-400 p-3 font-bold text-center">
                  Rammis Bank DWBS — Formal Executive Report
                </div>
                <div className="p-4 bg-slate-50 space-y-2 border-b border-slate-200">
                  <p className="text-slate-500"><strong>To:</strong> Chief Executive Officer (CEO)</p>
                  <p className="text-slate-500"><strong>From:</strong> Ethics & Anti-Corruption Office (EAAC)</p>
                  <p className="text-slate-900 font-semibold"><strong>Subject:</strong> {subject || '(No Subject)'}</p>
                  {selectedCase && (
                    <div className="text-[11px] text-slate-500 bg-white p-2 rounded border border-slate-200">
                      Reference: <strong className="font-mono">{selectedCase.reference_id}</strong> | Category: <strong>{selectedCase.category}</strong>
                    </div>
                  )}
                </div>

                <div
                  className="p-4 bg-white min-h-48 text-slate-800 leading-relaxed overflow-y-auto max-h-80"
                  dangerouslySetInnerHTML={{ __html: renderRichText(bodyText || '<p className="text-slate-400 italic">Report content will appear here...</p>') }}
                />

                {files.length > 0 && (
                  <div className="p-3 bg-slate-50 border-t border-slate-200">
                    <p className="font-semibold text-slate-600 mb-1">Attached Files ({files.length}):</p>
                    <ul className="list-disc list-inside text-slate-500 space-y-0.5">
                      {files.map((f, i) => (
                        <li key={i} className="truncate">{f.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400 text-center mt-3">
                Submitting will log this report into investigation records and dispatch an alert to the CEO.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
