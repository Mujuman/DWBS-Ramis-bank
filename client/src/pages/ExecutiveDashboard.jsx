import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, AlertTriangle, Clock, CheckCircle, FileText, Activity } from 'lucide-react';

const CATEGORY_COLORS = {
  Fraud: '#ef4444', Bribery: '#f59e0b', Corruption: '#8b5cf6',
  Harassment: '#ec4899', AML_Violation: '#0ea5e9', Data_Breach: '#14b8a6',
  Policy_Violation: '#64748b', Other: '#94a3b8',
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

  useEffect(() => {
    api.get('/cases/stats')
      .then(res => { setStats(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="spinner spinner-navy" />
      </div>
    );
  }

  const o = stats?.overview || {};

  const kpiCards = [
    { label: 'Total Reports', value: o.total || 0, icon: FileText, color: '#0A1D37', bg: '#e8edf5', change: 'All time' },
    { label: 'Critical Cases', value: o.critical || 0, icon: AlertTriangle, color: '#ef4444', bg: '#fee2e2', change: 'Requires immediate action' },
    { label: 'In Investigation', value: o.in_progress || 0, icon: Activity, color: '#3b82f6', bg: '#dbeafe', change: 'Active investigations' },
    { label: 'Resolved', value: o.resolved || 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7', change: 'Successfully closed' },
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
    { name: 'Resolved', value: o.resolved || 0, fill: '#22c55e' },
    { name: 'Closed', value: o.closed || 0, fill: '#94a3b8' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-navy-900)' }}>
            <TrendingUp size={20} style={{ color: 'var(--color-gold-500)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy-900)' }}>
              Executive Dashboard
            </h1>
            <p className="text-slate-500 text-sm">Whistleblowing system overview — {new Date().toLocaleDateString('en-ET', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
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

      {/* Escalated Cases Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="text-red-500" size={18} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
            Escalated Cases for Immediate CEO Action
          </h2>
        </div>
        {!stats?.escalated_cases || stats.escalated_cases.length === 0 ? (
          <p className="text-slate-400 text-xs py-4 text-center">No escalated cases pending action.</p>
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stats.escalated_cases.map(c => (
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
                      <span className="badge badge-escalated">Escalated</span>
                    </td>
                    <td className="text-slate-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-slate-600">
                      {c.assigned_investigator || <span className="text-red-400 font-medium italic">Unassigned</span>}
                    </td>
                    <td>
                      <a href={`/cases/${c.id}`} className="btn btn-ghost text-xs py-1 px-2">
                        View Details
                      </a>
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
    </div>
  );
}
