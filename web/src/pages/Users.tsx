import { useCallback, useEffect, useState } from 'react';
import { users as usersApi } from '../api/client';
import type { UserDto } from '../api/client';
import { useAuth } from '../context/AuthContext';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'advisor', label: 'Service Advisor' },
  { value: 'mechanic', label: 'Mechanic' },
  { value: 'accounts', label: 'Accounts' },
] as const;

export default function Users() {
  const { user } = useAuth();
  const [list, setList] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [editRole, setEditRole] = useState<'admin' | 'advisor' | 'mechanic' | 'accounts'>('advisor');
  const [updatingRole, setUpdatingRole] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'advisor' as 'admin' | 'advisor' | 'mechanic' | 'accounts',
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await usersApi.list(); setList(res.users); }
    catch { setError('Failed to load users'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function initials(name: string | null, email: string) {
    const src = name ?? email;
    return src.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  async function handleCreateUser() {
    setCreateErr(null);
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (!name) { setCreateErr('Name is required.'); return; }
    if (!email || !email.includes('@')) { setCreateErr('Valid email is required.'); return; }
    if (form.password.length < 6) { setCreateErr('Password must be at least 6 characters.'); return; }

    setCreating(true);
    try {
      await usersApi.create({
        name,
        email,
        password: form.password,
        role: form.role,
      });
      setForm({ name: '', email: '', password: '', role: 'advisor' });
      setShowCreate(false);
      fetchUsers();
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(userId: string, role: 'admin' | 'advisor' | 'mechanic' | 'accounts') {
    setUpdatingRole(true);
    try {
      const updated = await usersApi.update(userId, { role });
      setList((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));
      setEditingUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update role');
    } finally {
      setUpdatingRole(false);
    }
  }

  async function handleToggleActive(u: UserDto) {
    try {
      const updated = await usersApi.update(u.id, { isActive: !u.isActive });
      setList((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: updated.isActive } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    }
  }

  async function handleResetPassword(u: UserDto) {
    const next = window.prompt(`Set new password for ${u.email}`, '');
    if (next == null) return;
    if (next.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    try {
      await usersApi.resetPassword(u.id, next);
      alert(`Password reset successful for ${u.email}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset password');
    }
  }

  function roleBadge(role: string | null) {
    if (role === 'admin') return <span className="badge badge-admin">Admin</span>;
    if (role === 'advisor') return <span className="badge badge-sent">Advisor</span>;
    if (role === 'mechanic') return <span className="badge badge-progress">Mechanic</span>;
    if (role === 'accounts') return <span className="badge badge-approved">Accounts</span>;
    return <span className="badge badge-draft">{role ?? 'Staff'}</span>;
  }

  function openEditRole(u: UserDto) {
    setEditingUser(u);
    setEditRole((u.role as 'admin' | 'advisor' | 'mechanic' | 'accounts') ?? 'advisor');
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Users</h1>
            <p className="page-subtitle">Manage user accounts and roles</p>
          </div>
          <div className="page-header-actions">
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Create User
            </button>
          </div>
        </div>
      </div>
      <div className="page-content">
        {showCreate && (
          <div className="card" style={{ maxWidth: 760 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Create User</div>
                <div className="card-subtitle">Assign role: admin, advisor, mechanic, or accounts</div>
              </div>
            </div>
            {createErr && (
              <div className="alert alert-danger" style={{ marginBottom: 12 }}>
                <div className="alert-body">{createErr}</div>
              </div>
            )}
            <div className="form-row form-row-2" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label>Name</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Full name"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  className="form-control"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="name@company.com"
                />
              </div>
            </div>
            <div className="form-row form-row-2" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label>Role</label>
                <select
                  className="form-control"
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as typeof form.role }))}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Temporary Password</label>
                <input
                  className="form-control"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Minimum 6 characters"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={creating}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleCreateUser} disabled={creating}>
                {creating ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        )}

        {editingUser && (
          <div className="card" style={{ maxWidth: 520 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Edit User Role</div>
                <div className="card-subtitle">{editingUser.name ?? editingUser.email}</div>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Role</label>
              <select
                className="form-control"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as typeof editRole)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)} disabled={updatingRole}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleRoleChange(editingUser.id, editRole)}
                disabled={updatingRole}
              >
                {updatingRole ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-danger">
            <div className="alert-body">{error} <button type="button" className="btn btn-sm btn-secondary" onClick={fetchUsers}>Retry</button></div>
          </div>
        )}
        <div className="card">
          <div className="card-header">
            <div className="card-title">All Users</div>
          </div>
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-title">No users</div></div></td></tr>
                  ) : (
                    list.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="customer-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                              {initials(u.name, u.email)}
                            </div>
                            <span style={{ fontWeight: 600 }}>{u.name ?? '—'}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                        <td>
                          {roleBadge(u.role)}
                        </td>
                        <td>
                          {u.isActive
                            ? <span className="badge badge-active">Active</span>
                            : <span className="badge badge-inactive">Inactive</span>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={() => openEditRole(u)}>
                              Edit
                            </button>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={() => handleResetPassword(u)}>
                              Reset Password
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-success'}`}
                              onClick={() => handleToggleActive(u)}
                              disabled={u.id === user?.id}
                              title={u.id === user?.id ? 'You cannot deactivate yourself' : ''}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
