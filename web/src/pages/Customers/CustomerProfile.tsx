import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  customers as customersApi,
  jobs as jobsApi,
  invoices as invoicesApi,
  estimates as estimatesApi,
  creditNotes as cnApi,
} from '../../api/client';
import type {
  CustomerWithVehiclesDto,
  JobCardDto,
  InvoiceListItemDto,
  EstimateListItemDto,
  CreditNoteDto,
} from '../../api/client';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const fuelColors: Record<string, string> = {
  Petrol: '#dc2626', Diesel: '#b45309', CNG: '#0891b2', Electric: '#16a34a', Hybrid: '#7c3aed',
};

const STAGE_BADGE: Record<string, { cls: string; label: string }> = {
  pending:          { cls: 'badge-pending',   label: 'Pending'      },
  work_in_progress: { cls: 'badge-progress',  label: 'In Progress'  },
  delivered:        { cls: 'badge-delivered', label: 'Delivered'    },
};

const EST_BADGE: Record<string, string> = {
  draft: 'badge-draft', sent: 'badge-sent', approved: 'badge-approved', rejected: 'badge-rejected',
};

function payStatus(inv: InvoiceListItemDto): { label: string; cls: string } {
  const bal = inv.totalAmount - inv.paidAmount;
  if (inv.paidAmount <= 0) return { label: 'UNPAID',   cls: 'badge-draft'    };
  if (bal <= 0)            return { label: 'PAID',     cls: 'badge-approved' };
  return                          { label: 'PARTIAL',  cls: 'badge-sent'     };
}

type Tab = 'overview' | 'jobs' | 'estimates' | 'invoices' | 'credit-notes';

// ─── component ──────────────────────────────────────────────────────────────

