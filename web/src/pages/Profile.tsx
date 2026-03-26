import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">My Profile</h1>
            <p className="page-subtitle">Your account information</p>
          </div>
        </div>
      </div>
      <div className="page-content">
        <div className="card" style={{ maxWidth: 560 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div className="customer-avatar" style={{ width: 56, height: 56, fontSize: 20 }}>{initials}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{user?.name ?? 'Unknown'}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 2 }}>{user?.email}</div>
            </div>
          </div>
          <div className="info-row">
            <span className="info-label">Full Name</span>
            <span className="info-value">{user?.name ?? '—'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Email</span>
            <span className="info-value">{user?.email ?? '—'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Role</span>
            <span className="info-value">
              {user?.role === 'admin'
                ? <span className="badge badge-admin">Admin</span>
                : <span className="badge badge-draft">{user?.role ?? 'Staff'}</span>}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
