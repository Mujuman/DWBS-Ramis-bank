import { useState, useEffect } from 'react';
import api from '../services/api';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/cases/stats');
      setStats(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const refreshDashboard = async () => {
    await Promise.all([fetchUsers(), fetchStats()]);
  };

  useEffect(() => {
    refreshDashboard();
  }, []);

  const totalReports = stats?.overview?.total ?? 0;
  const closedInvestigations = stats?.overview?.closed ?? ((stats?.overview?.complaint_dismissed || 0) + (stats?.overview?.dismissed_no_evidence || 0) + (stats?.overview?.substantiated || 0));
  const activeInvestigations = stats ? Math.max(0, (stats?.overview?.total ?? 0) - closedInvestigations) : 0;


  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up">
       <div className="flex items-center justify-between mb-6">
         <div>
           <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy-900)' }}>Admin Dashboard</h1>
           <p className="text-slate-500 text-sm">System Admin dashboard for staff user management and report summaries</p>
         </div>
         <button onClick={refreshDashboard} className="btn btn-ghost">
           <RefreshCw size={15} /> Refresh
         </button>
       </div>
      <section className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: users.length, note: 'Staff accounts in the system' },
            { label: 'Total Reports', value: totalReports, note: 'Submitted case reports' },
            { label: 'Active Investigations', value: activeInvestigations, note: 'Reports still under review or investigation' },
            { label: 'Closed Investigations', value: closedInvestigations, note: 'Resolved or dismissed cases' },
          ].map((stat) => (
            <div key={stat.label} className="card p-5 border border-slate-200">
              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-500">{stat.label}</p>
              </div>
              <div className="text-3xl font-bold" style={{ color: 'var(--color-navy-900)' }}>{stat.value}</div>
              <p className="text-xs text-slate-400 mt-2">{stat.note}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold" style={{ color: 'var(--color-navy-900)' }}>
                Recent Users
              </h2>
              <p className="text-xs text-slate-500 mt-1">Newest staff accounts created in the system.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.slice(0, 6).map((u) => (
                    <tr key={u.id}>
                      <td className="font-medium text-sm text-slate-700">{u.username}</td>
                      <td className="text-xs text-slate-500">{u.role.replace(/_/g, ' ')}</td>
                      <td className="text-xs text-slate-500">{u.department || '—'}</td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-resolved' : 'badge-closed'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-xs text-slate-400 font-mono">{u.created_at ? format(new Date(u.created_at), 'MMM d') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-6 border border-slate-200">
            <h2 className="text-base font-bold mb-3" style={{ color: 'var(--color-navy-900)' }}>
              Admin Summary
            </h2>
            <p className="text-sm text-slate-600 mb-4">This view is designed for System Administrators to monitor user activity and high-level report counts without case content access.</p>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex items-center gap-3">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                Most recent staff accounts surfaced here.
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                Total reports and investigations counts only.
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-slate-500" />
                No case detail, evidence, or audit routes shown here.
              </li>
            </ul>
          </div>
        </div>
      </section>
  </div>
  );
}
