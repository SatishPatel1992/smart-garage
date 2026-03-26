import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { customers as customersApi } from '../../api/client';
import type { CustomerWithVehiclesDto } from '../../api/client';

export default function CustomerList() {
  const [list, setList] = useState<CustomerWithVehiclesDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const fetchCustomers = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await customersApi.list(query || undefined); setList(res.customers); }
    catch { setError('Failed to load customers'); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  function initials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Customers</h1>
            <p className="page-subtitle">Manage your customer base and vehicles</p>
          </div>
          <div className="page-header-actions">
            <Link to="/customers/new" className="btn btn-primary">+ Add Customer</Link>
          </div>
        </div>
      </div>
      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Customer List</div>
              <div className="card-subtitle">{list.length} customer{list.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="search-wrap" style={{ maxWidth: 320 }}>
              <span className="search-icon">🔍</span>
              <input
                type="search"
                className="form-control"
                placeholder="Search by name, phone, vehicle…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Vehicles</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr><td colSpan={4}>
                      <div className="empty-state">
                        <div className="empty-state-icon">👥</div>
                        <div className="empty-state-title">No customers found</div>
                        <div className="empty-state-desc">Add your first customer to get started.</div>
                      </div>
                    </td></tr>
                  ) : (
                    list.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="customer-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                              {initials(c.name)}
                            </div>
                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{c.phone}</td>
                        <td>
                          <span className="badge badge-draft">{c.vehicles.length} vehicle{c.vehicles.length !== 1 ? 's' : ''}</span>
                        </td>
                        <td>
                          <Link to={`/customers/${c.id}`} className="btn btn-sm btn-secondary">View →</Link>
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
