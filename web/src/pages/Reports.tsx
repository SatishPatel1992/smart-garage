import { useCallback, useEffect, useMemo, useState } from 'react';
import { utils as xlsxUtils, writeFile as writeXlsxFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  jobs as jobsApi,
  invoices as invoicesApi,
  estimates as estimatesApi,
  customers as customersApi,
  creditNotes as cnApi,
  serviceItems as siApi,
} from '../api/client';
import type {
  JobCardDto,
  InvoiceListItemDto,
  EstimateListItemDto,
  CustomerWithVehiclesDto,
  CreditNoteDto,
  ServiceItemDto,
} from '../api/client';
import { getAppPreferences } from '../utils/appPreferences';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getMonthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function last6Months() {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getFinancialYearStartDate() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 3, 1);
}

function getDateRangeByPreset(preset: 'thisMonth' | 'lastMonth' | 'last6Months' | 'financialYear') {
  const now = new Date();
  if (preset === 'thisMonth') {
    return {
      start: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: toDateInputValue(now),
    };
  }
  if (preset === 'lastMonth') {
    return {
      start: toDateInputValue(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      end: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (preset === 'financialYear') {
    return {
      start: toDateInputValue(getFinancialYearStartDate()),
      end: toDateInputValue(now),
    };
  }
  const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  return { start: toDateInputValue(d), end: toDateInputValue(now) };
}

// ─── Mini bar chart ─────────────────────────────────────────────────────────

function BarChart({ data, color = '#2563eb', valueFormatter = fmtCurrency }: {
  data: { label: string; value: number }[];
  color?: string;
  valueFormatter?: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '0 4px' }}>
      {data.map((d) => {
        const pct = max > 0 ? (d.value / max) * 100 : 0;
        return (
          <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>
              {d.value > 0 ? valueFormatter(d.value) : ''}
            </div>
            <div style={{
              width: '100%', minHeight: 4,
              height: `${Math.max(pct, d.value > 0 ? 4 : 0)}%`,
              background: color,
              borderRadius: '4px 4px 0 0',
              opacity: pct === 100 ? 1 : 0.55 + (pct / 100) * 0.45,
              transition: 'height 0.5s ease',
            }} />
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Donut chart (SVG) ──────────────────────────────────────────────────────

function DonutChart({ segments, size = 100 }: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--border)', margin: '0 auto' }} />;

  const r = 40, cx = 50, cy = 50;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {segments.map((seg) => {
        const dash = (seg.value / total) * circumference;
        const gap  = circumference - dash;
        const rotate = (offset / total) * 360 - 90;
        offset += seg.value;
        return (
          <circle
            key={seg.label}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={18}
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(${rotate} ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={31} fill="var(--bg-card)" />
    </svg>
  );
}

// ─── Horizontal bar ─────────────────────────────────────────────────────────

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
    </div>
  );
}

// ─── Report section card ─────────────────────────────────────────────────────

function ReportCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header" style={{ marginBottom: 18 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span> {title}
        </div>
      </div>
      {children}
    </div>
  );
}

type Tab = 'revenue' | 'jobs' | 'customers' | 'gst' | 'parts';

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Reports() {
  const defaultReportRange = getDateRangeByPreset(getAppPreferences().reportDefaultPreset);
  const [jobs,      setJobs]      = useState<JobCardDto[]>([]);
  const [invoices,  setInvoices]  = useState<InvoiceListItemDto[]>([]);
  const [estimates, setEstimates] = useState<EstimateListItemDto[]>([]);
  const [customers, setCustomers] = useState<CustomerWithVehiclesDto[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteDto[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItemDto[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('revenue');
  const [startDate, setStartDate] = useState<string>(defaultReportRange.start);
  const [endDate, setEndDate] = useState<string>(defaultReportRange.end);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [jRes, iRes, eRes, cRes, cnRes, siRes] = await Promise.allSettled([
        jobsApi.list(),
        invoicesApi.list(),
        estimatesApi.list(),
        customersApi.list(),
        cnApi.list(),
        siApi.list(),
      ]);

      const norm = <T,>(res: PromiseSettledResult<unknown>, keys: string[]): T[] => {
        if (res.status !== 'fulfilled') return [];
        const v = res.value as Record<string, unknown>;
        if (Array.isArray(v)) return v as T[];
        for (const k of keys) if (Array.isArray(v[k])) return v[k] as T[];
        return [];
      };

      setJobs(norm<JobCardDto>(jRes, ['jobs']));
      setInvoices(norm<InvoiceListItemDto>(iRes, ['invoices']));
      setEstimates(norm<EstimateListItemDto>(eRes, ['estimates']));
      setCustomers(norm<CustomerWithVehiclesDto>(cRes, ['customers']));
      setCreditNotes(norm<CreditNoteDto>(cnRes, ['creditNotes']));
      setServiceItems(norm<ServiceItemDto>(siRes, ['items']));
    } catch {
      setError('Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Computed analytics ────────────────────────────────────────────────────

  const startBoundary = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const endBoundary = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
  const inDateRange = useCallback((iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    if (startBoundary && d < startBoundary) return false;
    if (endBoundary && d > endBoundary) return false;
    return true;
  }, [endBoundary, startBoundary]);

  const filteredJobs = useMemo(() => jobs.filter((j) => inDateRange(j.createdAt)), [jobs, inDateRange]);
  const filteredInvoices = useMemo(() => invoices.filter((i) => inDateRange(i.createdAt)), [invoices, inDateRange]);
  const filteredEstimates = useMemo(() => estimates.filter((e) => inDateRange(e.createdAt)), [estimates, inDateRange]);
  const filteredCreditNotes = useMemo(() => creditNotes.filter((cn) => inDateRange(cn.createdAt)), [creditNotes, inDateRange]);

  const months = useMemo(() => {
    const items: string[] = [];
    if (startBoundary && endBoundary && startBoundary <= endBoundary) {
      const cursor = new Date(startBoundary.getFullYear(), startBoundary.getMonth(), 1);
      const endMonth = new Date(endBoundary.getFullYear(), endBoundary.getMonth(), 1);
      while (cursor <= endMonth) {
        items.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return items.length > 0 ? items : last6Months();
    }
    return last6Months();
  }, [endBoundary, startBoundary]);

  // Revenue by month
  const revenueByMonth = months.map((m) => ({
    label: getMonthLabel(m),
    value: filteredInvoices.filter((i) => getMonthKey(i.createdAt) === m).reduce((s, i) => s + i.totalAmount, 0),
  }));

  const collectedByMonth = months.map((m) => ({
    label: getMonthLabel(m),
    value: filteredInvoices.filter((i) => getMonthKey(i.createdAt) === m).reduce((s, i) => s + i.paidAmount, 0),
  }));

  const totalBilled     = filteredInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalCollected  = filteredInvoices.reduce((s, i) => s + i.paidAmount, 0);
  const totalOutstanding= Math.max(0, totalBilled - totalCollected);
  const totalCredited   = filteredCreditNotes.reduce((s, cn) => s + cn.amount, 0);
  const totalPartsRev   = filteredInvoices.reduce((s, i) => s + i.partsAmount, 0);
  const totalLabourRev  = filteredInvoices.reduce((s, i) => s + i.labourAmount, 0);

  // Jobs by month
  const jobsByMonth = months.map((m) => ({
    label: getMonthLabel(m),
    value: filteredJobs.filter((j) => getMonthKey(j.createdAt) === m).length,
  }));

  const pendingJobs   = filteredJobs.filter((j) => j.stage === 'pending').length;
  const inProgressJobs= filteredJobs.filter((j) => j.stage === 'work_in_progress').length;
  const deliveredJobs = filteredJobs.filter((j) => j.stage === 'delivered').length;

  // Stage donut
  const stageSegments = [
    { label: 'Pending',     value: pendingJobs,    color: '#f59e0b' },
    { label: 'In Progress', value: inProgressJobs, color: '#2563eb' },
    { label: 'Delivered',   value: deliveredJobs,  color: '#16a34a' },
  ].filter((s) => s.value > 0);

  // Top customers by jobs
  const custJobCount = filteredJobs.reduce<Record<string, { name: string; count: number; billed: number }>>((acc, j) => {
    const id = j.customer.id;
    if (!acc[id]) acc[id] = { name: j.customer.name, count: 0, billed: 0 };
    acc[id].count++;
    return acc;
  }, {});
  // attach billing
  const custInvMap = filteredInvoices.reduce<Record<string, number>>((acc, inv) => {
    const j = filteredJobs.find((jb) => jb.id === inv.jobCardId);
    if (j) acc[j.customer.id] = (acc[j.customer.id] ?? 0) + inv.totalAmount;
    return acc;
  }, {});
  for (const id of Object.keys(custJobCount)) custJobCount[id].billed = custInvMap[id] ?? 0;

  const topCustomers = Object.values(custJobCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // New customers by month
  const newCustByMonth = months.map((m) => ({
    label: getMonthLabel(m),
    value: customers.filter((c) => {
      // customers API doesn't have createdAt, approximate with jobs
      return filteredJobs.some((j) => j.customer.id === c.id && getMonthKey(j.createdAt) === m);
    }).length,
  }));

  // Customer vehicles breakdown
  const vehicleTypes = customers.flatMap((c) => c.vehicles).reduce<Record<string, number>>((acc, v) => {
    const type = v.fuel ?? 'Unknown';
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});
  const vehicleTypeColors: Record<string, string> = { Petrol: '#dc2626', Diesel: '#b45309', CNG: '#0891b2', Electric: '#16a34a', Hybrid: '#7c3aed', Unknown: '#94a3b8' };

  // GST
  const totalTax     = filteredInvoices.reduce((s, i) => s + i.taxAmount, 0);
  const gstByMonth   = months.map((m) => ({
    label: getMonthLabel(m),
    value: filteredInvoices.filter((i) => getMonthKey(i.createdAt) === m).reduce((s, i) => s + i.taxAmount, 0),
  }));

  // Invoice payment status breakdown
  const paidInvCount    = filteredInvoices.filter((i) => i.paidAmount >= i.totalAmount && i.totalAmount > 0).length;
  const partialInvCount = filteredInvoices.filter((i) => i.paidAmount > 0 && i.paidAmount < i.totalAmount).length;
  const unpaidInvCount  = filteredInvoices.filter((i) => i.paidAmount <= 0).length;

  // Parts usage (from service items, sorted by price as proxy for usage)
  const topParts = serviceItems
    .filter((s) => s.type === 'part')
    .sort((a, b) => b.defaultUnitPrice - a.defaultUnitPrice)
    .slice(0, 8);
  const topLabour = serviceItems
    .filter((s) => s.type === 'labour')
    .sort((a, b) => b.defaultUnitPrice - a.defaultUnitPrice)
    .slice(0, 8);
  const maxPartPrice  = Math.max(...topParts.map((p) => p.defaultUnitPrice), 1);
  const maxLabourPrice= Math.max(...topLabour.map((p) => p.defaultUnitPrice), 1);

  // Estimate conversion
  const estApproved  = filteredEstimates.filter((e) => e.status === 'approved').length;
  const estSent      = filteredEstimates.filter((e) => e.status === 'sent').length;
  const estRejected  = filteredEstimates.filter((e) => e.status === 'rejected').length;
  const estDraft     = filteredEstimates.filter((e) => e.status === 'draft').length;
  const conversionRate = filteredEstimates.length > 0 ? Math.round((estApproved / filteredEstimates.length) * 100) : 0;

  const jobsById = useMemo(() => {
    const out: Record<string, JobCardDto> = {};
    for (const j of filteredJobs) out[j.id] = j;
    return out;
  }, [filteredJobs]);

  const b2bInvoices = filteredInvoices.filter((inv) => {
    const job = jobsById[inv.jobCardId];
    return Boolean(job?.customer?.gstin);
  });
  const b2cInvoices = filteredInvoices.filter((inv) => {
    const job = jobsById[inv.jobCardId];
    return !job?.customer?.gstin;
  });

  const hsnSummary = filteredInvoices.reduce<Record<string, { taxable: number; gst: number; total: number }>>((acc, inv) => {
    const key = inv.lines.map((l) => l.description).join(', ') || 'GENERAL';
    if (!acc[key]) acc[key] = { taxable: 0, gst: 0, total: 0 };
    acc[key].taxable += inv.totalAmount - inv.taxAmount;
    acc[key].gst += inv.taxAmount;
    acc[key].total += inv.totalAmount;
    return acc;
  }, {});

  const financialYear = `${getFinancialYearStartDate().getFullYear()}-${String((getFinancialYearStartDate().getFullYear() + 1)).slice(-2)}`;

  const buildExportData = () => {
    if (activeTab === 'gst') {
      return {
        sheetName: 'GST-Register',
        title: `GST Compliance Report (${startDate} to ${endDate})`,
        columns: ['Invoice #', 'Customer', 'GSTIN', 'Taxable', 'GST', 'Total', 'Date'],
        rows: filteredInvoices.map((inv) => {
          const job = jobsById[inv.jobCardId];
          return [
            inv.invoiceNumber,
            job?.customer?.name ?? '—',
            job?.customer?.gstin ?? 'Unregistered',
            inv.totalAmount - inv.taxAmount,
            inv.taxAmount,
            inv.totalAmount,
            fmtDate(inv.createdAt),
          ];
        }),
      };
    }
    return {
      sheetName: 'Invoices',
      title: `Revenue Report (${startDate} to ${endDate})`,
      columns: ['Invoice #', 'Job #', 'Parts', 'Labour', 'Tax', 'Total', 'Paid', 'Balance', 'Date'],
      rows: filteredInvoices.map((inv) => [
        inv.invoiceNumber,
        inv.jobNumber ?? '—',
        inv.partsAmount,
        inv.labourAmount,
        inv.taxAmount,
        inv.totalAmount,
        inv.paidAmount,
        inv.totalAmount - inv.paidAmount,
        fmtDate(inv.createdAt),
      ]),
    };
  };

  const exportExcel = () => {
    const { columns, rows, sheetName } = buildExportData();
    const wb = xlsxUtils.book_new();
    const ws = xlsxUtils.aoa_to_sheet([columns, ...rows]);
    xlsxUtils.book_append_sheet(wb, ws, sheetName);
    writeXlsxFile(wb, `reports-${activeTab}-${startDate}-to-${endDate}.xlsx`);
  };

  const exportPdf = () => {
    const { title, columns, rows } = buildExportData();
    const doc = new jsPDF('landscape');
    doc.setFontSize(12);
    doc.text(title, 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [columns],
      body: rows.map((row) => row.map((c) => typeof c === 'number' ? c.toLocaleString('en-IN') : String(c))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`reports-${activeTab}-${startDate}-to-${endDate}.pdf`);
  };

  const applyPreset = (preset: 'thisMonth' | 'lastMonth' | 'last6Months' | 'financialYear') => {
    const now = new Date();
    if (preset === 'thisMonth') {
      setStartDate(toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)));
      setEndDate(toDateInputValue(now));
      return;
    }
    if (preset === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(toDateInputValue(start));
      setEndDate(toDateInputValue(end));
      return;
    }
    if (preset === 'financialYear') {
      setStartDate(toDateInputValue(getFinancialYearStartDate()));
      setEndDate(toDateInputValue(now));
      return;
    }
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    setStartDate(toDateInputValue(start));
    setEndDate(toDateInputValue(now));
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'revenue',   label: 'Revenue',   icon: '💰' },
    { key: 'jobs',      label: 'Jobs',      icon: '🔧' },
    { key: 'customers', label: 'Customers', icon: '👥' },
    { key: 'gst',       label: 'GST',       icon: '📊' },
    { key: 'parts',     label: 'Inventory', icon: '📦' },
  ];

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Reports</h1>
            <p className="page-subtitle">Analytics and business intelligence</p>
          </div>
          <div className="page-header-actions">
            <select className="form-control" value="" onChange={(e) => {
              const v = e.target.value as 'thisMonth' | 'lastMonth' | 'last6Months' | 'financialYear';
              if (v) applyPreset(v);
              e.currentTarget.value = '';
            }} style={{ width: 160 }}>
              <option value="">Date Preset</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="last6Months">Last 6 Months</option>
              <option value="financialYear">FY {financialYear}</option>
            </select>
            <input className="form-control" type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} style={{ width: 150 }} />
            <input className="form-control" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} style={{ width: 150 }} />
            <button type="button" className="btn btn-secondary" onClick={exportExcel}>Export Excel</button>
            <button type="button" className="btn btn-secondary" onClick={exportPdf}>Export PDF</button>
            <button type="button" className="btn btn-secondary" onClick={fetchAll}>↻ Refresh</button>
          </div>
        </div>
      </div>

      <div className="page-content">

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>
            <div className="alert-icon">⚠️</div>
            <div className="alert-body">{error} <button className="btn btn-sm btn-secondary" style={{ marginLeft: 10 }} onClick={fetchAll}>Retry</button></div>
          </div>
        )}

        {loading ? (
          <div className="loading" style={{ padding: '60px 0' }}>
            <div className="spinner" />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading reports…</span>
          </div>
        ) : (
          <>
            {/* ── KPI strip ── */}
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              {[
                { label: 'Total Billed',    value: fmtCurrency(totalBilled),      icon: '🧾', color: '#1d4ed8', cls: 'blue'   },
                { label: 'Collected',       value: fmtCurrency(totalCollected),   icon: '✅', color: '#15803d', cls: 'green'  },
                { label: 'Outstanding',     value: fmtCurrency(totalOutstanding), icon: '⏳', color: '#b45309', cls: 'amber'  },
                { label: 'Total Jobs',      value: filteredJobs.length,           icon: '🔧', color: '#1d4ed8', cls: 'blue'   },
                { label: 'Customers',       value: customers.length,              icon: '👥', color: '#6d28d9', cls: 'purple' },
                { label: 'GST Collected',   value: fmtCurrency(totalTax),         icon: '📊', color: '#0891b2', cls: 'blue'   },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <div className="stat-card-top"><div className={`stat-card-icon ${s.cls}`}>{s.icon}</div></div>
                  <div className="stat-card-value" style={{ color: s.color, fontSize: typeof s.value === 'string' && s.value.length > 8 ? '1.25rem' : undefined }}>{s.value}</div>
                  <div className="stat-card-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* ── Tab nav ── */}
            <div style={{ borderBottom: '2px solid var(--border)', marginBottom: 20, display: 'flex', gap: 0 }}>
              {TABS.map((t) => (
                <button key={t.key} type="button" onClick={() => setActiveTab(t.key)} style={{
                  padding: '11px 20px 9px', border: 'none',
                  borderBottom: `2px solid ${activeTab === t.key ? 'var(--accent)' : 'transparent'}`,
                  background: 'none', cursor: 'pointer',
                  fontWeight: activeTab === t.key ? 700 : 500, fontSize: '0.875rem',
                  color: activeTab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 7,
                  marginBottom: -2, transition: 'color 0.15s',
                }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* ════════════════════════════ REVENUE ════════════════════════════ */}
            {activeTab === 'revenue' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Billed vs Collected chart */}
                <ReportCard title="Monthly Billed (Last 6 months)" icon="🧾">
                  <BarChart data={revenueByMonth} color="#2563eb" />
                </ReportCard>

                <ReportCard title="Monthly Collected (Last 6 months)" icon="✅">
                  <BarChart data={collectedByMonth} color="#16a34a" />
                </ReportCard>

                {/* Revenue breakdown */}
                <ReportCard title="Revenue Breakdown" icon="📈">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <DonutChart size={110} segments={[
                      { label: 'Parts',  value: totalPartsRev,  color: '#2563eb' },
                      { label: 'Labour', value: totalLabourRev, color: '#7c3aed' },
                      { label: 'Tax',    value: totalTax,       color: '#f59e0b' },
                    ]} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Parts Revenue',   value: totalPartsRev,  color: '#2563eb' },
                        { label: 'Labour Revenue',  value: totalLabourRev, color: '#7c3aed' },
                        { label: 'Tax (GST)',        value: totalTax,       color: '#f59e0b' },
                        { label: 'Credit Notes',    value: -totalCredited, color: '#dc2626' },
                      ].map((row) => (
                        <div key={row.label} style={{ fontSize: '0.8125rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 3, background: row.color, flexShrink: 0 }} />
                              <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                            </div>
                            <span style={{ fontWeight: 700, color: row.value < 0 ? '#dc2626' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                              {row.value < 0 ? '−' : ''}{fmtCurrency(Math.abs(row.value))}
                            </span>
                          </div>
                          {row.value >= 0 && <HBar value={row.value} max={totalBilled} color={row.color} />}
                        </div>
                      ))}
                    </div>
                  </div>
                </ReportCard>

                {/* Invoice payment status */}
                <ReportCard title="Invoice Payment Status" icon="💳">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <DonutChart size={110} segments={[
                      { label: 'Paid',    value: paidInvCount,    color: '#16a34a' },
                      { label: 'Partial', value: partialInvCount, color: '#f59e0b' },
                      { label: 'Unpaid',  value: unpaidInvCount,  color: '#dc2626' },
                    ]} />
                    <div style={{ flex: 1 }}>
                      {[
                        { label: 'Fully Paid',     value: paidInvCount,    pct: filteredInvoices.length, color: '#16a34a' },
                        { label: 'Partially Paid', value: partialInvCount, pct: filteredInvoices.length, color: '#f59e0b' },
                        { label: 'Unpaid',         value: unpaidInvCount,  pct: filteredInvoices.length, color: '#dc2626' },
                      ].map((row) => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: row.color }} />
                            <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span style={{ fontWeight: 700 }}>{row.value}</span>
                            <span style={{ color: 'var(--text-muted)' }}>({row.pct > 0 ? Math.round((row.value / row.pct) * 100) : 0}%)</span>
                          </div>
                        </div>
                      ))}
                      <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 8, fontSize: '0.8125rem' }}>
                        <div style={{ color: 'var(--text-muted)' }}>Net after credit notes</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1d4ed8', marginTop: 2 }}>{fmtCurrency(totalBilled - totalCredited)}</div>
                      </div>
                    </div>
                  </div>
                </ReportCard>

                {/* Recent invoices table */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <ReportCard title="Recent Invoices" icon="📋">
                    {filteredInvoices.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No invoices yet.</p>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr><th>Invoice #</th><th>Job</th><th>Parts</th><th>Labour</th><th>Tax</th><th>Total</th><th>Paid</th><th>Balance</th><th>Date</th></tr>
                          </thead>
                          <tbody>
                            {filteredInvoices.slice(0, 10).map((inv) => {
                              const bal = inv.totalAmount - inv.paidAmount;
                              return (
                                <tr key={inv.id}>
                                  <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.8125rem' }}>{inv.invoiceNumber}</span></td>
                                  <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--accent)' }}>{inv.jobNumber ?? '—'}</span></td>
                                  <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.8125rem' }}>{fmtCurrency(inv.partsAmount)}</td>
                                  <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.8125rem' }}>{fmtCurrency(inv.labourAmount)}</td>
                                  <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{fmtCurrency(inv.taxAmount)}</td>
                                  <td><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(inv.totalAmount)}</span></td>
                                  <td><span style={{ color: '#15803d', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(inv.paidAmount)}</span></td>
                                  <td><span style={{ color: bal > 0 ? '#b45309' : '#15803d', fontWeight: 600 }}>{bal > 0 ? fmtCurrency(bal) : '—'}</span></td>
                                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(inv.createdAt)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </ReportCard>
                </div>
              </div>
            )}

            {/* ════════════════════════════ JOBS ════════════════════════════ */}
            {activeTab === 'jobs' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                <ReportCard title="Jobs per Month (Last 6 months)" icon="🔧">
                  <BarChart data={jobsByMonth} color="#2563eb" valueFormatter={(n) => String(n)} />
                </ReportCard>

                <ReportCard title="Jobs by Stage" icon="🚦">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <DonutChart size={110} segments={stageSegments} />
                    <div style={{ flex: 1 }}>
                      {[
                        { label: 'Pending',     value: pendingJobs,    color: '#f59e0b' },
                        { label: 'In Progress', value: inProgressJobs, color: '#2563eb' },
                        { label: 'Delivered',   value: deliveredJobs,  color: '#16a34a' },
                      ].map((s) => (
                        <div key={s.label} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                              <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                            </div>
                            <span style={{ fontWeight: 700 }}>{s.value}</span>
                          </div>
                          <HBar value={s.value} max={filteredJobs.length} color={s.color} />
                        </div>
                      ))}
                    </div>
                  </div>
                </ReportCard>

                {/* Estimate conversion */}
                <ReportCard title="Estimate Conversion" icon="📄">
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: conversionRate >= 50 ? '#15803d' : '#b45309', lineHeight: 1 }}>{conversionRate}%</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: 4 }}>of estimates approved</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Approved', value: estApproved, color: '#16a34a', cls: 'badge-approved' },
                      { label: 'Sent',     value: estSent,     color: '#7c3aed', cls: 'badge-sent'     },
                      { label: 'Draft',    value: estDraft,    color: '#94a3b8', cls: 'badge-draft'    },
                      { label: 'Rejected', value: estRejected, color: '#dc2626', cls: 'badge-rejected' },
                    ].map((s) => (
                      <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <span className={`badge ${s.cls}`} style={{ fontSize: '0.6875rem' }}>{s.label.toUpperCase()}</span>
                        <div style={{ flex: 1, margin: '0 12px' }}>
                          <HBar value={s.value} max={filteredEstimates.length} color={s.color} />
                        </div>
                        <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'right' }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </ReportCard>

                {/* Jobs table */}
                <ReportCard title="Vehicle Fuel Mix (Active Fleet)" icon="⛽">
                  {Object.keys(vehicleTypes).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No vehicles registered.</p>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <DonutChart size={110} segments={Object.entries(vehicleTypes).map(([k, v]) => ({ label: k, value: v, color: vehicleTypeColors[k] ?? '#94a3b8' }))} />
                      <div style={{ flex: 1 }}>
                        {Object.entries(vehicleTypes)
                          .sort(([, a], [, b]) => b - a)
                          .map(([fuel, count]) => (
                            <div key={fuel} style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 3 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <div style={{ width: 10, height: 10, borderRadius: 3, background: vehicleTypeColors[fuel] ?? '#94a3b8' }} />
                                  <span style={{ color: 'var(--text-secondary)' }}>{fuel}</span>
                                </div>
                                <span style={{ fontWeight: 700 }}>{count}</span>
                              </div>
                              <HBar value={count} max={Math.max(...Object.values(vehicleTypes))} color={vehicleTypeColors[fuel] ?? '#94a3b8'} />
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </ReportCard>

                {/* Recent jobs */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <ReportCard title="Recent Jobs" icon="🗂️">
                    {filteredJobs.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No jobs yet.</p>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr><th>Job #</th><th>Customer</th><th>Vehicle</th><th>Complaints</th><th>Stage</th><th>Date</th></tr>
                          </thead>
                          <tbody>
                            {filteredJobs.slice(0, 10).map((j) => {
                              const stageCfg: Record<string, { cls: string; label: string }> = {
                                pending:          { cls: 'badge-pending',   label: 'Pending'     },
                                work_in_progress: { cls: 'badge-progress',  label: 'In Progress' },
                                delivered:        { cls: 'badge-delivered', label: 'Delivered'   },
                              };
                              const { cls, label } = stageCfg[j.stage] ?? { cls: 'badge-draft', label: j.stage };
                              return (
                                <tr key={j.id}>
                                  <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: '0.8125rem' }}>{j.jobNumber}</span></td>
                                  <td style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{j.customer.name}</td>
                                  <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{j.vehicle.registrationNo}</span></td>
                                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.complaints}</td>
                                  <td><span className={`badge ${cls}`} style={{ fontSize: '0.6875rem' }}>{label}</span></td>
                                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(j.createdAt)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </ReportCard>
                </div>
              </div>
            )}

            {/* ════════════════════════════ CUSTOMERS ════════════════════════════ */}
            {activeTab === 'customers' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                <ReportCard title="New Customers (by first job, last 6 months)" icon="👥">
                  <BarChart data={newCustByMonth} color="#7c3aed" valueFormatter={(n) => String(n)} />
                </ReportCard>

                <ReportCard title="Vehicle Fuel Types" icon="⛽">
                  {Object.keys(vehicleTypes).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No vehicles.</p>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <DonutChart size={110} segments={Object.entries(vehicleTypes).map(([k, v]) => ({ label: k, value: v, color: vehicleTypeColors[k] ?? '#94a3b8' }))} />
                      <div style={{ flex: 1 }}>
                        {Object.entries(vehicleTypes).sort(([, a], [, b]) => b - a).map(([fuel, count]) => (
                          <div key={fuel} style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 3 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <div style={{ width: 10, height: 10, borderRadius: 3, background: vehicleTypeColors[fuel] ?? '#94a3b8' }} />
                                <span style={{ color: 'var(--text-secondary)' }}>{fuel}</span>
                              </div>
                              <span style={{ fontWeight: 700 }}>{count}</span>
                            </div>
                            <HBar value={count} max={Math.max(...Object.values(vehicleTypes))} color={vehicleTypeColors[fuel] ?? '#94a3b8'} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </ReportCard>

                {/* Top customers */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <ReportCard title="Top Customers by Jobs" icon="🏆">
                    {topCustomers.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No customer data yet.</p>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr><th>#</th><th>Customer</th><th>Total Jobs</th><th>Total Billed</th><th>Avg per Job</th></tr>
                          </thead>
                          <tbody>
                            {topCustomers.map((c, i) => (
                              <tr key={c.name}>
                                <td>
                                  <div style={{
                                    width: 26, height: 26, borderRadius: '50%', background: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem',
                                    color: i < 3 ? '#fff' : 'var(--text-muted)',
                                  }}>{i + 1}</div>
                                </td>
                                <td style={{ fontWeight: 600 }}>{c.name}</td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontWeight: 700 }}>{c.count}</span>
                                    <div style={{ flex: 1, maxWidth: 100 }}>
                                      <HBar value={c.count} max={topCustomers[0].count} color="#2563eb" />
                                    </div>
                                  </div>
                                </td>
                                <td><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(c.billed)}</span></td>
                                <td style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{c.count > 0 ? fmtCurrency(c.billed / c.count) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </ReportCard>
                </div>

                {/* All customers */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <ReportCard title="Customer Directory" icon="📋">
                    {customers.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No customers yet.</p>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr><th>Name</th><th>Phone</th><th>Email</th><th>Vehicles</th><th>Jobs</th></tr>
                          </thead>
                          <tbody>
                            {customers.map((c) => {
                              const jobCount = filteredJobs.filter((j) => j.customer.id === c.id).length;
                              return (
                                <tr key={c.id}>
                                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{c.phone}</td>
                                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{c.email ?? '—'}</td>
                                  <td><span className="badge badge-draft">{c.vehicles.length} vehicle{c.vehicles.length !== 1 ? 's' : ''}</span></td>
                                  <td><span style={{ fontWeight: 700, color: jobCount > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>{jobCount}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </ReportCard>
                </div>
              </div>
            )}

            {/* ════════════════════════════ GST ════════════════════════════ */}
            {activeTab === 'gst' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                <ReportCard title="GST Collected per Month" icon="📊">
                  <BarChart data={gstByMonth} color="#0891b2" />
                </ReportCard>

                {/* GST summary */}
                <ReportCard title="GST Summary" icon="🧾">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {[
                      { label: 'Total Taxable Value',      value: totalBilled - totalTax, note: 'ex-GST' },
                      { label: 'Total GST Collected',      value: totalTax,               note: 'CGST + SGST' },
                      { label: 'Credit Notes Issued',      value: -totalCredited,          note: 'deductions' },
                      { label: 'Net Taxable (after CN)',   value: totalBilled - totalTax - totalCredited, note: '' },
                    ].map((row) => (
                      <div key={row.label} className="info-row">
                        <span className="info-label">{row.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="info-value" style={{ fontVariantNumeric: 'tabular-nums', color: row.value < 0 ? '#dc2626' : undefined }}>
                            {row.value < 0 ? '−' : ''}{fmtCurrency(Math.abs(row.value))}
                          </span>
                          {row.note && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.note}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ReportCard>

                {/* GST by invoice */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <ReportCard title="GST Per Invoice" icon="📑">
                    {filteredInvoices.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No invoices yet.</p>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr><th>Invoice #</th><th>Job</th><th>Taxable Amount</th><th>GST Rate</th><th>GST Amount</th><th>Total incl. GST</th><th>Date</th></tr>
                          </thead>
                          <tbody>
                            {filteredInvoices.map((inv) => {
                              const taxableBase = inv.totalAmount - inv.taxAmount;
                              const gstRate = taxableBase > 0 ? ((inv.taxAmount / taxableBase) * 100).toFixed(0) : '0';
                              return (
                                <tr key={inv.id}>
                                  <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.8125rem' }}>{inv.invoiceNumber}</span></td>
                                  <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--accent)' }}>{inv.jobNumber ?? '—'}</span></td>
                                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(taxableBase)}</td>
                                  <td><span className="badge badge-draft" style={{ fontSize: '0.6875rem' }}>{gstRate}%</span></td>
                                  <td><span style={{ fontWeight: 700, color: '#0891b2', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(inv.taxAmount)}</span></td>
                                  <td><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(inv.totalAmount)}</span></td>
                                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(inv.createdAt)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </ReportCard>
                </div>

                {/* Credit notes */}
                {filteredCreditNotes.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <ReportCard title="Credit Notes (GST Deductions)" icon="📋">
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr><th>Credit Note #</th><th>Against Invoice</th><th>Amount</th><th>Reason</th><th>Date</th></tr>
                          </thead>
                          <tbody>
                            {filteredCreditNotes.map((cn) => (
                              <tr key={cn.id}>
                                <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.8125rem' }}>{cn.creditNoteNumber}</span></td>
                                <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--accent)' }}>{cn.invoiceNumber ?? '—'}</span></td>
                                <td><span style={{ fontWeight: 700, color: '#dc2626' }}>−{fmtCurrency(cn.amount)}</span></td>
                                <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{cn.reason}</td>
                                <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(cn.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </ReportCard>
                  </div>
                )}

                <div style={{ gridColumn: '1 / -1' }}>
                  <ReportCard title="GST Compliance - B2B Register" icon="🏢">
                    {b2bInvoices.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No B2B invoices in selected date range.</p>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr><th>Invoice #</th><th>Customer</th><th>GSTIN</th><th>Taxable</th><th>GST</th><th>Total</th></tr>
                          </thead>
                          <tbody>
                            {b2bInvoices.map((inv) => {
                              const job = jobsById[inv.jobCardId];
                              return (
                                <tr key={inv.id}>
                                  <td>{inv.invoiceNumber}</td>
                                  <td>{job?.customer.name ?? '—'}</td>
                                  <td style={{ fontFamily: 'var(--font-mono)' }}>{job?.customer.gstin ?? '—'}</td>
                                  <td>{fmtCurrency(inv.totalAmount - inv.taxAmount)}</td>
                                  <td>{fmtCurrency(inv.taxAmount)}</td>
                                  <td style={{ fontWeight: 700 }}>{fmtCurrency(inv.totalAmount)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </ReportCard>
                </div>

                <ReportCard title="GST Compliance - B2C Summary" icon="🧾">
                  <div className="info-row"><span className="info-label">B2C Invoices</span><span className="info-value">{b2cInvoices.length}</span></div>
                  <div className="info-row"><span className="info-label">Taxable Value</span><span className="info-value">{fmtCurrency(b2cInvoices.reduce((s, i) => s + (i.totalAmount - i.taxAmount), 0))}</span></div>
                  <div className="info-row"><span className="info-label">GST Collected</span><span className="info-value">{fmtCurrency(b2cInvoices.reduce((s, i) => s + i.taxAmount, 0))}</span></div>
                  <div className="info-row"><span className="info-label">Invoice Value</span><span className="info-value">{fmtCurrency(b2cInvoices.reduce((s, i) => s + i.totalAmount, 0))}</span></div>
                </ReportCard>

                <ReportCard title="HSN-like Summary (from invoice lines)" icon="📦">
                  {Object.keys(hsnSummary).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No line-level data in selected date range.</p>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr><th>Description Group</th><th>Taxable</th><th>GST</th><th>Total</th></tr>
                        </thead>
                        <tbody>
                          {Object.entries(hsnSummary).map(([key, row]) => (
                            <tr key={key}>
                              <td style={{ maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{key}</td>
                              <td>{fmtCurrency(row.taxable)}</td>
                              <td>{fmtCurrency(row.gst)}</td>
                              <td style={{ fontWeight: 700 }}>{fmtCurrency(row.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ReportCard>
              </div>
            )}

            {/* ════════════════════════════ PARTS / INVENTORY ════════════════════════════ */}
            {activeTab === 'parts' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Summary */}
                <ReportCard title="Catalogue Summary" icon="📦">
                  {[
                    { label: 'Total Parts / Products',  value: serviceItems.filter((s) => s.type === 'part').length,   color: '#2563eb' },
                    { label: 'Labour / Service Items',  value: serviceItems.filter((s) => s.type === 'labour').length, color: '#7c3aed' },
                    { label: 'Total Catalogue Items',   value: serviceItems.length,                                    color: '#1d4ed8' },
                  ].map((row) => (
                    <div key={row.label} className="info-row">
                      <span className="info-label">{row.label}</span>
                      <span style={{ fontWeight: 700, fontSize: '1.125rem', color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                  {serviceItems.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 8 }}>Type distribution</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <DonutChart size={70} segments={[
                          { label: 'Parts',  value: serviceItems.filter((s) => s.type === 'part').length,   color: '#2563eb' },
                          { label: 'Labour', value: serviceItems.filter((s) => s.type === 'labour').length, color: '#7c3aed' },
                        ]} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8125rem' }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: '#2563eb' }} />
                            <span style={{ color: 'var(--text-secondary)' }}>Parts</span>
                            <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{serviceItems.filter((s) => s.type === 'part').length}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8125rem' }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: '#7c3aed' }} />
                            <span style={{ color: 'var(--text-secondary)' }}>Labour</span>
                            <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{serviceItems.filter((s) => s.type === 'labour').length}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </ReportCard>

                {/* Price range */}
                <ReportCard title="Price Ranges" icon="💲">
                  {serviceItems.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No items in catalogue.</p>
                  ) : (() => {
                    const parts  = serviceItems.filter((s) => s.type === 'part');
                    const labour = serviceItems.filter((s) => s.type === 'labour');
                    const pMin = parts.length  ? Math.min(...parts.map((p)  => p.defaultUnitPrice)) : 0;
                    const pMax = parts.length  ? Math.max(...parts.map((p)  => p.defaultUnitPrice)) : 0;
                    const lMin = labour.length ? Math.min(...labour.map((l) => l.defaultUnitPrice)) : 0;
                    const lMax = labour.length ? Math.max(...labour.map((l) => l.defaultUnitPrice)) : 0;
                    const pAvg = parts.length  ? parts.reduce((s, p) => s + p.defaultUnitPrice, 0) / parts.length : 0;
                    const lAvg = labour.length ? labour.reduce((s, l) => s + l.defaultUnitPrice, 0) / labour.length : 0;
                    return (
                      <>
                        {parts.length > 0 && (
                          <>
                            <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#2563eb', marginBottom: 6 }}>🔩 Parts</div>
                            <div className="info-row"><span className="info-label">Min</span><span className="info-value">{fmtCurrency(pMin)}</span></div>
                            <div className="info-row"><span className="info-label">Max</span><span className="info-value">{fmtCurrency(pMax)}</span></div>
                            <div className="info-row"><span className="info-label">Average</span><span className="info-value" style={{ color: '#2563eb', fontWeight: 700 }}>{fmtCurrency(pAvg)}</span></div>
                          </>
                        )}
                        {labour.length > 0 && (
                          <>
                            <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#7c3aed', marginTop: 12, marginBottom: 6 }}>🔧 Labour</div>
                            <div className="info-row"><span className="info-label">Min</span><span className="info-value">{fmtCurrency(lMin)}</span></div>
                            <div className="info-row"><span className="info-label">Max</span><span className="info-value">{fmtCurrency(lMax)}</span></div>
                            <div className="info-row"><span className="info-label">Average</span><span className="info-value" style={{ color: '#7c3aed', fontWeight: 700 }}>{fmtCurrency(lAvg)}</span></div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </ReportCard>

                {/* Top parts by price */}
                <ReportCard title="Parts Catalogue (by price)" icon="🔩">
                  {topParts.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No parts in catalogue.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {topParts.map((p) => (
                        <div key={p.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 3 }}>
                            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{p.name}</span>
                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(p.defaultUnitPrice)}</span>
                              {p.defaultTaxRatePercent > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>+{p.defaultTaxRatePercent}%</span>}
                            </div>
                          </div>
                          <HBar value={p.defaultUnitPrice} max={maxPartPrice} color="#2563eb" />
                        </div>
                      ))}
                    </div>
                  )}
                </ReportCard>

                {/* Top labour */}
                <ReportCard title="Labour / Service Catalogue" icon="🔧">
                  {topLabour.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No labour items in catalogue.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {topLabour.map((p) => (
                        <div key={p.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 3 }}>
                            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{p.name}</span>
                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(p.defaultUnitPrice)}</span>
                              {p.defaultTaxRatePercent > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>+{p.defaultTaxRatePercent}%</span>}
                            </div>
                          </div>
                          <HBar value={p.defaultUnitPrice} max={maxLabourPrice} color="#7c3aed" />
                        </div>
                      ))}
                    </div>
                  )}
                </ReportCard>

                {/* Full catalogue table */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <ReportCard title="Full Catalogue" icon="📋">
                    {serviceItems.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No items in catalogue yet.</p>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr><th>Name</th><th>Type</th><th>Base Price</th><th>GST</th><th>Price incl. GST</th></tr>
                          </thead>
                          <tbody>
                            {[...serviceItems].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)).map((item) => (
                              <tr key={item.id}>
                                <td style={{ fontWeight: 500 }}>{item.name}</td>
                                <td>
                                  <span className={`badge ${item.type === 'part' ? 'badge-progress' : 'badge-sent'}`} style={{ fontSize: '0.6875rem' }}>
                                    {item.type === 'part' ? '🔩 PART' : '🔧 LABOUR'}
                                  </span>
                                </td>
                                <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtCurrency(item.defaultUnitPrice)}</td>
                                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{item.defaultTaxRatePercent > 0 ? `${item.defaultTaxRatePercent}%` : '—'}</td>
                                <td><span style={{ fontWeight: 700, color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(item.defaultUnitPrice * (1 + item.defaultTaxRatePercent / 100))}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </ReportCard>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
