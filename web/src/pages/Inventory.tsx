import { useCallback, useEffect, useRef, useState } from 'react';
import { serviceItems as api } from '../api/client';
import type { ServiceItemDto } from '../api/client';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── category config ─────────────────────────────────────────────────────────

type Category = {
  key: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  keywords: string[];
};

const CATEGORIES: Category[] = [
  { key: 'engine',    label: 'Engine Parts',   icon: '🔩', color: '#1d4ed8', bg: '#dbeafe', keywords: ['engine','piston','valve','gasket','filter','belt','chain','camshaft','crankshaft','head','block','timing'] },
  { key: 'tyres',     label: 'Tyres & Wheels',  icon: '🛞', color: '#b45309', bg: '#fef3c7', keywords: ['tyre','tire','wheel','rim','tube','alloy','spoke'] },
  { key: 'batteries', label: 'Batteries',       icon: '🔋', color: '#15803d', bg: '#dcfce7', keywords: ['battery','cell','acid','terminal','electrolyte'] },
  { key: 'oils',      label: 'Oils & Fluids',   icon: '🛢️', color: '#0891b2', bg: '#cffafe', keywords: ['oil','fluid','coolant','grease','lubricant','brake fluid','transmission','hydraulic'] },
  { key: 'electrical',label: 'Electricals',     icon: '💡', color: '#7c3aed', bg: '#ede9fe', keywords: ['bulb','fuse','wire','relay','sensor','alternator','starter','ignition','spark','coil','horn','light','lamp','indicator'] },
  { key: 'labour',    label: 'Labour / Service',icon: '🔧', color: '#0f766e', bg: '#ccfbf1', keywords: [] },
  { key: 'other',     label: 'Tools & Other',   icon: '🪛',  color: '#64748b', bg: '#f1f5f9', keywords: [] },
];

function categorise(item: ServiceItemDto): string {
  if (item.type === 'labour') return 'labour';
  const name = item.name.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.key === 'other' || cat.key === 'labour') continue;
    if (cat.keywords.some((k) => name.includes(k))) return cat.key;
  }
  return 'other';
}

// ─── Add Item Modal ──────────────────────────────────────────────────────────

type AddModalProps = {
  defaultType?: 'part' | 'labour';
  onClose: () => void;
  onSaved: (item: ServiceItemDto) => void;
};

