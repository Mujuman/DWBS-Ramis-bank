import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, FileText, BarChart3, Users,
  ClipboardList, ChevronRight
} from 'lucide-react';

const navItems = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['Investigator', 'CEO', 'System_Admin'],
  },
  {
    path: '/report',
    label: 'Submit Report',
    icon: FileText,
    roles: ['Employee', 'Branch_Manager'],
  },
  {
    path: '/cases',
    label: 'Case Management',
    icon: FileText,
    roles: ['Investigator', 'System_Admin'],
  },
  {
    path: '/compliance',
    label: 'Compliance Dashboard',
    icon: BarChart3,
    roles: ['Compliance_Officer', 'System_Admin'],
  },
  {
    path: '/executive',
    label: 'Executive Dashboard',
    icon: BarChart3,
    roles: ['CEO', 'System_Admin'],
  },
  {
    path: '/audit',
    label: 'Audit Logs',
    icon: ClipboardList,
    roles: ['Auditor', 'System_Admin', 'CEO'],
  },
  {
    path: '/admin',
    label: 'Administration',
    icon: Users,
    roles: ['System_Admin'],
  },
];

export default function Sidebar({ open }) {
  const { user } = useAuth();

  const visibleItems = navItems.filter(item =>
    !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <aside
      className="fixed left-0 top-16 bottom-0 z-40 flex flex-col transition-all duration-300 overflow-hidden"
      style={{
        width: open ? '260px' : '0px',
        background: '#0d1f3a',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex flex-col h-full overflow-hidden" style={{ width: '260px' }}>
        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="text-xs font-semibold uppercase tracking-widest mb-3 px-3"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            Navigation
          </div>

          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-sm font-medium transition-all duration-150 no-underline group ${
                  isActive
                    ? 'text-navy-900 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/8'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? { background: 'var(--color-gold-500)', color: 'var(--color-navy-900)' }
                  : {}
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={isActive ? '' : 'opacity-70 group-hover:opacity-100'} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight size={14} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer: User info strip */}
        {user && (
          <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: 'var(--color-gold-500)', color: 'var(--color-navy-900)' }}>
                {user.display_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-semibold text-white truncate">{user.display_name}</div>
                <div className="text-xs truncate" style={{ color: 'var(--color-gold-500)' }}>
                  {user.role?.replace(/_/g, ' ')}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
