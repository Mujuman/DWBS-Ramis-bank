import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, Filter, ChevronRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { CASE_STATUSES, STATUS_BADGE, formatStatus } from '../constants/caseWorkflow';

const STATUSES = ['', ...CASE_STATUSES];
const PRIORITIES = ['', 'Critical', 'High', 'Medium', 'Low'];
const CATEGORIES = ['', 'Fraud', 'Corruption', 'Bribery', 'Abuse_of_Power', 'Procurement_Violation', 'System_Misuse'];
const PRIORITY_MAP = { Critical: 'badge-critical', High: 'badge-high', Medium: 'badge-medium', Low: 'badge-low' };

export default function CaseListPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 });
  const [filters, setFilters] = useState({ status: '', priority: '', category: '', search: '', branch_or_dept: '', case_id: '', from_date: '', to_date: '', page: 1 });

  const fetchCases = async (f = filters) => {
    setLoading(true);
    try {
      const params = {};
      if (f.status) params.status = f.status;
      if (f.priority) params.severity_level = f.priority;
      if (f.category) params.category = f.category;
      if (f.search) params.search = f.search;
      if (f.branch_or_dept) params.branch_or_dept = f.branch_or_dept;
      if (f.case_id) params.case_id = f.case_id;
      if (f.from_date) params.from_date = f.from_date;
      if (f.to_date) params.to_date = f.to_date;
      params.page = f.page;
      params.limit = 20;
      const res = await api.get('/cases', { params });
      setCases(res.data.cases);
      setPagination(res.data.pagination);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { fetchCases(); }, []);

  const setFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value, page: 1 };
    setFilters(newFilters);
    fetchCases(newFilters);
  };

  const setPage = (p) => {
    const newFilters = { ...filters, page: p };
    setFilters(newFilters);
    fetchCases(newFilters);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy-900)' }}>Case Management</h1>
          <p className="text-slate-500 text-sm">{pagination.total} total cases</p>
        </div>
        <button onClick={() => fetchCases()} className="btn btn-ghost">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" className="form-input pl-9 text-sm"
              placeholder="Search by reference ID..."
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)} />
          </div>
          <select className="form-select text-sm flex-1 min-w-36"
            value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.slice(1).map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
          </select>
          <select className="form-select text-sm flex-1 min-w-32"
            value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
            <option value="">All Priorities</option>
            {PRIORITIES.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="form-select text-sm flex-1 min-w-36"
            value={filters.category} onChange={e => setFilter('category', e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
          <input type="text" className="form-input text-sm flex-1 min-w-36"
            placeholder="Branch / department"
            value={filters.branch_or_dept}
            onChange={e => setFilter('branch_or_dept', e.target.value)} />
          <input type="number" className="form-input text-sm flex-1 min-w-28"
            placeholder="Case ID"
            value={filters.case_id}
            onChange={e => setFilter('case_id', e.target.value)} />
          <input type="date" className="form-input text-sm flex-1 min-w-36"
            value={filters.from_date}
            onChange={e => setFilter('from_date', e.target.value)} />
          <input type="date" className="form-input text-sm flex-1 min-w-36"
            value={filters.to_date}
            onChange={e => setFilter('to_date', e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <span className="spinner spinner-navy mx-auto" />
          </div>
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
                  <th>Reference ID</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Submitted By</th>
                  <th>Assigned To</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => (
                  <tr key={c.id}>
                    <td>
                      <span className="font-mono text-xs font-bold tracking-wide"
                        style={{ color: 'var(--color-navy-900)' }}>
                        {c.reference_id}
                      </span>
                    </td>
                    <td className="text-slate-600 text-sm">{c.category?.replace(/_/g, ' ')}</td>
                    <td><span className={`badge ${PRIORITY_MAP[c.priority]}`}>{c.priority}</span></td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[c.status] || 'badge-review'}`}>
                        {formatStatus(c.status)}
                      </span>
                    </td>
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
                      {c.assigned_investigator || <span className="text-slate-300 italic">Unassigned</span>}
                    </td>
                    <td className="text-xs text-slate-400">
                      {format(new Date(c.created_at), 'MMM d, yyyy')}
                    </td>
                    <td>
                      <Link to={`/cases/${c.id}`} className="btn btn-ghost text-xs py-1 px-2">
                        Open <ChevronRight size={12} />
                      </Link>
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
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    p === pagination.page ? 'text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  style={p === pagination.page ? { background: 'var(--color-navy-900)' } : {}}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
