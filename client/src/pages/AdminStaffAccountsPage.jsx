import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Users, Search, Filter, ToggleLeft, ToggleRight,
  Edit3, Trash2, KeyRound, X, Save, AlertTriangle,
  ShieldCheck, Eye, EyeOff, RefreshCw, UserCheck, UserPlus,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ROLE_FILTERS = ['All','Employee','Branch_Manager','Compliance_Officer','CEO','System_Admin','Auditor'];
const STATUS_FILTERS = ['All','Active','Inactive'];
const ROLES = ['Employee','Branch_Manager','Compliance_Officer','CEO','System_Admin','Auditor'];
const ROLE_LABELS = {
  Employee:'Employee', Branch_Manager:'Branch Manager',
  Compliance_Officer:'Ethics & Anti-Corruption', CEO:'CEO', System_Admin:'System Admin', Auditor:'Auditor',
};
const ROLE_COLORS = {
  Employee:           { bg:'#eff6ff', color:'#1d4ed8' },
  Branch_Manager:     { bg:'#f0fdf4', color:'#15803d' },
  Compliance_Officer: { bg:'#ede9fe', color:'#6d28d9' },
  CEO:                { bg:'#fee2e2', color:'#b91c1c' },
  System_Admin:       { bg:'#e0f2fe', color:'#0369a1' },
  Auditor:            { bg:'#f1f5f9', color:'#475569' },
};

