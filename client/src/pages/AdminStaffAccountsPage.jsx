import { useState, useMemo, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import {
  Users, Search, Filter, ToggleLeft, ToggleRight,
  Edit3, Trash2, KeyRound, X, Save, AlertTriangle,
  ShieldCheck, Eye, EyeOff, RefreshCw, UserCheck,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ROLE_FILTERS = ['All', 'Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO', 'System_Admin', 'Auditor'];
const STATUS_FILTERS = ['All', 'Active', 'Inactive'];
const ROLES = ['Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO', 'System_Admin', 'Auditor'];
const ROLE_LABELS = {
  Employee:           'Employee',
  Branch_Manager:     'Branch Manager',
  Investigator:       'Investigator',
  Compliance_Officer: 'Ethics & Anti-Corruption',
  CEO:                'CEO',
  System_Admin:       'System Admin',
  Auditor:            'Auditor',
};
const ROLE_COLORS = {
  Employee:           { bg: '#eff6ff', color: '#1d4ed8' },
  Branch_Manager:     { bg: '#f0fdf4', color: '#15803d' },
  Investigator:       { bg: '#fef3c7', color: '#b45309' },
  Compliance_Officer: { bg: '#ede9fe', color: '#6d28d9' },
  CEO:                { bg: '#fee2e2', color: '#b91c1c' },
  System_Admin:       { bg: '#e0f2fe', color: '#0369a1' },
  Auditor:            { bg: '#f1f5f9', color: '#475569' },
};

// ── Reusable modal wrapper ──────────────────────────────────
function Modal({ title, subtitle, icon: Icon, iconBg, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,29,55,0.55)', backdropFilter: 'blur(2px)' }}>
      <div className="card p-0 w-full max-w-md mx-auto fade-in-up"
        style={{ maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(10,29,55,0.25)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: iconBg || '#e8edf5' }}>
                <Icon size={17} style={{ color: iconBg ? undefined : 'var(--color-navy-900)' }} />
              </div>
            )}
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--color-navy-900)' }}>{title}</h3>
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0">
            <X size={16} className="text-slate-400" />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminStaffAccountsPage() {
  const { user: me } = useAuth();

  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [roleFilter, setRoleFilter]     = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // ── Edit modal ─────────────────────────────────────────────
  const [editTarget, setEditTarget]     = useState(null); // user object
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail]       = useState('');
  const [editDept, setEditDept]         = useState('');
  const [editRole, setEditRole]         = useState('');
  const [saving, setSaving]             = useState(false);

  // ── Delete modal ───────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  // ── Reset password modal ───────────────────────────────────
  const [pwTarget, setPwTarget]         = useState(null);
  const [newPw, setNewPw]               = useState('');
  const [confirmPw, setConfirmPw]       = useState('');
  const [showPw, setShowPw]             = useState(false);
  const [resetting, setResetting]       = useState(false);

  // ── Load ───────────────────────────────────────────────────
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch {
      toast.error('Unable to load staff accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  // ── Filter ────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (roleFilter !== 'All' && u.role !== roleFilter) return false;
      if (statusFilter !== 'All') {
        if (statusFilter === 'Active' && !u.is_active) return false;
        if (statusFilter === 'Inactive' && u.is_active) return false;
      }
      if (!q) return true;
      return [u.username, u.email, u.role, u.department]
        .filter(Boolean).some(f => f.toLowerCase().includes(q));
    });
  }, [users, search, roleFilter, statusFilter]);

  // ── Open edit ─────────────────────────────────────────────
  const openEdit = (u) => {
    setEditTarget(u);
    setEditUsername(u.username);
    setEditEmail(u.email);
    setEditDept(u.department || '');
    setEditRole(u.role);
  };

  // ── Save edit ─────────────────────────────────────────────
  const saveEdit = async () => {
    if (!editUsername.trim() || !editEmail.trim()) {
      toast.error('Username and email are required');
      return;
    }
    setSaving(true);
    try {
      // Update details
      await api.patch(`/users/${editTarget.id}`, {
        username: editUsername.trim(),
        email: editEmail.trim(),
        department: editDept.trim(),
      });
      // Update role separately if changed
      if (editRole !== editTarget.role) {
        await api.patch(`/users/${editTarget.id}/role`, { role: editRole });
      }
      toast.success('User updated successfully');
      setEditTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user');
    }
    setSaving(false);
  };

  // ── Toggle active ─────────────────────────────────────────
  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u.id}/active`, { is_active: !u.is_active });
      toast.success(`User ${u.is_active ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch {
      toast.error('Failed to update status');
    }
  };

  // ── Delete ────────────────────────────────────────────────
  const doDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success(`User "${deleteTarget.username}" deleted`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
    setDeleting(false);
  };

  // ── Reset password ────────────────────────────────────────
  const doResetPassword = async () => {
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    setResetting(true);
    try {
      await api.patch(`/users/${pwTarget.id}/password`, { password: newPw });
      toast.success(`Password reset for "${pwTarget.username}"`);
      setPwTarget(null);
      setNewPw('');
      setConfirmPw('');
      setShowPw(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    }
    setResetting(false);
  };

  const openResetPw = (u) => {
    setPwTarget(u);
    setNewPw('');
    setConfirmPw('');
    setShowPw(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy-900)' }}>
            Staff Accounts
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage staff accounts — edit details, reset passwords, or remove users.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-2 shadow-sm">
            <Users size={16} className="text-slate-400" />
            <div>
              <div className="text-xs text-slate-500">Total</div>
              <div className="text-base font-bold" style={{ color: 'var(--color-navy-900)' }}>{users.length}</div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-2 shadow-sm">
            <Filter size={16} className="text-slate-400" />
            <div>
              <div className="text-xs text-slate-500">Showing</div>
              <div className="text-base font-bold" style={{ color: 'var(--color-navy-900)' }}>{filteredUsers.length}</div>
            </div>
          </div>
          <button onClick={fetchUsers} className="btn btn-ghost">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr] mb-5">
        <div className="card border border-slate-200 p-4 flex items-center gap-3">
          <Search size={16} className="text-slate-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full form-input border-0 p-0 shadow-none focus:ring-0"
            placeholder="Search by username, email, role, or department…" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card border border-slate-200 p-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="form-select mt-1.5 text-sm">
              {ROLE_FILTERS.map(f => (
                <option key={f} value={f}>{f === 'All' ? 'All Roles' : (ROLE_LABELS[f] || f.replace(/_/g, ' '))}</option>
              ))}
            </select>
          </div>
          <div className="card border border-slate-200 p-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-select mt-1.5 text-sm">
              {STATUS_FILTERS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card overflow-hidden border border-slate-200">
        {loading ? (
          <div className="py-16 text-center"><span className="spinner spinner-navy mx-auto" /></div>
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
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-14 text-center text-slate-400">
                      No staff accounts match your search.
                    </td>
                  </tr>
                ) : filteredUsers.map(u => {
                  const rc = ROLE_COLORS[u.role] || { bg: '#f1f5f9', color: '#475569' };
                  const isSelf = u.id === me?.userId;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: 'var(--color-navy-900)', color: 'var(--color-gold-500)' }}>
                            {u.username?.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-sm text-slate-800">{u.username}</span>
                          {isSelf && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: '#dbeafe', color: '#1d4ed8' }}>You</span>
                          )}
                        </div>
                      </td>
                      <td className="text-xs text-slate-500">{u.email}</td>
                      <td>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: rc.bg, color: rc.color }}>
                          {ROLE_LABELS[u.role] || u.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="text-xs text-slate-500">{u.department || '—'}</td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-resolved' : 'badge-closed'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-xs text-slate-400 font-mono">
                        {u.created_at ? format(new Date(u.created_at), 'MMM d, yyyy') : '—'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1 flex-wrap">
                          {/* Edit */}
                          <button onClick={() => openEdit(u)}
                            className="btn btn-ghost text-xs py-1 px-2 flex items-center gap-1"
                            title="Edit user details">
                            <Edit3 size={12} /> Edit
                          </button>
                          {/* Toggle active */}
                          <button onClick={() => toggleActive(u)} disabled={isSelf}
                            className={`btn text-xs py-1 px-2 flex items-center gap-1 ${
                              isSelf ? 'opacity-40 cursor-not-allowed btn-ghost'
                              : u.is_active ? 'btn-ghost text-amber-600 hover:bg-amber-50'
                              : 'btn-ghost text-green-700 hover:bg-green-50'
                            }`}
                            title={isSelf ? 'Cannot deactivate your own account' : u.is_active ? 'Deactivate' : 'Activate'}>
                            {u.is_active ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          {/* Reset password */}
                          <button onClick={() => openResetPw(u)}
                            className="btn btn-ghost text-xs py-1 px-2 flex items-center gap-1 text-violet-700 hover:bg-violet-50"
                            title="Reset password">
                            <KeyRound size={12} /> Reset PW
                          </button>
                          {/* Delete */}
                          <button onClick={() => setDeleteTarget(u)} disabled={isSelf}
                            className={`btn text-xs py-1 px-2 flex items-center gap-1 ${
                              isSelf ? 'opacity-40 cursor-not-allowed btn-ghost'
                              : 'btn-ghost text-red-600 hover:bg-red-50'
                            }`}
                            title={isSelf ? 'Cannot delete your own account' : 'Delete user'}>
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════ EDIT MODAL ══════════════ */}
      {editTarget && (
        <Modal
          title="Edit User"
          subtitle={`@${editTarget.username}`}
          icon={Edit3}
          iconBg="#dbeafe"
          onClose={() => setEditTarget(null)}
          footer={
            <>
              <button onClick={() => setEditTarget(null)} className="btn btn-ghost text-sm">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="btn btn-primary text-sm">
                {saving ? <><span className="spinner" /> Saving…</> : <><Save size={14} /> Save Changes</>}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="form-label text-xs">Username <span className="text-red-500">*</span></label>
              <input className="form-input text-sm" value={editUsername}
                onChange={e => setEditUsername(e.target.value)} placeholder="Username" />
            </div>
            <div>
              <label className="form-label text-xs">Email <span className="text-red-500">*</span></label>
              <input className="form-input text-sm" type="email" value={editEmail}
                onChange={e => setEditEmail(e.target.value)} placeholder="Email address" />
            </div>
            <div>
              <label className="form-label text-xs">Department</label>
              <input className="form-input text-sm" value={editDept}
                onChange={e => setEditDept(e.target.value)} placeholder="Department" />
            </div>
            <div>
              <label className="form-label text-xs">Role</label>
              <select className="form-select text-sm" value={editRole} onChange={e => setEditRole(e.target.value)}>
                {ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r] || r.replace(/_/g, ' ')}</option>
                ))}
              </select>
              {editRole !== editTarget.role && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle size={11} /> Role will change from <strong>{ROLE_LABELS[editTarget.role]}</strong> to <strong>{ROLE_LABELS[editRole]}</strong>
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ══════════════ DELETE MODAL ══════════════ */}
      {deleteTarget && (
        <Modal
          title="Delete User Account"
          subtitle="This action is permanent and cannot be undone"
          icon={Trash2}
          iconBg="#fee2e2"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost text-sm">Cancel</button>
              <button onClick={doDelete} disabled={deleting}
                className="btn text-sm text-white"
                style={{ background: '#dc2626', borderColor: '#dc2626' }}>
                {deleting ? <><span className="spinner" /> Deleting…</> : <><Trash2 size={14} /> Delete User</>}
              </button>
            </>
          }
        >
          <div className="rounded-xl p-4 mb-4 flex items-start gap-3"
            style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800 mb-1">
                You are about to permanently delete this account.
              </p>
              <p className="text-xs text-red-700">
                All login access will be immediately revoked. This cannot be reversed.
              </p>
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(10,29,55,0.04)' }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: 'var(--color-navy-900)', color: 'var(--color-gold-500)' }}>
                {deleteTarget.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{deleteTarget.username}</p>
                <p className="text-xs text-slate-500">{deleteTarget.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="text-xs">
                <span className="text-slate-500">Role</span>
                <p className="font-semibold text-slate-700 mt-0.5">{ROLE_LABELS[deleteTarget.role]}</p>
              </div>
              <div className="text-xs">
                <span className="text-slate-500">Department</span>
                <p className="font-semibold text-slate-700 mt-0.5">{deleteTarget.department || '—'}</p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════════════ RESET PASSWORD MODAL ══════════════ */}
      {pwTarget && (
        <Modal
          title="Reset Password"
          subtitle={`Set a new password for @${pwTarget.username}`}
          icon={KeyRound}
          iconBg="#ede9fe"
          onClose={() => setPwTarget(null)}
          footer={
            <>
              <button onClick={() => setPwTarget(null)} className="btn btn-ghost text-sm">Cancel</button>
              <button onClick={doResetPassword} disabled={resetting}
                className="btn btn-primary text-sm">
                {resetting ? <><span className="spinner" /> Resetting…</> : <><ShieldCheck size={14} /> Reset Password</>}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* User info strip */}
            <div className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: 'rgba(10,29,55,0.04)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: 'var(--color-navy-900)', color: 'var(--color-gold-500)' }}>
                {pwTarget.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{pwTarget.username}</p>
                <p className="text-xs text-slate-500">{ROLE_LABELS[pwTarget.role]}</p>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="form-label text-xs">New Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input className="form-input text-sm pr-10"
                  type={showPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="At least 8 characters" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {/* Strength hint */}
              {newPw.length > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  {[4, 8, 12].map((len, i) => (
                    <div key={i} className="flex-1 h-1 rounded-full"
                      style={{
                        background: newPw.length >= len
                          ? (i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#22c55e')
                          : '#e2e8f0',
                      }} />
                  ))}
                  <span className="text-xs text-slate-400">
                    {newPw.length < 4 ? 'Too short' : newPw.length < 8 ? 'Weak' : newPw.length < 12 ? 'Good' : 'Strong'}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="form-label text-xs">Confirm Password <span className="text-red-500">*</span></label>
              <input className="form-input text-sm"
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Re-enter new password" />
              {confirmPw && newPw !== confirmPw && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertTriangle size={11} /> Passwords do not match
                </p>
              )}
              {confirmPw && newPw === confirmPw && newPw.length >= 8 && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <UserCheck size={11} /> Passwords match
                </p>
              )}
            </div>

            <div className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(109,40,217,0.18)' }}>
              <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#6d28d9' }} />
              <p className="text-xs" style={{ color: '#4c1d95' }}>
                The user will need to use this new password on their next login. Notify them securely.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
