import { useCallback, useEffect, useState } from 'react';
import { creditNotes as cnApi, invoices as invoicesApi } from '../api/client';
import { me as meApi } from '../api/client';
import type { CreditNoteDto, InvoiceListItemDto } from '../api/client';
import type { OrgInfo } from '../components/InvoicePDF';
import { printCreditNote } from '../components/CreditNotePDF';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── component ───────────────────────────────────────────────────────────────

export default function CreditNotes() {
  const [creditNotesList, setCreditNotesList] = useState<CreditNoteDto[]>([]);
  const [invoices,        setInvoices]        = useState<InvoiceListItemDto[]>([]);
  const [org,             setOrg]             = useState<OrgInfo>({ name: 'Smart Garage' });
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);

  // Issue modal state
  const [showIssueModal,  setShowIssueModal]  = useState(false);
  const [selInvoiceId,    setSelInvoiceId]    = useState('');
  const [amount,          setAmount]          = useState('');
  const [reason,          setReason]          = useState('');
  const [issueError,      setIssueError]      = useState('');
  const [issuing,         setIssuing]         = useState(false);

  // ── fetch ─────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [cnRes, invRes, meRes] = await Promise.all([
        cnApi.list(),
        invoicesApi.list(),
        meApi.get(),
      ]);
      setCreditNotesList(cnRes.creditNotes);
      setInvoices(invRes.invoices);
      if (meRes.organization) setOrg({
        name: meRes.organization.name,
        address: meRes.organization.address,
        phone: meRes.organization.phone,
        gstin: meRes.organization.gstin,
      });
    } catch {
      setError('Failed to load credit notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── issue credit note ─────────────────────────────────────────────────────

  const openIssueModal = (invoiceId = '') => {
    setSelInvoiceId(invoiceId);
    setAmount('');
    setReason('');
    setIssueError('');
    setShowIssueModal(true);
  };

  const handleIssue = async () => {
    setIssueError('');
    if (!selInvoiceId) { setIssueError('Please select an invoice.'); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setIssueError('Enter a valid amount greater than 0.'); return; }
    if (!reason.trim()) { setIssueError('Please enter a reason for the credit note.'); return; }

    const inv = invoices.find(i => i.id === selInvoiceId);
    if (inv && amt > inv.totalAmount) {
      setIssueError(`Amount cannot exceed the invoice total of ${fmtINR(inv.totalAmount)}.`);
      return;
    }

    setIssuing(true);
    try {
      const created = await cnApi.create({ invoiceId: selInvoiceId, amount: amt, reason: reason.trim() });
      setCreditNotesList(prev => [created, ...prev]);
      setShowIssueModal(false);
    } catch (e) {
      setIssueError(e instanceof Error ? e.message : 'Failed to create credit note.');
    } finally {
      setIssuing(false);
    }
  };

  // ── stats ─────────────────────────────────────────────────────────────────

  const totalCreditIssued = creditNotesList.reduce((s, cn) => s + cn.amount, 0);
  const thisMonth = creditNotesList.filter(cn => {
    const d = new Date(cn.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonth.reduce((s, cn) => s + cn.amount, 0);

  // ── selected invoice for modal ────────────────────────────────────────────

  const selInvoice = invoices.find(i => i.id === selInvoiceId);
  const maxAmount = selInvoice ? selInvoice.totalAmount : undefined;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Credit Notes</h1>
            <p className="page-subtitle">Issue and track credit notes against invoices</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-primary" onClick={() => openIssueModal()}>
              + Issue Credit Note
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {error && (
          <div className="alert alert-danger">
            <div className="alert-icon">⚠️</div>
            <div className="alert-body">{error}</div>
          </div>
        )}

        {/* Stat cards */}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-card-icon purple" style={{ background: '#ede9fe' }}>📋</div>
            </div>
            <div className="stat-card-value" style={{ color: '#6d28d9' }}>{creditNotesList.length}</div>
            <div className="stat-card-label">Total Credit Notes</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-card-icon purple" style={{ background: '#ede9fe' }}>💜</div>
            </div>
            <div className="stat-card-value" style={{ color: '#6d28d9', fontSize: '1.375rem' }}>
              {fmtINR(totalCreditIssued)}
            </div>
            <div className="stat-card-label">Total Credit Issued</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-card-icon amber">📅</div>
            </div>
            <div className="stat-card-value" style={{ color: '#b45309', fontSize: '1.375rem' }}>
              {fmtINR(thisMonthTotal)}
            </div>
            <div className="stat-card-label">This Month</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-card-icon green">🧾</div>
            </div>
            <div className="stat-card-value" style={{ color: '#15803d' }}>{invoices.length}</div>
            <div className="stat-card-label">Invoices Available</div>
          </div>
        </div>

        {/* Credit notes list */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">All Credit Notes</div>
              <div className="card-subtitle">{creditNotesList.length} credit note{creditNotesList.length !== 1 ? 's' : ''} issued</div>
            </div>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : creditNotesList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No credit notes yet</div>
              <div className="empty-state-desc">
                Issue a credit note when a customer is overcharged or when a refund/adjustment is needed against an invoice.
              </div>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => openIssueModal()}>
                + Issue First Credit Note
              </button>
            </div>
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {creditNotesList.map(cn => (
                    <tr key={cn.id}>
                      <td>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.875rem',
                          color: '#6d28d9',
                        }}>
                          {cn.creditNoteNumber}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600 }}>
                          {cn.invoiceNumber ?? cn.invoiceId.slice(0, 8)}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 700, color: '#6d28d9',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {fmtINR(cn.amount)}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: 300 }}>
                        <span style={{
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {cn.reason}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {fmtDate(cn.createdAt)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ background: '#7c3aed', color: '#fff' }}
                            onClick={() => printCreditNote({ cn, org })}
                          >
                            🖨 Print
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              // Pre-fill issue modal with same invoice for follow-up CN
                              if (cn.invoiceId) openIssueModal(cn.invoiceId);
                            }}
                          >
                            + Another
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* What is a credit note info box */}
        <div className="alert alert-info" style={{ marginTop: 8 }}>
          <div className="alert-icon">ℹ️</div>
          <div className="alert-body">
            <strong>About Credit Notes:</strong> A credit note is issued when you need to reduce the amount
            a customer owes — e.g. for overcharging, returned parts, or service complaints.
            It acts as a negative invoice and can be applied against the customer's next bill or refunded directly.
          </div>
        </div>
      </div>

      {/* ── Issue Credit Note Modal ── */}
      {showIssueModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 60, padding: '1rem', backdropFilter: 'blur(2px)',
          }}
          onClick={() => setShowIssueModal(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520,
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              background: '#7c3aed', color: '#fff', padding: '16px 20px',
              borderRadius: '14px 14px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.0625rem' }}>Issue Credit Note</div>
                <div style={{ fontSize: '0.8125rem', opacity: 0.8, marginTop: 2 }}>
                  Create a credit note against an existing invoice
                </div>
              </div>
              <button
                onClick={() => setShowIssueModal(false)}
                style={{
                  border: 'none', background: 'rgba(255,255,255,0.15)',
                  color: '#fff', borderRadius: 8, width: 30, height: 30,
                  cursor: 'pointer', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px 24px 24px' }}>
              {/* Invoice selector */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 700, marginBottom: 6 }}>Select Invoice *</label>
                <select
                  className="form-control"
                  value={selInvoiceId}
                  onChange={e => { setSelInvoiceId(e.target.value); setAmount(''); }}
                >
                  <option value="">— Choose invoice</option>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — ₹{inv.totalAmount.toLocaleString('en-IN')}
                      {inv.jobNumber ? ` (Job ${inv.jobNumber})` : ''}
                    </option>
                  ))}
                </select>
                {selInvoice && (
                  <div style={{
                    marginTop: 8, padding: '8px 12px',
                    background: '#f5f3ff', border: '1px solid #ddd6fe',
                    borderRadius: 8, fontSize: '0.8125rem',
                    display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                  }}>
                    <div>
                      <span style={{ color: '#6b7280' }}>Total: </span>
                      <strong>{fmtINR(selInvoice.totalAmount)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Paid: </span>
                      <strong style={{ color: '#16a34a' }}>{fmtINR(selInvoice.paidAmount)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Balance: </span>
                      <strong style={{ color: '#dc2626' }}>
                        {fmtINR(selInvoice.totalAmount - selInvoice.paidAmount)}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 700, marginBottom: 6 }}>
                  Credit Amount (₹) *
                  {maxAmount !== undefined && (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                      max {fmtINR(maxAmount)}
                    </span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', fontWeight: 700, fontSize: '1rem',
                  }}>₹</span>
                  <input
                    type="number"
                    min={0}
                    max={maxAmount}
                    step={0.01}
                    className="form-control"
                    style={{ paddingLeft: 28 }}
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                </div>
                {/* Quick-fill buttons */}
                {selInvoice && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {[25, 50, 75, 100].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setAmount(String(Math.round(selInvoice.totalAmount * pct / 100 * 100) / 100))}
                        style={{
                          padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)',
                          background: 'var(--bg-base)', color: 'var(--text-secondary)',
                          fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {pct}%
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAmount(String(Math.round((selInvoice.totalAmount - selInvoice.paidAmount) * 100) / 100))}
                      style={{
                        padding: '3px 10px', borderRadius: 20, border: '1px solid #7c3aed',
                        background: '#f5f3ff', color: '#6d28d9',
                        fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Balance due
                    </button>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ fontWeight: 700, marginBottom: 6 }}>Reason *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="e.g. Customer overcharged for parts, part returned, service complaint resolved with partial refund…"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
                {/* Common reason quick-fills */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {[
                    'Overcharged for parts',
                    'Part returned by customer',
                    'Service complaint — goodwill adjustment',
                    'Duplicate billing',
                  ].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      style={{
                        padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)',
                        background: reason === r ? '#f5f3ff' : 'var(--bg-base)',
                        borderColor: reason === r ? '#7c3aed' : 'var(--border)',
                        color: reason === r ? '#6d28d9' : 'var(--text-secondary)',
                        fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {issueError && (
                <div className="error-msg" style={{ marginBottom: 14 }}>
                  ⚠️ {issueError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowIssueModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 2, background: '#7c3aed', color: '#fff', fontWeight: 700 }}
                  onClick={handleIssue}
                  disabled={issuing}
                >
                  {issuing ? 'Issuing…' : '✓ Issue Credit Note'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
