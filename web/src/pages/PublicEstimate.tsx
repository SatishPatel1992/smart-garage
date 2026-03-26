import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { estimates, type PublicEstimateDto } from '../api/client';

function fmtDate(v?: string) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PublicEstimate() {
  const { estimateId = '' } = useParams();
  const [data, setData] = useState<PublicEstimateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    if (!estimateId) {
      setError('Invalid estimate link.');
      setLoading(false);
      return;
    }
    setLoading(true);
    estimates.getPublic(estimateId)
      .then((res) => {
        setData(res);
        setApproved(res.status === 'approved');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load estimate.'))
      .finally(() => setLoading(false));
  }, [estimateId]);

  const subtotal = useMemo(() => data?.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) ?? 0, [data]);
  const tax = useMemo(() => (data ? Math.max(0, data.totalAmount - subtotal) : 0), [data, subtotal]);

  const handleApprove = async () => {
    if (!estimateId || approved) return;
    setApproving(true);
    setError('');
    try {
      const res = await estimates.approvePublic(estimateId);
      setApproved(res.status === 'approved');
      setData((prev) => (prev ? { ...prev, status: res.status, approvedAt: res.approvedAt } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve estimate.');
    } finally {
      setApproving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fb', padding: '28px 14px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Estimate Approval</h1>
        {loading && <p style={{ marginTop: 16 }}>Loading estimate…</p>}
        {error && <p style={{ marginTop: 16, color: '#b91c1c' }}>⚠ {error}</p>}

        {!loading && data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12, marginTop: 16 }}>
              <div><strong>Estimate:</strong> {data.estimateNumber}</div>
              <div><strong>Status:</strong> {approved ? 'Approved' : data.status}</div>
              <div><strong>Customer:</strong> {data.customer.name}</div>
              <div><strong>Vehicle:</strong> {data.vehicle.registrationNo} — {data.vehicle.make} {data.vehicle.model}</div>
              <div><strong>Valid until:</strong> {fmtDate(data.validUntil)}</div>
              <div><strong>Total:</strong> ₹{data.totalAmount.toLocaleString('en-IN')}</div>
            </div>

            <div style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>Item</th>
                    <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #e5e7eb' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #e5e7eb' }}>Unit (₹)</th>
                    <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #e5e7eb' }}>Tax (₹)</th>
                    <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #e5e7eb' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l) => (
                    <tr key={l.id}>
                      <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{l.description}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{l.quantity}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{l.unitPrice.toLocaleString('en-IN')}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                        {(l.amount - l.quantity * l.unitPrice).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{l.amount.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <div>Sub total: ₹{subtotal.toLocaleString('en-IN')}</div>
              <div>Tax: ₹{tax.toLocaleString('en-IN')}</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>Total: ₹{data.totalAmount.toLocaleString('en-IN')}</div>
            </div>

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approved || approving}
                style={{
                  background: approved ? '#16a34a' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 16px',
                  cursor: approved ? 'default' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {approved ? 'Approved ✓' : approving ? 'Approving…' : 'Approve Estimate'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

