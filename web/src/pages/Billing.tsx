import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoices as invoicesApi, creditNotes as cnApi } from '../api/client';
import type { InvoiceListItemDto, CreditNoteDto } from '../api/client';

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Billing() {
  const [invoices,      setInvoices]      = useState<InvoiceListItemDto[]>([]);
  const [creditNotes,   setCreditNotes]   = useState<CreditNoteDto[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);

  // Inline credit note mini-modal
  const [showCN,        setShowCN]        = useState(false);
  const [cnInvoice,     setCnInvoice]     = useState<InvoiceListItemDto | null>(null);
  const [cnAmount,      setCnAmount]      = useState('');
  const [cnReason,      setCnReason]      = useState('');
  const [cnError,       setCnError]       = useState('');
  const [cnSubmitting,  setCnSubmitting]  = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [invRes, cnRes] = await Promise.all([invoicesApi.list(), cnApi.list()]);
      setInvoices(invRes.invoices);
      setCreditNotes(cnRes.creditNotes);
    } catch { setError('Failed to load billing data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalBilled    = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid      = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const totalCredited  = creditNotes.reduce((s, cn) => s + cn.amount, 0);
  const outstanding    = totalBilled - totalPaid - totalCredited;

  // Credit notes keyed by invoiceId for quick lookup
  const cnByInvoice = creditNotes.reduce<Record<string, CreditNoteDto[]>>((acc, cn) => {
    if (!acc[cn.invoiceId]) acc[cn.invoiceId] = [];
    acc[cn.invoiceId].push(cn);
    return acc;
  }, {});

  const openCN = (inv: InvoiceListItemDto) => {
    setCnInvoice(inv);
    setCnAmount('');
    setCnReason('');
    setCnError('');
    setShowCN(true);
  };

  const handleIssueCN = async () => {
    setCnError('');
    const amt = parseFloat(cnAmount);
    if (isNaN(amt) || amt <= 0) { setCnError('Enter a valid amount.'); return; }
    if (!cnReason.trim()) { setCnError('Please enter a reason.'); return; }
    if (!cnInvoice) return;
    if (amt > cnInvoice.totalAmount) { setCnError(`Cannot exceed invoice total ₹${cnInvoice.totalAmount.toLocaleString('en-IN')}.`); return; }
    setCnSubmitting(true);
    try {
      const created = await cnApi.create({ invoiceId: cnInvoice.id, amount: amt, reason: cnReason.trim() });
      setCreditNotes(prev => [created, ...prev]);
      setShowCN(false);
    } catch (e) { setCnError(e instanceof Error ? e.message : 'Failed to issue credit note.'); }
    finally { setCnSubmitting(false); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Billing</h1>
            <p className="page-subtitle">Invoices, payments and credit notes</p>
          </div>
          <div className="page-header-actions">
            <Link to="/credit-notes" className="btn btn-secondary">
              📋 Credit Notes
            </Link>
          </div>
        </div>
      </div>

      <div className="page-content">
        {error && <p className="error-msg">{error}</p>}

        {/* Stats */}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card-top"><div className="stat-card-icon blue">🧾</div></div>
            <div className="stat-card-value" style={{ fontSize: '1.5rem', color: '#1d4ed8' }}>₹{totalBilled.toLocaleString()}</div>
            <div className="stat-card-label">Total Billed</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-top"><div className="stat-card-icon green">✅</div></div>
            <div className="stat-card-value" style={{ fontSize: '1.5rem', color: '#15803d' }}>₹{totalPaid.toLocaleString()}</div>
            <div className="stat-card-label">Total Collected</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-top"><div className="stat-card-icon purple" style={{ background: '#ede9fe' }}>📋</div></div>
            <div className="stat-card-value" style={{ fontSize: '1.5rem', color: '#6d28d9' }}>₹{totalCredited.toLocaleString()}</div>
            <div className="stat-card-label">Total Credited</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-top"><div className="stat-card-icon red">⏳</div></div>
            <div className="stat-card-value" style={{ fontSize: '1.5rem', color: '#b91c1c' }}>₹{Math.max(0, outstanding).toLocaleString()}</div>
            <div className="stat-card-label">Net Outstanding</div>
          </div>
        </div>

        {/* Invoice list */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Invoice List</div>
            <Link to="/credit-notes" className="btn btn-sm" style={{ background: '#7c3aed', color: '#fff' }}>
              + Issue Credit Note
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Job #</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Credited</th>
                  <th>Balance</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🧾</div>
                      <div className="empty-state-title">No invoices yet</div>
                      <div className="empty-state-desc">Invoices are generated from completed job cards.</div>
                    </div>
                  </td></tr>
                ) : (
                  invoices.map(inv => {
                    const credited = (cnByInvoice[inv.id] ?? []).reduce((s, cn) => s + cn.amount, 0);
                    const balance  = inv.totalAmount - inv.paidAmount - credited;
                    return (
                      <tr key={inv.id}>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {inv.invoiceNumber}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{inv.jobNumber ?? '—'}</td>
                        <td style={{ fontWeight: 600 }}>₹{inv.totalAmount.toLocaleString()}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 500 }}>₹{inv.paidAmount.toLocaleString()}</td>
                        <td>
                          {credited > 0
                            ? <span style={{ color: '#6d28d9', fontWeight: 600 }}>₹{credited.toLocaleString()}</span>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td>
                          <span style={{ color: balance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                            ₹{Math.max(0, balance).toLocaleString()}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{fmtDate(inv.createdAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ background: '#7c3aed', color: '#fff', whiteSpace: 'nowrap' }}
                            onClick={() => openCN(inv)}
                          >
                            + Credit Note
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Credit notes sub-list */}
        {creditNotes.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent Credit Notes</div>
              <Link to="/credit-notes" className="btn btn-sm btn-secondary">View All →</Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Credit Note #</th>
                    <th>Invoice</th>
                    <th>Amount</th>
                    <th>Reason</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {creditNotes.slice(0, 5).map(cn => (
                    <tr key={cn.id}>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#6d28d9' }}>{cn.creditNoteNumber}</span></td>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{cn.invoiceNumber ?? '—'}</span></td>
                      <td><span style={{ fontWeight: 700, color: '#6d28d9' }}>₹{cn.amount.toLocaleString()}</span></td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: 240 }}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                          {cn.reason}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{fmtDate(cn.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Quick credit note modal */}
      {showCN && cnInvoice && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 60, padding: '1rem', backdropFilter: 'blur(2px)',
          }}
          onClick={() => setShowCN(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              background: '#7c3aed', color: '#fff', padding: '14px 18px',
              borderRadius: '14px 14px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>Issue Credit Note</div>
                <div style={{ fontSize: '0.8125rem', opacity: 0.8, marginTop: 1 }}>
                  Against {cnInvoice.invoiceNumber} · ₹{cnInvoice.totalAmount.toLocaleString('en-IN')}
                </div>
              </div>
              <button onClick={() => setShowCN(false)}
                style={{ border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 20px 20px' }}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ fontWeight: 700 }}>Credit Amount (₹) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>₹</span>
                  <input type="number" min={0} max={cnInvoice.totalAmount} step={0.01}
                    className="form-control" style={{ paddingLeft: 26 }}
                    placeholder="0.00" value={cnAmount} onChange={e => setCnAmount(e.target.value)} autoFocus />
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                  {[25, 50, 100].map(pct => (
                    <button key={pct} type="button"
                      onClick={() => setCnAmount(String(Math.round(cnInvoice.totalAmount * pct / 100 * 100) / 100))}
                      style={{ padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                      {pct}%
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => setCnAmount(String(Math.max(0, cnInvoice.totalAmount - cnInvoice.paidAmount)))}
                    style={{ padding: '3px 10px', borderRadius: 20, border: '1px solid #7c3aed', background: '#f5f3ff', color: '#6d28d9', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                    Balance due
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 700 }}>Reason *</label>
                <textarea className="form-control" rows={2}
                  placeholder="e.g. Overcharged for parts, part returned…"
                  value={cnReason} onChange={e => setCnReason(e.target.value)} />
                <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                  {['Overcharged for parts', 'Part returned', 'Service complaint', 'Duplicate billing'].map(r => (
                    <button key={r} type="button" onClick={() => setCnReason(r)}
                      style={{ padding: '2px 9px', borderRadius: 20, border: '1px solid var(--border)', background: cnReason === r ? '#f5f3ff' : 'var(--bg-base)', borderColor: cnReason === r ? '#7c3aed' : 'var(--border)', color: cnReason === r ? '#6d28d9' : 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer' }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {cnError && <div className="error-msg" style={{ marginBottom: 12 }}>⚠️ {cnError}</div>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCN(false)}>Cancel</button>
                <button type="button" className="btn" style={{ flex: 2, background: '#7c3aed', color: '#fff', fontWeight: 700 }}
                  onClick={handleIssueCN} disabled={cnSubmitting}>
                  {cnSubmitting ? 'Issuing…' : '✓ Issue Credit Note'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
