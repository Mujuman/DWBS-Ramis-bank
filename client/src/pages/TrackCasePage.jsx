import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { format } from 'date-fns';
import { RefreshCw, FileText, ChevronRight } from 'lucide-react';
import { STATUS_BADGE, formatStatus } from '../constants/caseWorkflow';

export default function TrackCasePage() {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const myUserId = user?.userId ?? user?.id;
  const filteredCases = useMemo(() => {
    if (!myUserId || cases.length === 0) return cases;
    return cases.filter((c) => {
      if (c.owner_id) return String(c.owner_id) === String(myUserId);
      return c.submitted_by_type !== 'anonymous';
    });
  }, [cases, myUserId]);

  const fetchCases = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.get('/cases', { params: { limit: 50 } });
      setCases(res.data.cases || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load submitted reports.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchCases();
  }, [user]);

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-2">Submitted Reports</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy-900)' }}>
            Your Submitted Reports
          </h1>
          <p className="text-slate-500 mt-2 max-w-2xl">
            This list includes reports filed by your staff account. There is no search field here — only your own submissions are shown.
          </p>
        </div>

        <button type="button" onClick={fetchCases} className="btn btn-ghost inline-flex items-center gap-2">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <span className="spinner spinner-navy mx-auto" />
          </div>
        ) : error ? (
          <div className="py-12 text-center text-slate-500">
            <p>{error}</p>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 w-14 h-14 rounded-full flex items-center justify-center bg-slate-100 text-slate-500">
              <FileText size={24} />
            </div>
            <p className="text-sm text-slate-400">No submitted reports were found for your account.</p>
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
                {filteredCases.map((c) => {
                  const caseId = c.id || c.case_id || c.reference_id;
                  return (
                    <tr key={caseId}>
                      <td>
                        <span className="font-mono text-xs font-bold" style={{ color: 'var(--color-navy-900)' }}>
                          {c.reference_id}
                        </span>
                      </td>
                      <td className="text-slate-600">{c.category?.replace(/_/g, ' ')}</td>
                      <td>
                        <span className={`badge badge-${(c.priority || 'Medium').toLowerCase()}`}>
                          {c.priority || 'Medium'}
                        </span>
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
                        <Link to={`/cases/${caseId}`} className="btn btn-ghost text-xs py-1 px-2 inline-flex items-center gap-1">
                          View <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