export default function CustomerProfile() {
  const { customerId } = useParams<{ customerId: string }>();

  const [customer,    setCustomer]    = useState<CustomerWithVehiclesDto | null>(null);
  const [jobs,        setJobs]        = useState<JobCardDto[]>([]);
  const [invoices,    setInvoices]    = useState<InvoiceListItemDto[]>([]);
  const [estimates,   setEstimates]   = useState<EstimateListItemDto[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteDto[]>([]);

  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const fetchAll = useCallback(async () => {
    if (!customerId) return;
    setLoading(true); setError(null);
    try {
      const [custRes, jobsRes, invRes, estRes, cnRes] = await Promise.allSettled([
        customersApi.get(customerId),
        jobsApi.list(),
        invoicesApi.list(),
        estimatesApi.list(),
        cnApi.list(),
      ]);

      if (custRes.status === 'fulfilled') setCustomer(custRes.value);
      else { setError('Failed to load customer'); return; }

      // Filter jobs for this customer
      if (jobsRes.status === 'fulfilled') {
        const allJobs = Array.isArray(jobsRes.value)
          ? (jobsRes.value as JobCardDto[])
          : (jobsRes.value as { jobs: JobCardDto[] }).jobs ?? [];
        setJobs(allJobs.filter((j) => j.customer.id === customerId));
      }

      // Get job IDs for this customer to cross-filter invoices/estimates
      const custJobIds = new Set(
        jobsRes.status === 'fulfilled'
          ? (Array.isArray(jobsRes.value)
              ? (jobsRes.value as JobCardDto[])
              : (jobsRes.value as { jobs: JobCardDto[] }).jobs ?? []
            ).filter((j) => j.customer.id === customerId).map((j) => j.id)
          : []
      );

      if (invRes.status === 'fulfilled') {
        const raw = invRes.value as unknown;
        const all: InvoiceListItemDto[] = Array.isArray(raw)
          ? (raw as InvoiceListItemDto[])
          : (raw as { invoices?: InvoiceListItemDto[] }).invoices ?? [];
        setInvoices(all.filter((i) => custJobIds.has(i.jobCardId)));
      }

      if (estRes.status === 'fulfilled') {
        const raw = estRes.value as unknown;
        const all: EstimateListItemDto[] = Array.isArray(raw)
          ? (raw as EstimateListItemDto[])
          : (raw as { estimates?: EstimateListItemDto[] }).estimates ?? [];
        setEstimates(all.filter((e) => custJobIds.has(e.jobCardId)));
      }

      if (cnRes.status === 'fulfilled') {
        const raw = cnRes.value as unknown;
        const allCNs: CreditNoteDto[] = Array.isArray(raw)
          ? (raw as CreditNoteDto[])
          : (raw as { creditNotes?: CreditNoteDto[] }).creditNotes ?? [];
        const invIds = new Set(
          invRes.status === 'fulfilled'
            ? (() => {
                const r = invRes.value as unknown;
                const arr: InvoiceListItemDto[] = Array.isArray(r) ? (r as InvoiceListItemDto[]) : (r as { invoices?: InvoiceListItemDto[] }).invoices ?? [];
                return arr.filter((i) => custJobIds.has(i.jobCardId)).map((i) => i.id);
              })()
            : []
        );
        setCreditNotes(allCNs.filter((cn) => invIds.has(cn.invoiceId)));
      }
    } catch {
      setError('Failed to load customer data');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  if (error || !customer) {
    return (
      <div className="page-content">
        <div className="card">
          <p className="error-msg">{error || 'Customer not found'}</p>
          <Link to="/customers" className="btn btn-secondary">← Back to Customers</Link>
        </div>
      </div>
    );
  }

  const initials = customer.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  // ── derived stats ────────────────────────────────────────────────────────
  const totalBilled      = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid        = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const totalOutstanding = Math.max(0, totalBilled - totalPaid);
  const approvedEstValue = estimates.filter((e) => e.status === 'approved').reduce((s, e) => s + e.totalAmount, 0);

  const TABS: { key: Tab; label: string; count: number | null; icon: string }[] = [
    { key: 'overview',     label: 'Overview',     count: null,              icon: '🏠' },
    { key: 'jobs',         label: 'Jobs',         count: jobs.length,       icon: '🔧' },
    { key: 'estimates',    label: 'Estimates',    count: estimates.length,  icon: '📄' },
    { key: 'invoices',     label: 'Invoices',     count: invoices.length,   icon: '🧾' },
    { key: 'credit-notes', label: 'Credit Notes', count: creditNotes.length, icon: '📋' },
  ];

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/customers" className="btn btn-secondary btn-sm">← Back</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="customer-avatar" style={{ width: 52, height: 52, fontSize: 20 }}>{initials}</div>
              <div>
                <h1 className="page-title">{customer.name}</h1>
                <p className="page-subtitle">
                  {customer.phone}
                  {customer.email ? ` · ${customer.email}` : ''}
                  {' · '}
                  {customer.vehicles.length} vehicle{customer.vehicles.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
          <div className="page-header-actions">
            <Link to="/jobs/new" className="btn btn-primary">+ New Job</Link>
          </div>
        </div>
      </div>

      <div className="page-content">

        {/* ── Summary stat strip ── */}
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-card-top"><div className="stat-card-icon blue">🔧</div></div>
            <div className="stat-card-value" style={{ color: '#1d4ed8' }}>{jobs.length}</div>
            <div className="stat-card-label">Total Jobs</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-top"><div className="stat-card-icon purple">📄</div></div>
            <div className="stat-card-value" style={{ color: '#6d28d9', fontSize: '1.375rem' }}>{fmtCurrency(approvedEstValue)}</div>
            <div className="stat-card-label">Approved Estimates</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-top"><div className="stat-card-icon green">✅</div></div>
            <div className="stat-card-value" style={{ color: '#15803d', fontSize: '1.375rem' }}>{fmtCurrency(totalPaid)}</div>
            <div className="stat-card-label">Total Paid</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-top"><div className="stat-card-icon amber">⚠️</div></div>
            <div className="stat-card-value" style={{ color: '#b45309', fontSize: '1.375rem' }}>{fmtCurrency(totalOutstanding)}</div>
            <div className="stat-card-label">Outstanding</div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Tab bar */}
          <div style={{ borderBottom: '1px solid var(--border)', padding: '0 20px', display: 'flex', gap: 0 }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '14px 16px 12px',
                  border: 'none',
                  borderBottom: `2px solid ${activeTab === t.key ? 'var(--accent)' : 'transparent'}`,
                  background: 'none',
                  cursor: 'pointer',
                  fontWeight: activeTab === t.key ? 700 : 500,
                  fontSize: '0.875rem',
                  color: activeTab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'color 0.15s, border-color 0.15s',
                  whiteSpace: 'nowrap',
                  marginBottom: -1,
                }}
              >
                <span>{t.icon}</span>
                {t.label}
                {t.count !== null && (
                  <span style={{
                    background: activeTab === t.key ? 'var(--accent)' : 'var(--border)',
                    color: activeTab === t.key ? '#fff' : 'var(--text-muted)',
                    borderRadius: 99,
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '1px 7px',
                    minWidth: 20,
                    textAlign: 'center',
                  }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: 20 }}>

            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Contact */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Contact Information
                  </div>
                  <div className="info-row"><span className="info-label">Phone</span><span className="info-value">{customer.phone}</span></div>
                  {customer.email   && <div className="info-row"><span className="info-label">Email</span><span className="info-value">{customer.email}</span></div>}
                  {customer.address && <div className="info-row"><span className="info-label">Address</span><span className="info-value">{customer.address}</span></div>}
                  {customer.gstin   && (
                    <div className="info-row">
                      <span className="info-label">GSTIN</span>
                      <span className="info-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{customer.gstin}</span>
                    </div>
                  )}
                  {!customer.email && !customer.address && !customer.gstin && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No additional contact details.</p>
                  )}
                </div>

                {/* Vehicles */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Registered Vehicles
                  </div>
                  {customer.vehicles.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No vehicles registered.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {customer.vehicles.map((v) => (
                        <div key={v.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px',
                          background: 'var(--bg-base)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                        }}>
                          <div style={{ width: 38, height: 38, borderRadius: 8, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🚗</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.9375rem' }}>{v.registrationNo}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: 2 }}>
                              {v.make} {v.model}{v.year ? ` (${v.year})` : ''}{v.type ? ` · ${v.type}` : ''}
                            </div>
                          </div>
                          {v.fuel && (
                            <span className="badge" style={{
                              background: `${fuelColors[v.fuel] ?? '#64748b'}18`,
                              color: fuelColors[v.fuel] ?? '#64748b',
                              borderColor: `${fuelColors[v.fuel] ?? '#64748b'}40`,
                              fontSize: '0.6875rem',
                            }}>{v.fuel}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent activity shortcuts */}
                {jobs.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Recent Jobs
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {jobs.slice(0, 3).map((j) => {
                        const { cls, label } = STAGE_BADGE[j.stage] ?? { cls: 'badge-draft', label: j.stage };
                        return (
                          <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.875rem', color: 'var(--accent)' }}>{j.jobNumber}</span>
                            <span style={{ flex: 1, color: 'var(--text-secondary)', fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.complaints}</span>
                            <span className={`badge ${cls}`}>{label}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{fmtDate(j.createdAt)}</span>
                            <Link to={`/jobs/${j.id}`} className="btn btn-sm btn-secondary">View →</Link>
                          </div>
                        );
                      })}
                      {jobs.length > 3 && (
                        <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setActiveTab('jobs')}>
                          View all {jobs.length} jobs →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── JOBS ── */}
            {activeTab === 'jobs' && (
              jobs.length === 0 ? (
                <EmptyTab icon="🔧" title="No jobs yet" desc="This customer has no job cards." action={<Link to="/jobs/new" className="btn btn-primary">+ Create Job</Link>} />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Job #</th>
                        <th>Vehicle</th>
                        <th>Complaints</th>
                        <th>Stage</th>
                        <th>Odometer</th>
                        <th>Date</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j) => {
                        const { cls, label } = STAGE_BADGE[j.stage] ?? { cls: 'badge-draft', label: j.stage };
                        return (
                          <tr key={j.id}>
                            <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>{j.jobNumber}</span></td>
                            <td>
                              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.875rem' }}>{j.vehicle.registrationNo}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{j.vehicle.make} {j.vehicle.model}</div>
                            </td>
                            <td style={{ maxWidth: 240 }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {j.complaints}
                              </span>
                            </td>
                            <td><span className={`badge ${cls}`}>{label}</span></td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{j.odometerReading.toLocaleString()} km</td>
                            <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{fmtDate(j.createdAt)}</td>
                            <td><Link to={`/jobs/${j.id}`} className="btn btn-sm btn-secondary">View →</Link></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* ── ESTIMATES ── */}
            {activeTab === 'estimates' && (
              estimates.length === 0 ? (
                <EmptyTab icon="📄" title="No estimates" desc="No estimates have been created for this customer's jobs." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Estimate #</th>
                        <th>Job</th>
                        <th>Vehicle</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Valid Until</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimates.map((e) => {
                        const expired = e.validUntil && new Date(e.validUntil) < new Date();
                        const showExpired = expired && e.status !== 'approved' && e.status !== 'rejected';
                        return (
                          <tr key={e.id}>
                            <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.875rem' }}>{e.estimateNumber}</span></td>
                            <td>
                              <Link to={`/jobs/${e.jobCardId}`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--accent)', textDecoration: 'none' }}>
                                {e.jobNumber}
                              </Link>
                            </td>
                            <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{e.vehicleRegistrationNo}</span></td>
                            <td><span style={{ fontWeight: 700 }}>{fmtCurrency(e.totalAmount)}</span></td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span className={`badge ${EST_BADGE[e.status] ?? 'badge-draft'}`}>{e.status.toUpperCase()}</span>
                                {showExpired && <span className="badge" style={{ background: '#fef2f2', color: '#991b1b', borderColor: '#fecaca', fontSize: '0.625rem' }}>EXPIRED</span>}
                              </div>
                            </td>
                            <td style={{ fontSize: '0.8125rem', color: showExpired ? 'var(--danger)' : 'var(--text-muted)', fontWeight: showExpired ? 600 : 400 }}>
                              {fmtDate(e.validUntil)}
                            </td>
                            <td><Link to={`/jobs/${e.jobCardId}`} className="btn btn-sm btn-secondary">Open Job →</Link></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* ── INVOICES ── */}
            {activeTab === 'invoices' && (
              invoices.length === 0 ? (
                <EmptyTab icon="🧾" title="No invoices" desc="No invoices have been raised for this customer yet." />
              ) : (
                <>
                  {/* Mini summary */}
                  <div style={{ display: 'flex', gap: 24, marginBottom: 16, padding: '12px 16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                    <span>Total billed: <strong>{fmtCurrency(totalBilled)}</strong></span>
                    <span style={{ color: '#15803d' }}>Paid: <strong>{fmtCurrency(totalPaid)}</strong></span>
                    {totalOutstanding > 0 && <span style={{ color: '#b45309' }}>Outstanding: <strong>{fmtCurrency(totalOutstanding)}</strong></span>}
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Job</th>
                          <th>Parts</th>
                          <th>Labour</th>
                          <th>Tax</th>
                          <th>Total</th>
                          <th>Paid</th>
                          <th>Balance</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => {
                          const { label, cls } = payStatus(inv);
                          const balance = inv.totalAmount - inv.paidAmount;
                          return (
                            <tr key={inv.id}>
                              <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.875rem' }}>{inv.invoiceNumber}</span></td>
                              <td>
                                {inv.jobNumber
                                  ? <Link to={`/jobs/${inv.jobCardId}`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--accent)', textDecoration: 'none' }}>{inv.jobNumber}</Link>
                                  : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                              </td>
                              <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(inv.partsAmount)}</td>
                              <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(inv.labourAmount)}</td>
                              <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{fmtCurrency(inv.taxAmount)}</td>
                              <td><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(inv.totalAmount)}</span></td>
                              <td><span style={{ fontWeight: 600, color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(inv.paidAmount)}</span></td>
                              <td>
                                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: balance > 0 ? '#b45309' : '#15803d' }}>
                                  {balance > 0 ? fmtCurrency(balance) : '—'}
                                </span>
                              </td>
                              <td><span className={`badge ${cls}`}>{label}</span></td>
                              <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{fmtDate(inv.createdAt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            )}

            {/* ── CREDIT NOTES ── */}
            {activeTab === 'credit-notes' && (
              creditNotes.length === 0 ? (
                <EmptyTab icon="📋" title="No credit notes" desc="No credit notes have been issued for this customer." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Credit Note #</th>
                        <th>Against Invoice</th>
                        <th>Amount</th>
                        <th>Reason</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditNotes.map((cn) => (
                        <tr key={cn.id}>
                          <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.875rem' }}>{cn.creditNoteNumber}</span></td>
                          <td>
                            {cn.invoiceNumber
                              ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--accent)' }}>{cn.invoiceNumber}</span>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td><span style={{ fontWeight: 700, color: '#dc2626' }}>−{fmtCurrency(cn.amount)}</span></td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', maxWidth: 280 }}>{cn.reason}</td>
                          <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{fmtDate(cn.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

          </div>
        </div>
      </div>
    </>
  );
}

// ─── EmptyTab helper ─────────────────────────────────────────────────────────

function EmptyTab({ icon, title, desc, action }: { icon: string; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state" style={{ padding: '32px 0' }}>
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{desc}</div>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
