import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { estimates as estimatesApi } from '../api/client';
import type { EstimateListItemDto, EstimateListParams } from '../api/client';

// ─── helpers ────────────────────────────────────────────────────────────────

function isExpired(validUntil?: string): boolean {
  if (!validUntil) return false;
  return new Date(validUntil) < new Date();
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtCurrency(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

type StatusFilter = 'all' | 'draft' | 'sent' | 'approved' | 'rejected';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'draft',    label: 'Draft'    },
  { key: 'sent',     label: 'Sent'     },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE: Record<string, string> = {
  draft:    'badge-draft',
  sent:     'badge-sent',
  approved: 'badge-approved',
  rejected: 'badge-rejected',
};



// ─── component ──────────────────────────────────────────────────────────────

export default function Estimates() {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);

  const [allItems, setAllItems] = useState<EstimateListItemDto[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch]             = useState('');

  const fetchEstimates = useCallback(async (params: EstimateListParams = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await estimatesApi.list(params);
      // Normalise: backend may return array directly, { estimates: [] }, or { data: [] }
      const raw = res as unknown;
      const items: EstimateListItemDto[] =
        Array.isArray(raw)
          ? (raw as EstimateListItemDto[])
          : Array.isArray((raw as { estimates?: unknown }).estimates)
            ? (raw as { estimates: EstimateListItemDto[] }).estimates
            : Array.isArray((raw as { data?: unknown }).data)
              ? (raw as { data: EstimateListItemDto[] }).data
              : [];
      setAllItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load estimates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEstimates(); }, [fetchEstimates]);

  const filtered = allItems.filter((e) => {
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      e.estimateNumber.toLowerCase().includes(q) ||
      e.jobNumber.toLowerCase().includes(q) ||
      e.customerName.toLowerCase().includes(q) ||
      e.vehicleRegistrationNo.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const countByStatus = (s: StatusFilter) =>
    s === 'all' ? allItems.length : allItems.filter((e) => e.status === s).length;

  const openJob = (jobCardId: string) => navigate(`/jobs/${jobCardId}#estimate`);

  const approvedValue = allItems.filter((e) => e.status === 'approved').reduce((s, e) => s + e.totalAmount, 0);

  const stats = [
    { label: 'Total Estimates',  value: allItems.length, icon: '📄', colorClass: 'blue',   valueColor: '#1d4ed8' },
    { label: 'Pending Approval', value: allItems.filter((e) => e.status === 'sent').length, icon: '⏳', colorClass: 'amber', valueColor: '#b45309' },
    { label: 'Approved',         value: allItems.filter((e) => e.status === 'approved').length, icon: '✅', colorClass: 'green', valueColor: '#15803d' },
    { label: 'Approved Value',   value: fmtCurrency(approvedValue), icon: '💰', colorClass: 'purple', valueColor: '#6d28d9', small: true },
  ];

  return (
    <>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Estimates</h1>
            <p className="page-subtitle">All job estimates — discover, track and navigate</p>
          </div>
          <div className="page-header-actions">
            <Link to="/jobs/new" className="btn btn-primary">+ New Job</Link>
          </div>
        </div>
      </div>

      <div className="page-content">

        {!loading && !error && allItems.length > 0 && (
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            {stats.map((s) => (
              <div key={s.label} className="stat-card">
                <div className="stat-card-top">
                  <div className={`stat-card-icon ${s.colorClass}`}>{s.icon}</div>
                </div>
                <div className="stat-card-value" style={{ color: s.valueColor, fontSize: s.small ? '1.375rem' : undefined }}>
                  {s.value}
                </div>
                <div className="stat-card-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div className="filter-tabs">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`filter-tab ${statusFilter === f.key ? 'active' : ''}`}
                  onClick={() => setStatusFilter(f.key)}
                >
                  {f.label}
                  {!loading && (
                    <span style={{ marginLeft: 5, fontWeight: 500, color: statusFilter === f.key ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.75rem' }}>
                      ({countByStatus(f.key)})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="search-wrap" style={{ maxWidth: 300 }}>
              <span className="search-icon">🔍</span>
              <input
                ref={searchRef}
                type="search"
                className="form-control"
                placeholder="Estimate #, job #, customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 12 }}>
              <div className="alert-icon">⚠️</div>
              <div className="alert-body">
                {error}
                <button type="button" className="btn btn-sm btn-secondary" style={{ marginLeft: 12 }} onClick={() => fetchEstimates()}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="loading">
              <div className="spinner" />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading estimates…</span>
            </div>
          )}

          {!loading && !error && (
            filtered.length === 0
              ? (
                <EmptyState
                  hasAny={allItems.length > 0}
                  statusFilter={statusFilter}
                  search={search}
                  onClearFilters={() => { setStatusFilter('all'); setSearch(''); }}
                />
              )
              : <EstimatesTable rows={filtered} onOpenJob={openJob} />
          )}
        </div>
      </div>
    </>
  );
}

// ─── EstimatesTable ──────────────────────────────────────────────────────────

function EstimatesTable({ rows, onOpenJob }: { rows: EstimateListItemDto[]; onOpenJob: (jobCardId: string) => void }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Estimate #</th>
            <th>Job</th>
            <th>Customer</th>
            <th>Vehicle</th>
            <th>Total</th>
            <th>Status</th>
            <th>Valid Until</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const expired = isExpired(e.validUntil);
            const showExpired = expired && e.status !== 'approved' && e.status !== 'rejected';
            return (
              <tr key={e.id}>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.875rem' }}>
                    {e.estimateNumber}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => onOpenJob(e.jobCardId)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.875rem' }}
                  >
                    {e.jobNumber}
                  </button>
                </td>
                <td style={{ fontWeight: 500 }}>{e.customerName}</td>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {e.vehicleRegistrationNo}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCurrency(e.totalAmount)}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className={`badge ${STATUS_BADGE[e.status] ?? 'badge-draft'}`}>
                      {e.status.toUpperCase()}
                    </span>
                    {showExpired && (
                      <span className="badge" style={{ background: '#fef2f2', color: '#991b1b', borderColor: '#fecaca', fontSize: '0.625rem', letterSpacing: '0.04em' }}>
                        EXPIRED
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span style={{ color: showExpired ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: showExpired ? 600 : 400 }}>
                    {fmtDate(e.validUntil)}
                  </span>
                </td>
                <td>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => onOpenJob(e.jobCardId)}>
                    Open Job →
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────

function EmptyState({ hasAny, statusFilter, search, onClearFilters }: {
  hasAny: boolean; statusFilter: StatusFilter; search: string; onClearFilters: () => void;
}) {
  if (hasAny) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-title">No estimates match</div>
        <div className="empty-state-desc">
          {search ? `No results for "${search}".` : `No ${statusFilter} estimates found.`}
        </div>
        <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={onClearFilters}>
          Clear filters
        </button>
      </div>
    );
  }
  return (
    <div className="empty-state">
      <div className="empty-state-icon">📄</div>
      <div className="empty-state-title">No estimates yet</div>
      <div className="empty-state-desc">
        Estimates are built inside job cards. Open any job, add parts &amp; labour, then create the estimate from there.
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'center' }}>
        <Link to="/jobs" className="btn btn-primary">Go to Jobs</Link>
        <Link to="/jobs/new" className="btn btn-secondary">Create New Job</Link>
      </div>
    </div>
  );
}
