import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  RefreshCw, Search, UserCheck, ArrowUpCircle,
  AlertTriangle, CheckCircle, Clock, FileText,
  TrendingUp, Shield, Users, ChevronRight, X,
} from 'lucide-react';

const STATUSES   = ['New','Under_Review','Assigned','Investigating','Pending_Evidence','Resolved','Closed'];
const PRIORITIES = ['Low','Medium','High','Critical'];
const CATEGORIES = ['Fraud','Corruption','Bribery','Abuse_of_Power','Procurement_Violation','System_Misuse'];

const STATUS_BADGE = {
  New:'badge-new', Under_Review:'badge-review', Assigned:'badge-review',
  Investigating:'badge-progress', Pending_Evidence:'badge-escalated',
  Resolved:'badge-resolved', Closed:'badge-closed',
};
const PRIORITY_BADGE = {
  Low:'badge-low', Medium:'badge-medium', High:'badge-high', Critical:'badge-critical',
};

export default function ComplianceDashboard() {
  const { user } = useAuth();

  const [cases,         setCases]         = useState([]);
  const [stats,         setStats]         = useState(null);
  const [investigators, setInvestigators] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [pagination,    setPagination]    = useState({ total:0, page:1, total_pages:1 });
  const [activeTab,     setActiveTab]     = useState('queue');
  const [filters,       setFilters]       = useState({ status:'', priority:'', category:'', search:'', page:1 });

  // assign modal
  const [assignModal,  setAssignModal]  = useState(null);   // case object
  const [assignTarget, setAssignTarget] = useState('');
  const [assigning,    setAssigning]    = useState(false);

  // severity override modal
  const [severityModal, setSeverityModal] = useState(null); // case object
  const [newSeverity,   setNewSeverity]   = useState('');
  const [overriding,    setOverriding]    = useState(false);

  // escalating state (stores case id)
  const [escalating, setEscalating] = useState(null);

  const loadAll = useCallback(async (f = filters) => {
    setLoading(true);
    try {
      const params = { page: f.page, limit: 20 };
      if (f.status)   params.status         = f.status;
      if (f.priority) params.severity_level = f.priority;
      if (f.category) params.category       = f.category;
      if (f.search)   params.search         = f.search;

      const [cRes, sRes, uRes] = await Promise.all([
        api.get('/cases', { params }),
        api.get('/cases/stats'),
        api.get('/users'),
      ]);
      setCases(cRes.data.cases || []);
      setPagination(cRes.data.pagination || { total:0, page:1, total_pages:1 });
      setStats(sRes.data);
      setInvestigators((uRes.data.users || []).filter(u => u.role === 'Investigator' && u.is_active));
    } catch {
      toast.error('Failed to load dashboard data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, []);

  const applyFilter = (key, val) => {
    const nf = { ...filters, [key]: val, page: 1 };
    setFilters(nf); loadAll(nf);
  };
  const goPage = (p) => {
    const nf = { ...filters, page: p };
    setFilters(nf); loadAll(nf);
  };

  // ── Assign / Reassign ──────────────────────────────────────
  const doAssign = async () => {
    if (!assignTarget) { toast.error('Select an investigator'); return; }
    setAssigning(true);
    try {
      await api.patch(`/cases/${assignModal.id}/status`, {
        assigned_to: parseInt(assignTarget),
        status: 'Assigned',
      });
      toast.success('Case assigned successfully');
      setAssignModal(null); setAssignTarget('');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Assignment failed');
    }
    setAssigning(false);
  };

  // ── Override severity ──────────────────────────────────────
  const doOverride = async () => {
    if (!newSeverity) { toast.error('Select a severity level'); return; }
    setOverriding(true);
    try {
      await api.patch(`/cases/${severityModal.id}/status`, { priority: newSeverity });
      toast.success(`Severity updated to ${newSeverity}`);
      setSeverityModal(null); setNewSeverity('');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Override failed');
    }
    setOverriding(false);
  };

  // ── Escalate to CEO ────────────────────────────────────────
  const doEscalate = async (c) => {
    setEscalating(c.id);
    try {
      await api.post(`/cases/${c.id}/escalate`);
      toast.success('Case escalated to CEO dashboard');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Escalation failed');
    }
    setEscalating(null);
  };

  // ── Workload: count cases per investigator ─────────────────
  const workload = investigators.map(inv => ({
    ...inv,
    count: cases.filter(c => c.assigned_investigator === inv.username).length,
  })).sort((a, b) => a.count - b.count);

  const ov = stats?.overview || {};
  const statCards = [
    { label:'Total Cases',  value: ov.total      || 0, icon: FileText,      color:'var(--color-navy-900)', bg:'#e8edf5' },
    { label:'New',          value: ov.new_cases   || 0, icon: AlertTriangle, color:'var(--color-gold-600)', bg:'#fef3c7' },
    { label:'In Progress',  value: ov.in_progress || 0, icon: Clock,         color:'#3b82f6',               bg:'#dbeafe' },
    { label:'Resolved',     value: ov.resolved    || 0, icon: CheckCircle,   color:'#16a34a',               bg:'#dcfce7' },
    { label:'Critical',     value: ov.critical    || 0, icon: TrendingUp,    color:'#dc2626',               bg:'#fee2e2' },
    { label:'Unassigned',   value: cases.filter(c => !c.assigned_investigator).length,
      icon: Users, color:'#7c3aed', bg:'#ede9fe' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color:'var(--color-navy-900)' }}>
            Compliance Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Team Lead · {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <button onClick={() => loadAll()} className="btn btn-ghost">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                <s.icon size={18} style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-extrabold" style={{ color:'var(--color-navy-900)' }}>{s.value}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background:'var(--color-slate-100)' }}>
        {[['queue','Case Queue'], ['workload','Investigator Workload']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === key ? 'shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            style={activeTab === key ? { background:'var(--color-navy-900)', color:'var(--color-gold-500)' } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════ CASE QUEUE TAB ══════════════ */}
      {activeTab === 'queue' && (
        <>
          {/* Filters */}
          <div className="card p-4 mb-5">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" className="form-input pl-9 text-sm"
                  placeholder="Search reference ID..."
                  value={filters.search}
                  onChange={e => applyFilter('search', e.target.value)} />
              </div>
              <select className="form-select text-sm min-w-36"
                value={filters.status} onChange={e => applyFilter('status', e.target.value)}>
                <option value="">All Statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
              <select className="form-select text-sm min-w-32"
                value={filters.priority} onChange={e => applyFilter('priority', e.target.value)}>
                <option value="">All Priorities</option>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className="form-select text-sm min-w-36"
                value={filters.category} onChange={e => applyFilter('category', e.target.value)}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="py-16 text-center"><span className="spinner spinner-navy mx-auto" /></div>
            ) : cases.length === 0 ? (
              <div className="py-16 text-center">
                <Filter size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-400">No cases match the current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
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
                    {cases.map(c => (
                      <tr key={c.id}>
                        <td>
                          <span className="font-mono text-xs font-bold" style={{ color:'var(--color-navy-900)' }}>
                            {c.reference_id}
                          </span>
                        </td>
                        <td className="text-slate-600 text-sm">{c.category?.replace(/_/g,' ')}</td>
                        <td><span className={`badge ${PRIORITY_BADGE[c.priority] || 'badge-low'}`}>{c.priority}</span></td>
                        <td><span className={`badge ${STATUS_BADGE[c.status] || 'badge-review'}`}>{c.status?.replace(/_/g,' ')}</span></td>
                        <td>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: c.submitted_by_type === 'anonymous' ? 'rgba(10,29,55,0.08)' : 'rgba(249,168,38,0.1)',
                              color: c.submitted_by_type === 'anonymous' ? 'var(--color-navy-700)' : 'var(--color-gold-700)',
                            }}>
                            {c.submitted_by_type === 'anonymous' ? '🔒 Anonymous' : '👤 Staff'}
                          </span>
                        </td>
                        <td className="text-xs text-slate-500">
                          {c.assigned_investigator || <span className="text-red-400 font-medium italic">Unassigned</span>}
                        </td>
                        <td className="text-xs text-slate-400">{format(new Date(c.created_at), 'MMM d, yyyy')}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Link to={`/cases/${c.id}`} className="btn btn-ghost text-xs py-1 px-2">
                              Open <ChevronRight size={11} />
                            </Link>
                            <button
                              onClick={() => { setAssignModal(c); setAssignTarget(c.assigned_investigator_id || ''); }}
                              className="btn btn-outline text-xs py-1 px-2"
                              title="Assign / Reassign">
                              <UserCheck size={12} /> Assign
                            </button>
                            <button
                              onClick={() => { setSeverityModal(c); setNewSeverity(c.priority || 'Medium'); }}
                              className="btn btn-ghost text-xs py-1 px-2"
                              title="Override severity">
                              <TrendingUp size={12} />
                            </button>
                            <button
                              onClick={() => doEscalate(c)}
                              disabled={escalating === c.id}
                              className="btn btn-ghost text-xs py-1 px-2 text-red-600 hover:bg-red-50"
                              title="Escalate to CEO">
                              {escalating === c.id
                                ? <span className="spinner" style={{ width:12, height:12 }} />
                                : <ArrowUpCircle size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                <p className="text-sm text-slate-500">
                  Page {pagination.page} of {pagination.total_pages} ({pagination.total} cases)
                </p>
                <div className="flex gap-2">
                  {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => goPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === pagination.page ? 'text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                      style={p === pagination.page ? { background:'var(--color-navy-900)' } : {}}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
