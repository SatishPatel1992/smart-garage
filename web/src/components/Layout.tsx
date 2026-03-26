import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccess } from '../utils/roleAccess';
import type { AppSection } from '../utils/roleAccess';

// SVG icon components
const icons: Record<string, string> = {
  dashboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  jobs: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  billing: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
  customers: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  estimates: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  inventory: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`,
  procurement: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18"/><path d="M6 7l1.5 12h9L18 7"/><path d="M9 11h6"/><path d="M12 3v4"/></svg>`,
  payments: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  reports: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  communications: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  servicereminders: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>`,
  users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>`,
  profile: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>`,
  creditnotes: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="11" y2="11"/></svg>`,
  logout: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  vehiclemakes: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
};

function NavIcon({ name }: { name: string }) {
  return (
    <span
      className="sidebar-nav-icon"
      dangerouslySetInnerHTML={{ __html: icons[name] ?? '' }}
    />
  );
}

const mainNav: Array<{ to: string; end: boolean; label: string; icon: string; section: AppSection }> = [
  { to: '/', end: true, label: 'Dashboard', icon: 'dashboard', section: 'dashboard' },
  { to: '/jobs', end: false, label: 'Jobs', icon: 'jobs', section: 'jobs' },
  { to: '/billing', end: true, label: 'Billing', icon: 'billing', section: 'billing' },
  { to: '/customers', end: false, label: 'Customers', icon: 'customers', section: 'customers' },
  { to: '/estimates', end: true, label: 'Estimates', icon: 'estimates', section: 'estimates' },
  { to: '/inventory', end: true, label: 'Inventory', icon: 'inventory', section: 'inventory' },
  { to: '/procurement', end: true, label: 'Procurement', icon: 'procurement', section: 'procurement' },
  { to: '/payments',           end: true,  label: 'Payments',           icon: 'payments',         section: 'payments' },
  { to: '/credit-notes',       end: true,  label: 'Credit Notes',       icon: 'creditnotes',      section: 'creditNotes' },
  { to: '/reports',            end: true,  label: 'Reports',            icon: 'reports',          section: 'reports' },
  { to: '/communications',     end: true,  label: 'Communications',     icon: 'communications',   section: 'communications' },
  { to: '/service-reminders',  end: true,  label: 'Service Reminders',  icon: 'servicereminders', section: 'serviceReminders' },
];

const adminNav: Array<{ to: string; end: boolean; label: string; icon: string; section: AppSection }> = [
  { to: '/users', end: true, label: 'Users', icon: 'users', section: 'users' },
  { to: '/vehicle-makes', end: true, label: 'Vehicle Makes', icon: 'vehiclemakes', section: 'vehicleMakes' },
];

const accountNav: Array<{ to: string; end: boolean; label: string; icon: string; section: AppSection }> = [
  { to: '/settings', end: true, label: 'Settings', icon: 'settings', section: 'settings' },
  { to: '/profile', end: true, label: 'My Profile', icon: 'profile', section: 'profile' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const visibleMainNav = mainNav.filter((item) => canAccess(user?.role, item.section));
  const visibleAdminNav = adminNav.filter((item) => canAccess(user?.role, item.section));
  const visibleAccountNav = accountNav.filter((item) => canAccess(user?.role, item.section));
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app">
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <a href="/">
            <div className="sidebar-brand-icon">🔧</div>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">Smart Garage</span>
              <span className="sidebar-brand-sub">Management System</span>
            </div>
          </a>
        </div>

        {/* Main nav */}
        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Main</span>
          {visibleMainNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}

          {visibleAdminNav.length > 0 && (
            <>
              <span className="sidebar-section-label" style={{ marginTop: 8 }}>Admin</span>
              {visibleAdminNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}

          {visibleAccountNav.length > 0 && (
            <>
              <span className="sidebar-section-label" style={{ marginTop: 8 }}>Account</span>
              {visibleAccountNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name ?? user?.email}</div>
              <div className="sidebar-user-role">{user?.role ?? 'Staff'}</div>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="sidebar-logout">
            <span dangerouslySetInnerHTML={{ __html: icons.logout }} />
            Log out
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
