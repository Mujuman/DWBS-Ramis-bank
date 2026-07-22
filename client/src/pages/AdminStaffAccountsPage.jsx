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

const ROLE_FILTERS = ['All','Employee','Branch_Manager','Investigator','Compliance_Officer','CEO','System_Admin','Auditor'];
const STATUS_FILTERS = ['All','Active','Inactive'];
const ROLES = ['Employee','Branch_Manager','Investigator','Compliance_Officer','CEO','System_Admin','Auditor'];
const ROLE_LABELS = {
  Employee:'Employee', Branch_Manager:'Branch Manager', Investigator:'Investigator',
  Compliance_Officer:'Ethics & Anti-Corruption', CEO:'CEO', System_Admin:'System Admin', Auditor:'Auditor',
};
const ROLE_COLORS = {
  Employee:           { bg:'#eff6ff', color:'#1d4ed8' },
  Branch_Manager:     { bg:'#f0fdf4', color:'#15803d' },
  Investigator:       { bg:'#fef3c7', color:'#b45309' },
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