function AddItemModal({ defaultType = 'part', onClose, onSaved }: AddModalProps) {
  const [name,     setName]     = useState('');
  const [type,     setType]     = useState<'part' | 'labour'>(defaultType);
  const [price,    setPrice]    = useState('');
  const [tax,      setTax]      = useState('18');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const handleSave = async () => {
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }
    const unitPrice = parseFloat(price);
    if (isNaN(unitPrice) || unitPrice < 0) { setError('Enter a valid price.'); return; }
    const taxRate = parseFloat(tax);
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) { setError('Tax rate must be 0–100.'); return; }
    setSaving(true);
    try {
      const created = await api.create({ name: name.trim(), type, defaultUnitPrice: unitPrice, defaultTaxRatePercent: taxRate });
      onSaved(created);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text-primary)' }}>Add Inventory Item</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>Part, consumable or service</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>

        {/* Type toggle */}
        <div className="form-group">
          <label className="form-label required">Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['part', 'labour'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '1.5px solid',
                borderColor: type === t ? 'var(--accent)' : 'var(--border)',
                background: type === t ? '#eff6ff' : 'var(--bg-card)',
                color: type === t ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: type === t ? 700 : 500, fontSize: '0.875rem', cursor: 'pointer',
                transition: 'all 0.12s',
              }}>
                {t === 'part' ? '🔩 Part / Product' : '🔧 Labour / Service'}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="form-group">
          <label className="form-label required">Name</label>
          <input
            ref={nameRef}
            type="text"
            className="form-control"
            placeholder={type === 'part' ? 'e.g. Engine Oil Filter, Brake Pad Set…' : 'e.g. Oil Change Service, Wheel Alignment…'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        {/* Price + Tax in a row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label required">Unit Price (₹)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>₹</span>
              <input type="number" className="form-control" style={{ paddingLeft: 26 }} placeholder="0.00" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Tax Rate (%)</label>
            <div style={{ position: 'relative' }}>
              <input type="number" className="form-control" style={{ paddingRight: 26 }} placeholder="18" min={0} max={100} step="0.5" value={tax} onChange={(e) => setTax(e.target.value)} />
              <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>%</span>
            </div>
          </div>
        </div>

        {/* Price preview */}
        {price && !isNaN(parseFloat(price)) && parseFloat(price) > 0 && (
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.8125rem', display: 'flex', gap: 16 }}>
            <span>Base: <strong>{fmtCurrency(parseFloat(price))}</strong></span>
            {parseFloat(tax) > 0 && (
              <>
                <span style={{ color: 'var(--text-muted)' }}>+{tax}% GST: <strong>{fmtCurrency(parseFloat(price) * parseFloat(tax) / 100)}</strong></span>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Total: {fmtCurrency(parseFloat(price) * (1 + parseFloat(tax) / 100))}</span>
              </>
            )}
          </div>
        )}

        {error && <div style={{ marginBottom: 14, color: 'var(--danger)', fontSize: '0.8125rem', fontWeight: 500 }}>⚠️ {error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : '✓ Add to Inventory'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Item detail drawer (inline expand) ─────────────────────────────────────

function ItemRow({ item }: { item: ServiceItemDto }) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORIES.find((c) => c.key === categorise(item)) ?? CATEGORIES[CATEGORIES.length - 1];
  const withTax = item.defaultUnitPrice * (1 + item.defaultTaxRatePercent / 100);

  return (
    <>
      <tr
        onClick={() => setOpen((p) => !p)}
        style={{ cursor: 'pointer' }}
      >
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
              {cat.icon}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{item.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>{cat.label}</div>
            </div>
          </div>
        </td>
        <td>
          <span className={`badge ${item.type === 'part' ? 'badge-progress' : 'badge-sent'}`} style={{ fontSize: '0.6875rem' }}>
            {item.type === 'part' ? '🔩 PART' : '🔧 LABOUR'}
          </span>
        </td>
        <td>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(item.defaultUnitPrice)}</span>
        </td>
        <td>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
            {item.defaultTaxRatePercent > 0 ? `${item.defaultTaxRatePercent}%` : '—'}
          </span>
        </td>
        <td>
          <span style={{ fontWeight: 600, color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(withTax)}</span>
        </td>
        <td>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{open ? '▲' : '▼'}</span>
        </td>
      </tr>
      {open && (
        <tr style={{ background: 'var(--bg-subtle)' }}>
          <td colSpan={6} style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: '0.8125rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Item ID: </span><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{item.id}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Base price: </span><strong>{fmtCurrency(item.defaultUnitPrice)}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>GST ({item.defaultTaxRatePercent}%): </span><strong>{fmtCurrency(item.defaultUnitPrice * item.defaultTaxRatePercent / 100)}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Price incl. tax: </span><strong style={{ color: '#15803d' }}>{fmtCurrency(withTax)}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Used in estimates & invoices as default unit price</span></div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'list';

export default function Inventory() {
  const [allItems,  setAllItems]  = useState<ServiceItemDto[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [search,    setSearch]    = useState('');
  const [typeFilter,setTypeFilter]= useState<'all' | 'part' | 'labour'>('all');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [viewMode,  setViewMode]  = useState<ViewMode>('list');
  const [showAdd,   setShowAdd]   = useState(false);
  const [addType,   setAddType]   = useState<'part' | 'labour'>('part');

  const fetchItems = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.list();
      const raw = res as unknown;
      const items: ServiceItemDto[] = Array.isArray(raw)
        ? (raw as ServiceItemDto[])
        : (raw as { items?: ServiceItemDto[] }).items ?? [];
      setAllItems(items);
    } catch {
      setError('Failed to load inventory items.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleItemAdded = (item: ServiceItemDto) => {
    setAllItems((prev) => [item, ...prev]);
  };

  // ── derived ───────────────────────────────────────────────────────────────

  const filtered = allItems.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || item.name.toLowerCase().includes(q);
    const matchType   = typeFilter === 'all' || item.type === typeFilter;
    const matchCat    = catFilter === 'all' || categorise(item) === catFilter;
    return matchSearch && matchType && matchCat;
  });

  const totalParts  = allItems.filter((i) => i.type === 'part').length;
  const totalLabour = allItems.filter((i) => i.type === 'labour').length;
  const avgPartPrice = totalParts > 0
    ? allItems.filter((i) => i.type === 'part').reduce((s, i) => s + i.defaultUnitPrice, 0) / totalParts
    : 0;

  // Category counts for sidebar
  const catCounts: Record<string, number> = { all: allItems.length };
  for (const item of allItems) {
    const key = categorise(item);
    catCounts[key] = (catCounts[key] ?? 0) + 1;
  }

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Inventory</h1>
            <p className="page-subtitle">Parts catalogue, service items and pricing</p>
          </div>
          <div className="page-header-actions">
            <button type="button" className="btn btn-secondary" onClick={() => { setAddType('labour'); setShowAdd(true); }}>+ Labour Item</button>
            <button type="button" className="btn btn-primary" onClick={() => { setAddType('part'); setShowAdd(true); }}>+ Add Part</button>
          </div>
        </div>
      </div>

      <div className="page-content">

        {/* ── Stat strip ── */}
        {!loading && !error && (
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-card-top"><div className="stat-card-icon blue">🔩</div></div>
              <div className="stat-card-value" style={{ color: '#1d4ed8' }}>{totalParts}</div>
              <div className="stat-card-label">Part SKUs</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-top"><div className="stat-card-icon green">🔧</div></div>
              <div className="stat-card-value" style={{ color: '#15803d' }}>{totalLabour}</div>
              <div className="stat-card-label">Service Items</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-top"><div className="stat-card-icon purple">📦</div></div>
              <div className="stat-card-value" style={{ color: '#6d28d9' }}>{allItems.length}</div>
              <div className="stat-card-label">Total Items</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-top"><div className="stat-card-icon amber">💰</div></div>
              <div className="stat-card-value" style={{ color: '#b45309', fontSize: '1.375rem' }}>
                {totalParts > 0 ? fmtCurrency(avgPartPrice) : '—'}
              </div>
              <div className="stat-card-label">Avg Part Price</div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start' }}>

          {/* ── Category sidebar ── */}
          <div className="card" style={{ padding: '8px 0', marginBottom: 0 }}>
            <div style={{ padding: '8px 14px 6px', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Categories
            </div>
            {[{ key: 'all', label: 'All Items', icon: '📦', color: '#6d28d9', bg: '#ede9fe' }, ...CATEGORIES].map((cat) => {
              const count = catCounts[cat.key] ?? 0;
              const active = catFilter === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCatFilter(cat.key)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px', border: 'none', background: active ? '#eff6ff' : 'none',
                    cursor: 'pointer', textAlign: 'left', borderLeft: `3px solid ${active ? 'var(--accent)' : 'transparent'}`,
                    transition: 'all 0.12s',
                  }}
                >
                  <span style={{ width: 28, height: 28, borderRadius: 7, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                    {cat.icon}
                  </span>
                  <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: active ? 700 : 500, color: active ? 'var(--accent)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cat.label}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Main panel ── */}
          <div>
            <div className="card" style={{ marginBottom: 0 }}>
              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {/* Search */}
                <div className="search-wrap" style={{ flex: '1 1 200px', maxWidth: 320 }}>
                  <span className="search-icon">🔍</span>
                  <input
                    type="search" className="form-control"
                    placeholder="Search parts, services…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Type filter */}
                <div className="filter-tabs" style={{ flex: '0 0 auto' }}>
                  {(['all', 'part', 'labour'] as const).map((t) => (
                    <button key={t} type="button" className={`filter-tab ${typeFilter === t ? 'active' : ''}`} onClick={() => setTypeFilter(t)}>
                      {t === 'all' ? 'All' : t === 'part' ? '🔩 Parts' : '🔧 Labour'}
                      <span style={{ marginLeft: 4, fontSize: '0.75rem', color: typeFilter === t ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        ({t === 'all' ? allItems.length : allItems.filter((i) => i.type === t).length})
                      </span>
                    </button>
                  ))}
                </div>

                {/* View toggle */}
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                  {(['list', 'grid'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setViewMode(m)} style={{
                      padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)',
                      background: viewMode === m ? 'var(--accent)' : 'var(--bg-card)',
                      color: viewMode === m ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer', fontSize: 15, lineHeight: 1,
                    }}>
                      {m === 'list' ? '☰' : '⊞'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="alert alert-danger" style={{ marginBottom: 12 }}>
                  <div className="alert-icon">⚠️</div>
                  <div className="alert-body">
                    {error}
                    <button type="button" className="btn btn-sm btn-secondary" style={{ marginLeft: 10 }} onClick={fetchItems}>Retry</button>
                  </div>
                </div>
              )}

              {/* Loading */}
              {loading && <div className="loading"><div className="spinner" /><span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading inventory…</span></div>}

              {/* Empty state */}
              {!loading && !error && allItems.length === 0 && (
                <div className="empty-state" style={{ padding: '40px 0' }}>
                  <div className="empty-state-icon">📦</div>
                  <div className="empty-state-title">No items yet</div>
                  <div className="empty-state-desc">Add parts and service items to build your catalogue. They'll appear as selectable options when creating estimates and invoices.</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
                    <button type="button" className="btn btn-primary" onClick={() => { setAddType('part'); setShowAdd(true); }}>+ Add First Part</button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setAddType('labour'); setShowAdd(true); }}>+ Add Labour Item</button>
                  </div>
                </div>
              )}

              {/* Filtered empty */}
              {!loading && !error && allItems.length > 0 && filtered.length === 0 && (
                <div className="empty-state" style={{ padding: '32px 0' }}>
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-title">No items match</div>
                  <div className="empty-state-desc">{search ? `No results for "${search}".` : 'No items in this category.'}</div>
                  <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => { setSearch(''); setTypeFilter('all'); setCatFilter('all'); }}>Clear filters</button>
                </div>
              )}

              {/* ── LIST VIEW ── */}
              {!loading && !error && filtered.length > 0 && viewMode === 'list' && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Type</th>
                        <th>Base Price</th>
                        <th>GST</th>
                        <th>Price incl. Tax</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item) => <ItemRow key={item.id} item={item} />)}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── GRID VIEW ── */}
              {!loading && !error && filtered.length > 0 && viewMode === 'grid' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {filtered.map((item) => {
                    const cat = CATEGORIES.find((c) => c.key === categorise(item)) ?? CATEGORIES[CATEGORIES.length - 1];
                    const withTax = item.defaultUnitPrice * (1 + item.defaultTaxRatePercent / 100);
                    return (
                      <div key={item.id} style={{
                        border: '1px solid var(--border)', borderRadius: 10,
                        padding: '16px 14px', background: 'var(--bg-card)',
                        display: 'flex', flexDirection: 'column', gap: 8,
                        transition: 'box-shadow 0.15s', cursor: 'default',
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 9, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                            {cat.icon}
                          </div>
                          <span className={`badge ${item.type === 'part' ? 'badge-progress' : 'badge-sent'}`} style={{ fontSize: '0.625rem' }}>
                            {item.type === 'part' ? 'PART' : 'LABOUR'}
                          </span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>{item.name}</div>
                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Base</div>
                            <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem' }}>{fmtCurrency(item.defaultUnitPrice)}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>incl. {item.defaultTaxRatePercent}% GST</div>
                            <div style={{ fontWeight: 700, color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(withTax)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Result count */}
              {!loading && filtered.length > 0 && (
                <div style={{ marginTop: 12, fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                  Showing {filtered.length} of {allItems.length} items
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAdd && (
        <AddItemModal
          defaultType={addType}
          onClose={() => setShowAdd(false)}
          onSaved={handleItemAdded}
        />
      )}
    </>
  );
}
