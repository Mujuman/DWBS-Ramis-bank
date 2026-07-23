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
      const [statsRes, usersRes] = await Promise.allSettled([
        api.get('/cases/stats'),
        api.get('/users'),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (usersRes.status === 'fulfilled') {
        setInvestigators(
          (usersRes.value.data.users || [])
            .filter(u => u.role === 'Investigator' && u.is_active)
            .sort((a, b) => a.username.localeCompare(b.username))
        );
      }
      // Load escalated cases
      const escRes = await api.get('/cases', { params: { is_escalated: 1, limit: 100 } });
      setEscalatedCases(escRes.data.cases || []);
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
