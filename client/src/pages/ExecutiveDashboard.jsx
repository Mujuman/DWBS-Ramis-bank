import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, AlertTriangle, Clock, CheckCircle, FileText,
  Activity, UserCheck, X, Briefcase, Zap, RefreshCw
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
  const [fraudOnly, setFraudOnly] = useState(false);

  // Assign investigator modal state
  const [assignModal, setAssignModal] = useState(null);  // escalated case object
  const [assignTarget, setAssignTarget] = useState('');
  const [assigning, setAssigning] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/cases/stats'),
      api.get('/users'),
    ])
      .then(([statsRes, usersRes]) => {
        setStats(statsRes.data);
        setInvestigators(
          (usersRes.data.users || [])
            .filter(u => u.role === 'Investigator' && u.is_active)
            .sort((a, b) => (a.username || '').localeCompare(b.username || ''))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  // ── Assign investigator (CEO action) ───────────────────────
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

  const escalatedCases = stats?.escalated_cases || [];
  const filteredEscalated = fraudOnly
    ? escalatedCases.filter(c => ['Fraud', 'Corruption', 'Bribery'].includes(c.category))
    : escalatedCases;

  const kpiCards = [
    { label: 'Total Reports', value: o.total || 0, icon: FileText, color: '#0A1D37', bg: '#e8edf5', change: 'All time' },
    { label: 'Critical Cases', value: o.critical || 0, icon: AlertTriangle, color: '#ef4444', bg: '#fee2e2', change: 'Requires action' },
    { label: 'In Investigation', value: o.in_progress || 0, icon: Activity, color: '#3b82f6', bg: '#dbeafe', change: 'Active investigations' },
    { label: 'Substantiated', value: o.substantiated || 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7', change: 'Evidence confirmed' },
    { label: 'Avg. Resolution', value: stats?.avg_resolution_hours ? `${stats.avg_resolution_hours}h` : 'N/A', icon: Clock, color: '#8b5cf6', bg: '#ede9fe', change: 'Average hours' },
    { label: 'High Priority', value: o.high || 0, icon: TrendingUp, color: '#f59e0b', bg: '#fef3c7', change: 'High severity' },
  ];

  const pieData = stats?.by_category?.map(c => ({
    name: c.category.replace(/_/g, ' '),
    value: c.total,
  })) || [];

  const statusChartData = [
    { name: 'New', value: o.new_cases || 0, fill: '#F9A826' },
    { name: 'Under Review', value: o.under_review || 0, fill: '#3b82f6' },
    { name: 'In Progress', value: o.in_progress || 0, fill: '#f59e0b' },
    { name: 'Substantiated', value: o.substantiated || 0, fill: '#22c55e' },
    { name: 'Dismissed', value: (o.complaint_dismissed || 0) + (o.dismissed_no_evidence || 0), fill: '#94a3b8' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up">

      {/* Header */}
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
              Whistleblowing system overview — {new Date().toLocaleDateString('en-ET', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <button onClick={loadData} className="btn btn-ghost">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {kpiCards.map(k => (
          <div key={k.label} className="card p-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: k.bg }}>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <p className="text-2xl font-extrabold mb-0.5" style={{ color: 'var(--color-navy-900)' }}>{k.value}</p>
            <p className="text-xs font-semibold text-slate-600 mb-0.5">{k.label}</p>
            <p className="text-xs text-slate-400">{k.change}</p>
          </div>
        ))}
      </div>

      {/* ── Escalated Cases — CEO Action Required ── */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#fee2e2' }}>
            <Zap size={18} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
              Critical Cases — Escalated by Ethics & Anti-Corruption Office
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              These cases have been reported to you by the Ethics & Anti-Corruption Office.
              Review each case and <strong>assign an investigator</strong> to proceed.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <label className="text-xs text-slate-500 flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="fraudOnly" className="w-4 h-4" onChange={e => setFraudOnly(e.target.checked)} />
            Show fraud/financial crime only
          </label>
          <span className="text-xs text-slate-400">{filteredEscalated.length} escalated case{filteredEscalated.length !== 1 ? 's' : ''}</span>
        </div>

        {filteredEscalated.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle size={32} className="mx-auto mb-3 text-green-400" />
            <p className="text-slate-400 text-sm">No escalated cases awaiting your action.</p>
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
                  <th>Action Required</th>
                </tr>
              </thead>
              <tbody>
                {filteredEscalated.map(c => (
                  <tr key={c.id}>
                    <td>
                      <span className="font-mono text-xs font-bold" style={{ color: 'var(--color-navy-900)' }}>
                        {c.reference_id}
                      </span>
                    </td>
                    <td className="text-slate-600">{c.category?.replace(/_/g, ' ')}</td>
                    <td>
                      <span className={`badge badge-${c.priority?.toLowerCase()}`}>{c.priority}</span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[c.status] || 'badge-review'}`}>
                        {formatStatus(c.status)}
                      </span>
                    </td>
                    <td className="text-slate-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-slate-600">
                      {c.assigned_investigator || <span className="text-red-400 font-medium italic">Unassigned</span>}
                    </td>
                    <td>
                      {!c.assigned_investigator ? (
                        <button
                          onClick={() => { setAssignModal(c); setAssignTarget(''); }}
                          className="btn btn-primary text-xs py-1 px-3"
                          title="Assign an investigator to this case"
                        >
                          <UserCheck size={12} /> Assign Investigator
                        </button>
                      ) : (
                        <button
                          onClick={() => { setAssignModal(c); setAssignTarget(''); }}
                          className="btn btn-outline text-xs py-1 px-3"
                          title="Reassign investigator"
                        >
                          <UserCheck size={12} /> Reassign
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

        {/* Category Pie */}
        <div className="card p-6">
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>
            Cases by Category
          </h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                    dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-slate-600">{d.name}</span>
                    </div>
                    <span className="font-bold text-slate-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">No data</div>
          )}
        </div>
      </div>

      {/* Status breakdown */}
      <div className="card p-6">
        <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-navy-900)' }}>
          Cases by Status
        </h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={statusChartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Cases" radius={[6, 6, 0, 0]}>
              {statusChartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ══════════════ ASSIGN INVESTIGATOR MODAL ══════════════ */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,29,55,0.5)' }}>
          <div className="card p-0 w-full max-w-md mx-4 fade-in-up" style={{ maxHeight: '90vh', overflow: 'auto' }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--color-navy-900)' }}>
                  Assign Investigator
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

            {/* Modal body */}
            <div className="px-6 py-5">
              {/* Context banner */}
              <div className="rounded-xl p-3 mb-4 flex items-start gap-2"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Zap size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-800">
                  Escalated by the <strong>Ethics & Anti-Corruption Office</strong> on{' '}
                  {assignModal.created_at ? format(new Date(assignModal.created_at), 'MMM d, yyyy') : '—'}.
                  Please assign an investigator to proceed.
                </p>
              </div>

              {/* Current info */}
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(10,29,55,0.03)' }}>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-500">Category</span>
                  <span className="font-medium" style={{ color: 'var(--color-navy-900)' }}>
                    {assignModal.category?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-500">Priority</span>
                  <span className={`badge badge-${assignModal.priority?.toLowerCase()}`}>{assignModal.priority}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Currently Assigned</span>
                  <span className="font-medium" style={{ color: 'var(--color-navy-900)' }}>
                    {assignModal.assigned_investigator || <span className="text-red-400 italic">Unassigned</span>}
                  </span>
                </div>
              </div>

              {/* Investigator select */}
              <label className="form-label">Select Investigator *</label>
              <select
                className="form-select text-sm w-full"
                value={assignTarget}
                onChange={e => setAssignTarget(e.target.value)}
              >
                <option value="">— Choose an investigator —</option>
                {investigators.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.username} {inv.department ? `(${inv.department})` : ''}
                  </option>
                ))}
              </select>

              {investigators.length === 0 && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <Briefcase size={12} /> No active investigators found. Ask System Admin to create investigator accounts.
                </p>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setAssignModal(null); setAssignTarget(''); }}
                className="btn btn-ghost text-sm">
                Cancel
              </button>
              <button onClick={doAssign} disabled={assigning || !assignTarget}
                className="btn btn-primary text-sm">
                {assigning
                  ? <><span className="spinner" /> Assigning...</>
                  : <><UserCheck size={14} /> Assign Investigator</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