// ── Modal shell ────────────────────────────────────────────────
function Modal({ title, subtitle, iconBg, icon: Icon, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,29,55,0.6)', backdropFilter: 'blur(3px)' }}>
      <div className="w-full max-w-md mx-auto fade-in-up"
        style={{
          background:'#fff', borderRadius:'1.25rem',
          boxShadow:'0 32px 80px rgba(10,29,55,0.28)',
          maxHeight:'92vh', overflow:'auto',
          border:'1px solid rgba(10,29,55,0.08)',
        }}>
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom:'1px solid #f1f5f9' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: iconBg || '#e8edf5' }}>
              <Icon size={18} style={{ color: iconBg ? '#fff' : 'var(--color-navy-900)' }} />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color:'var(--color-navy-900)' }}>{title}</p>
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors">
            <X size={15} className="text-slate-400" />
          </button>
        </div>
        {/* body */}
        <div className="px-6 py-5">{children}</div>
        {/* footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 py-4"
            style={{ borderTop:'1px solid #f1f5f9' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Icon action button ─────────────────────────────────────────
function ActionBtn({ onClick, disabled, title, icon: Icon, hoverBg, hoverColor, color }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
      style={{ color: color || '#64748b' }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = hoverBg || '#f1f5f9'; e.currentTarget.style.color = hoverColor || '#0A1D37'; }}}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = color || '#64748b'; }}>
      <Icon size={15} />
    </button>
  );
}

export default function AdminStaffAccountsPage() {
  const { user: me } = useAuth();

  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // edit
  const [editTarget, setEditTarget] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail]   = useState('');
  const [editDept, setEditDept]     = useState('');
  const [editRole, setEditRole]     = useState('');
  const [saving, setSaving]         = useState(false);

  // delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]     = useState(false);

  // reset pw
  const [pwTarget, setPwTarget]     = useState(null);
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [resetting, setResetting]   = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try { const r = await api.get('/users'); setUsers(r.data.users || []); }
    catch { toast.error('Unable to load staff accounts'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchUsers(); }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (roleFilter !== 'All' && u.role !== roleFilter) return false;
      if (statusFilter === 'Active' && !u.is_active) return false;
      if (statusFilter === 'Inactive' && u.is_active) return false;
      if (!q) return true;
      return [u.username, u.email, u.role, u.department].filter(Boolean).some(f => f.toLowerCase().includes(q));
    });
  }, [users, search, roleFilter, statusFilter]);

  const openEdit = (u) => { setEditTarget(u); setEditUsername(u.username); setEditEmail(u.email); setEditDept(u.department || ''); setEditRole(u.role); };
  const openResetPw = (u) => { setPwTarget(u); setNewPw(''); setConfirmPw(''); setShowPw(false); };

  const saveEdit = async () => {
    if (!editUsername.trim() || !editEmail.trim()) { toast.error('Username and email are required'); return; }
    setSaving(true);
    try {
      await api.patch(`/users/${editTarget.id}`, { username: editUsername.trim(), email: editEmail.trim(), department: editDept.trim() });
      if (editRole !== editTarget.role) await api.patch(`/users/${editTarget.id}/role`, { role: editRole });
      toast.success('User updated'); setEditTarget(null); fetchUsers();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update user'); }
    setSaving(false);
  };

  const toggleActive = async (u) => {
    try { await api.patch(`/users/${u.id}/active`, { is_active: !u.is_active }); toast.success(`User ${u.is_active ? 'deactivated' : 'activated'}`); fetchUsers(); }
    catch { toast.error('Failed to update status'); }
  };

  const doDelete = async () => {
    setDeleting(true);
    try { await api.delete(`/users/${deleteTarget.id}`); toast.success(`"${deleteTarget.username}" deleted`); setDeleteTarget(null); fetchUsers(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to delete user'); }
    setDeleting(false);
  };

  const doResetPassword = async () => {
    if (newPw.length < 8) { toast.error('At least 8 characters required'); return; }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    setResetting(true);
    try { await api.patch(`/users/${pwTarget.id}/password`, { password: newPw }); toast.success(`Password reset for "${pwTarget.username}"`); setPwTarget(null); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to reset password'); }
    setResetting(false);
  };

  const activeCount = users.filter(u => u.is_active).length;

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in-up">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background:'var(--color-navy-900)' }}>
            <Users size={20} style={{ color:'var(--color-gold-500)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color:'var(--color-navy-900)' }}>Staff Accounts</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage, edit, reset passwords, and remove staff users</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { label:'Total Users',  value: users.length,  color:'#0A1D37', bg:'#e8edf5' },
            { label:'Active',       value: activeCount,   color:'#15803d', bg:'#dcfce7' },
            { label:'Showing',      value: filteredUsers.length, color:'#6d28d9', bg:'#ede9fe' },
          ].map(s => (
            <div key={s.label} className="rounded-xl px-4 py-2.5 flex items-center gap-2.5"
              style={{ background:'#fff', border:'1px solid #e2e8f0', boxShadow:'0 1px 4px rgba(10,29,55,0.06)' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <div>
                <p className="text-xs text-slate-500 leading-none">{s.label}</p>
                <p className="text-lg font-extrabold leading-tight mt-0.5" style={{ color: s.color }}>{s.value}</p>
              </div>
            </div>
          ))}
          <button onClick={fetchUsers} className="btn btn-ghost">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>
      {/* ── Search & Filters ── */}
      <div className="card p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-56">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="form-input pl-9 text-sm" placeholder="Search username, email, department…" />
          </div>
          {/* Role */}
          <div className="flex items-center gap-2 min-w-44">
            <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Role</label>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="form-select text-sm flex-1">
              {ROLE_FILTERS.map(f => <option key={f} value={f}>{f === 'All' ? 'All Roles' : (ROLE_LABELS[f] || f.replace(/_/g,' '))}</option>)}
            </select>
          </div>
          {/* Status */}
          <div className="flex items-center gap-2 min-w-36">
            <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-select text-sm flex-1">
              {STATUS_FILTERS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-20 text-center"><span className="spinner spinner-navy mx-auto" /></div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center">
            <Users size={36} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-400 font-medium">No accounts match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => {
                  const rc = ROLE_COLORS[u.role] || { bg:'#f1f5f9', color:'#475569' };
                  const isSelf = u.id === me?.userId;
                  return (
                    <tr key={u.id}>
                      {/* User */}
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background:'var(--color-navy-900)', color:'var(--color-gold-500)' }}>
                            {u.username?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 leading-tight">{u.username}</p>
                            {isSelf && <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background:'#dbeafe', color:'#1d4ed8' }}>You</span>}
                          </div>
                        </div>
                      </td>
                      {/* Email */}
                      <td className="text-xs text-slate-500 max-w-40 truncate">{u.email}</td>
                      {/* Role badge */}
                      <td>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: rc.bg, color: rc.color }}>
                          {ROLE_LABELS[u.role] || u.role.replace(/_/g,' ')}
                        </span>
                      </td>
                      {/* Dept */}
                      <td className="text-xs text-slate-500">{u.department || '—'}</td>
                      {/* Status */}
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-resolved' : 'badge-closed'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {/* Date */}
                      <td className="text-xs text-slate-400 tabular-nums">
                        {u.created_at ? format(new Date(u.created_at),'MMM d, yyyy') : '—'}
                      </td>
                      {/* Actions — icon buttons */}
                      <td>
                        <div className="flex items-center justify-end gap-0.5">
                          {/* Edit */}
                          <ActionBtn onClick={() => openEdit(u)} title="Edit user details"
                            icon={Edit3} hoverBg="#dbeafe" hoverColor="#1d4ed8" />
                          {/* Toggle active */}
                          <ActionBtn onClick={() => toggleActive(u)} disabled={isSelf}
                            title={isSelf ? 'Cannot change your own status' : u.is_active ? 'Deactivate' : 'Activate'}
                            icon={u.is_active ? ToggleLeft : ToggleRight}
                            color={u.is_active ? '#d97706' : '#15803d'}
                            hoverBg={u.is_active ? '#fef3c7' : '#dcfce7'}
                            hoverColor={u.is_active ? '#b45309' : '#166534'} />
                          {/* Reset password */}
                          <ActionBtn onClick={() => openResetPw(u)} title="Reset password"
                            icon={KeyRound} hoverBg="#ede9fe" hoverColor="#6d28d9" />
                          {/* Delete */}
                          <ActionBtn onClick={() => setDeleteTarget(u)} disabled={isSelf}
                            title={isSelf ? 'Cannot delete your own account' : 'Delete user'}
                            icon={Trash2} hoverBg="#fee2e2" hoverColor="#b91c1c" color="#94a3b8" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Row count */}
        {!loading && filteredUsers.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Showing <strong className="text-slate-600">{filteredUsers.length}</strong> of <strong className="text-slate-600">{users.length}</strong> accounts
            </p>
          </div>
        )}
      </div>

      {/* ══ EDIT MODAL ══ */}
      {editTarget && (
        <Modal title="Edit User" subtitle={`Editing @${editTarget.username}`}
          icon={Edit3} iconBg="#1d4ed8" onClose={() => setEditTarget(null)}
          footer={<>
            <button onClick={() => setEditTarget(null)} className="btn btn-ghost text-sm">Cancel</button>
            <button onClick={saveEdit} disabled={saving} className="btn btn-primary text-sm">
              {saving ? <><span className="spinner" /> Saving…</> : <><Save size={14} /> Save Changes</>}
            </button>
          </>}>
          <div className="space-y-4">
            {/* current user strip */}
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background:'rgba(10,29,55,0.04)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{ background:'var(--color-navy-900)', color:'var(--color-gold-500)' }}>
                {editTarget.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{editTarget.username}</p>
                <p className="text-xs text-slate-400">{editTarget.email}</p>
              </div>
            </div>
            <div>
              <label className="form-label text-xs">Username <span className="text-red-500">*</span></label>
              <input className="form-input text-sm" value={editUsername} onChange={e => setEditUsername(e.target.value)} placeholder="Username" />
            </div>
            <div>
              <label className="form-label text-xs">Email <span className="text-red-500">*</span></label>
              <input className="form-input text-sm" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email address" />
            </div>
            <div>
              <label className="form-label text-xs">Department</label>
              <input className="form-input text-sm" value={editDept} onChange={e => setEditDept(e.target.value)} placeholder="e.g. Finance, IT, Operations" />
            </div>
            <div>
              <label className="form-label text-xs">Role</label>
              <select className="form-select text-sm" value={editRole} onChange={e => setEditRole(e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              {editRole !== editTarget.role && (
                <div className="mt-2 flex items-start gap-2 text-xs px-3 py-2 rounded-lg"
                  style={{ background:'#fef3c7', color:'#92400e' }}>
                  <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                  Role changing: <strong>{ROLE_LABELS[editTarget.role]}</strong> → <strong>{ROLE_LABELS[editRole]}</strong>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ══ DELETE MODAL ══ */}
      {deleteTarget && (
        <Modal title="Delete Account" subtitle="Permanent — cannot be undone"
          icon={Trash2} iconBg="#dc2626" onClose={() => setDeleteTarget(null)}
          footer={<>
            <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost text-sm">Cancel</button>
            <button onClick={doDelete} disabled={deleting} className="btn btn-danger text-sm">
              {deleting ? <><span className="spinner" /> Deleting…</> : <><Trash2 size={14} /> Delete User</>}
            </button>
          </>}>
          <div className="space-y-4">
            {/* warning */}
            <div className="flex items-start gap-3 p-4 rounded-xl"
              style={{ background:'#fef2f2', border:'1px solid #fecaca' }}>
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">Permanently delete this account?</p>
                <p className="text-xs text-red-600 mt-0.5">All system access will be revoked immediately. This action cannot be reversed.</p>
              </div>
            </div>
            {/* user card */}
            <div className="p-4 rounded-xl" style={{ background:'rgba(10,29,55,0.04)', border:'1px solid rgba(10,29,55,0.08)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background:'var(--color-navy-900)', color:'var(--color-gold-500)' }}>
                  {deleteTarget.username?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{deleteTarget.username}</p>
                  <p className="text-xs text-slate-500">{deleteTarget.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[['Role', ROLE_LABELS[deleteTarget.role]], ['Department', deleteTarget.department || '—'],
                  ['Status', deleteTarget.is_active ? 'Active' : 'Inactive'],
                  ['Created', deleteTarget.created_at ? format(new Date(deleteTarget.created_at),'MMM d, yyyy') : '—']
                ].map(([k,v]) => (
                  <div key={k} className="text-xs">
                    <p className="text-slate-400 mb-0.5">{k}</p>
                    <p className="font-semibold text-slate-700">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ RESET PASSWORD MODAL ══ */}
      {pwTarget && (
        <Modal title="Reset Password" subtitle={`New password for @${pwTarget.username}`}
          icon={KeyRound} iconBg="#6d28d9" onClose={() => setPwTarget(null)}
          footer={<>
            <button onClick={() => setPwTarget(null)} className="btn btn-ghost text-sm">Cancel</button>
            <button onClick={doResetPassword} disabled={resetting || newPw.length < 8 || newPw !== confirmPw}
              className="btn btn-primary text-sm">
              {resetting ? <><span className="spinner" /> Resetting…</> : <><ShieldCheck size={14} /> Reset Password</>}
            </button>
          </>}>
          <div className="space-y-4">
            {/* user strip */}
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background:'rgba(10,29,55,0.04)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background:'var(--color-navy-900)', color:'var(--color-gold-500)' }}>
                {pwTarget.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{pwTarget.username}</p>
                <p className="text-xs text-slate-400">{ROLE_LABELS[pwTarget.role]} · {pwTarget.department || 'No dept'}</p>
              </div>
            </div>
            {/* new password */}
            <div>
              <label className="form-label text-xs">New Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input className="form-input text-sm pr-10" type={showPw ? 'text' : 'password'}
                  value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="At least 8 characters" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {/* strength bar */}
              {newPw.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                  {[[4,'#ef4444'],[8,'#f59e0b'],[12,'#22c55e']].map(([len, col], i) => (
                    <div key={i} className="flex-1 h-1.5 rounded-full transition-all duration-300"
                      style={{ background: newPw.length >= len ? col : '#e2e8f0' }} />
                  ))}
                  <span className="text-xs font-medium ml-1"
                    style={{ color: newPw.length < 4 ? '#ef4444' : newPw.length < 8 ? '#f59e0b' : newPw.length < 12 ? '#22c55e' : '#16a34a' }}>
                    {newPw.length < 4 ? 'Too short' : newPw.length < 8 ? 'Weak' : newPw.length < 12 ? 'Good' : 'Strong'}
                  </span>
                </div>
              )}
            </div>
            {/* confirm */}
            <div>
              <label className="form-label text-xs">Confirm Password <span className="text-red-500">*</span></label>
              <input className="form-input text-sm" type={showPw ? 'text' : 'password'}
                value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Re-enter password" />
              {confirmPw.length > 0 && (
                <p className={`text-xs mt-1.5 flex items-center gap-1 font-medium ${newPw === confirmPw ? 'text-green-600' : 'text-red-500'}`}>
                  {newPw === confirmPw ? <><UserCheck size={11} /> Passwords match</> : <><AlertTriangle size={11} /> Passwords do not match</>}
                </p>
              )}
            </div>
            {/* notice */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl"
              style={{ background:'rgba(109,40,217,0.06)', border:'1px solid rgba(109,40,217,0.18)' }}>
              <ShieldCheck size={14} className="flex-shrink-0 mt-0.5" style={{ color:'#6d28d9' }} />
              <p className="text-xs" style={{ color:'#4c1d95' }}>
                The user must use this new password on their next login. Notify them through a secure channel.
              </p>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
