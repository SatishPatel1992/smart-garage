import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  jobs as jobsApi,
  estimates as estimatesApi,
  invoices as invoicesApi,
  serviceItems as serviceItemsApi,
  insurance as insuranceApi,
  me as meApi,
} from '../../api/client';
import type {
  JobCardDto,
  EstimateDto,
  InvoiceDto,
  ServiceItemDto,
  InsuranceCompanyDto,
  OrgSettings,
} from '../../api/client';
import { printInvoice } from '../../components/InvoicePDF';
import type { OrgInfo } from '../../components/InvoicePDF';
import { printEstimate } from '../../components/EstimatePDF';
import { buildEstimatePdfFile, buildInvoicePdfFile } from '../../components/PdfShare';
import { getAppPreferences } from '../../utils/appPreferences';

// ─── constants ────────────────────────────────────────────────────────────────

const STAGES: { key: 'pending' | 'work_in_progress' | 'delivered'; label: string; icon: string }[] = [
  { key: 'pending',          label: 'Pending',     icon: '🕐' },
  { key: 'work_in_progress', label: 'In Progress', icon: '🔧' },
  { key: 'delivered',        label: 'Delivered',   icon: '✅' },
];

const GST_CHIPS = [0, 5, 12, 18, 28];

// ─── types ────────────────────────────────────────────────────────────────────

