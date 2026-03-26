import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoices as invoicesApi } from '../api/client';
import type { InvoiceListItemDto } from '../api/client';
import { getAppPreferences } from '../utils/appPreferences';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function paymentStatus(inv: InvoiceListItemDto): 'paid' | 'partial' | 'unpaid' | 'overpaid' {
  if (inv.paidAmount <= 0) return 'unpaid';
  if (inv.paidAmount >= inv.totalAmount) return inv.paidAmount > inv.totalAmount ? 'overpaid' : 'paid';
  return 'partial';
}

const PAY_STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  paid:     { cls: 'badge-approved', label: 'PAID' },
  partial:  { cls: 'badge-sent',     label: 'PARTIAL' },
  unpaid:   { cls: 'badge-draft',    label: 'UNPAID' },
  overpaid: { cls: 'badge-progress', label: 'OVERPAID' },
};

type PayFilter = 'all' | 'paid' | 'partial' | 'unpaid';

const PAY_FILTERS: { key: PayFilter; label: string }[] = [
  { key: 'all',     label: 'All'     },
  { key: 'paid',    label: 'Paid'    },
  { key: 'partial', label: 'Partial' },
  { key: 'unpaid',  label: 'Unpaid'  },
];

// ─── Record Payment Modal ────────────────────────────────────────────────────

type RecordPaymentModalProps = {
  invoice: InvoiceListItemDto;
  onClose: () => void;
  onSave: (invoiceId: string, newPaid: number) => Promise<void>;
};

