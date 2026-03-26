import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  parts as partsApi,
  suppliers as suppliersApi,
  purchaseOrders as poApi,
} from '../api/client';
import type { PartDto, PurchaseOrderDto, SupplierDto } from '../api/client';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

type Tab = 'reorder' | 'purchase-orders' | 'suppliers';

type PoLine = {
  partId: string;
  quantityOrdered: number;
  unitCost: number;
  taxRatePercent: number;
};

// ─── Status badge helper ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PurchaseOrderDto['status'] }) {
  const map: Record<PurchaseOrderDto['status'], { label: string; cls: string }> = {
    draft:             { label: 'Draft',             cls: 'badge-draft' },
    sent:              { label: 'Sent',              cls: 'badge-sent' },
    partially_received:{ label: 'Partial',           cls: 'badge-pending' },
    received:          { label: 'Received',          cls: 'badge-approved' },
    cancelled:         { label: 'Cancelled',         cls: 'badge-rejected' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'badge-draft' };
  return <span className={`badge ${cls}`}>{label}</span>;
}

// ─── Supplier Form Modal ──────────────────────────────────────────────────────

type SupplierModalProps = {
  onClose: () => void;
  onSaved: () => void;
};

function SupplierModal({ onClose, onSaved }: SupplierModalProps) {
  const [form, setForm] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '', gstin: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) { setError('Supplier name is required.'); return; }
    setSaving(true);
    try {
      await suppliersApi.create({
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        gstin: form.gstin.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text-primary)' }}>Add Supplier</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>Vendor / parts supplier details</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text-muted)', lineHeight: 1, marginLeft: 12 }}>×</button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}><div className="alert-body">{error}</div></div>}

        <div className="form-group">
          <label className="form-label required">Supplier Name</label>
          <input ref={nameRef} className="form-control" placeholder="e.g. Bosch Auto Parts" value={form.name} onChange={set('name')} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Contact Person</label>
            <input className="form-control" placeholder="e.g. Ramesh Kumar" value={form.contactPerson} onChange={set('contactPerson')} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-control" placeholder="e.g. 9876543210" value={form.phone} onChange={set('phone')} />
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" placeholder="supplier@email.com" value={form.email} onChange={set('email')} />
          </div>
          <div className="form-group">
            <label className="form-label">GSTIN</label>
            <input className="form-control" placeholder="27XXXXX..." value={form.gstin} onChange={set('gstin')} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <input className="form-control" placeholder="Full address" value={form.address} onChange={set('address')} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Add Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PO Detail Modal ──────────────────────────────────────────────────────────

type PoDetailModalProps = {
  po: PurchaseOrderDto;
  onClose: () => void;
  onReceive: (po: PurchaseOrderDto) => Promise<void>;
  onStatusChange: (po: PurchaseOrderDto, status: PurchaseOrderDto['status']) => Promise<void>;
};