interface EstimateLineEdit {
  id: string;
  description: string;
  itemName: string;
  type: 'part' | 'labour';
  quantity: number;
  unitPrice: number;
  taxRatePercent: number;
  taxAmount: number;
  lineTotal: number;
  // insurance split
  insurancePayableMode: 'percent' | 'rupees' | null;
  insurancePayableValue: number;
  insurancePayableAmount: number; // computed
  customerPayableAmount: number;  // computed
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function computeLine(
  l: Omit<EstimateLineEdit, 'taxAmount' | 'lineTotal' | 'insurancePayableAmount' | 'customerPayableAmount'>
): EstimateLineEdit {
  // GST applied on full subtotal. Then split proportionally — both parties pay their tax share.
  // e.g. Unit=2500, Ins=50%, GST=18%:
  //   subtotal=2500, tax=450, lineTotal=2950
  //   ins pays: 1250 (pre-tax) + 225 (tax) = 1475
  //   cust pays: 1250 (pre-tax) + 225 (tax) = 1475
  //   Customer ₹ column shows pre-tax share (1250) for clarity
  const subtotal  = round2(l.quantity * l.unitPrice);
  const taxAmount = round2(subtotal * l.taxRatePercent / 100);
  const lineTotal = round2(subtotal + taxAmount);

  const insPct = (l.insurancePayableMode === 'percent') ? (l.insurancePayableValue ?? 0) : 0;
  const insurancePayableAmount = round2(subtotal * insPct / 100);           // ins pre-tax share
  const customerPayableAmount  = round2(subtotal - insurancePayableAmount); // cust pre-tax share (shown in col)

  return { ...l, taxAmount, lineTotal, insurancePayableAmount, customerPayableAmount };
}

function getLineNotes(description: string, itemName: string): string {
  if (!description || description === itemName) return '';
  if (description.startsWith(itemName + ' - ')) return description.slice(itemName.length + 3);
  return description;
}

function fmtINR(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getViewEstimateLink(estimateId: string) {
  return `${window.location.origin}/public/estimate/${estimateId}`;
}
function normalizeIndianPhone(raw?: string) {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const estimateSectionRef = useRef<HTMLDivElement>(null);
  const itemSearchRef      = useRef<HTMLDivElement>(null);

  // job / data
  const [job,               setJob]               = useState<JobCardDto | null>(null);
  const [estimate,          setEstimate]          = useState<EstimateDto | null>(null);
  const [invoices,          setInvoices]          = useState<InvoiceDto[]>([]);
  const [insuranceCompanies,setInsuranceCompanies]= useState<InsuranceCompanyDto[]>([]);
  const [org,               setOrg]               = useState<OrgInfo>({ name: 'Smart Garage' });
  const [orgSettings,       setOrgSettings]       = useState<OrgSettings>({});
  const [serviceItems,      setServiceItems]      = useState<ServiceItemDto[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState<string | null>(null);
  const [updating,          setUpdating]          = useState(false);

  // estimate builder
  const [estimateLines,     setEstimateLines]     = useState<EstimateLineEdit[]>([]);
  const [includeGST,        setIncludeGST]        = useState(() => getAppPreferences().estimateIncludeGSTByDefault);
  const [itemSearch,        setItemSearch]        = useState('');
  const [itemSearchOpen,    setItemSearchOpen]    = useState(false);
  const [selectedInsuranceId,setSelectedInsuranceId] = useState<string | null>(null);
  const [selectedLineIds,   setSelectedLineIds]   = useState<Set<string>>(new Set());

  // modals
  const [showCreateItem,    setShowCreateItem]    = useState(false);
  const [createItemName,    setCreateItemName]    = useState('');
  const [createItemType,    setCreateItemType]    = useState<'part' | 'labour'>('part');
  const [createItemPrice,   setCreateItemPrice]   = useState('');
  const [createItemTax,     setCreateItemTax]     = useState('18');

  const [showSendModal,     setShowSendModal]     = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNote,      setRevisionNote]      = useState('');
  const [showVersionHistory,setShowVersionHistory]= useState(false);

  const [showPaymentModal,  setShowPaymentModal]  = useState(false);
  const [paymentInvoice,    setPaymentInvoice]    = useState<InvoiceDto | null>(null);
  const [paymentAmount,     setPaymentAmount]     = useState('');
  const [paymentMethod,     setPaymentMethod]     = useState<'cash' | 'upi' | 'card' | 'bank_transfer'>('cash');

  const defaultTax = orgSettings.defaultGstRatePercent ?? 18;

  // ── data fetching ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      jobsApi.get(jobId).then((j) => {
        setJob(j);
        setSelectedInsuranceId(j.insuranceCompanyId ?? null);
      }).catch(() => setError('Failed to load job')),
      insuranceApi.list().then((r) => setInsuranceCompanies(r.companies)).catch(() => {}),
      meApi.get().then((r) => {
        if (r.organization) setOrg({
          name: r.organization.name,
          address: r.organization.address,
          phone: r.organization.phone,
          gstin: r.organization.gstin,
        });
        if (r.organization?.settings) {
          setOrgSettings(r.organization.settings);
          setIncludeGST(r.organization.settings.gstEnabled ?? getAppPreferences().estimateIncludeGSTByDefault);
        }
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !job) return;
    estimatesApi.getByJobId(jobId)
      .then((d) => {
        setEstimate(d);
        // Infer GST toggle from stored lines — if any line has tax, GST is on
        const hasTax = d.lines.some(l => l.amount > l.quantity * l.unitPrice);
        setIncludeGST(hasTax);
        // Recover insurance: if the job's insuranceCompanyId is missing but
        // the estimate lines carry insurance split data, the job was probably
        // created with insurance. Re-sync selectedInsuranceId from the job
        // record (already set above) — the real fix is Fix 1 (saving on select),
        // but for legacy data: mark hasInsurance from lines if any line has a split.
        const hasInsuranceSplit = d.lines.some(
          l => l.insurancePayableMode != null && (l.insurancePayableValue ?? 0) > 0
        );
        if (hasInsuranceSplit) {
          // We know insurance was used — keep selectedInsuranceId from job if set,
          // otherwise set a sentinel so hasInsurance stays true even if job field
          // wasn't saved. The actual company name comes from job.insuranceCompany.
          setSelectedInsuranceId(prev => prev ?? '__insurance__');
        }
        setEstimateLines(d.lines.map((l, i) => {
          const subtotal  = l.quantity * l.unitPrice;
          const taxAmount = round2(l.amount - subtotal);
          const taxRate   = subtotal > 0 ? round2((taxAmount / subtotal) * 100) : 0;
          return computeLine({
            id: `line-${d.id}-${i}`,
            description: l.description, itemName: l.description,
            type: l.type as 'part' | 'labour',
            quantity: l.quantity, unitPrice: l.unitPrice, taxRatePercent: taxRate,
            insurancePayableMode: l.insurancePayableMode ?? null,
            insurancePayableValue: l.insurancePayableValue ?? 0,
          });
        }));
      })
      .catch(() => setEstimate(null));
  }, [jobId, job?.id]);

  useEffect(() => {
    setCreateItemTax(String(defaultTax));
  }, [defaultTax]);

  useEffect(() => {
    if (!jobId) return;
    invoicesApi.getByJobId(jobId)
      .then((r) => setInvoices(r.invoices ?? []))
      .catch(() => setInvoices([]));
  }, [jobId]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!itemSearch.trim()) { setServiceItems([]); return; }
      serviceItemsApi.list(itemSearch).then((r) => setServiceItems(r.items ?? [])).catch(() => setServiceItems([]));
    }, 300);
    return () => clearTimeout(t);
  }, [itemSearch]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (itemSearchRef.current && !itemSearchRef.current.contains(e.target as Node)) {
        setItemSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // scroll to #estimate on load if hash present
  useEffect(() => {
    if (window.location.hash === '#estimate' && estimateSectionRef.current) {
      setTimeout(() => estimateSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    }
  }, [loading]);

  // When GST is toggled off, zero out tax rates
  useEffect(() => {
    if (!includeGST) {
      setEstimateLines(prev => prev.map(l => computeLine({ ...l, taxRatePercent: 0 })));
    }
  }, [includeGST]);
  const hasInsurance = !!selectedInsuranceId;

  // When insurance is selected, default all lines to 100% insurance
  // unless a split is already explicitly set.
  useEffect(() => {
    if (!hasInsurance) return;
    setEstimateLines(prev =>
      prev.map((l) => {
        const hasExplicitSplit =
          l.insurancePayableMode != null && (l.insurancePayableValue ?? 0) > 0;
        if (hasExplicitSplit) return l;
        return computeLine({
          ...l,
          insurancePayableMode: 'percent',
          insurancePayableValue: 100,
        });
      })
    );
  }, [hasInsurance]);

  // ── computed totals ──────────────────────────────────────────────────────────

  const subtotal    = useMemo(() => round2(estimateLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)), [estimateLines]);
  const totalTax    = useMemo(() => round2(estimateLines.reduce((s, l) => s + l.taxAmount, 0)), [estimateLines]);
  const totalAmount = useMemo(() => round2(subtotal + totalTax), [subtotal, totalTax]);
  const sgst        = round2(totalTax / 2);
  const cgst        = round2(totalTax / 2);

  const insuranceTotal = useMemo(
    // Insurance payable = insurance pre-tax share + insurance proportional GST share
    () => round2(estimateLines.reduce((s, l) => {
      const insPct = l.insurancePayableMode === 'percent' ? (l.insurancePayableValue ?? 0) : 0;
      const taxOnIns = round2(l.taxAmount * insPct / 100);
      return s + l.insurancePayableAmount + taxOnIns;
    }, 0)),
    [estimateLines]
  );
  const customerTotal = useMemo(
    // Customer pays pre-tax share + their proportional tax (same % as their subtotal share)
    () => round2(estimateLines.reduce((s, l) => {
      const insPct = l.insurancePayableMode === 'percent' ? (l.insurancePayableValue ?? 0) : 0;
      const custPct = 100 - insPct;
      const custTax = round2(l.taxAmount * custPct / 100);
      return s + l.customerPayableAmount + custTax;
    }, 0)),
    [estimateLines]
  );

  const paidAmount = invoices.length > 0
    ? round2(invoices.reduce((s, inv) => s + (inv.paidAmount ?? 0), 0))
    : 0;
  const discountAmount = invoices.length > 0
    ? round2(invoices.reduce((s, inv) => s + (inv.discountAmount ?? 0), 0))
    : 0;
  const balanceAmount = invoices.length > 0
    ? round2(invoices.reduce((s, inv) => s + Math.max(0, (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0)), 0))
    : totalAmount;

  const isExpired = estimate?.validUntil ? new Date(estimate.validUntil) < new Date() : false;

  // ── line management ──────────────────────────────────────────────────────────

  const addLine = (item: ServiceItemDto) => {
    setEstimateLines(prev => [...prev, computeLine({
      id: `line-${Date.now()}-${item.id}`,
      description: item.name, itemName: item.name,
      type: item.type as 'part' | 'labour',
      quantity: 1,
      unitPrice: item.defaultUnitPrice,
      taxRatePercent: includeGST ? (item.defaultTaxRatePercent ?? defaultTax) : 0,
      insurancePayableMode: hasInsurance ? 'percent' : null,
      insurancePayableValue: hasInsurance ? 100 : 0,
    })]);
    setItemSearch(''); setItemSearchOpen(false);
  };

  const updateLine = (id: string, updates: Partial<EstimateLineEdit>) =>
    setEstimateLines(prev => prev.map(l => l.id !== id ? l : computeLine({ ...l, ...updates })));

  const removeLine = (id: string) =>
    setEstimateLines(prev => prev.filter(l => l.id !== id));

  const toggleLineSelection = (id: string) =>
    setSelectedLineIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAllLines = (checked: boolean) =>
    setSelectedLineIds(checked ? new Set(estimateLines.map(l => l.id)) : new Set());

  const removeSelectedLines = () => {
    setEstimateLines(prev => prev.filter(l => !selectedLineIds.has(l.id)));
    setSelectedLineIds(new Set());
  };

  // ── API actions ──────────────────────────────────────────────────────────────

  const handleCreateEstimate = async () => {
    if (!jobId || estimateLines.length === 0) return;
    setUpdating(true);
    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + (orgSettings.estimateValidityDays ?? 14));
      const d = await estimatesApi.create({
        jobCardId: jobId,
        lines: estimateLines.map(l => ({
          description: l.description, type: l.type,
          quantity: l.quantity, unitPrice: l.unitPrice, amount: l.lineTotal,
          insurancePayableMode: l.insurancePayableMode ?? undefined,
          insurancePayableValue: l.insurancePayableValue || undefined,
        })),
        totalAmount,
        validUntil: validUntil.toISOString().split('T')[0],
      });
      setEstimate(d);
      refreshLinesFromDto(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create estimate');
    } finally { setUpdating(false); }
  };

  const refreshLinesFromDto = (d: EstimateDto) => {
    setEstimateLines(d.lines.map((l, i) => {
      const st  = l.quantity * l.unitPrice;
      const tax = round2(l.amount - st);
      return computeLine({
        id: `line-${d.id}-${i}`,
        description: l.description, itemName: l.description,
        type: l.type as 'part' | 'labour',
        quantity: l.quantity, unitPrice: l.unitPrice,
        taxRatePercent: st > 0 ? round2((tax / st) * 100) : 0,
        insurancePayableMode: l.insurancePayableMode ?? null,
        insurancePayableValue: l.insurancePayableValue ?? 0,
      });
    }));
  };

  const handleSaveRevision = async () => {
    if (!estimate) return;
    setUpdating(true);
    try {
      const d = await estimatesApi.addRevision(estimate.id, {
        lines: estimateLines.map(l => ({
          description: l.description, type: l.type,
          quantity: l.quantity, unitPrice: l.unitPrice, amount: l.lineTotal,
          insurancePayableMode: l.insurancePayableMode ?? undefined,
          insurancePayableValue: l.insurancePayableValue || undefined,
        })),
        totalAmount,
        note: revisionNote.trim() || 'Revision after customer request',
      });
      setEstimate(d);
      setShowRevisionModal(false);
      setRevisionNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save revision');
    } finally { setUpdating(false); }
  };

  const markStatus = async (status: 'draft' | 'sent' | 'approved' | 'rejected') => {
    if (!estimate) return;
    try {
      const d = await estimatesApi.updateStatus(estimate.id, status);
      setEstimate(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  const handleCreateItem = async () => {
    const name  = createItemName.trim();
    const price = parseFloat(createItemPrice);
    const tax   = parseFloat(createItemTax);
    if (!name || isNaN(price) || price < 0) return;
    try {
      const created = await serviceItemsApi.create({
        name, type: createItemType,
        defaultUnitPrice: price,
        defaultTaxRatePercent: isNaN(tax) ? defaultTax : tax,
      });
      addLine(created);
      setShowCreateItem(false);
      setCreateItemName(''); setCreateItemPrice(''); setCreateItemTax('18');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create item');
    }
  };

  const creatingInvoiceRef = React.useRef(false);
  const handleCreateInvoice = async () => {
    if (!jobId || !estimate) return;
    if (creatingInvoiceRef.current) return; // prevent double-call
    creatingInvoiceRef.current = true;
    const partsTotal  = estimate.lines.filter(l => l.type === 'part').reduce((s, l) => s + l.amount, 0);
    const labourTotal = estimate.lines.filter(l => l.type === 'labour').reduce((s, l) => s + l.amount, 0);
    setUpdating(true);
    try {
      const res = await invoicesApi.create({
        jobCardId: jobId, estimateId: estimate.id, format: 'tax',
        partsAmount: round2(partsTotal), labourAmount: round2(labourTotal),
        taxAmount: totalTax, discountAmount: 0,
        totalAmount: estimate.totalAmount,
        lines: estimate.lines.map(l => ({
          description: l.description, type: l.type as 'part' | 'labour',
          quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount,
        })),
      });
      setInvoices(res.invoices ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create invoice');
    } finally {
      setUpdating(false);
      creatingInvoiceRef.current = false;
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentInvoice) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;
    const newPaid = round2((paymentInvoice.paidAmount ?? 0) + amount);
    if (newPaid > paymentInvoice.totalAmount) return;
    try {
      const d = await invoicesApi.updatePaidAmount(paymentInvoice.id, newPaid);
      setInvoices(prev => prev.map(i => i.id === d.id ? d : i));
      setShowPaymentModal(false); setPaymentInvoice(null); setPaymentAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record payment');
    }
  };

  const handleDeleteInvoice = async (inv: InvoiceDto) => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    try {
      await invoicesApi.delete(inv.id);
      setInvoices(prev => prev.filter(i => i.id !== inv.id));
      if (estimate && invoices.length <= 1) {
        const d = await estimatesApi.updateStatus(estimate.id, 'sent');
        setEstimate(d);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete invoice');
    }
  };

  const updateStage = async (stage: 'pending' | 'work_in_progress' | 'delivered') => {
    if (!jobId) return;
    try {
      const updated = await jobsApi.updateStage(jobId, stage);
      setJob(updated);
    } catch { setError('Failed to update stage'); }
  };

  // ── send to client ────────────────────────────────────────────────────────────

  const handleSendWhatsApp = () => {
    if (!estimate) return;
    const link    = getViewEstimateLink(estimate.id);
    const message = `Hi${job?.customer.name ? ' ' + job.customer.name : ''}, your vehicle service estimate is ready.\n\nEstimate: ${estimate.estimateNumber}\nAmount: ₹${estimate.totalAmount.toLocaleString('en-IN')}\nValid until: ${fmtDate(estimate.validUntil)}\n\nView & approve: ${link}`;
    const phone = normalizeIndianPhone(job?.customer.phone);
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`, '_blank');
    markStatus('sent');
    setShowSendModal(false);
  };

  const handleSendEmail = () => {
    if (!estimate || !job?.customer.email) return;
    const link    = getViewEstimateLink(estimate.id);
    const subject = `Service Estimate ${estimate.estimateNumber}`;
    const body    = `Dear ${job.customer.name ?? 'Customer'},\n\nYour service estimate is ready.\n\nEstimate No: ${estimate.estimateNumber}\nTotal: ₹${estimate.totalAmount.toLocaleString('en-IN')}\nValid until: ${fmtDate(estimate.validUntil)}\n\nView & approve online: ${link}\n\nThank you.`;
    window.open(`mailto:${job.customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    markStatus('sent');
    setShowSendModal(false);
  };

  const handleCopyLink = async () => {
    if (!estimate) return;
    await navigator.clipboard.writeText(getViewEstimateLink(estimate.id));
    markStatus('sent');
    setShowSendModal(false);
  };

  const [whatsappLoading, setWhatsappLoading] = useState<string | null>(null);

  const sharePdfViaWhatsApp = async (file: File, phone: string, text: string) => {
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
    };
    try {
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: file.name,
          text,
        });
        return;
      }
    } catch {
      // fall through to fallback flow
    }

    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    const msg = `${text}\n\nPlease find the attached PDF invoice.`;
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleSendInvoicePdfWhatsApp = async (inv: InvoiceDto, mode: 'customer' | 'insurance') => {
    if (!estimate || !job) return;
    const loadingKey = `${inv.id}-${mode}`;
    setWhatsappLoading(loadingKey);
    try {
      const file = await buildInvoicePdfFile({ inv, estimate, job, org, mode });
      const phone = normalizeIndianPhone(job.customer.phone);
      const text = `${mode === 'insurance' ? 'Insurance' : 'Customer'} Invoice ${inv.invoiceNumber} for vehicle ${job.vehicle.registrationNo}`;
      await sharePdfViaWhatsApp(file, phone, text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to prepare invoice PDF for WhatsApp.');
    } finally {
      setWhatsappLoading(null);
    }
  };

  const handleSendEstimatePdfWhatsApp = async () => {
    if (!estimate || !job) return;
    setWhatsappLoading('estimate-pdf');
    try {
      const file = await buildEstimatePdfFile({ estimate, job, org });
      const phone = normalizeIndianPhone(job.customer.phone);
      const text = `Estimate ${estimate.estimateNumber} for vehicle ${job.vehicle.registrationNo}`;
      await sharePdfViaWhatsApp(file, phone, text);
      markStatus('sent');
      setShowSendModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to prepare estimate PDF for WhatsApp.');
    } finally {
      setWhatsappLoading(null);
    }
  };

  // ── loading / error screens ───────────────────────────────────────────────────

  if (loading && !job) {
    return <div className="loading"><div className="spinner" /></div>;
  }
  if (error && !job) {
    return (
      <div className="page-content">
        <div className="card">
          <p className="error-msg">{error}</p>
          <Link to="/jobs" className="btn btn-secondary">← Back to Jobs</Link>
        </div>
      </div>
    );
  }
  if (!job) return null;

  const currentStageIndex = STAGES.findIndex(s => s.key === job.stage);

  // ─── render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Page header ── */}
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <Link to="/jobs" className="btn btn-ghost btn-sm" style={{ marginBottom: 6 }}>← Jobs</Link>
            <h1 className="page-title">{job.jobNumber}</h1>
            <p className="page-subtitle">
              {job.customer.name} · {job.vehicle.registrationNo} {job.vehicle.make} {job.vehicle.model}
            </p>
          </div>
          <span className={`badge badge-${job.stage === 'pending' ? 'pending' : job.stage === 'work_in_progress' ? 'progress' : 'delivered'}`} style={{ fontSize: '0.8125rem', padding: '4px 12px' }}>
            {job.stage === 'work_in_progress' ? 'In Progress' : job.stage === 'delivered' ? 'Delivered' : 'Pending'}
          </span>
        </div>
      </div>

      <div className="page-content">
        {error && (
          <div className="alert alert-danger">
            <div className="alert-icon">⚠️</div>
            <div className="alert-body">{error}</div>
          </div>
        )}

        {/* ── Job progress stepper ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="card-title">Job Progress</div>
            {job.stage !== 'delivered' && currentStageIndex < STAGES.length - 1 && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => updateStage(STAGES[currentStageIndex + 1].key)}
              >
                Mark as {STAGES[currentStageIndex + 1].label} →
              </button>
            )}
          </div>
          {/* Stepped progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {STAGES.map((s, idx) => {
              const done    = idx < currentStageIndex;
              const current = idx === currentStageIndex;
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: idx < STAGES.length - 1 ? 1 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: done || current ? '#0d9488' : 'var(--bg-base)',
                      border: `2px solid ${done || current ? '#0d9488' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16,
                      boxShadow: current ? '0 0 0 4px rgba(13,148,136,0.15)' : 'none',
                      transition: 'all 0.2s',
                    }}>
                      {done ? '✓' : s.icon}
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: current ? 700 : 500,
                      color: done || current ? '#0d9488' : 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}>
                      {s.label}
                    </span>
                  </div>
                  {idx < STAGES.length - 1 && (
                    <div style={{
                      flex: 1, height: 3, margin: '0 8px', marginTop: -18,
                      background: done ? '#0d9488' : 'var(--border)',
                      borderRadius: 2, transition: 'background 0.3s',
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Customer + Vehicle cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 0 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>
                {job.customer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="card-title" style={{ margin: 0 }}>Customer</div>
            </div>
            <div className="info-row"><span className="info-label">Name</span><span className="info-value">{job.customer.name}</span></div>
            <div className="info-row"><span className="info-label">Phone</span><span className="info-value">{job.customer.phone}</span></div>
            {job.customer.email && <div className="info-row"><span className="info-label">Email</span><span className="info-value">{job.customer.email}</span></div>}
          </div>
          <div className="card" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🚗</div>
              <div className="card-title" style={{ margin: 0 }}>Vehicle</div>
            </div>
            <div className="info-row"><span className="info-label">Reg No</span><span className="info-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{job.vehicle.registrationNo}</span></div>
            <div className="info-row"><span className="info-label">Make / Model</span><span className="info-value">{job.vehicle.make} {job.vehicle.model}</span></div>
            <div className="info-row"><span className="info-label">Odometer</span><span className="info-value">{job.odometerReading.toLocaleString()} km</span></div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>Complaints / Concerns</div>
          <p style={{ margin: 0, color: job.complaints ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: job.complaints ? 'normal' : 'italic' }}>
            {job.complaints || 'No complaints recorded'}
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            ESTIMATE SECTION  (anchored via id="estimate" for deep-linking)
        ════════════════════════════════════════════════════════════════════════ */}
        <div id="estimate" ref={estimateSectionRef} style={{ scrollMarginTop: 24 }}>
          <div className="job-parts-desktop-card" style={{ marginTop: 14 }}>
            <div className="job-parts-desktop-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <h2 className="job-parts-desktop-title">Add parts &amp; labour</h2>
                {estimate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9375rem' }}>{estimate.estimateNumber}</span>
                    <span className={`badge badge-${estimate.status}`}>{estimate.status.toUpperCase()}</span>
                    {isExpired && <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>EXPIRED</span>}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      Valid: {fmtDate(estimate.validUntil)}
                    </span>
                  </div>
                )}
              </div>
              {estimate && (
                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Select insurance (if any), then search and add items.
                </p>
              )}
              {!estimate && (
                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Select insurance (if any), then search and add items.
                </p>
              )}
            </div>

            <div className="job-parts-desktop-body">

              {/* ── Builder UI (always shown pre-estimate; also shown for revisions post-estimate) ── */}
              {(!estimate || showRevisionModal) && (
                <>
                  {/* Row 1 — Insurance + Search */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '20px 32px', marginBottom: 16 }}>

                    {/* Insurance */}
                    <div style={{ minWidth: 220, flex: '0 0 auto' }}>
                      <label className="job-parts-label">Insurance Company</label>
                      <select
                        className="form-control job-parts-select-wide"
                        value={selectedInsuranceId ?? ''}
                        onChange={async e => {
                          const val = e.target.value || null;
                          setSelectedInsuranceId(val);
                          // Persist to server so it survives refresh
                          if (jobId) {
                            try {
                              const updated = await jobsApi.update(jobId, { insuranceCompanyId: val });
                              setJob(updated);
                            } catch {
                              // non-critical — local state is still correct for this session
                            }
                          }
                        }}
                      >
                        <option value="">Select insurance company</option>
                        {insuranceCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    {/* Search */}
                    <div style={{ flex: '1 1 320px', minWidth: 280 }} ref={itemSearchRef}>
                      <label className="job-parts-label">Search Part / Labour</label>
                      <div className="job-parts-search-inline">
                        <span className="job-parts-search-icon">🔍</span>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search parts or labour…"
                          value={itemSearch}
                          onChange={e => { setItemSearch(e.target.value); setItemSearchOpen(true); }}
                          onFocus={() => setItemSearchOpen(true)}
                        />
                        {itemSearchOpen && (itemSearch.trim() || serviceItems.length > 0) && (
                          <div className="job-parts-dropdown">
                            {serviceItems.length === 0 && itemSearch.trim() ? (
                              <button type="button" className="job-parts-dropdown-add-new"
                                onClick={() => { setItemSearchOpen(false); setShowCreateItem(true); }}>
                                + Add "{itemSearch}" as new part/labour
                              </button>
                            ) : (
                              serviceItems.map(item => (
                                <button key={item.id} type="button" className="job-parts-dropdown-option" onClick={() => addLine(item)}>
                                  <span>{item.name}</span>
                                  <span className="job-parts-dropdown-meta">{item.type} · ₹{item.defaultUnitPrice.toLocaleString()}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                        <button type="button" className="job-parts-add-btn"
                          onClick={() => { const f = serviceItems[0]; if (f) addLine(f); else setShowCreateItem(true); }}>
                          +
                        </button>
                      </div>
                    </div>

                    {/* GST Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 2 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Include GST</span>
                      <button
                        type="button"
                        onClick={() => setIncludeGST(v => !v)}
                        style={{
                          width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                          background: includeGST ? '#0d9488' : 'var(--border-strong)',
                          transition: 'background 0.2s', position: 'relative', flexShrink: 0,
                        }}
                        role="switch" aria-checked={includeGST}
                      >
                        <span style={{
                          position: 'absolute', top: 3, left: includeGST ? 'calc(100% - 23px)' : 3,
                          width: 20, height: 20, borderRadius: '50%', background: '#fff',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                        }} />
                      </button>
                    </div>
                  </div>

                  {/* Add new to catalogue link */}
                  <button type="button" className="job-parts-add-catalog" onClick={() => setShowCreateItem(true)}>
                    ⊕ Add new part or labour (catalogue)
                  </button>

                  {/* ── Compact line-items table ── */}
                  {estimateLines.length > 0 && (
                    <>
                      {/* Bulk action bar */}
                      {selectedLineIds.size > 0 && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 12px', background: '#fef2f2', borderRadius: 8,
                          border: '1px solid #fecaca', marginBottom: 8,
                        }}>
                          <span style={{ fontSize: '0.8125rem', color: '#b91c1c', fontWeight: 600 }}>
                            {selectedLineIds.size} selected
                          </span>
                          <button type="button" className="btn btn-sm btn-danger" onClick={removeSelectedLines}>
                            🗑️ Remove
                          </button>
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelectedLineIds(new Set())}>
                            Clear
                          </button>
                        </div>
                      )}

                      {/* Compact table */}
                      <LineTable
                        lines={estimateLines}
                        includeGST={includeGST}
                        hasInsurance={hasInsurance}
                        selectedLineIds={selectedLineIds}
                        onToggleSelect={toggleLineSelection}
                        onSelectAll={selectAllLines}
                        onUpdate={updateLine}
                        onRemove={removeLine}
                      />

                    </>
                  )}
                  {/* Summary + Create estimate (always visible, even with zero items) */}
                  <EstimateSummary
                    subtotal={subtotal}
                    totalTax={totalTax}
                    sgst={sgst}
                    cgst={cgst}
                    totalAmount={totalAmount}
                    includeGST={includeGST}
                    hasInsurance={hasInsurance}
                    insuranceTotal={insuranceTotal}
                    customerTotal={customerTotal}
                    paidAmount={estimate ? paidAmount : 0}
                    discountAmount={estimate ? discountAmount : 0}
                    balanceAmount={estimate ? balanceAmount : totalAmount}
                    showFinancials={!!estimate}
                  />

                  {!estimate && (
                    <button
                      type="button"
                      className="job-parts-create-btn"
                      onClick={handleCreateEstimate}
                      disabled={updating || estimateLines.length === 0}
                    >
                      {updating ? 'Creating…' : 'Create estimate'}
                    </button>
                  )}
                </>
              )}

              {/* ── Post-estimate view ── */}
              {estimate && !showRevisionModal && (
                <EstimateView
                  estimate={estimate}
                  job={job}
                  invoices={invoices}
                  totalTax={totalTax}
                  paidAmount={paidAmount}
                  discountAmount={discountAmount}
                  balanceAmount={balanceAmount}
                  updating={updating}
                  isExpired={isExpired}
                  includeGST={includeGST}
                  hasInsurance={hasInsurance}
                  insuranceTotal={insuranceTotal}
                  customerTotal={customerTotal}
                  onMarkSent={() => markStatus('sent')}
                  onMarkApproved={() => markStatus('approved')}
                  onMarkRejected={() => markStatus('rejected')}
                  onUndoRejection={() => markStatus('draft')}
                  onSendToClient={() => setShowSendModal(true)}
                  onPrintEstimate={() => printEstimate({ estimate, job, org })}
                  onSaveRevision={() => setShowRevisionModal(true)}
                  onToggleVersionHistory={() => setShowVersionHistory(v => !v)}
                  showVersionHistory={showVersionHistory}
                  onCreateInvoice={handleCreateInvoice}
                  onRecordPayment={(inv) => {
                    setPaymentInvoice(inv);
                    setPaymentAmount(String(round2(inv.totalAmount - (inv.paidAmount ?? 0))));
                    setShowPaymentModal(true);
                  }}
                  onDeleteInvoice={handleDeleteInvoice}
                  org={org}
                  onPrintInvoice={(inv, mode) => printInvoice({ inv, estimate, job, org, mode })}
                  onShareInvoiceWhatsApp={handleSendInvoicePdfWhatsApp}
                  whatsappLoadingKey={whatsappLoading}
                  // pass computed lines for summary when viewing
                  subtotal={estimateLines.reduce((s,l) => s + l.quantity * l.unitPrice, 0)}
                  sgst={sgst} cgst={cgst} totalAmount={estimate.totalAmount}
                />
              )}

              {/* Revision editor shown inline below estimate header */}
              {estimate && showRevisionModal && (
                <div style={{ marginTop: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 0', borderBottom: '1px solid var(--border)', marginBottom: 16,
                  }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0d9488' }}>✏️ Editing Revision</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRevisionModal(false)}>Cancel</button>
                      <button type="button" className="btn btn-sm" style={{ background: '#0d9488', color: '#fff' }}
                        onClick={handleSaveRevision} disabled={updating}>
                        {updating ? 'Saving…' : 'Save revision'}
                      </button>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label>Revision note (optional)</label>
                    <input className="form-control" placeholder="e.g. Updated after customer review"
                      value={revisionNote} onChange={e => setRevisionNote(e.target.value)} />
                  </div>
                </div>
              )}

            </div>{/* /desktop-body */}
          </div>{/* /desktop-card */}
        </div>{/* /#estimate */}
      </div>{/* /page-content */}

      {/* ══════════════════════ MODALS ══════════════════════ */}

      {/* Send to client modal */}
      {showSendModal && estimate && (
        <Modal title="Send estimate to client" onClose={() => setShowSendModal(false)}>
          {isExpired && (
            <div className="alert alert-warning" style={{ marginBottom: 12 }}>
              <div className="alert-icon">⚠️</div>
              <div className="alert-body">This estimate has expired. You can still send it.</div>
            </div>
          )}
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Choose how to share estimate <strong>{estimate.estimateNumber}</strong> (₹{estimate.totalAmount.toLocaleString('en-IN')}) with the customer.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" className="btn btn-lg" style={{ background: '#25d366', color: '#fff', justifyContent: 'flex-start', gap: 12 }}
              onClick={handleSendWhatsApp}>
              <span style={{ fontSize: 20 }}>💬</span>
              <span>
                <div style={{ fontWeight: 700 }}>Send via WhatsApp</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 400, opacity: 0.85 }}>Opens WhatsApp with prefilled message</div>
              </span>
            </button>
            <button
              type="button"
              className="btn btn-lg"
              style={{ background: '#128c7e', color: '#fff', justifyContent: 'flex-start', gap: 12 }}
              onClick={handleSendEstimatePdfWhatsApp}
            >
              <span style={{ fontSize: 20 }}>📄</span>
              <span>
                <div style={{ fontWeight: 700 }}>Send Estimate PDF via WhatsApp</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 400, opacity: 0.9 }}>
                  Shares PDF file directly when supported
                </div>
              </span>
            </button>
            <button type="button" className="btn btn-lg btn-secondary" style={{ justifyContent: 'flex-start', gap: 12 }}
              onClick={handleSendEmail} disabled={!job?.customer.email}>
              <span style={{ fontSize: 20 }}>📧</span>
              <span>
                <div style={{ fontWeight: 700 }}>Send via Email</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                  {job?.customer.email ?? 'No email on file'}
                </div>
              </span>
            </button>
            <button type="button" className="btn btn-lg btn-secondary" style={{ justifyContent: 'flex-start', gap: 12 }}
              onClick={handleCopyLink}>
              <span style={{ fontSize: 20 }}>🔗</span>
              <span>
                <div style={{ fontWeight: 700 }}>Copy link</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 400 }}>Copies approve link to clipboard</div>
              </span>
            </button>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

            {invoices.length > 0 && (
              <>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Share invoice PDF to customer WhatsApp
                </div>
                {invoices.map((inv) => {
                  const mode: 'customer' | 'insurance' = inv.billToType === 'insurance' ? 'insurance' : 'customer';
                  return (
                    <button
                      key={`wa-invoice-${inv.id}`}
                      type="button"
                      className="btn btn-lg"
                      style={{ background: '#25d366', color: '#fff', justifyContent: 'flex-start', gap: 12 }}
                      onClick={() => handleSendInvoicePdfWhatsApp(inv, mode)}
                    >
                      <span style={{ fontSize: 20 }}>🧾</span>
                      <span>
                        <div style={{ fontWeight: 700 }}>
                          Send {mode === 'insurance' ? 'Insurance' : 'Customer'} Invoice PDF via WhatsApp
                        </div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 400, opacity: 0.9 }}>
                          {inv.invoiceNumber}
                        </div>
                      </span>
                    </button>
                  );
                })}
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              </>
            )}

            {/* Print / PDF estimate */}
            <button
              type="button"
              className="btn btn-lg btn-secondary"
              style={{ justifyContent: 'flex-start', gap: 12 }}
              onClick={() => {
                printEstimate({ estimate, job: job!, org });
                setShowSendModal(false);
              }}
            >
              <span style={{ fontSize: 20 }}>🖨️</span>
              <span>
                <div style={{ fontWeight: 700 }}>Print / Download PDF</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                  Opens print-ready estimate — save as PDF from browser
                </div>
              </span>
            </button>
          </div>
        </Modal>
      )}

      {/* Create catalogue item modal */}
      {showCreateItem && (
        <Modal title="New part or labour" onClose={() => setShowCreateItem(false)}>
          <div className="form-group">
            <label>Name *</label>
            <input className="form-control" value={createItemName} onChange={e => setCreateItemName(e.target.value)} placeholder="e.g. Brake pad set" autoFocus />
          </div>
          <div className="form-row form-row-2" style={{ marginBottom: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Type</label>
              <select className="form-control" value={createItemType} onChange={e => setCreateItemType(e.target.value as 'part' | 'labour')}>
                <option value="part">Part</option>
                <option value="labour">Labour</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Unit price (₹) *</label>
              <input type="number" min={0} step={0.01} className="form-control" value={createItemPrice} onChange={e => setCreateItemPrice(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="form-group">
            <label>Default Tax %</label>
            <select
              className="form-control"
              value={createItemTax}
              onChange={e => setCreateItemTax(e.target.value)}
              style={{ fontWeight: 600 }}
            >
              {GST_CHIPS.map(r => (
                <option key={r} value={String(r)}>{r}%</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreateItem(false)}>Cancel</button>
            <button type="button" className="btn" style={{ background: '#0d9488', color: '#fff' }} onClick={handleCreateItem}>
              Create &amp; add
            </button>
          </div>
        </Modal>
      )}

      {/* Payment modal */}
      {showPaymentModal && paymentInvoice && (
        <Modal title="Record payment" onClose={() => { setShowPaymentModal(false); setPaymentInvoice(null); }}>
          <div style={{ padding: '10px 14px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--success)' }}>Invoice: {paymentInvoice.invoiceNumber}</div>
            <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--success)', marginTop: 2 }}>
              Due: {fmtINR(round2(paymentInvoice.totalAmount - (paymentInvoice.paidAmount ?? 0)))}
            </div>
          </div>
          <div className="form-group">
            <label>Amount (₹) *</label>
            <input type="number" min={0} step={0.01} className="form-control" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label>Payment method</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['cash', 'upi', 'card', 'bank_transfer'] as const).map(m => (
                <button key={m} type="button"
                  onClick={() => setPaymentMethod(m)}
                  style={{
                    padding: '5px 14px', borderRadius: 20, border: '1px solid',
                    background: paymentMethod === m ? '#2563eb' : 'var(--bg-base)',
                    borderColor: paymentMethod === m ? '#2563eb' : 'var(--border)',
                    color: paymentMethod === m ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', textTransform: 'capitalize',
                  }}>
                  {m.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowPaymentModal(false); setPaymentInvoice(null); }}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleRecordPayment}>Record payment</button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── LineTable ───────────────────────────────────────────────────────────────
// Compact table layout matching industry standard:
// [cb] # | Item | Qty | Unit ₹ | GST% | Tax ₹ | Ins% | Cust ₹ | Total ₹ | del
// When insurance is selected: inline Ins% input + read-only Customer ₹ column.
// No separate expand panel — everything lives in the row.

function LineTable({
  lines, includeGST, hasInsurance, selectedLineIds,
  onToggleSelect, onSelectAll, onUpdate, onRemove,
}: {
  lines: EstimateLineEdit[];
  includeGST: boolean;
  hasInsurance: boolean;
  selectedLineIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  onUpdate: (id: string, updates: Partial<EstimateLineEdit>) => void;
  onRemove: (id: string) => void;
}) {
  const allSelected = lines.length > 0 && selectedLineIds.size === lines.length;

  // Grid template: cb | # | item | qty | unit | gst% | tax | [ins%] | [cust] | total | del
  const cols = [
    '28px', '28px',                            // cb, #
    'minmax(160px,1fr)',                        // item
    '64px',                                    // qty
    '100px',                                   // unit price
    ...(hasInsurance ? ['76px', '90px'] : []), // ins%, cust₹  ← BEFORE tax
    ...(includeGST ? ['72px', '80px'] : []),   // gst%, tax₹   ← tax on cust share
    '100px',                                   // total
    '32px',                                    // del
  ].join(' ');

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: cols, background: '#f6f8fa', borderBottom: '2px solid var(--border)', padding: '0 4px', position: 'sticky', top: 0, zIndex: 2 }}>
        <HeaderCell center>
          <input type="checkbox" checked={allSelected} onChange={e => onSelectAll(e.target.checked)} style={{ accentColor: '#0d9488', width: 14, height: 14 }} />
        </HeaderCell>
        <HeaderCell center>#</HeaderCell>
        <HeaderCell>Items</HeaderCell>
        <HeaderCell center>Qty</HeaderCell>
        <HeaderCell right>Unit Price (₹)</HeaderCell>
        {hasInsurance && <HeaderCell center style={{ color: '#0369a1', background: '#f0f9ff' }}>Ins %</HeaderCell>}
        {hasInsurance && <HeaderCell right style={{ color: '#0369a1', background: '#f0f9ff' }}>Customer ₹</HeaderCell>}
        {includeGST && <HeaderCell center>GST %</HeaderCell>}
        {includeGST && <HeaderCell right>Tax (₹)</HeaderCell>}
        <HeaderCell right>Line Total</HeaderCell>
        <HeaderCell center>Del</HeaderCell>
      </div>

      {/* Rows */}
      {lines.map((line, idx) => {
        const isSelected = selectedLineIds.has(line.id);
        return (
          <div
            key={line.id}
            style={{
              display: 'grid',
              gridTemplateColumns: cols,
              borderBottom: '1px solid var(--border-light)',
              background: isSelected ? 'rgba(13,148,136,0.04)' : idx % 2 === 0 ? '#fff' : '#fafbfc',
              alignItems: 'center',
              minHeight: 44,
              padding: '0 4px',
            }}
          >
            {/* Checkbox */}
            <Cell center>
              <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(line.id)}
                style={{ accentColor: '#0d9488', width: 14, height: 14 }} />
            </Cell>

            {/* Row number */}
            <Cell center>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{idx + 1}</span>
            </Cell>

            {/* Item name + description */}
            <Cell>
              <div style={{ padding: '5px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {line.itemName}
                  </span>
                  <span className={`badge ${line.type === 'part' ? 'badge-draft' : 'badge-progress'}`}
                    style={{ fontSize: '0.5625rem', padding: '1px 5px', lineHeight: 1.5 }}>
                    {line.type === 'part' ? 'PART' : 'LABOUR'}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Add note…"
                  value={line.description !== line.itemName ? line.description.replace(line.itemName + ' - ', '') : ''}
                  onChange={e => onUpdate(line.id, {
                    description: e.target.value ? `${line.itemName} - ${e.target.value}` : line.itemName,
                  })}
                  style={{ width: '100%', border: 'none', borderBottom: '1px dashed var(--border)', background: 'transparent', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '1px 0', outline: 'none' }}
                />
              </div>
            </Cell>

            {/* Qty */}
            <Cell center>
              <input type="number" min={0} step={1} value={line.quantity}
                onChange={e => { const n = e.target.value === '' ? 0 : parseInt(e.target.value, 10); if (!isNaN(n) && n >= 0) onUpdate(line.id, { quantity: n }); }}
                style={compactInputStyle} />
            </Cell>

            {/* Unit price */}
            <Cell right>
              <input type="number" min={0} step={0.01} value={line.unitPrice}
                onChange={e => { const n = e.target.value === '' ? 0 : parseFloat(e.target.value); if (!isNaN(n) && n >= 0) onUpdate(line.id, { unitPrice: n }); }}
                style={{ ...compactInputStyle, textAlign: 'right' }} />
            </Cell>

            {/* Insurance % — BEFORE tax; leave blank when not set */}
            {hasInsurance && (
              <Cell center>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  <input
                    type="number" min={0} max={100} step={1}
                    value={
                      line.insurancePayableMode === 'percent' && line.insurancePayableValue > 0
                        ? line.insurancePayableValue
                        : ''
                    }
                    placeholder="—"
                    onChange={e => {
                      if (e.target.value === '') {
                        // Clear: no insurance split on this line
                        onUpdate(line.id, { insurancePayableMode: null, insurancePayableValue: 0 });
                      } else {
                        const n = parseFloat(e.target.value);
                        if (!isNaN(n) && n >= 0 && n <= 100) {
                          onUpdate(line.id, { insurancePayableMode: 'percent', insurancePayableValue: n });
                        }
                      }
                    }}
                    style={{
                      ...compactInputStyle,
                      width: '54px',
                      textAlign: 'right',
                      borderColor: (line.insurancePayableValue ?? 0) > 0 ? '#0369a1' : 'var(--border)',
                      color: (line.insurancePayableValue ?? 0) > 0 ? '#0369a1' : 'var(--text-muted)',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>%</span>
                </div>
              </Cell>
            )}

            {/* Customer ₹ — pre-tax customer share (read-only) */}
            {/* Customer ₹ — their share of the full line total (incl. tax) */}
            {hasInsurance && (
              <Cell right>
                <span style={{
                  fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums',
                  color: 'var(--text-secondary)', fontWeight: 500,
                }}>
                  ₹{line.customerPayableAmount.toFixed(2)}
                </span>
              </Cell>
            )}

            {/* GST % — on full subtotal */}
            {includeGST && (
              <Cell center>
                <select
                  value={GST_CHIPS.includes(line.taxRatePercent) ? line.taxRatePercent : line.taxRatePercent}
                  onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onUpdate(line.id, { taxRatePercent: v }); }}
                  style={{
                    width: '100%', padding: '4px 4px', border: '1px solid',
                    borderColor: line.taxRatePercent > 0 ? '#0d9488' : 'var(--border)',
                    borderRadius: 6, fontSize: '0.8125rem', fontWeight: 700,
                    color: line.taxRatePercent > 0 ? '#0d9488' : 'var(--text-secondary)',
                    background: line.taxRatePercent > 0 ? 'rgba(13,148,136,0.06)' : 'var(--bg-base)',
                    cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none', textAlign: 'center',
                  }}>
                  {GST_CHIPS.map(r => <option key={r} value={r}>{r}%</option>)}
                  {!GST_CHIPS.includes(line.taxRatePercent) && <option value={line.taxRatePercent}>{line.taxRatePercent}%</option>}
                </select>
              </Cell>
            )}

            {/* Tax ₹ — on customer share only */}
            {includeGST && (
              <Cell right>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                  {line.taxAmount > 0 ? `₹${line.taxAmount.toFixed(2)}` : '—'}
                </span>
              </Cell>
            )}

            {/* Line total */}
            <Cell right>
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                ₹{line.lineTotal.toLocaleString('en-IN')}
              </span>
            </Cell>

            {/* Delete */}
            <Cell center>
              <button type="button" onClick={() => onRemove(line.id)}
                style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background='#fee2e2'; b.style.borderColor='#fca5a5'; b.style.color='#dc2626'; }}
                onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background='transparent'; b.style.borderColor='var(--border)'; b.style.color='var(--text-muted)'; }}>
                ✕
              </button>
            </Cell>
          </div>
        );
      })}

      {/* Footer: item count + subtotal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', background: '#f6f8fa', borderTop: '1px solid var(--border)', fontSize: '0.8125rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {lines.length} item{lines.length !== 1 ? 's' : ''}
          {selectedLineIds.size > 0 && <span style={{ color: '#0d9488', marginLeft: 8 }}>· {selectedLineIds.size} selected</span>}
        </span>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          Subtotal: ₹{round2(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)).toLocaleString('en-IN')}
        </span>
      </div>
    </div>
  );
}

// ─── Table helpers ───────────────────────────────────────────────────────────

const compactInputStyle: React.CSSProperties = {
  width: '100%', padding: '4px 6px', border: '1px solid var(--border)',
  borderRadius: 5, fontSize: '0.875rem', background: 'var(--bg-base)',
  color: 'var(--text-primary)', outline: 'none', textAlign: 'center',
  fontFamily: 'var(--font-mono)',
};

function HeaderCell({ children, center, right, style }: {
  children?: React.ReactNode; center?: boolean; right?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      padding: '8px 6px',
      fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      textAlign: center ? 'center' : right ? 'right' : 'left',
      userSelect: 'none',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Cell({ children, center, right }: {
  children?: React.ReactNode; center?: boolean; right?: boolean;
}) {
  return (
    <div style={{
      padding: '4px 6px', display: 'flex', alignItems: 'center',
      justifyContent: center ? 'center' : right ? 'flex-end' : 'flex-start',
    }}>
      {children}
    </div>
  );
}

// ─── EstimateSummary ──────────────────────────────────────────────────────────

function EstimateSummary({
  subtotal, totalTax, sgst, cgst, totalAmount, includeGST,
  hasInsurance, insuranceTotal, customerTotal,
  paidAmount, discountAmount, balanceAmount, showFinancials,
}: {
  subtotal: number; totalTax: number; sgst: number; cgst: number; totalAmount: number;
  includeGST: boolean; hasInsurance: boolean; insuranceTotal: number; customerTotal: number;
  paidAmount: number; discountAmount: number; balanceAmount: number; showFinancials: boolean;
}) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
      border: '1px solid #bbf7d0',
      borderRadius: 12, padding: '16px 20px', marginBottom: 16,
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
        Estimate Summary
      </div>
      <SummaryRow label="Sub total"     value={`₹${subtotal.toLocaleString('en-IN')}`} />
      {includeGST && (
        <>
          <SummaryRow label="SGST"    value={`₹${sgst.toLocaleString('en-IN', { minimumFractionDigits: 1 })}`} />
          <SummaryRow label="CGST"    value={`₹${cgst.toLocaleString('en-IN', { minimumFractionDigits: 1 })}`} />
        </>
      )}
      {hasInsurance && insuranceTotal > 0 && (
        <>
          <div style={{ height: 1, background: '#bbf7d0', margin: '8px 0' }} />
          <SummaryRow label="Insurance payable" value={`₹${insuranceTotal.toLocaleString('en-IN')}`} valueColor="#16a34a" />
          <SummaryRow label="Customer payable"  value={`₹${customerTotal.toLocaleString('en-IN')}`} />
        </>
      )}
      <div style={{ height: 1, background: '#bbf7d0', margin: '8px 0' }} />
      <SummaryRow label="Total amount" value={`₹${totalAmount.toLocaleString('en-IN')}`} bold accent="#0d9488" />
      {showFinancials && (
        <>
          <SummaryRow label="Paid amount"    value={`₹${paidAmount.toLocaleString('en-IN')}`}    valueColor="#16a34a" />
          <SummaryRow label="Discount"       value={`₹${discountAmount.toLocaleString('en-IN')}`} valueColor="#d97706" />
          <SummaryRow label="Balance amount" value={`₹${balanceAmount.toLocaleString('en-IN')}`} bold valueColor="#dc2626" />
        </>
      )}
    </div>
  );
}

function SummaryRow({ label, value, bold, accent, valueColor }: {
  label: string; value: string; bold?: boolean; accent?: string; valueColor?: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '0.9375rem' }}>
      <span style={{ color: '#4b5563', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontWeight: bold ? 800 : 600, color: accent ?? valueColor ?? 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

// ─── EstimateView ─────────────────────────────────────────────────────────────
// Shown after estimate is created — lines table, actions, invoices

function EstimateView({
  estimate, job, invoices, totalTax, paidAmount, discountAmount, balanceAmount,
  updating, isExpired, includeGST, hasInsurance, insuranceTotal, customerTotal,
  onMarkSent, onMarkApproved, onMarkRejected, onUndoRejection, onSendToClient,
  onPrintEstimate, onSaveRevision, onToggleVersionHistory, showVersionHistory,
  onCreateInvoice, onRecordPayment, onDeleteInvoice,
  org: _org, onPrintInvoice, onShareInvoiceWhatsApp, whatsappLoadingKey,
  subtotal, sgst, cgst, totalAmount,
}: {
  estimate: EstimateDto;
  job: JobCardDto;
  invoices: InvoiceDto[];
  totalTax: number;
  paidAmount: number;
  discountAmount: number;
  balanceAmount: number;
  updating: boolean;
  isExpired: boolean;
  includeGST: boolean;
  hasInsurance: boolean;
  insuranceTotal: number;
  customerTotal: number;
  onMarkSent: () => void;
  onMarkApproved: () => void;
  onMarkRejected: () => void;
  onUndoRejection: () => void;
  onSendToClient: () => void;
  onPrintEstimate: () => void;
  onSaveRevision: () => void;
  onToggleVersionHistory: () => void;
  showVersionHistory: boolean;
  onCreateInvoice: () => void;
  onRecordPayment: (inv: InvoiceDto) => void;
  onDeleteInvoice: (inv: InvoiceDto) => void;
  org: OrgInfo;
  onPrintInvoice: (inv: InvoiceDto, mode: 'customer' | 'insurance') => void;
  onShareInvoiceWhatsApp: (inv: InvoiceDto, mode: 'customer' | 'insurance') => void;
  whatsappLoadingKey: string | null;
  subtotal: number;
  sgst: number;
  cgst: number;
  totalAmount: number;
}) {
  const isSendable = estimate.status === 'draft' || estimate.status === 'sent';

  return (
    <div>
      {/* Lines table */}
      {estimate.lines.length > 0 && (
        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Unit (₹)</th>
                {includeGST && <th style={{ textAlign: 'right' }}>Tax %</th>}
                {includeGST && <th style={{ textAlign: 'right' }}>Tax (₹)</th>}
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {estimate.lines.map(l => {
                const subtotalLine = round2(l.quantity * l.unitPrice);
                const taxAmt       = round2(l.amount - subtotalLine);
                const taxPct       = subtotalLine > 0 ? round2((taxAmt / subtotalLine) * 100) : 0;
                return (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 500 }}>{l.description}</td>
                    <td><span className={`badge ${l.type === 'part' ? 'badge-draft' : 'badge-progress'}`} style={{ fontSize: '0.625rem' }}>{l.type.toUpperCase()}</span></td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{l.quantity}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₹{l.unitPrice.toLocaleString('en-IN')}</td>
                    {includeGST && (
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                        {taxPct > 0 ? `${taxPct}%` : '—'}
                      </td>
                    )}
                    {includeGST && (
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {taxAmt > 0 ? `₹${taxAmt.toFixed(2)}` : '—'}
                      </td>
                    )}
                    <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>₹{l.amount.toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      <EstimateSummary
        subtotal={subtotal} totalTax={totalTax} sgst={sgst} cgst={cgst}
        totalAmount={totalAmount} includeGST={includeGST}
        hasInsurance={hasInsurance} insuranceTotal={insuranceTotal} customerTotal={customerTotal}
        paidAmount={paidAmount} discountAmount={discountAmount} balanceAmount={balanceAmount}
        showFinancials={invoices.length > 0}
      />

      {/* Action buttons — visible for all non-approved statuses */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {/* Send to client: draft or sent */}
        {(estimate.status === 'draft' || estimate.status === 'sent') && (
          <button type="button" className="btn" style={{ background: '#0d9488', color: '#fff' }} onClick={onSendToClient}>
            📤 Send to client
          </button>
        )}
        {/* Mark sent: only when still draft */}
        {estimate.status === 'draft' && (
          <button type="button" className="btn btn-primary" onClick={onMarkSent}>
            ✉ Mark as sent
          </button>
        )}
        {/* Mark approved: draft or sent */}
        {(estimate.status === 'draft' || estimate.status === 'sent') && (
          <button type="button" className="btn btn-success" onClick={onMarkApproved}>
            ✓ Mark approved
          </button>
        )}
        {/* Mark rejected: draft or sent */}
        {(estimate.status === 'draft' || estimate.status === 'sent') && (
          <button type="button" className="btn btn-danger" onClick={onMarkRejected}>
            ✕ Mark rejected
          </button>
        )}
        {/* Always available: save revision + version history */}
        <button type="button" className="btn btn-secondary" onClick={onPrintEstimate}>
          🖨️ Print Estimate
        </button>
        <button type="button" className="btn btn-secondary" onClick={onSaveRevision}>
          ✏️ Save as revision
        </button>
        {(estimate.revisions?.length ?? 0) > 0 && (
          <button type="button" className="btn btn-ghost" onClick={onToggleVersionHistory}>
            🕐 History ({estimate.revisions?.length})
          </button>
        )}
      </div>

      {/* Status banners */}
      {estimate.status === 'approved' && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <div className="alert-icon">✅</div>
          <div className="alert-body">
            <div className="alert-title">Estimate approved!</div>
            {invoices.length === 0
              ? 'You can now create a formal invoice for this job.'
              : `Invoice ${invoices[0].invoiceNumber} created.`}
          </div>
        </div>
      )}
      {estimate.status === 'rejected' && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 18, flexShrink: 0 }}>✕</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: 2 }}>Estimate rejected</div>
            <div style={{ fontSize: '0.8125rem', color: '#b91c1c', marginBottom: 10 }}>
              You can undo this rejection to revert back to draft, or save a revision with updated pricing.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: '#0d9488', color: '#fff' }}
                onClick={onUndoRejection}
              >
                ↩ Undo rejection (back to draft)
              </button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={onSaveRevision}>
                ✏️ Save new revision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create invoice (approved only) */}
      {estimate.status === 'approved' && (
        <div style={{ marginBottom: 20 }}>
          <button type="button" className="btn btn-success btn-lg"
            onClick={onCreateInvoice}
            disabled={updating || invoices.length > 0}
            style={{ width: '100%' }}>
            {updating ? 'Creating…' : invoices.length > 0 ? '✓ Invoice created' : '🧾 Create invoice'}
          </button>
        </div>
      )}

      {/* Version history accordion */}
      {showVersionHistory && (estimate.revisions?.length ?? 0) > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Version history
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {estimate.revisions?.map(rev => (
              <div key={rev.id} style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'var(--bg-base)', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>v{rev.version} — ₹{rev.totalAmount.toLocaleString('en-IN')}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(rev.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {rev.note && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>{rev.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices */}
      {invoices.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 12, color: 'var(--text-primary)' }}>Invoices</div>
          {invoices.map(inv => {
            const due         = round2(inv.totalAmount - (inv.paidAmount ?? 0));
            const isPaid      = (inv.paidAmount ?? 0) >= inv.totalAmount;
                  // Show insurance copy button when insurance is selected OR
                  // estimate lines carry split data (handles legacy/reload case)
                  const showInsCopy = hasInsurance || estimate.lines.some(
                    l => l.insurancePayableMode != null && (l.insurancePayableValue ?? 0) > 0
                  );
                  const printMode: 'customer' | 'insurance' = inv.billToType === 'insurance' ? 'insurance' : 'customer';

            return (
              <div key={inv.id} style={{
                borderRadius: 12,
                border: `1px solid ${isPaid ? '#bbf7d0' : 'var(--border)'}`,
                overflow: 'hidden',
                marginBottom: 12,
              }}>
                {/* Invoice header */}
                <div style={{
                  padding: '12px 16px',
                  background: isPaid ? '#f0fdf4' : '#f6f8fa',
                  borderBottom: `1px solid ${isPaid ? '#bbf7d0' : 'var(--border)'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>
                      {inv.invoiceNumber}
                    </span>
                    {isPaid
                      ? <span className="badge badge-approved">PAID IN FULL</span>
                      : <span className="badge badge-pending">OUTSTANDING</span>}
                    {showInsCopy && (
                      <span className="badge" style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fbbf24' }}>
                        🛡 Insurance job
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--text-primary)' }}>
                      ₹{inv.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    {!isPaid && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--danger)', fontWeight: 600 }}>
                        Due: ₹{due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {!isPaid && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => onRecordPayment(inv)}>
                      💳 Record payment
                    </button>
                  )}

                  {/* ── PDF button (single, based on invoice billToType) ── */}
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: printMode === 'insurance' ? '#92400e' : '#1a3557', color: '#fff' }}
                    onClick={() => onPrintInvoice(inv, printMode)}
                    title={printMode === 'insurance' ? 'Insurance copy' : 'Customer copy'}
                  >
                    {printMode === 'insurance' ? '🛡 Insurance Invoice' : '🖨 Customer Invoice'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: '#25d366', color: '#fff', minWidth: 130, display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => onShareInvoiceWhatsApp(inv, printMode)}
                    disabled={whatsappLoadingKey === `${inv.id}-${printMode}`}
                    title="Share invoice PDF via WhatsApp"
                  >
                    {whatsappLoadingKey === `${inv.id}-${printMode}` ? (
                      <>
                        <span style={{
                          display: 'inline-block', width: 13, height: 13,
                          border: '2px solid rgba(255,255,255,0.4)',
                          borderTopColor: '#fff',
                          borderRadius: '50%',
                          animation: 'spin 0.7s linear infinite',
                          flexShrink: 0,
                        }} />
                        Preparing PDF…
                      </>
                    ) : (
                      <>💬 WhatsApp PDF</>
                    )}
                  </button>

                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                    onClick={() => onDeleteInvoice(inv)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 60, padding: '1rem',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '20px 24px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700 }}>{title}</h3>
          <button type="button" onClick={onClose} style={{
            border: 'none', background: 'var(--bg-base)', borderRadius: 6,
            width: 28, height: 28, cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)',
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
