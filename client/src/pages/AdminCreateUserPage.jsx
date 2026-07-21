import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Lock, Shield, Building } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const roles = [
  { value: 'Employee', label: 'Employee', description: 'Standard bank employee - can submit reports' },
  { value: 'Branch_Manager', label: 'Branch Manager', description: 'Manager of a branch with limited case access' },
  { value: 'Investigator', label: 'Investigator', description: 'Compliance team member who investigates cases' },
  { value: 'Compliance_Officer', label: 'Compliance Officer', description: 'Senior compliance role with case overview access' },
  { value: 'CEO', label: 'CEO', description: 'Executive role with access to statistics and reports' },
  { value: 'Auditor', label: 'Auditor', description: 'Read-only audit log access and review role' },
];

export default function AdminCreateUserPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Employee',
    department: '',
  });

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = () => {
    if (!formData.username || formData.username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return false;
    }
    if (!formData.email || !formData.email.includes('@')) {
      toast.error('Please enter a valid email address');
      return false;
    }
    if (!formData.password || formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }
    if (!formData.department) {
      toast.error('Please enter a department');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await api.post('/users', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        department: formData.department,
      });
      toast.success('Staff account created successfully');
      navigate('/admin/users');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create staff account');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy-900)' }}>
            Create Staff Account
          </h1>
          <p className="text-slate-500 text-sm">
            System Administrators can create new staff user accounts here. Public registration is disabled.
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card border border-slate-200 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-navy-900)' }}>
            New Staff User
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Create employee, manager, investigator, compliance, executive, or auditor accounts from this page.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Username</label>
            <div className="relative">
              <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="form-input pl-14"
                placeholder="e.g. jdoe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                name="email"
                value={formData.email}
                onChange={handleChange}
                type="email"
                className="form-input pl-14"
                placeholder="jdoe@rammisbank.et"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                name="password"
                value={formData.password}
                onChange={handleChange}
                type="password"
                className="form-input pl-14"
                placeholder="Strong password"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                type="password"
                className="form-input pl-14"
                placeholder="Confirm password"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Role</label>
            <div className="relative">
              <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="form-select pl-14"
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">
              {roles.find((role) => role.value === formData.role)?.description}
            </p>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Department</label>
            <div className="relative">
              <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="form-input pl-14"
                placeholder="e.g. Compliance, IT_Security"
              />
            </div>
          </div>

          <div className="lg:col-span-2 text-right">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Creating staff account...' : 'Create Staff Account'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
