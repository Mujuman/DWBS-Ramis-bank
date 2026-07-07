import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Users, Shield, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { format } from 'date-fns';

const ROLES = ['Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO', 'System_Admin'];
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
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('users');

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (_) {}
  };

  const fetchAudit = async () => {
    try {
      const res = await api.get('/audit');
      setAudit(res.data.logs || []);
    } catch (_) {}
  };

  useEffect(() => {
    Promise.all([fetchUsers(), fetchAudit()]).finally(() => setLoading(false));
  }, []);

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

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy-900)' }}>Administration</h1>
          <p className="text-slate-500 text-sm">System configuration and user management</p>
        </div>
        <button onClick={() => { fetchUsers(); fetchAudit(); }} className="btn btn-ghost">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'var(--color-slate-100)' }}>
        {[['users', Users, 'User Management'], ['audit', Shield, 'Audit Logs']].map(([key, Icon, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === key ? 'shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            style={tab === key ? { background: 'var(--color-navy-900)', color: 'var(--color-gold-500)' } : {}}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
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
                    <th>Display Name</th>
                    <th>Username (AD)</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: 'var(--color-navy-900)', color: 'var(--color-gold-500)' }}>
                            {u.display_name?.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-sm text-slate-700">{u.display_name}</span>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-slate-500">{u.ad_username}</td>
                      <td className="text-xs text-slate-500">{u.email}</td>
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
                      <td className="text-xs text-slate-400">
                        {u.last_login ? format(new Date(u.last_login), 'MMM d, HH:mm') : 'Never'}
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
      )}

      {/* Audit Tab */}
      {tab === 'audit' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Shield size={16} style={{ color: 'var(--color-navy-900)' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-navy-900)' }}>
              Immutable Audit Log
            </h2>
            <span className="badge badge-resolved text-xs ml-auto">INSERT-Only DB User</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Case ID</th>
                  <th>Performed By</th>
                  <th>Type</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {audit.map(log => (
                  <tr key={log.id}>
                    <td className="text-xs text-slate-500 font-mono whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d HH:mm:ss')}
                    </td>
                    <td>
                      <span className="text-xs font-mono font-bold"
                        style={{ color: 'var(--color-navy-900)' }}>
                        {log.action}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">{log.case_id || '—'}</td>
                    <td className="text-xs text-slate-600 font-mono">{log.performed_by}</td>
                    <td>
                      <span className={`badge text-xs ${
                        log.performed_by_type === 'staff' ? 'badge-review'
                        : log.performed_by_type === 'anonymous' ? 'badge-new'
                        : 'badge-closed'
                      }`}>
                        {log.performed_by_type}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400 font-mono max-w-xs truncate">
                      {log.metadata ? JSON.stringify(log.metadata).slice(0, 60) + '...' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
