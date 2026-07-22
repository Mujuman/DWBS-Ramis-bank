import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Users, Search, Filter, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const ROLE_FILTERS = ['All', 'Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO', 'System_Admin', 'Auditor'];
const STATUS_FILTERS = ['All', 'Active', 'Inactive'];
const ROLES = ['Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO', 'System_Admin', 'Auditor'];
const ROLE_LABELS = {
  Employee: 'Employee',
  Branch_Manager: 'Branch Manager',
  Investigator: 'Investigator',
  Compliance_Officer: 'Ethics & Anti-Corruption',
  CEO: 'CEO',
  System_Admin: 'System Admin',
  Auditor: 'Auditor',
};

export default function AdminStaffAccountsPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (error) {
      toast.error('Unable to load staff accounts');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      if (roleFilter !== 'All' && user.role !== roleFilter) return false;
      if (statusFilter !== 'All') {
        const activeText = user.is_active ? 'Active' : 'Inactive';
        if (activeText !== statusFilter) return false;
      }

      if (!query) return true;
      return [user.username, user.email, user.role, user.department]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query));
    });
  }, [users, search, roleFilter, statusFilter]);

  const changeRole = async (userId, newRole) => {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      toast.success('Role updated');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update role');
      console.error(error);
    }
  };

  const toggleActive = async (user) => {
    try {
      await api.patch(`/users/${user.id}/active`, { is_active: !user.is_active });
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update status');
      console.error(error);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy-900)' }}>
            Staff Accounts
          </h1>
          <p className="text-slate-500 text-sm">
            Review and manage staff user accounts with search and filters.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-2 shadow-sm">
            <Users size={18} className="text-slate-400" />
            <div>
              <div className="text-xs text-slate-500">Total accounts</div>
              <div className="text-base font-bold text-slate-900">{users.length}</div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-2 shadow-sm">
            <Filter size={18} className="text-slate-400" />
            <div>
              <div className="text-xs text-slate-500">Showing</div>
              <div className="text-base font-bold text-slate-900">{filteredUsers.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr] mb-6">
        <div className="card border border-slate-200 p-4 flex items-center gap-3">
          <Search size={18} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full form-input"
            placeholder="Search by username, email, role, or department"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card border border-slate-200 p-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="form-select mt-2"
            >
              {ROLE_FILTERS.map((filter) => (
                <option key={filter} value={filter}>{filter === 'All' ? 'All' : (ROLE_LABELS[filter] || filter.replace(/_/g, ' '))}</option>
              ))}
            </select>
          </div>
          <div className="card border border-slate-200 p-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select mt-2"
            >
              {STATUS_FILTERS.map((filter) => (
                <option key={filter} value={filter}>{filter}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden border border-slate-200">
        {loading ? (
          <div className="py-12 text-center"><span className="spinner spinner-navy mx-auto" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium text-sm text-slate-700">{u.username}</td>
                    <td className="text-xs text-slate-500">{u.email}</td>
                    <td className="text-xs text-slate-500">{ROLE_LABELS[u.role] || u.role.replace(/_/g, ' ')}</td>
                    <td className="text-xs text-slate-500">{u.department || '—'}</td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-resolved' : 'badge-closed'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400 font-mono">
                      {u.created_at ? format(new Date(u.created_at), 'MMM d, HH:mm') : 'Unknown'}
                    </td>
                    <td className="flex flex-wrap gap-2">
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${u.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'
                          }`}
                      >
                        {u.is_active ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500">
                      No staff accounts match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
