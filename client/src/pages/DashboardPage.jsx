import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  FileText, Clock, CheckCircle, AlertTriangle,
  TrendingUp, Plus, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { STATUS_BADGE, formatStatus } from '../constants/caseWorkflow';

export default function DashboardPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const casesRes = await api.get('/cases', { params: { limit: 5 } });
        setCases(casesRes.data.cases);

        const canViewStats = ['Compliance_Officer', 'CEO', 'System_Admin', 'Investigator'].includes(user?.role);
        if (canViewStats) {
          const statsRes = await api.get('/cases/stats');
          setStats(statsRes.data);
        }
      } catch (_) { }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const statCards = stats ? [
    { label: 'Total Cases', value: stats.overview?.total || 0, icon: FileText, color: 'var(--color-navy-900)', bg: '#e8edf5' },
    { label: 'New', value: stats.overview?.new_cases || 0, icon: AlertTriangle, color: 'var(--color-gold-600)', bg: '#fef3c7' },
    { label: 'In Progress', value: stats.overview?.in_progress || 0, icon: Clock, color: '#3b82f6', bg: '#dbeafe' },
    { label: 'Substantiated', value: stats.overview?.substantiated || 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7' },
  ] : [];

  return (
    <div className="p-6 max-w-6xl mx-auto fade-in-up">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy-900)' }}>
            Welcome, {user?.display_name?.split(' ')[0]}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {format(new Date(), 'EEEE, MMMM d, yyyy')} — DWBS Staff Portal
          </p>
        </div>
        <Link to="/report" className="btn btn-gold">
          <Plus size={16} /> New Report
        </Link>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(s => (
            <div key={s.label} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: s.bg }}>
                  <s.icon size={20} style={{ color: s.color }} />
                </div>
                <TrendingUp size={14} className="text-slate-300" />
              </div>
              <p className="text-3xl font-extrabold mb-1" style={{ color: 'var(--color-navy-900)' }}>
                {s.value}
              </p>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recent Cases */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold" style={{ color: 'var(--color-navy-900)' }}>
            Recent Cases
          </h2>
          <Link to="/cases" className="btn btn-ghost text-sm py-1.5 px-3 flex items-center gap-1">
            View All <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <span className="spinner spinner-navy mx-auto" />
            <p className="text-sm text-slate-400 mt-3">Loading...</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="py-12 text-center">
            <FileText size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-400">No cases found.</p>
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
                  <th>Submitted</th>
                  <th>Assigned To</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => (
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
                    <td className="text-slate-500 text-xs">
                      {format(new Date(c.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="text-slate-600 text-xs">
                      {c.assigned_investigator || <span className="text-slate-300">Unassigned</span>}
                    </td>
                    <td>
                      <Link to={`/cases/${c.id}`} className="btn btn-ghost text-xs py-1 px-2">
                        View <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