function RecordPaymentModal({ invoice, onClose, onSave }: RecordPaymentModalProps) {
  const balance = Math.max(0, invoice.totalAmount - invoice.paidAmount);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<'cash' | 'upi' | 'card' | 'bank_transfer'>(() => getAppPreferences().paymentDefaultMethod);
  const [note, setNote]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async () => {
    setError('');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount.'); return; }
    setSubmitting(true);
    try {
      await onSave(invoice.id, invoice.paidAmount + amt);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 440,
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text-primary)' }}>
              Record Payment
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {invoice.invoiceNumber}{invoice.jobNumber ? ` · ${invoice.jobNumber}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Summary row */}
        <div style={{
          background: 'var(--bg-subtle)', borderRadius: 8, padding: '12px 14px',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
          marginBottom: 20, fontSize: '0.8125rem',
        }}>
          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Invoice Total</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmtCurrency(invoice.totalAmount)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Paid</div>
            <div style={{ fontWeight: 700, color: '#15803d' }}>{fmtCurrency(invoice.paidAmount)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Balance Due</div>
            <div style={{ fontWeight: 700, color: balance > 0 ? '#b45309' : '#15803d' }}>{fmtCurrency(balance)}</div>
          </div>
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Amount Received <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600 }}>₹</span>
            <input
              type="number"
              className="form-control"
              style={{ paddingLeft: 28 }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0}
              step="0.01"
              autoFocus
            />
          </div>
          {balance > 0 && (
            <button
              type="button"
              style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => setAmount(String(balance))}
            >
              Use full balance ({fmtCurrency(balance)})
            </button>
          )}
        </div>

        {/* Payment method */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Payment Method
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['cash', 'upi', 'card', 'bank_transfer'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 7, border: '1.5px solid',
                  borderColor: method === m ? 'var(--accent)' : 'var(--border)',
                  background: method === m ? 'var(--accent-subtle, #eff6ff)' : 'var(--bg-card)',
                  color: method === m ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: method === m ? 700 : 500,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                {m === 'upi' ? 'UPI' : m === 'bank_transfer' ? 'Bank' : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Note (optional)
          </label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. cheque #1234, transaction ID…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <div style={{ marginBottom: 14, color: 'var(--danger)', fontSize: '0.8125rem', fontWeight: 500 }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 2 }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : '✓ Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Payments() {
  const [invoices, setInvoices] = useState<InvoiceListItemDto[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [payFilter, setPayFilter] = useState<PayFilter>('all');
  const [search, setSearch]       = useState('');

  const [recordingInvoice, setRecordingInvoice] = useState<InvoiceListItemDto | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await invoicesApi.list();
      setInvoices(res.invoices);
    } catch {
      setError('Failed to load payment records. Make sure the Billing backend is connected.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── derived stats ────────────────────────────────────────────────────────
  const totalBilled    = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid      = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const totalOutstanding = Math.max(0, totalBilled - totalPaid);
  const paidInvoices   = invoices.filter((i) => paymentStatus(i) === 'paid').length;
  const unpaidCount    = invoices.filter((i) => paymentStatus(i) !== 'paid').length;

  // ── filtered rows ────────────────────────────────────────────────────────
  const filtered = invoices.filter((inv) => {
    const ps = paymentStatus(inv);
    const matchFilter =
      payFilter === 'all' ||
      (payFilter === 'paid' && ps === 'paid') ||
      (payFilter === 'partial' && ps === 'partial') ||
      (payFilter === 'unpaid' && (ps === 'unpaid' || ps === 'overpaid'));

    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.jobNumber ?? '').toLowerCase().includes(q);

    return matchFilter && matchSearch;
  });

  const countForFilter = (f: PayFilter) => {
    if (f === 'all') return invoices.length;
    if (f === 'unpaid') return invoices.filter((i) => { const s = paymentStatus(i); return s === 'unpaid' || s === 'overpaid'; }).length;
    return invoices.filter((i) => paymentStatus(i) === f).length;
  };

  // ── handle save payment ──────────────────────────────────────────────────
  const handleSavePayment = async (invoiceId: string, newPaid: number) => {
    await invoicesApi.updatePaidAmount(invoiceId, newPaid);
    setInvoices((prev) =>
      prev.map((inv) => inv.id === invoiceId ? { ...inv, paidAmount: newPaid } : inv)
    );
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Payments</h1>
            <p className="page-subtitle">Payment history and recording</p>
          </div>
          <div className="page-header-actions">
            <Link to="/billing" className="btn btn-secondary">🧾 View Invoices</Link>
          </div>
        </div>
      </div>

      <div className="page-content">

        {/* Stats */}
        {!loading && !error && (
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-card-top"><div className="stat-card-icon blue">🧾</div></div>
              <div className="stat-card-value" style={{ color: '#1d4ed8', fontSize: '1.375rem' }}>{fmtCurrency(totalBilled)}</div>
              <div className="stat-card-label">Total Billed</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-top"><div className="stat-card-icon green">✅</div></div>
              <div className="stat-card-value" style={{ color: '#15803d', fontSize: '1.375rem' }}>{fmtCurrency(totalPaid)}</div>
              <div className="stat-card-label">Total Collected</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-top"><div className="stat-card-icon amber">⚠️</div></div>
              <div className="stat-card-value" style={{ color: '#b45309', fontSize: '1.375rem' }}>{fmtCurrency(totalOutstanding)}</div>
              <div className="stat-card-label">Outstanding</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-top"><div className="stat-card-icon purple">📊</div></div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <div className="stat-card-value" style={{ color: '#15803d' }}>{paidInvoices}</div>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>/ {invoices.length}</span>
              </div>
              <div className="stat-card-label">Invoices Cleared</div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="card-title">Payment Records</div>
              <div className="card-subtitle">All payments across invoices</div>
            </div>
            {!loading && unpaidCount > 0 && (
              <span className="badge badge-pending" style={{ alignSelf: 'flex-start' }}>
                {unpaidCount} pending
              </span>
            )}
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div className="filter-tabs">
              {PAY_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`filter-tab ${payFilter === f.key ? 'active' : ''}`}
                  onClick={() => setPayFilter(f.key)}
                >
                  {f.label}
                  {!loading && (
                    <span style={{ marginLeft: 5, fontWeight: 500, color: payFilter === f.key ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.75rem' }}>
                      ({countForFilter(f.key)})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="search-wrap" style={{ maxWidth: 260 }}>
              <span className="search-icon">🔍</span>
              <input
                type="search"
                className="form-control"
                placeholder="Invoice #, job #…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 12 }}>
              <div className="alert-icon">⚠️</div>
              <div className="alert-body">
                {error}
                <button type="button" className="btn btn-sm btn-secondary" style={{ marginLeft: 12 }} onClick={fetchAll}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="loading">
              <div className="spinner" />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading payments…</span>
            </div>
          )}

          {/* Table */}
          {!loading && !error && (
            filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💳</div>
                <div className="empty-state-title">
                  {invoices.length === 0 ? 'No payments recorded yet' : 'No records match'}
                </div>
                <div className="empty-state-desc">
                  {invoices.length === 0
                    ? 'Payments are recorded against invoices. Create an invoice from a job card first.'
                    : search ? `No results for "${search}".` : `No ${payFilter} payments found.`}
                </div>
                {invoices.length === 0 && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'center' }}>
                    <Link to="/billing" className="btn btn-primary">Go to Billing</Link>
                    <Link to="/jobs" className="btn btn-secondary">View Jobs</Link>
                  </div>
                )}
                {invoices.length > 0 && (
                  <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => { setPayFilter('all'); setSearch(''); }}>
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Job</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inv) => {
                      const ps = paymentStatus(inv);
                      const { cls, label } = PAY_STATUS_BADGE[ps];
                      const balance = inv.totalAmount - inv.paidAmount;
                      const pct = inv.totalAmount > 0 ? Math.min(100, Math.round((inv.paidAmount / inv.totalAmount) * 100)) : 0;
                      const isFullyPaid = ps === 'paid' || ps === 'overpaid';

                      return (
                        <tr key={inv.id}>
                          {/* Invoice # */}
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.875rem' }}>
                              {inv.invoiceNumber}
                            </span>
                          </td>

                          {/* Job */}
                          <td>
                            {inv.jobNumber ? (
                              <Link
                                to={`/jobs/${inv.jobCardId}`}
                                style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--accent)', textDecoration: 'none' }}
                              >
                                {inv.jobNumber}
                              </Link>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>—</span>
                            )}
                          </td>

                          {/* Date */}
                          <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {fmtDate(inv.createdAt)}
                          </td>

                          {/* Total */}
                          <td>
                            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                              {fmtCurrency(inv.totalAmount)}
                            </span>
                          </td>

                          {/* Paid */}
                          <td>
                            <span style={{ fontWeight: 600, color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>
                              {fmtCurrency(inv.paidAmount)}
                            </span>
                          </td>

                          {/* Balance */}
                          <td>
                            <span style={{
                              fontWeight: 600,
                              fontVariantNumeric: 'tabular-nums',
                              color: balance > 0 ? '#b45309' : balance < 0 ? '#1d4ed8' : '#15803d',
                            }}>
                              {balance > 0 ? fmtCurrency(balance) : balance < 0 ? `(${fmtCurrency(Math.abs(balance))})` : '—'}
                            </span>
                          </td>

                          {/* Status badge */}
                          <td>
                            <span className={`badge ${cls}`}>{label}</span>
                          </td>

                          {/* Progress bar */}
                          <td style={{ minWidth: 100 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${pct}%`,
                                  background: isFullyPaid ? '#16a34a' : pct > 0 ? '#f59e0b' : 'var(--border)',
                                  borderRadius: 99,
                                  transition: 'width 0.3s ease',
                                }} />
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>
                                {pct}%
                              </span>
                            </div>
                          </td>

                          {/* Action */}
                          <td>
                            {!isFullyPaid ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => setRecordingInvoice(inv)}
                              >
                                + Payment
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.8125rem', color: '#15803d', fontWeight: 600 }}>✓ Cleared</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {recordingInvoice && (
        <RecordPaymentModal
          invoice={recordingInvoice}
          onClose={() => setRecordingInvoice(null)}
          onSave={handleSavePayment}
        />
      )}
    </>
  );
}