function PoDetailModal({ po, onClose, onReceive, onStatusChange }: PoDetailModalProps) {
  const [busy, setBusy] = useState(false);

  const handle = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 700, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{po.poNumber}</span>
              <StatusBadge status={po.status} />
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {po.vendorName} · Created {fmtDate(po.createdAt)}
              {po.expectedDate && ` · Expected ${fmtDate(po.expectedDate)}`}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>

        {po.notes && (
          <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            📝 {po.notes}
          </div>
        )}

        {/* Lines table */}
        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Part</th>
                <th style={{ textAlign: 'right' }}>Ordered</th>
                <th style={{ textAlign: 'right' }}>Received</th>
                <th style={{ textAlign: 'right' }}>Unit Cost</th>
                <th style={{ textAlign: 'right' }}>Tax %</th>
                <th style={{ textAlign: 'right' }}>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l) => {
                const pending = l.quantityOrdered - l.quantityReceived;
                return (
                  <tr key={l.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{l.partName}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.partCode}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{l.quantityOrdered}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ color: pending > 0 ? 'var(--warning, #b45309)' : 'var(--success)' }}>{l.quantityReceived}</span>
                      {pending > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>({pending} pending)</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(l.unitCost)}</td>
                    <td style={{ textAlign: 'right' }}>{l.taxRatePercent}%</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(l.lineAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 240 }}>
            <div className="info-row"><span className="info-label">Subtotal</span><span className="info-value">{fmtCurrency(po.subtotalAmount)}</span></div>
            <div className="info-row"><span className="info-label">Tax</span><span className="info-value">{fmtCurrency(po.taxAmount)}</span></div>
            <div className="info-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--accent)' }}>{fmtCurrency(po.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          {po.status === 'draft' && (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => handle(() => onStatusChange(po, 'sent'))}>
              📤 Mark as Sent
            </button>
          )}
          {(po.status === 'sent' || po.status === 'partially_received') && (
            <button type="button" className="btn btn-success" disabled={busy} onClick={() => handle(() => onReceive(po))}>
              ✅ Receive Stock
            </button>
          )}
          {po.status !== 'received' && po.status !== 'cancelled' && (
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => handle(() => onStatusChange(po, 'cancelled'))}>
              🚫 Cancel PO
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Create PO Modal ──────────────────────────────────────────────────────────

type CreatePoModalProps = {
  parts: PartDto[];
  suppliers: SupplierDto[];
  initialLines?: PoLine[];
  onClose: () => void;
  onCreated: () => void;
  onImportedParts: () => Promise<void>;
};

function CreatePoModal({ parts, suppliers, initialLines = [], onClose, onCreated, onImportedParts }: CreatePoModalProps) {
  const [form, setForm] = useState({
    vendorId: suppliers[0]?.id ?? '',
    expectedDate: '',
    notes: '',
    lines: initialLines.length > 0
      ? initialLines
      : [{ partId: parts[0]?.id ?? '', quantityOrdered: 1, unitCost: parts[0]?.costPrice ?? parts[0]?.price ?? 0, taxRatePercent: 18 }],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const setField = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const updateLine = (idx: number, patch: Partial<PoLine>) =>
    setForm((p) => ({ ...p, lines: p.lines.map((l, i) => i === idx ? { ...l, ...patch } : l) }));

  const removeLine = (idx: number) =>
    setForm((p) => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }));

  const addLine = () =>
    setForm((p) => ({
      ...p,
      lines: [...p.lines, { partId: parts[0]?.id ?? '', quantityOrdered: 1, unitCost: parts[0]?.costPrice ?? parts[0]?.price ?? 0, taxRatePercent: 18 }],
    }));

  const poTotal = useMemo(
    () => form.lines.reduce((sum, l) => sum + l.quantityOrdered * l.unitCost * (1 + l.taxRatePercent / 100), 0),
    [form.lines]
  );

  const handleCreate = async () => {
    setError('');
    if (!form.vendorId) { setError('Please select a supplier.'); return; }
    if (form.lines.length === 0) { setError('Add at least one line item.'); return; }
    if (form.lines.some((l) => !l.partId)) { setError('Select a part for each line.'); return; }
    setSaving(true);
    try {
      await poApi.create({
        vendorId: form.vendorId,
        expectedDate: form.expectedDate || undefined,
        notes: form.notes || undefined,
        lines: form.lines,
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');
    try {
      await onImportedParts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import parts');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 860, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text-primary)' }}>Create Purchase Order</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>Raise a new PO to a supplier</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {parts.length} inventory part{parts.length !== 1 ? 's' : ''} available for PO.
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : 'Import parts from Inventory'}
          </button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}><div className="alert-body">{error}</div></div>}

        <div className="form-row form-row-3" style={{ marginBottom: 0 }}>
          <div className="form-group">
            <label className="form-label required">Supplier</label>
            <select className="form-control" value={form.vendorId} onChange={(e) => setField('vendorId', e.target.value)}>
              <option value="">Select supplier…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Expected Delivery</label>
            <input className="form-control" type="date" value={form.expectedDate} onChange={(e) => setField('expectedDate', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-control" placeholder="Internal notes…" value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </div>
        </div>

        {/* Line Items */}
        <div style={{ marginTop: 18, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Line Items</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Part</th>
                  <th style={{ width: 90 }}>Qty</th>
                  <th style={{ width: 120 }}>Unit Cost (₹)</th>
                  <th style={{ width: 90 }}>GST %</th>
                  <th style={{ width: 120, textAlign: 'right' }}>Line Total</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {form.lines.map((l, idx) => {
                  const lineTotal = l.quantityOrdered * l.unitCost * (1 + l.taxRatePercent / 100);
                  return (
                    <tr key={idx}>
                      <td>
                        <select
                          className="form-control"
                          style={{ minWidth: 180 }}
                          value={l.partId}
                          onChange={(e) => {
                            const part = parts.find((p) => p.id === e.target.value);
                            updateLine(idx, { partId: e.target.value, unitCost: part?.costPrice ?? part?.price ?? 0 });
                          }}
                        >
                          <option value="">Select part…</option>
                          {parts.map((p) => <option key={p.id} value={p.id}>{p.code} – {p.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number" className="form-control" min={1} value={l.quantityOrdered}
                          onChange={(e) => updateLine(idx, { quantityOrdered: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          type="number" className="form-control" min={0} step={0.01} value={l.unitCost}
                          onChange={(e) => updateLine(idx, { unitCost: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <select
                          className="form-control" value={l.taxRatePercent}
                          onChange={(e) => updateLine(idx, { taxRatePercent: Number(e.target.value) })}
                        >
                          {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.875rem' }}>{fmtCurrency(lineTotal)}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
                        >×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={addLine}>+ Add Line</button>
        </div>

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '10px 18px', textAlign: 'right' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 2 }}>PO Total (incl. GST)</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--accent)' }}>{fmtCurrency(poTotal)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : '📦 Create Purchase Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Supplier Card ────────────────────────────────────────────────────────────

function SupplierCard({ s }: { s: SupplierDto }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '1rem', flexShrink: 0,
          }}>
            {s.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{s.name}</div>
            {s.contactPerson && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 1 }}>👤 {s.contactPerson}</div>}
          </div>
        </div>
        {s.gstin && <span className="badge badge-draft" style={{ flexShrink: 0 }}>GST</span>}
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {s.phone && <div className="info-row"><span className="info-label">📞 Phone</span><span className="info-value">{s.phone}</span></div>}
        {s.email && <div className="info-row"><span className="info-label">✉️ Email</span><span className="info-value">{s.email}</span></div>}
        {s.gstin && <div className="info-row"><span className="info-label">🏢 GSTIN</span><span className="info-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{s.gstin}</span></div>}
        {s.address && <div className="info-row"><span className="info-label">📍 Address</span><span className="info-value">{s.address}</span></div>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Procurement() {
  const [parts, setParts] = useState<PartDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderDto[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{
    partId: string; code: string; name: string; currentQty: number;
    minQty: number; unit: string; vendorId?: string | null; vendorName?: string | null; recommendedOrderQty: number;
  }>>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('reorder');

  // Modals
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showCreatePo, setShowCreatePo] = useState(false);
  const [createPoInitialLines, setCreatePoInitialLines] = useState<PoLine[]>([]);
  const [detailPo, setDetailPo] = useState<PurchaseOrderDto | null>(null);

  // Filters
  const [poStatusFilter, setPoStatusFilter] = useState<PurchaseOrderDto['status'] | 'all'>('all');
  const [supplierSearch, setSupplierSearch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, sRes, poRes, sugRes] = await Promise.all([
        partsApi.list(),
        suppliersApi.list(),
        poApi.list(),
        poApi.reorderSuggestions(),
      ]);
      setParts(pRes.parts);
      setSuppliers(sRes.suppliers);
      setPurchaseOrders(poRes.purchaseOrders);
      setSuggestions(sugRes.suggestions);
    } catch {
      setError('Failed to load procurement data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreateFromSuggestions = () => {
    const lines: PoLine[] = suggestions.map((s) => ({
      partId: s.partId,
      quantityOrdered: s.recommendedOrderQty,
      unitCost: parts.find((p) => p.id === s.partId)?.costPrice ?? parts.find((p) => p.id === s.partId)?.price ?? 0,
      taxRatePercent: 18,
    }));
    setCreatePoInitialLines(lines);
    setShowCreatePo(true);
  };

  const markReceived = async (po: PurchaseOrderDto) => {
    const pending = po.lines
      .filter((l) => l.quantityReceived < l.quantityOrdered)
      .map((l) => ({ lineId: l.id, quantityReceivedNow: l.quantityOrdered - l.quantityReceived }));
    if (pending.length === 0) return;
    await poApi.receive(po.id, pending);
    setDetailPo(null);
    fetchAll();
  };

  const changePoStatus = async (po: PurchaseOrderDto, status: PurchaseOrderDto['status']) => {
    await poApi.updateStatus(po.id, status);
    setDetailPo(null);
    fetchAll();
  };

  // Computed
  const filteredPos = useMemo(() => {
    return purchaseOrders.filter((po) => poStatusFilter === 'all' || po.status === poStatusFilter);
  }, [purchaseOrders, poStatusFilter]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.toLowerCase();
    return suppliers.filter((s) =>
      !q || s.name.toLowerCase().includes(q) ||
      (s.phone ?? '').includes(q) ||
      (s.contactPerson ?? '').toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearch]);

  const poSummary = useMemo(() => {
    const total = purchaseOrders.reduce((sum, p) => sum + p.totalAmount, 0);
    const pending = purchaseOrders.filter((p) => p.status === 'sent' || p.status === 'partially_received').length;
    return { total, pending };
  }, [purchaseOrders]);

  return (
    <>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Procurement</h1>
            <p className="page-subtitle">Manage suppliers, purchase orders & stock replenishment</p>
          </div>
          <div className="page-header-actions">
            <button type="button" className="btn btn-secondary" onClick={() => { setShowSupplierModal(true); }}>
              + Add Supplier
            </button>
            <button type="button" className="btn btn-primary" onClick={() => { setCreatePoInitialLines([]); setShowCreatePo(true); }}>
              + Create PO
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}><div className="alert-body">{error}</div></div>}

        {/* Summary KPI Row */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { icon: '⚠️', label: 'Low Stock Alerts',   value: String(suggestions.length),             accent: suggestions.length > 0 ? 'var(--danger)' : 'var(--success)' },
              { icon: '📦', label: 'Total POs',           value: String(purchaseOrders.length),          accent: 'var(--accent)' },
              { icon: '🕐', label: 'Awaiting Delivery',  value: String(poSummary.pending),              accent: poSummary.pending > 0 ? '#b45309' : 'var(--success)' },
              { icon: '🏪', label: 'Suppliers',           value: String(suppliers.length),               accent: 'var(--accent)' },
            ].map(({ icon, label, value, accent }) => (
              <div key={label} className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', marginBottom: 4 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: '1.5rem', color: accent }}>{value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {([
            { key: 'reorder',         label: '⚠️ Reorder Alerts', count: suggestions.length },
            { key: 'purchase-orders', label: '📦 Purchase Orders', count: purchaseOrders.length },
            { key: 'suppliers',       label: '🏪 Suppliers',        count: suppliers.length },
          ] as Array<{ key: Tab; label: string; count: number }>).map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '10px 18px',
                fontWeight: activeTab === key ? 700 : 500,
                fontSize: '0.875rem',
                color: activeTab === key ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: activeTab === key ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {label}
              {count > 0 && (
                <span style={{
                  background: activeTab === key ? 'var(--accent)' : 'var(--border-strong)',
                  color: activeTab === key ? '#fff' : 'var(--text-secondary)',
                  borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700,
                  padding: '1px 7px', lineHeight: '18px',
                }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : (
          <>
            {/* ── Reorder Alerts Tab ── */}
            {activeTab === 'reorder' && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Reorder Alerts</div>
                    <div className="card-subtitle">Parts below minimum stock threshold — order now to avoid shortages</div>
                  </div>
                  {suggestions.length > 0 && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={openCreateFromSuggestions}>
                      📦 Create PO from All
                    </button>
                  )}
                </div>
                {suggestions.length === 0 ? (
                  <div className="empty-state">
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
                    <div>All parts are above minimum stock levels.</div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Part Code</th>
                          <th>Name</th>
                          <th style={{ textAlign: 'right' }}>Current Stock</th>
                          <th style={{ textAlign: 'right' }}>Min Required</th>
                          <th style={{ textAlign: 'right' }}>Reorder Qty</th>
                          <th>Default Supplier</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {suggestions.map((s) => {
                          const pct = s.minQty > 0 ? Math.round((s.currentQty / s.minQty) * 100) : 100;
                          return (
                            <tr key={s.partId}>
                              <td>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.8125rem' }}>{s.code}</span>
                              </td>
                              <td style={{ fontWeight: 500 }}>{s.name}</td>
                              <td style={{ textAlign: 'right' }}>
                                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{s.currentQty}</span>
                                <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: '0.8125rem' }}>{s.unit}</span>
                                <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', width: 60, marginLeft: 'auto' }}>
                                  <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct < 25 ? 'var(--danger)' : 'var(--warning, #f59e0b)', borderRadius: 2 }} />
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>{s.minQty} {s.unit}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{s.recommendedOrderQty} {s.unit}</td>
                              <td>{s.vendorName ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => {
                                    const part = parts.find((p) => p.id === s.partId);
                                    setCreatePoInitialLines([{
                                      partId: s.partId,
                                      quantityOrdered: s.recommendedOrderQty,
                                      unitCost: part?.costPrice ?? part?.price ?? 0,
                                      taxRatePercent: 18,
                                    }]);
                                    setShowCreatePo(true);
                                  }}
                                >
                                  Order
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Purchase Orders Tab ── */}
            {activeTab === 'purchase-orders' && (
              <div className="card">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div className="card-title">Purchase Orders</div>
                    <div className="card-subtitle">All POs · {fmtCurrency(poSummary.total)} total value</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      className="form-control"
                      style={{ width: 'auto', minWidth: 160 }}
                      value={poStatusFilter}
                      onChange={(e) => setPoStatusFilter(e.target.value as typeof poStatusFilter)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="partially_received">Partially Received</option>
                      <option value="received">Received</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {filteredPos.length === 0 ? (
                  <div className="empty-state">
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
                    <div>No purchase orders found.</div>
                    <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => { setCreatePoInitialLines([]); setShowCreatePo(true); }}>
                      Create First PO
                    </button>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>PO Number</th>
                          <th>Supplier</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Lines</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th>Expected</th>
                          <th>Created</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPos.map((po) => (
                          <tr
                            key={po.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setDetailPo(po)}
                          >
                            <td>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.875rem', color: 'var(--accent)' }}>{po.poNumber}</span>
                            </td>
                            <td style={{ fontWeight: 500 }}>{po.vendorName}</td>
                            <td><StatusBadge status={po.status} /></td>
                            <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{po.lines.length}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(po.totalAmount)}</td>
                            <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                              {po.expectedDate ? fmtDate(po.expectedDate) : '—'}
                            </td>
                            <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{fmtDate(po.createdAt)}</td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={(e) => { e.stopPropagation(); setDetailPo(po); }}
                              >
                                View →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Suppliers Tab ── */}
            {activeTab === 'suppliers' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                  <input
                    className="form-control"
                    style={{ maxWidth: 320 }}
                    placeholder="Search suppliers by name, phone, contact…"
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                  />
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowSupplierModal(true)}>
                    + Add Supplier
                  </button>
                </div>

                {filteredSuppliers.length === 0 ? (
                  <div className="card">
                    <div className="empty-state">
                      <div style={{ fontSize: '2rem', marginBottom: 8 }}>🏪</div>
                      <div>{supplierSearch ? 'No suppliers match your search.' : 'No suppliers added yet.'}</div>
                      {!supplierSearch && (
                        <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowSupplierModal(true)}>
                          Add First Supplier
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                    {filteredSuppliers.map((s) => <SupplierCard key={s.id} s={s} />)}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {showSupplierModal && (
        <SupplierModal
          onClose={() => setShowSupplierModal(false)}
          onSaved={fetchAll}
        />
      )}

      {showCreatePo && (
        <CreatePoModal
          parts={parts}
          suppliers={suppliers}
          initialLines={createPoInitialLines}
          onClose={() => setShowCreatePo(false)}
          onCreated={fetchAll}
          onImportedParts={async () => {
            const res = await partsApi.importFromServiceItems();
            await fetchAll();
            if (res.createdCount > 0) {
              setError(null);
            }
          }}
        />
      )}

      {detailPo && (
        <PoDetailModal
          po={detailPo}
          onClose={() => setDetailPo(null)}
          onReceive={markReceived}
          onStatusChange={changePoStatus}
        />
      )}
    </>
  );
}
