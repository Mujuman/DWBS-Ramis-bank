import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Search, Filter, Download, Calendar, User, FileText, AlertCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const AuditDashboard = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50 });
  
  // Filters
  const [filters, setFilters] = useState({
    action: '',
    case_id: '',
    user_id: '',
    from_date: '',
    to_date: '',
  });

  useEffect(() => {
    fetchAuditLogs();
  }, [pagination.page]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '')),
      });

      const response = await api.get(`/audit?${params}`);
      setLogs(response.data.logs);
      setPagination(prev => ({ ...prev, total: response.data.pagination.total }));
    } catch (error) {
      toast.error('Failed to load audit logs');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchAuditLogs();
  };

  const clearFilters = () => {
    setFilters({
      action: '',
      case_id: '',
      user_id: '',
      from_date: '',
      to_date: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
    setTimeout(fetchAuditLogs, 100);
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Action', 'Case ID', 'User ID', 'Details'];
    const csvData = logs.map(log => [
      new Date(log.created_at).toLocaleString(),
      log.action,
      log.target_case_id || 'N/A',
      log.performed_by || 'System',
      log.metadata || '',
    ]);

    const csv = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getActionBadgeColor = (action) => {
    if (action.includes('LOGIN'))                        return { bg: '#dbeafe', color: '#1d4ed8' };
    if (action.includes('CREATE') || action.includes('SUBMIT')) return { bg: '#dcfce7', color: '#15803d' };
    if (action.includes('UPDATE') || action.includes('ASSIGN') || action.includes('EDIT')) return { bg: '#fef3c7', color: '#b45309' };
    if (action.includes('DELETE') || action.includes('FAILED') || action.includes('ESCALAT')) return { bg: '#fee2e2', color: '#b91c1c' };
    if (action.includes('NOTE') || action.includes('MESSAGE'))  return { bg: '#ede9fe', color: '#6d28d9' };
    return { bg: '#f1f5f9', color: '#475569' };
  };

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up" style={{ background: 'var(--color-slate-50)', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        className="card p-6 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0A1D37, #1e3a5f)' }}>
            <Shield className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy-900)' }}>Audit Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">Independent oversight and compliance monitoring</p>
          </div>
        </div>
        <button onClick={exportToCSV} disabled={logs.length === 0}
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </motion.div>

      {/* ── Filters ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4" style={{ color: 'var(--color-navy-900)' }} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          {[
            { label: 'Action', field: 'action', placeholder: 'e.g. LOGIN, CREATE', type: 'text' },
            { label: 'Case ID', field: 'case_id', placeholder: 'Case ID', type: 'number' },
            { label: 'User ID', field: 'user_id', placeholder: 'User ID', type: 'number' },
            { label: 'From Date', field: 'from_date', placeholder: '', type: 'date' },
            { label: 'To Date', field: 'to_date', placeholder: '', type: 'date' },
          ].map(f => (
            <div key={f.field}>
              <label className="form-label text-xs">{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={filters[f.field]}
                onChange={e => handleFilterChange(f.field, e.target.value)}
                className="form-input text-sm w-full" />
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={applyFilters} className="btn btn-primary text-sm flex items-center gap-2">
            <Search className="w-4 h-4" /> Apply Filters
          </button>
          <button onClick={clearFilters} className="btn btn-ghost text-sm">Clear All</button>
        </div>
      </motion.div>

      {/* ── Audit Logs Table ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
        className="card overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
            Audit Trail
          </h2>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: 'rgba(10,29,55,0.07)', color: 'var(--color-navy-900)' }}>
            {pagination.total} records
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="spinner spinner-navy" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <AlertCircle className="w-14 h-14 mb-4 text-slate-300" />
              <p className="text-base font-semibold">No audit logs found</p>
              <p className="text-sm mt-1 text-slate-400">Try adjusting your filters</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th><div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Timestamp</div></th>
                  <th><div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Action</div></th>
                  <th>Case ID</th>
                  <th><div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> User</div></th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => {
                  const badge = getActionBadgeColor(log.action);
                  return (
                    <motion.tr key={log.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                      className="hover:bg-slate-50 transition-colors">
                      <td className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold"
                          style={{ background: badge.bg, color: badge.color }}>
                          {log.action}
                        </span>
                      </td>
                      <td className="text-sm font-mono font-bold" style={{ color: 'var(--color-navy-900)' }}>
                        {log.target_case_id || <span className="text-slate-300 font-normal">—</span>}
                      </td>
                      <td className="text-sm text-slate-700">
                        {log.performed_by || <span className="text-slate-400 italic text-xs">System</span>}
                      </td>
                      <td className="text-xs text-slate-500 max-w-xs truncate">
                        {log.metadata || <span className="text-slate-300">—</span>}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && logs.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of <strong>{pagination.total}</strong>
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="btn btn-ghost text-sm disabled:opacity-40">
                ← Previous
              </button>
              <button onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page * pagination.limit >= pagination.total}
                className="btn btn-ghost text-sm disabled:opacity-40">
                Next →
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Info Notice ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.18)' }}>
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#1d4ed8' }} />
        <div className="text-sm" style={{ color: '#1e3a8a' }}>
          <p className="font-semibold mb-0.5">Auditor Access Notice</p>
          <p className="text-xs" style={{ color: '#3b5fa0' }}>
            Read-only access. Audit records are immutable and cannot be modified or deleted.
            All system activity is automatically logged for compliance and oversight purposes.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AuditDashboard;
