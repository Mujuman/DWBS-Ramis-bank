import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Users, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { format } from 'date-fns';

const ROLES = ['Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO', 'System_Admin', 'Auditor'];
const ROLE_COLORS = {
  System_Admin: 'bg-purple-100 text-purple-700',
  CEO: 'bg-amber-100 text-amber-700',
  Compliance_Officer: 'bg-blue-100 text-blue-700',
  Investigator: 'bg-teal-100 text-teal-700',
  Branch_Manager: 'bg-indigo-100 text-indigo-700',
  Employee: 'bg-slate-100 text-slate-600',
};

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'Employee',
    department: '',
  });

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (_) {}
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/cases/stats');
      setStats(res.data);
    } catch (_) {}
  };

  const refreshDashboard = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchStats()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshDashboard();
  }, []);

  const totalReports = stats?.overview?.total ?? 0;
  const closedInvestigations = stats?.overview?.closed ?? ((stats?.overview?.complaint_dismissed || 0) + (stats?.overview?.dismissed_no_evidence || 0) + (stats?.overview?.substantiated || 0));
  const activeInvestigations = stats ? Math.max(0, (stats?.overview?.total ?? 0) - closedInvestigations) : 0;

  const changeRole = async (userId, newRole) => {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      toast.success('Role updated');
      fetchUsers();
    } catch (_) { toast.error('Failed to update role'); }
  };

  const toggleActive = async (user) => {
    try {
      await api.patch(`/users/${user.id}/active`, { is_active: !user.is_active });
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (_) { toast.error('Failed to update status'); }
  };

  const handleNewUserChange = (e) => {
    setNewUser(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const createUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.email || !newUser.password || !newUser.department) {
      toast.error('All user fields are required');
      return;
    }
    setCreating(true);
    try {
      await api.post('/users', newUser);
      toast.success('Staff account created successfully');
      setNewUser({ username: '', email: '', password: '', role: 'Employee', department: '' });
      refreshDashboard();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

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

        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
              Create Staff Account
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              System Administrators can create staff accounts here. Public registration is disabled.
            </p>
          </div>
          <form onSubmit={createUser} className="p-6 grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Username</label>
              <input
                name="username"
                value={newUser.username}
                onChange={handleNewUserChange}
                className="form-input"
                placeholder="e.g. jdoe"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Email</label>
              <input
                name="email"
                value={newUser.email}
                onChange={handleNewUserChange}
                type="email"
                className="form-input"
                placeholder="jdoe@rammisbank.et"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Password</label>
              <input
                name="password"
                value={newUser.password}
                onChange={handleNewUserChange}
                type="password"
                className="form-input"
                placeholder="Strong password"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Role</label>
              <select
                name="role"
                value={newUser.role}
                onChange={handleNewUserChange}
                className="form-select"
              >
                {ROLES.map(role => (
                  <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Department</label>
              <input
                name="department"
                value={newUser.department}
                onChange={handleNewUserChange}
                className="form-input"
                placeholder="e.g. Compliance, IT_Security"
              />
            </div>
            <div className="lg:col-span-3 text-right">
              <button
                type="submit"
                disabled={creating}
                className="btn btn-primary"
              >
                {creating ? 'Creating user...' : 'Create Staff User'}
              </button>
            </div>
          </form>
        </div>

        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
              Staff Accounts ({users.length})
            </h2>
          </div>
          {loading ? (
            <div className="py-12 text-center"><span className="spinner spinner-navy mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="font-medium text-sm text-slate-700">{u.username}</td>
                      <td className="text-xs text-slate-500">{u.email}</td>
                      <td className="text-xs text-slate-500">{u.department || '—'}</td>
                      <td>
                        <select
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
                          value={u.role}
                          onChange={e => changeRole(u.id, e.target.value)}>
                          {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                        </select>
                      </td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-resolved' : 'badge-closed'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-xs text-slate-400 font-mono">
                        {u.created_at ? format(new Date(u.created_at), 'MMM d, HH:mm') : 'Unknown'}
                      </td>
                      <td>
                        <button onClick={() => toggleActive(u)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                            u.is_active
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-green-700 hover:bg-green-50'
                          }`}>
                          {u.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      </div>
    </div>
  );
}
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
            </div>
          )}

          {tab === 'users' && (
            <div className="space-y-6">
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
                    Create Staff Account
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    System Administrators can create staff accounts here. Public registration is disabled.
                  </p>
                </div>
                <form onSubmit={createUser} className="p-6 grid gap-4 lg:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Username</label>
                    <input
                      name="username"
                      value={newUser.username}
                      onChange={handleNewUserChange}
                      className="form-input"
                      placeholder="e.g. jdoe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Email</label>
                    <input
                      name="email"
                      value={newUser.email}
                      onChange={handleNewUserChange}
                      type="email"
                      className="form-input"
                      placeholder="jdoe@rammisbank.et"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Password</label>
                    <input
                      name="password"
                      value={newUser.password}
                      onChange={handleNewUserChange}
                      type="password"
                      className="form-input"
                      placeholder="Strong password"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Role</label>
                    <select
                      name="role"
                      value={newUser.role}
                      onChange={handleNewUserChange}
                      className="form-select"
                    >
                      {ROLES.map(role => (
                        <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Department</label>
                    <input
                      name="department"
                      value={newUser.department}
                      onChange={handleNewUserChange}
                      className="form-input"
                      placeholder="e.g. Compliance, IT_Security"
                    />
                  </div>
                  <div className="lg:col-span-3 text-right">
                    <button
                      type="submit"
                      disabled={creating}
                      className="btn btn-primary"
                    >
                      {creating ? 'Creating user...' : 'Create Staff User'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
                    Staff Accounts ({users.length})
                  </h2>
                </div>
                {loading ? (
                  <div className="py-12 text-center"><span className="spinner spinner-navy mx-auto" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Email</th>
                          <th>Department</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Created At</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id}>
                            <td className="font-medium text-sm text-slate-700">{u.username}</td>
                            <td className="text-xs text-slate-500">{u.email}</td>
                            <td className="text-xs text-slate-500">{u.department || '—'}</td>
                            <td>
                              <select
                                className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
                                value={u.role}
                                onChange={e => changeRole(u.id, e.target.value)}>
                                {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                              </select>
                            </td>
                            <td>
                              <span className={`badge ${u.is_active ? 'badge-resolved' : 'badge-closed'}`}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="text-xs text-slate-400 font-mono">
                              {u.created_at ? format(new Date(u.created_at), 'MMM d, HH:mm') : 'Unknown'}
                            </td>
                            <td>
                              <button onClick={() => toggleActive(u)}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                                  u.is_active
                                    ? 'text-red-600 hover:bg-red-50'
                                    : 'text-green-700 hover:bg-green-50'
                                }`}>
                                {u.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
