import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  Linking,
  Share,
  Platform,
  ActionSheetIOS,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { JobsStackParamList } from '../../navigation/JobsStack';
import type {
  JobCard,
  JobStage,
  EstimateItemLine,
  PartOrLabourItem,
  Estimate,
  EstimateLine,
  Invoice,
  InvoiceFormat,
  PaymentMethod,
} from '../../types/models';
import { jobs as jobsApi, serviceItems as serviceItemsApi, insurance as insuranceApi, estimates as estimatesApi, invoices as invoicesApi } from '../../api/client';
import type { ServiceItemDto, InsuranceCompanyDto, EstimateDto, InvoiceDto, JobCardDto } from '../../api/client';
import { MOCK_MECHANICS } from '../../data/mockJobs';
import { useSettings } from '../../context/SettingsContext';
import { getViewEstimateLink, isEstimateExpired } from '../../data/mockEstimates';
import { buildInvoiceHtml as buildInvoiceHtmlPdf } from '../../utils/invoicePdf';

type Props = NativeStackScreenProps<JobsStackParamList, 'JobDetail'>;

const STAGE_ORDER: JobStage[] = ['pending', 'work_in_progress', 'delivered'];
const STAGE_LABELS: Record<JobStage, string> = {
  pending: 'Pending',
  work_in_progress: 'Work In Progress',
  delivered: 'Delivered',
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function computeLine(line: Omit<EstimateItemLine, 'taxAmount' | 'lineTotal'>): EstimateItemLine {
  const subtotal = line.quantity * line.unitPrice;
  const taxAmount = round2((subtotal * line.taxRatePercent) / 100);
  const lineTotal = round2(subtotal + taxAmount);
  return { ...line, taxAmount, lineTotal };
}

/** Insurance/customer split from line subtotal (before tax). Only when insurance selected. */
function getLinePayableSplit(line: EstimateItemLine): { insuranceAmount: number; customerAmount: number } {
  const lineSubtotal = line.quantity * line.unitPrice;
  const mode = line.insurancePayableMode ?? 'percent';
  const value = line.insurancePayableValue ?? 0;
  let insuranceAmount: number;
  if (mode === 'percent') {
    insuranceAmount = round2((lineSubtotal * Math.min(100, Math.max(0, value))) / 100);
  } else {
    insuranceAmount = round2(Math.min(Math.max(0, value), lineSubtotal));
  }
  const customerAmount = round2(lineSubtotal - insuranceAmount);
  return { insuranceAmount, customerAmount };
}

function mapDtoToJobCard(d: JobCardDto): JobCard {
  return {
    id: d.id,
    jobNumber: d.jobNumber,
    customer: d.customer,
    vehicle: d.vehicle,
    insuranceCompanyId: d.insuranceCompanyId,
    insuranceCompany: d.insuranceCompany,
    complaints: d.complaints,
    odometerReading: d.odometerReading,
    photos: d.photos ?? [],
    stage: d.stage as JobCard['stage'],
    assignedMechanicId: d.assignedMechanicId,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function mapDtoToEstimate(d: EstimateDto): Estimate {
  return {
    id: d.id,
    estimateNumber: d.estimateNumber,
    jobCardId: d.jobCardId,
    lines: d.lines.map((l) => ({
      description: l.description,
      type: l.type as 'part' | 'labour',
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.amount,
      ...(l.insurancePayableMode && { insurancePayableMode: l.insurancePayableMode as 'percent' | 'rupees' }),
      ...(l.insurancePayableValue != null && { insurancePayableValue: l.insurancePayableValue }),
    })),
    totalAmount: d.totalAmount,
    status: d.status as Estimate['status'],
    sentAt: d.sentAt,
    approvedAt: d.approvedAt,
    rejectedAt: d.rejectedAt,
    validUntil: d.validUntil,
    revisions: d.revisions?.map((r) => ({
      id: r.id,
      estimateId: r.estimateId,
      version: r.version,
      lines: r.lines ?? [],
      totalAmount: r.totalAmount,
      note: r.note,
      createdAt: r.createdAt,
    })),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function mapDtoToInvoice(d: InvoiceDto): Invoice {
  return {
    id: d.id,
    invoiceNumber: d.invoiceNumber,
    jobCardId: d.jobCardId,
    estimateId: d.estimateId,
    billToType: d.billToType ?? 'customer',
    format: (d.format as Invoice['format']) ?? 'tax',
    partsAmount: d.partsAmount,
    labourAmount: d.labourAmount,
    taxAmount: d.taxAmount,
    discountAmount: d.discountAmount,
    totalAmount: d.totalAmount,
    paidAmount: d.paidAmount,
    pdfUrl: d.pdfUrl,
    createdAt: d.createdAt,
  };
}

export default function JobDetailScreen({ route, navigation }: Props) {
  const { jobId } = route.params;
  const settings = useSettings();
  const [job, setJob] = useState<JobCard | null>(null);
  const [jobLoading, setJobLoading] = useState(true);
  const [jobError, setJobError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    jobsApi.get(jobId)
      .then((d) => {
        if (!cancelled) {
          setJob(mapDtoToJobCard(d));
          setSelectedInsuranceId(d.insuranceCompanyId ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setJobError('Failed to load job');
      })
      .finally(() => {
        if (!cancelled) setJobLoading(false);
      });
    return () => { cancelled = true; };
  }, [jobId]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showItemsDropdown, setShowItemsDropdown] = useState(false);
  const [includeGST, setIncludeGST] = useState(true);
  const [estimateLines, setEstimateLines] = useState<EstimateItemLine[]>([]);
  const [selectedInsuranceId, setSelectedInsuranceId] = useState<string | null>(null);
  const [showInsuranceDropdown, setShowInsuranceDropdown] = useState(false);
  const [jobEstimate, setJobEstimate] = useState<Estimate | null>(null);
  const [jobInvoices, setJobInvoices] = useState<Invoice[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [invoiceForPayment, setInvoiceForPayment] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [showRevisions, setShowRevisions] = useState(false);
  const [partsSearchResults, setPartsSearchResults] = useState<PartOrLabourItem[]>([]);
  const [partsSearchLoading, setPartsSearchLoading] = useState(false);
  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompanyDto[]>([]);
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [createItemName, setCreateItemName] = useState('');
  const [createItemType, setCreateItemType] = useState<'part' | 'labour'>('part');
  const [createItemPrice, setCreateItemPrice] = useState('');
  const [createItemTaxPercent, setCreateItemTaxPercent] = useState('18');
  const [createItemSubmitting, setCreateItemSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    insuranceApi.list().then((res) => {
      if (!cancelled) setInsuranceCompanies(res.companies);
    }).catch(() => { if (!cancelled) setInsuranceCompanies([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      setPartsSearchLoading(true);
      serviceItemsApi.list(searchQuery)
        .then((res) => {
          if (!cancelled) setPartsSearchResults(res.items as PartOrLabourItem[]);
        })
        .catch(() => { if (!cancelled) setPartsSearchResults([]); })
        .finally(() => { if (!cancelled) setPartsSearchLoading(false); });
    }, 300);
    return () => { clearTimeout(t); cancelled = true; };
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    estimatesApi.getByJobId(jobId)
      .then((d) => {
        if (cancelled) return;
        const est = mapDtoToEstimate(d);
        setJobEstimate(est);
        setEstimateLines(
          est.lines.map((l, i) => {
            const subtotal = l.quantity * l.unitPrice;
            const lineTotal = l.amount;
            const taxAmount = round2(lineTotal - subtotal);
            const taxRatePercent = subtotal > 0 ? round2((taxAmount / subtotal) * 100) : 0;
            return {
              id: `line-${est.id}-${i}`,
              description: l.description,
              type: l.type,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              taxRatePercent,
              taxAmount,
              lineTotal,
              ...(l.insurancePayableMode && { insurancePayableMode: l.insurancePayableMode }),
              ...(l.insurancePayableValue != null && { insurancePayableValue: l.insurancePayableValue }),
            };
          })
        );
      })
      .catch(() => {
        if (!cancelled) setJobEstimate(null);
      });
    return () => { cancelled = true; };
  }, [jobId]);

  useEffect(() => {
    let cancelled = false;
    invoicesApi.getByJobId(jobId)
      .then((res) => {
        if (!cancelled) setJobInvoices((res.invoices ?? []).map(mapDtoToInvoice));
      })
      .catch(() => {
        if (!cancelled) setJobInvoices([]);
      });
    return () => { cancelled = true; };
  }, [jobId]);

  const searchResults = partsSearchResults;
  const selectedInsurance = insuranceCompanies.find((c) => c.id === selectedInsuranceId);
  const estimateSubtotal = useMemo(
    () => round2(estimateLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)),
    [estimateLines]
  );
  const estimateTotalTax = useMemo(
    () => round2(estimateLines.reduce((sum, l) => sum + l.taxAmount, 0)),
    [estimateLines]
  );
  const hasInsuranceSelected = selectedInsurance != null && selectedInsurance.name !== 'No insurance';
  const { insuranceTotal, customerTotal } = useMemo(() => {
    if (!hasInsuranceSelected) return { insuranceTotal: 0, customerTotal: estimateSubtotal };
    let ins = 0;
    let cust = 0;
    estimateLines.forEach((l) => {
      const { insuranceAmount, customerAmount } = getLinePayableSplit(l);
      ins += insuranceAmount;
      cust += customerAmount;
    });
    return { insuranceTotal: round2(ins), customerTotal: round2(cust) };
  }, [hasInsuranceSelected, estimateLines, estimateSubtotal]);

  if (jobLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ marginTop: 12, fontSize: 15, color: '#64748b' }}>Loading job...</Text>
      </View>
    );
  }
  if (jobError || !job) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 24 }}>
        <Text style={{ fontSize: 16, color: '#dc2626', textAlign: 'center' }}>{jobError ?? 'Job not found'}</Text>
      </View>
    );
  }

  const currentStageIndex = STAGE_ORDER.indexOf(job.stage);
  const estimateExpired = jobEstimate ? isEstimateExpired(jobEstimate) : false;
  const gstEnabled = settings.isGstEnabled();
  const taxRates = gstEnabled ? settings.getTaxRates() : [0];

  const addEstimateItem = (item: PartOrLabourItem) => {
    const newLine: Omit<EstimateItemLine, 'taxAmount' | 'lineTotal'> = {
      id: `line-${Date.now()}-${item.id}`,
      description: item.name,
      type: item.type,
      quantity: 1,
      unitPrice: item.defaultUnitPrice,
      taxRatePercent: gstEnabled && includeGST ? item.defaultTaxRatePercent : 0,
      ...(hasInsuranceSelected && { insurancePayableMode: 'percent' as const, insurancePayableValue: 0 }),
    };
    setEstimateLines((prev) => [...prev, computeLine(newLine)]);
    setSearchQuery('');
    setShowItemsDropdown(false);
  };

  const handleCreatePartOrLabour = async () => {
    const name = createItemName.trim();
    const price = parseFloat(createItemPrice);
    const taxPercent = parseFloat(createItemTaxPercent);
    if (!name) {
      Alert.alert('Error', 'Name is required.');
      return;
    }
    if (isNaN(price) || price < 0) {
      Alert.alert('Error', 'Enter a valid unit price.');
      return;
    }
    if (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100) {
      Alert.alert('Error', 'Tax rate must be between 0 and 100.');
      return;
    }
    setCreateItemSubmitting(true);
    try {
      const created = await serviceItemsApi.create({
        name,
        type: createItemType,
        defaultUnitPrice: price,
        defaultTaxRatePercent: taxPercent,
      });
      const item: PartOrLabourItem = {
        id: created.id,
        name: created.name,
        type: created.type as 'part' | 'labour',
        defaultUnitPrice: created.defaultUnitPrice,
        defaultTaxRatePercent: created.defaultTaxRatePercent,
      };
      addEstimateItem(item);
      setShowCreateItemModal(false);
      setCreateItemName('');
      setCreateItemPrice('');
      setCreateItemTaxPercent('18');
      setPartsSearchResults((prev) => [item, ...prev]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create part/labour.');
    } finally {
      setCreateItemSubmitting(false);
    }
  };

  const updateEstimateLine = (id: string, updates: Partial<EstimateItemLine>) => {
    setEstimateLines((prev) =>
      prev.map((l) => (l.id !== id ? l : computeLine({ ...l, ...updates })))
    );
  };

  const removeEstimateLine = (id: string) => {
    setEstimateLines((prev) => prev.filter((l) => l.id !== id));
  };

  const estimateTotalAmount = round2(estimateSubtotal + estimateTotalTax);
  const estimateSgst = round2(estimateTotalTax / 2);
  const estimateCgst = round2(estimateTotalTax / 2);

  const createEstimate = async () => {
    if (estimateLines.length === 0) {
      Alert.alert('Add items', 'Add parts and labour before creating estimate.');
      return;
    }
    const lines: EstimateLine[] = estimateLines.map((l) => ({
      description: l.description,
      type: l.type,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.lineTotal,
      ...(l.insurancePayableMode && { insurancePayableMode: l.insurancePayableMode }),
      ...(l.insurancePayableValue != null && { insurancePayableValue: l.insurancePayableValue }),
    }));
    const validDays = settings.getEstimateValidityDays();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);
    const validUntilStr = validUntil.toISOString().split('T')[0];
    try {
      const d = await estimatesApi.create({
        jobCardId: job.id,
        lines,
        totalAmount: estimateTotalAmount,
        validUntil: validUntilStr,
      });
      const estimate = mapDtoToEstimate(d);
      setJobEstimate(estimate);
      setEstimateLines(
        estimate.lines.map((l, i) => {
          const subtotal = l.quantity * l.unitPrice;
          const lineTotal = l.amount;
          const taxAmount = round2(lineTotal - subtotal);
          const taxRatePercent = subtotal > 0 ? round2((taxAmount / subtotal) * 100) : 0;
          return {
            id: `line-${estimate.id}-${i}`,
            description: l.description,
            type: l.type,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRatePercent,
            taxAmount,
            lineTotal,
          };
        })
      );
      Alert.alert('Estimate created', `${estimate.estimateNumber} is ready. Valid until ${estimate.validUntil ?? '—'}.`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create estimate.');
    }
  };

  function phoneForWhatsApp(phone: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length === 10) return '91' + digits;
    return digits.startsWith('91') ? digits : digits;
  }

  const sendEstimateToClient = () => {
    if (!jobEstimate) return;
    if (estimateExpired) {
      Alert.alert('Estimate expired', 'This estimate has passed its valid-until date. Send anyway?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send anyway', onPress: () => doSendEstimate() },
      ]);
      return;
    }
    doSendEstimate();
  };

  const doSendEstimate = () => {
    if (!jobEstimate) return;
    const link = getViewEstimateLink(jobEstimate.id);
    const message = `Hi, please view and approve/reject your estimate: ${link}`;
    const options = ['WhatsApp', 'Email', 'Copy link', 'Cancel'];
    const cancelButtonIndex = 3;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        (i) => {
          if (i === 0) {
            const num = phoneForWhatsApp(job.customer.phone);
            Linking.openURL(`whatsapp://send?phone=${num}&text=${encodeURIComponent(message)}`).catch(() =>
              Alert.alert('Error', 'Could not open WhatsApp.')
            );
          } else if (i === 1 && job.customer.email) {
            Linking.openURL(
              `mailto:${job.customer.email}?subject=Estimate ${jobEstimate.estimateNumber}&body=${encodeURIComponent(message)}`
            ).catch(() => Alert.alert('Error', 'Could not open mail.'));
          } else if (i === 2) {
            Share.share({ message: link, title: 'Estimate link' });
          }
          if (i !== cancelButtonIndex && i < 3) {
            estimatesApi.updateStatus(jobEstimate.id, 'sent')
              .then((d) => setJobEstimate(mapDtoToEstimate(d)))
              .catch(() => Alert.alert('Error', 'Failed to update estimate status.'));
          }
        }
      );
    } else {
      Alert.alert(
        'Send to client (FR-041/042)',
        'Choose how to send the estimate link.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'WhatsApp',
            onPress: () => {
              const num = phoneForWhatsApp(job.customer.phone);
              Linking.openURL(`whatsapp://send?phone=${num}&text=${encodeURIComponent(message)}`).catch(() =>
                Alert.alert('Error', 'Could not open WhatsApp.')
              );
              estimatesApi.updateStatus(jobEstimate.id, 'sent')
                .then((d) => setJobEstimate(mapDtoToEstimate(d)))
                .catch(() => Alert.alert('Error', 'Failed to update estimate status.'));
            },
          },
          {
            text: 'Email',
            onPress: () => {
              if (job.customer.email) {
                Linking.openURL(
                  `mailto:${job.customer.email}?subject=Estimate ${jobEstimate.estimateNumber}&body=${encodeURIComponent(message)}`
                ).catch(() => Alert.alert('Error', 'Could not open mail.'));
              } else Alert.alert('No email', 'Customer has no email on file.');
              estimatesApi.updateStatus(jobEstimate.id, 'sent')
                .then((d) => setJobEstimate(mapDtoToEstimate(d)))
                .catch(() => Alert.alert('Error', 'Failed to update estimate status.'));
            },
          },
          { text: 'Copy link', onPress: () => Share.share({ message: link, title: 'Estimate link' }) },
        ]
      );
    }
  };

  const shareEstimateAsPdf = async () => {
    if (!jobEstimate) return;
    try {
      const { printToFileAsync } = await import('expo-print');
      const { shareAsync } = await import('expo-sharing');
      const html = buildEstimateHtml(jobEstimate, job);
      const { uri } = await printToFileAsync({ html });
      await shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Estimate ${jobEstimate.estimateNumber}` });
    } catch (e) {
      Alert.alert(
        'PDF',
        'Generate & share as PDF. Install: npx expo install expo-print expo-sharing',
        undefined
      );
    }
  };

  function buildEstimateHtml(est: Estimate, j: JobCard): string {
    const rows = est.lines
      .map(
        (l) =>
          `<tr><td>${escapeHtml(l.description)}</td><td>${l.type}</td><td>${l.quantity}</td><td>₹${l.unitPrice}</td><td>₹${l.amount}</td></tr>`
      )
      .join('');
    return `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:system-ui;padding:20px;color:#1e293b;}
h1{font-size:18px;} .meta{color:#64748b;font-size:14px;margin-bottom:16px;}
table{width:100%;border-collapse:collapse;} th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;}
th{background:#f1f5f9;} .total{font-weight:700;font-size:16px;margin-top:12px;}
</style></head><body>
<h1>Estimate ${escapeHtml(est.estimateNumber)}</h1>
<div class="meta">Job: ${escapeHtml(j.jobNumber)} | Customer: ${escapeHtml(j.customer.name)} | Vehicle: ${j.vehicle.registrationNo}</div>
<table><thead><tr><th>Item</th><th>Type</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="total">Total: ₹${est.totalAmount.toLocaleString('en-IN')}</div>
<div class="meta" style="margin-top:12px;">Valid until: ${est.validUntil ?? '—'}</div>
</body></html>`;
  }

  function escapeHtml(s: string): string {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const shareInvoiceAsPdf = async (inv: Invoice, format: InvoiceFormat) => {
    if (!jobEstimate) return;
    try {
      const { printToFileAsync } = await import('expo-print');
      const { shareAsync } = await import('expo-sharing');
      const billToOverride =
        inv.billToType === 'insurance' && job?.insuranceCompany
          ? { name: job.insuranceCompany.name, address: null, phone: null, gstin: null }
          : null;
      const html = buildInvoiceHtml(inv, job, jobEstimate, format, billToOverride);
      const { uri } = await printToFileAsync({ html });
      await shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${inv.invoiceNumber}` });
    } catch (e) {
      Alert.alert('PDF', 'Install: npx expo install expo-print expo-sharing', undefined);
    }
  };

  function buildInvoiceHtml(
    inv: Invoice,
    j: JobCard,
    est: Estimate,
    format: InvoiceFormat,
    billToOverride?: { name: string; address?: string | null; phone?: string | null; gstin?: string | null } | null
  ): string {
    const company = settings.organization
      ? {
          name: settings.organization.name,
          address: settings.organization.address,
          phone: settings.organization.phone,
          gstin: settings.organization.gstin,
          logoUrl: settings.organization.settings?.logoUrl ?? null,
        }
      : null;
    return buildInvoiceHtmlPdf(inv, format, j, est, company, gstEnabled, billToOverride ?? undefined);
  }

  const saveAsNewRevision = async () => {
    if (!jobEstimate || estimateLines.length === 0) return;
    const lines: EstimateLine[] = estimateLines.map((l) => ({
      description: l.description,
      type: l.type,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.lineTotal,
      ...(l.insurancePayableMode && { insurancePayableMode: l.insurancePayableMode }),
      ...(l.insurancePayableValue != null && { insurancePayableValue: l.insurancePayableValue }),
    }));
    try {
      const d = await estimatesApi.addRevision(jobEstimate.id, {
        lines,
        totalAmount: estimateTotalAmount,
        note: 'Revision after customer request',
      });
      setJobEstimate(mapDtoToEstimate(d));
      Alert.alert('Revision saved', 'New version added to history.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save revision.');
    }
  };

  const markEstimateApproved = () => {
    if (!jobEstimate) return;
    estimatesApi.updateStatus(jobEstimate.id, 'approved')
      .then((d) => {
        setJobEstimate(mapDtoToEstimate(d));
        Alert.alert('Approved', 'Client has approved the estimate. You can now create the invoice.');
      })
      .catch(() => Alert.alert('Error', 'Failed to update estimate status.'));
  };

  const markEstimateRejected = () => {
    if (!jobEstimate) return;
    estimatesApi.updateStatus(jobEstimate.id, 'rejected')
      .then((d) => {
        setJobEstimate(mapDtoToEstimate(d));
        Alert.alert('Rejected', 'Estimate was rejected by client.');
      })
      .catch(() => Alert.alert('Error', 'Failed to update estimate status.'));
  };

  const createInvoice = async () => {
    if (!jobEstimate || jobEstimate.status !== 'approved') return;
    const partsTotal = jobEstimate.lines.filter((l) => l.type === 'part').reduce((s, l) => s + l.amount, 0);
    const labourTotal = jobEstimate.lines.filter((l) => l.type === 'labour').reduce((s, l) => s + l.amount, 0);
    const taxTotal = estimateTotalTax;
    try {
      const res = await invoicesApi.create({
        jobCardId: job.id,
        estimateId: jobEstimate.id,
        format: 'tax',
        partsAmount: round2(partsTotal),
        labourAmount: round2(labourTotal),
        taxAmount: round2(taxTotal),
        discountAmount: 0,
        totalAmount: jobEstimate.totalAmount,
        lines: jobEstimate.lines.map((l) => ({
          description: l.description,
          type: l.type,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
        })),
      });
      const list = res.invoices ?? [];
      setJobInvoices(list.map(mapDtoToInvoice));
      Alert.alert(
        'Invoice(s) created',
        list.length > 1
          ? `Customer and insurance invoices generated. You can download PDFs or collect payment.`
          : `${list[0]?.invoiceNumber ?? 'Invoice'} generated. You can now download PDF or collect payment.`
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create invoice.');
    }
  };

  const deleteInvoiceAndRevertToEstimate = (inv: Invoice) => {
    if (!jobEstimate) return;
    const label = inv.billToType === 'insurance' ? 'Insurance invoice' : 'Customer invoice';
    Alert.alert(
      `Delete ${label}?`,
      'This will remove this invoice. If both invoices are deleted you can create them again from the estimate. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await invoicesApi.delete(inv.id);
              const remaining = jobInvoices.filter((i) => i.id !== inv.id);
              setJobInvoices(remaining);
              if (remaining.length === 0) {
                const updated = await estimatesApi.updateStatus(jobEstimate.id, 'sent');
                setJobEstimate(mapDtoToEstimate(updated));
                Alert.alert('Done', 'Invoice(s) deleted. Estimate is back to "Sent". You can edit and approve again, then create a new invoice.');
              } else {
                Alert.alert('Done', 'Invoice deleted.');
              }
            } catch (err) {
              const msg = err && typeof err === 'object' && 'message' in err ? (err as { message?: string }).message : 'Failed to delete invoice.';
              Alert.alert('Error', String(msg));
            }
          },
        },
      ]
    );
  };

  const recordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!invoiceForPayment || isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid payment amount.');
      return;
    }
    const newPaid = round2((invoiceForPayment.paidAmount ?? 0) + amount);
    const total = invoiceForPayment.totalAmount;
    if (newPaid > total) {
      Alert.alert('Overpayment', `Total invoice is ₹${total.toLocaleString('en-IN')}. Adjust amount.`);
      return;
    }
    try {
      const d = await invoicesApi.updatePaidAmount(invoiceForPayment.id, newPaid);
      setJobInvoices((prev) => prev.map((i) => (i.id === d.id ? mapDtoToInvoice(d) : i)));
      setInvoiceForPayment(null);
      setShowPaymentModal(false);
      setPaymentAmount('');
      Alert.alert('Payment recorded', `₹${amount.toLocaleString('en-IN')} recorded via ${paymentMethod}.`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to record payment.');
    }
  };

  const updateStage = (newStage: JobStage) => {
    setUpdating(true);
    jobsApi
      .updateStage(job.id, newStage)
      .then((d) => setJob(mapDtoToJobCard(d)))
      .catch(() => Alert.alert('Error', 'Failed to update job stage.'))
      .finally(() => setUpdating(false));
  };

  const assignMechanic = (mechanicId: string) => {
    // TODO FR-030: API to assign job to mechanic
    setJob((prev) => ({ ...prev, assignedMechanicId: mechanicId }));
    Alert.alert('Assigned', 'Mechanic assigned (API integration pending).');
  };

  const addPhoto = () => {
    // TODO FR-023: expo-image-picker upload to job card
    Alert.alert('Photos', 'Photo upload will be integrated with API.');
  };

  const assignedMechanic = job.assignedMechanicId
    ? MOCK_MECHANICS.find((m) => m.id === job.assignedMechanicId)
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <Text style={styles.jobNumber}>{job.jobNumber}</Text>
        <View style={styles.stageRow}>
          {STAGE_ORDER.map((stage, index) => {
            const isActive = index <= currentStageIndex;
            const isCurrent = job.stage === stage;
            return (
              <View key={stage} style={styles.stageItem}>
                <View
                  style={[
                    styles.stageDot,
                    isActive && styles.stageDotActive,
                    isCurrent && styles.stageDotCurrent,
                  ]}
                />
                <Text style={[styles.stageLabel, isActive && styles.stageLabelActive]}>
                  {STAGE_LABELS[stage]}
                </Text>
                {index < STAGE_ORDER.length - 1 && <View style={styles.stageLine} />}
              </View>
            );
          })}
        </View>
        {job.stage !== 'delivered' && currentStageIndex < STAGE_ORDER.length - 1 && (
          <TouchableOpacity
            style={styles.progressButton}
            onPress={() => updateStage(STAGE_ORDER[currentStageIndex + 1])}
            disabled={updating}
          >
            <Text style={styles.progressButtonText}>
              Mark as {STAGE_LABELS[STAGE_ORDER[currentStageIndex + 1]]}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Customer</Text>
        <Text style={styles.value}>{job.customer.name}</Text>
        <Text style={styles.valueSecondary}>{job.customer.phone}</Text>
        {job.customer.email ? (
          <Text style={styles.valueSecondary}>{job.customer.email}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Vehicle</Text>
        <Text style={styles.value}>{job.vehicle.registrationNo}</Text>
        <Text style={styles.valueSecondary}>
          {job.vehicle.make} {job.vehicle.model}
          {job.vehicle.year ? ` · ${job.vehicle.year}` : ''}
        </Text>
        <Text style={styles.valueSecondary}>Odometer: {job.odometerReading.toLocaleString()} km</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Complaints</Text>
        <Text style={styles.complaints}>{job.complaints}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Photos (FR-023)</Text>
          <TouchableOpacity onPress={addPhoto}>
            <Ionicons name="add-circle-outline" size={24} color="#3b82f6" />
          </TouchableOpacity>
        </View>
        {job.photos.length === 0 ? (
          <TouchableOpacity style={styles.photoPlaceholder} onPress={addPhoto}>
            <Ionicons name="images-outline" size={40} color="#94a3b8" />
            <Text style={styles.photoPlaceholderText}>Add photos</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.photoRow}>
            {job.photos.map((uri, i) => (
              <View key={i} style={styles.photoThumb} />
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mechanic assignment (FR-030)</Text>
        {assignedMechanic ? (
          <View style={styles.assignedRow}>
            <Ionicons name="person" size={20} color="#22c55e" />
            <Text style={styles.assignedName}>{assignedMechanic.name}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.hint}>Assign to mechanic:</Text>
            {MOCK_MECHANICS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.mechanicChip}
                onPress={() => assignMechanic(m.id)}
              >
                <Text style={styles.mechanicChipText}>{m.name}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>

      {/* Estimate items – last section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add parts & labour</Text>
        <Text style={styles.hint}>Select insurance (if any), then search and add items.</Text>

        <Text style={styles.insuranceLabel}>Insurance company</Text>
        <TouchableOpacity
          style={styles.insuranceDropdownTrigger}
          onPress={() => setShowInsuranceDropdown((v) => !v)}
        >
          <Text style={styles.insuranceDropdownTriggerText} numberOfLines={1}>
            {selectedInsurance
              ? selectedInsurance.name
              : 'Select insurance company'}
          </Text>
          <Ionicons name={selectedInsuranceId && showInsuranceDropdown ? 'chevron-up' : 'chevron-down'} size={20} color="#64748b" />
        </TouchableOpacity>
        {showInsuranceDropdown && (
          <View style={styles.insuranceDropdown}>
            {insuranceCompanies.map((ins) => (
              <TouchableOpacity
                key={ins.id}
                style={[
                  styles.insuranceDropdownItem,
                  selectedInsuranceId === ins.id && styles.insuranceDropdownItemSelected,
                ]}
                onPress={() => {
                  const newId = ins.name === 'No insurance' ? null : ins.id;
                  setSelectedInsuranceId(newId);
                  setShowInsuranceDropdown(false);
                  if (job) {
                    jobsApi.update(job.id, { insuranceCompanyId: newId })
                      .then((d) => setJob(mapDtoToJobCard(d)))
                      .catch(() => Alert.alert('Error', 'Failed to save insurance company.'));
                  }
                  if (ins.name !== 'No insurance' && estimateLines.length > 0) {
                    setEstimateLines((prev) =>
                      prev.map((l) => ({
                        ...l,
                        insurancePayableMode: l.insurancePayableMode ?? 'percent',
                        insurancePayableValue: l.insurancePayableValue ?? 0,
                      }))
                    );
                  }
                }}
              >
                <Text style={[styles.insuranceDropdownItemText, selectedInsuranceId === ins.id && styles.insuranceDropdownItemTextSelected]} numberOfLines={1}>
                  {ins.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.itemsSearchWrap}>
          <Ionicons name="search" size={20} color="#64748b" style={styles.itemsSearchIcon} />
          <TextInput
            style={styles.itemsSearchInput}
            placeholder="Search parts or labour"
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={(t) => {
              setSearchQuery(t);
              setShowItemsDropdown(true);
            }}
            onFocus={() => setShowItemsDropdown(true)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearchQuery(''); setShowItemsDropdown(false); }}
              style={styles.itemsSearchClear}
            >
              <Ionicons name="close-circle" size={22} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {showItemsDropdown && (
          <View style={styles.itemsDropdown}>
            {searchResults.length === 0 && !partsSearchLoading ? (
              <TouchableOpacity
                style={styles.itemsDropdownEmptyRow}
                onPress={() => { setShowItemsDropdown(false); setShowCreateItemModal(true); }}
              >
                <Text style={styles.itemsDropdownEmpty}>No matches</Text>
                <Text style={styles.addNewItemLink}>Add new part/labour</Text>
              </TouchableOpacity>
            ) : searchResults.length === 0 ? (
              <Text style={styles.itemsDropdownEmpty}>Searching...</Text>
            ) : (
              searchResults.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.itemsDropdownItem}
                  onPress={() => addEstimateItem(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.itemsDropdownIcon, item.type === 'part' ? styles.itemsDropdownIconPart : styles.itemsDropdownIconLabour]}>
                    <Ionicons name={item.type === 'part' ? 'cube-outline' : 'construct-outline'} size={18} color="#fff" />
                  </View>
                  <View style={styles.itemsDropdownText}>
                    <Text style={styles.itemsDropdownName}>{item.name}</Text>
                    <Text style={styles.itemsDropdownMeta}>
                      {item.type === 'part' ? 'Part' : 'Labour'} · ₹{item.defaultUnitPrice.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color="#14b8a6" />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {gstEnabled && (
          <View style={styles.itemsGstRow}>
            <Text style={styles.itemsGstLabel}>Include GST</Text>
            <Switch
              value={includeGST}
              onValueChange={setIncludeGST}
              trackColor={{ false: '#e2e8f0', true: '#14b8a6' }}
              thumbColor="#fff"
            />
          </View>
        )}
        <TouchableOpacity
          style={styles.addNewItemBtn}
          onPress={() => setShowCreateItemModal(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color="#3b82f6" />
          <Text style={styles.addNewItemBtnText}>Add new part or labour (catalogue)</Text>
        </TouchableOpacity>

        <Modal
          visible={showCreateItemModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCreateItemModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New part or labour</Text>
              <Text style={styles.modalLabel}>Name</Text>
              <TextInput
                style={styles.modalInput}
                value={createItemName}
                onChangeText={setCreateItemName}
                placeholder="e.g. Brake Pad Set"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.modalLabel}>Type</Text>
              <View style={styles.modalTypeRow}>
                <TouchableOpacity
                  style={[styles.modalTypeChip, createItemType === 'part' && styles.modalTypeChipSelected]}
                  onPress={() => setCreateItemType('part')}
                >
                  <Text style={[styles.modalTypeChipText, createItemType === 'part' && styles.modalTypeChipTextSelected]}>Part</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalTypeChip, createItemType === 'labour' && styles.modalTypeChipSelected]}
                  onPress={() => setCreateItemType('labour')}
                >
                  <Text style={[styles.modalTypeChipText, createItemType === 'labour' && styles.modalTypeChipTextSelected]}>Labour</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>Default unit price (₹)</Text>
              <TextInput
                style={styles.modalInput}
                value={createItemPrice}
                onChangeText={setCreateItemPrice}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
              />
              <Text style={styles.modalLabel}>Default tax %</Text>
              <TextInput
                style={styles.modalInput}
                value={createItemTaxPercent}
                onChangeText={setCreateItemTaxPercent}
                placeholder="18"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowCreateItemModal(false)}
                  disabled={createItemSubmitting}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSubmitBtn}
                  onPress={handleCreatePartOrLabour}
                  disabled={createItemSubmitting}
                >
                  {createItemSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitBtnText}>Create & add to estimate</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {estimateLines.length === 0 ? (
          <View style={styles.itemsEmpty}>
            <Text style={styles.itemsEmptyText}>No items added yet</Text>
          </View>
        ) : (
          <>
            {estimateLines.map((line) => (
              <View key={line.id} style={styles.estimateLineCard}>
                <View style={styles.estimateLineRow1}>
                  <Text style={styles.estimateLineName} numberOfLines={1}>{line.description}</Text>
                  <TouchableOpacity onPress={() => removeEstimateLine(line.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <View style={styles.estimateLineRow2}>
                  <View style={styles.estimateLineField}>
                    <Text style={styles.estimateLineLabel}>Qty</Text>
                    <TextInput
                      style={styles.estimateLineInput}
                      value={String(line.quantity)}
                      onChangeText={(t) => {
                        const n = parseInt(t, 10);
                        if (!isNaN(n) && n >= 0) updateEstimateLine(line.id, { quantity: n });
                      }}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.estimateLineField}>
                    <Text style={styles.estimateLineLabel}>Unit price (₹)</Text>
                    <TextInput
                      style={styles.estimateLineInput}
                      value={String(line.unitPrice)}
                      onChangeText={(t) => {
                        const n = parseFloat(t);
                        if (!isNaN(n) && n >= 0) updateEstimateLine(line.id, { unitPrice: n });
                      }}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                {hasInsuranceSelected && (
                  <View style={styles.estimateLinePayableRow}>
                    <View style={styles.estimateLinePayableField}>
                      <Text style={styles.estimateLineLabel}>Insurance payable</Text>
                      <View style={styles.payableInputRow}>
                        <TextInput
                          style={styles.payableInput}
                          value={String(line.insurancePayableValue ?? (line.insurancePayableMode === 'percent' ? '0' : ''))}
                          onChangeText={(t) => {
                            const num = parseFloat(t);
                            if (line.insurancePayableMode === 'percent') {
                              updateEstimateLine(line.id, { insurancePayableValue: isNaN(num) ? 0 : Math.min(100, Math.max(0, num)) });
                            } else {
                              updateEstimateLine(line.id, { insurancePayableValue: isNaN(num) || num < 0 ? 0 : num });
                            }
                          }}
                          keyboardType="decimal-pad"
                          placeholder="0"
                        />
                        <View style={styles.payableUnitRow}>
                          <TouchableOpacity
                            style={[styles.payableUnitBtn, (line.insurancePayableMode ?? 'percent') === 'percent' && styles.payableUnitBtnSelected]}
                            onPress={() => {
                              const sub = line.quantity * line.unitPrice;
                              const currentVal = line.insurancePayableValue ?? 0;
                              if (line.insurancePayableMode === 'rupees' && sub > 0) {
                                updateEstimateLine(line.id, { insurancePayableMode: 'percent', insurancePayableValue: round2((currentVal / sub) * 100) });
                              } else {
                                updateEstimateLine(line.id, { insurancePayableMode: 'percent', insurancePayableValue: currentVal });
                              }
                            }}
                          >
                            <Text style={[styles.payableUnitText, (line.insurancePayableMode ?? 'percent') === 'percent' && styles.payableUnitTextSelected]}>%</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.payableUnitBtn, line.insurancePayableMode === 'rupees' && styles.payableUnitBtnSelected]}
                            onPress={() => {
                              const sub = line.quantity * line.unitPrice;
                              const pct = line.insurancePayableValue ?? 0;
                              updateEstimateLine(line.id, { insurancePayableMode: 'rupees', insurancePayableValue: round2((sub * pct) / 100) });
                            }}
                          >
                            <Text style={[styles.payableUnitText, line.insurancePayableMode === 'rupees' && styles.payableUnitTextSelected]}>₹</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                    <View style={styles.estimateLinePayableField}>
                      <Text style={styles.estimateLineLabel}>Customer payable</Text>
                      <Text style={styles.customerPayableValue}>
                        ₹{getLinePayableSplit(line).customerAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>
                )}
                {gstEnabled && (
                  <View style={styles.estimateLineRow3}>
                    <Text style={styles.estimateLineLabel}>Tax %</Text>
                    <View style={styles.estimateTaxChips}>
                      {taxRates.map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.estimateTaxChip, line.taxRatePercent === r && styles.estimateTaxChipSelected]}
                          onPress={() => updateEstimateLine(line.id, { taxRatePercent: r })}
                        >
                          <Text style={[styles.estimateTaxChipText, line.taxRatePercent === r && styles.estimateTaxChipTextSelected]}>{r}%</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                <View style={styles.estimateLineTotals}>
                  {gstEnabled && <Text style={styles.estimateLineTaxLabel}>Tax: ₹{line.taxAmount.toFixed(2)}</Text>}
                  <Text style={styles.estimateLineTotal}>Total: ₹{line.lineTotal.toLocaleString('en-IN')}</Text>
                </View>
              </View>
            ))}

            <View style={styles.estimateSummary}>
              {hasInsuranceSelected && (
                <>
                  <View style={styles.estimateSummaryRow}>
                    <Text style={styles.estimateSummaryLabel}>Insurance payable</Text>
                    <Text style={styles.estimateSummaryValue}>₹{insuranceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={styles.estimateSummaryRow}>
                    <Text style={styles.estimateSummaryLabel}>Customer payable</Text>
                    <Text style={styles.estimateSummaryValue}>₹{customerTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </View>
                </>
              )}
              <View style={styles.estimateSummaryRow}>
                <Text style={styles.estimateSummaryLabel}>Sub total</Text>
                <Text style={styles.estimateSummaryValue}>₹{estimateSubtotal.toLocaleString('en-IN')}</Text>
              </View>
              {gstEnabled && (
                <>
                  <View style={styles.estimateSummaryRow}>
                    <Text style={styles.estimateSummaryLabel}>SGST</Text>
                    <Text style={styles.estimateSummaryValue}>₹{estimateSgst.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.estimateSummaryRow}>
                    <Text style={styles.estimateSummaryLabel}>CGST</Text>
                    <Text style={styles.estimateSummaryValue}>₹{estimateCgst.toLocaleString('en-IN')}</Text>
                  </View>
                </>
              )}
              <View style={[styles.estimateSummaryRow, styles.estimateSummaryTotalRow]}>
                <Text style={styles.estimateSummaryTotalLabel}>Total amount</Text>
                <Text style={styles.estimateSummaryTotalValue}>₹{estimateTotalAmount.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            {/* Estimate: Create → Send → Approve (FR-041/042) */}
            <View style={styles.flowSection}>
              <Text style={styles.flowSectionTitle}>Estimate & approval</Text>
              {!jobEstimate ? (
                <TouchableOpacity style={styles.flowPrimaryButton} onPress={createEstimate} activeOpacity={0.8}>
                  <Ionicons name="document-text" size={22} color="#fff" />
                  <Text style={styles.flowPrimaryButtonText}>Create estimate</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.flowStatusRow}>
                    <Text style={styles.flowLabel}>{jobEstimate.estimateNumber}</Text>
                    <View style={styles.flowBadgeRow}>
                      <View style={[styles.flowBadge, styles[`flowBadge_${jobEstimate.status}` as keyof typeof styles]]}>
                        <Text style={styles.flowBadgeText}>{jobEstimate.status.toUpperCase()}</Text>
                      </View>
                      {estimateExpired && (
                        <View style={styles.flowBadgeExpired}>
                          <Text style={styles.flowBadgeExpiredText}>EXPIRED</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.flowAmount}>Total: ₹{jobEstimate.totalAmount.toLocaleString('en-IN')}</Text>
                  {jobEstimate.validUntil && (
                    <Text style={styles.flowValidUntil}>
                      Valid until: {new Date(jobEstimate.validUntil).toLocaleDateString()}
                    </Text>
                  )}
                  <View style={styles.flowActionRow}>
                    {(jobEstimate.status === 'draft' || jobEstimate.status === 'sent') && (
                      <TouchableOpacity style={[styles.flowPrimaryButton, styles.flowPrimaryButtonWide]} onPress={sendEstimateToClient} activeOpacity={0.8}>
                        <Ionicons name="send" size={20} color="#fff" />
                        <Text style={styles.flowPrimaryButtonText}>Send to client</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.flowPdfButton} onPress={shareEstimateAsPdf}>
                      <Ionicons name="document-attach" size={20} color="#3b82f6" />
                      <Text style={styles.flowPdfButtonText}>PDF / Share</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.flowRevisionButton} onPress={saveAsNewRevision}>
                    <Ionicons name="git-branch-outline" size={18} color="#64748b" />
                    <Text style={styles.flowRevisionButtonText}>Save as new revision</Text>
                  </TouchableOpacity>
                  {(jobEstimate.revisions?.length ?? 0) > 0 && (
                    <>
                      <TouchableOpacity onPress={() => setShowRevisions((v) => !v)} style={styles.flowRevisionsToggle}>
                        <Text style={styles.flowRevisionsToggleText}>
                          Version history ({jobEstimate.revisions!.length})
                        </Text>
                        <Ionicons name={showRevisions ? 'chevron-up' : 'chevron-down'} size={18} color="#64748b" />
                      </TouchableOpacity>
                      {showRevisions && (
                        <View style={styles.flowRevisionsList}>
                          {jobEstimate.revisions!.map((rev) => (
                            <View key={rev.id} style={styles.flowRevisionItem}>
                              <Text style={styles.flowRevisionVersion}>v{rev.version}</Text>
                              <Text style={styles.flowRevisionMeta}>
                                ₹{rev.totalAmount.toLocaleString('en-IN')} · {new Date(rev.createdAt).toLocaleString()}
                              </Text>
                              {rev.note ? <Text style={styles.flowRevisionNote}>{rev.note}</Text> : null}
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                  {jobEstimate.status === 'sent' && (
                    <View style={styles.flowDemoRow}>
                      <Text style={styles.flowHint}>Client can view link and approve/reject. For demo:</Text>
                      <View style={styles.flowDemoButtons}>
                        <TouchableOpacity style={styles.flowApproveBtn} onPress={markEstimateApproved}>
                          <Text style={styles.flowApproveBtnText}>Mark approved</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.flowRejectBtn} onPress={markEstimateRejected}>
                          <Text style={styles.flowRejectBtnText}>Mark rejected</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  {jobEstimate.status === 'approved' && (
                    <Text style={styles.flowSuccessText}>✓ Client approved. Create invoice below.</Text>
                  )}
                  {jobEstimate.status === 'rejected' && (
                    <Text style={styles.flowRejectText}>Estimate rejected by client.</Text>
                  )}
                </>
              )}
            </View>

            {/* Invoice: Create after approval */}
            {jobEstimate?.status === 'approved' && (
              <View style={styles.flowSection}>
                <Text style={styles.flowSectionTitle}>Invoice</Text>
                {jobInvoices.length === 0 ? (
                  <TouchableOpacity style={styles.flowPrimaryButton} onPress={createInvoice} activeOpacity={0.8}>
                    <Ionicons name="receipt" size={22} color="#fff" />
                    <Text style={styles.flowPrimaryButtonText}>Create invoice</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    {jobInvoices.map((inv) => (
                      <View key={inv.id} style={[styles.card, { marginBottom: 12 }]}>
                        <View style={styles.flowStatusRow}>
                          <Text style={styles.flowLabel}>
                            {inv.billToType === 'insurance' ? 'Insurance invoice' : 'Customer invoice'} · {inv.invoiceNumber}
                          </Text>
                          <Text style={styles.flowAmount}>₹{inv.totalAmount.toLocaleString('en-IN')}</Text>
                        </View>
                        <View style={styles.flowSummaryRow}>
                          <Text style={styles.flowSummaryLabel}>Paid</Text>
                          <Text style={styles.flowSummaryValue}>₹{(inv.paidAmount ?? 0).toLocaleString('en-IN')}</Text>
                        </View>
                        <View style={styles.flowActionRow}>
                          <TouchableOpacity style={[styles.flowPdfButton, styles.flowPdfButtonHalf]} onPress={() => shareInvoiceAsPdf(inv, 'proforma')}>
                            <Ionicons name="document-attach" size={18} color="#3b82f6" />
                            <Text style={styles.flowPdfButtonText}>Proforma PDF</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.flowPdfButton, styles.flowPdfButtonHalf]} onPress={() => shareInvoiceAsPdf(inv, 'tax')}>
                            <Ionicons name="document-text" size={18} color="#3b82f6" />
                            <Text style={styles.flowPdfButtonText}>Tax PDF</Text>
                          </TouchableOpacity>
                        </View>
                        {inv.billToType !== 'insurance' && (
                          <>
                            {(inv.paidAmount ?? 0) < inv.totalAmount && (
                              <TouchableOpacity
                                style={styles.flowSecondaryButton}
                                onPress={() => {
                                  setInvoiceForPayment(inv);
                                  setShowPaymentModal(true);
                                }}
                              >
                                <Ionicons name="card" size={20} color="#0d9488" />
                                <Text style={styles.flowSecondaryButtonText}>Record payment</Text>
                              </TouchableOpacity>
                            )}
                            {(inv.paidAmount ?? 0) >= inv.totalAmount && (
                              <Text style={styles.flowSuccessText}>✓ Paid in full</Text>
                            )}
                          </>
                        )}
                        <TouchableOpacity
                          style={[styles.flowSecondaryButton, { marginTop: 12, backgroundColor: '#fef2f2' }]}
                          onPress={() => deleteInvoiceAndRevertToEstimate(inv)}
                        >
                          <Ionicons name="arrow-undo" size={20} color="#b91c1c" />
                          <Text style={[styles.flowSecondaryButtonText, { color: '#b91c1c' }]}>Delete this invoice</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}
          </>
        )}
      </View>

      {/* Payment modal */}
      <Modal visible={showPaymentModal} transparent animationType="fade">
        <View style={styles.paymentModalOverlay}>
          <View style={styles.paymentModal}>
            <Text style={styles.paymentModalTitle}>Record payment</Text>
            {invoiceForPayment && (
              <>
                <Text style={styles.paymentModalHint}>
                  Due: ₹{(invoiceForPayment.totalAmount - (invoiceForPayment.paidAmount ?? 0)).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.paymentModalLabel}>Amount (₹)</Text>
                <TextInput
                  style={styles.paymentModalInput}
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                />
                <Text style={styles.paymentModalLabel}>Method</Text>
                <View style={styles.paymentMethodRow}>
                  {(['cash', 'upi', 'card', 'bank_transfer'] as PaymentMethod[]).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.paymentMethodChip, paymentMethod === m && styles.paymentMethodChipSelected]}
                      onPress={() => setPaymentMethod(m)}
                    >
                      <Text style={[styles.paymentMethodChipText, paymentMethod === m && styles.paymentMethodChipTextSelected]}>
                        {m === 'bank_transfer' ? 'Bank' : m.charAt(0).toUpperCase() + m.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.paymentModalActions}>
                  <TouchableOpacity
                    style={styles.paymentModalCancel}
                    onPress={() => {
                      setShowPaymentModal(false);
                      setInvoiceForPayment(null);
                      setPaymentAmount('');
                    }}
                  >
                    <Text style={styles.paymentModalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.paymentModalSubmit} onPress={recordPayment}>
                    <Text style={styles.paymentModalSubmitText}>Record</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  jobNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  stageRow: { flexDirection: 'row', marginBottom: 12 },
  stageItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e2e8f0',
  },
  stageDotActive: { backgroundColor: '#3b82f6' },
  stageDotCurrent: { width: 12, height: 12, borderRadius: 6 },
  stageLabel: { fontSize: 10, color: '#94a3b8', marginLeft: 4 },
  stageLabelActive: { color: '#1e293b' },
  stageLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 2,
  },
  progressButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  progressButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  value: { fontSize: 16, color: '#1e293b', fontWeight: '500' },
  valueSecondary: { fontSize: 14, color: '#64748b', marginTop: 2 },
  complaints: { fontSize: 14, color: '#475569' },
  hint: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  photoPlaceholder: {
    height: 80,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: { fontSize: 13, color: '#94a3b8', marginTop: 6 },
  photoRow: { flexDirection: 'row', gap: 8 },
  photoThumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#f1f5f9' },
  assignedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assignedName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  mechanicChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  mechanicChipText: { fontSize: 15, color: '#1e293b', fontWeight: '500' },
  /* Estimate items – last section */
  insuranceLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  insuranceDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  insuranceDropdownTriggerText: { fontSize: 15, color: '#1e293b', flex: 1 },
  insuranceDropdown: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    maxHeight: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  insuranceDropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  insuranceDropdownItemSelected: { backgroundColor: '#f0fdfa' },
  insuranceDropdownItemText: { fontSize: 15, color: '#1e293b' },
  insuranceDropdownItemTextSelected: { fontWeight: '600', color: '#0d9488' },
  itemsSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  itemsSearchIcon: { marginRight: 8 },
  itemsSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  itemsSearchClear: { padding: 4 },
  itemsDropdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    maxHeight: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  itemsDropdownEmpty: {
    padding: 16,
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
  },
  itemsDropdownEmptyRow: {
    padding: 16,
    alignItems: 'center',
  },
  addNewItemLink: {
    marginTop: 8,
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  addNewItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 8,
  },
  addNewItemBtnText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 14,
  },
  modalTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  modalTypeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  modalTypeChipSelected: { backgroundColor: '#3b82f6' },
  modalTypeChipText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  modalTypeChipTextSelected: { color: '#fff' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  modalCancelBtnText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    minWidth: 120,
  },
  modalSubmitBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  itemsDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemsDropdownIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemsDropdownIconPart: { backgroundColor: '#3b82f6' },
  itemsDropdownIconLabour: { backgroundColor: '#14b8a6' },
  itemsDropdownText: { flex: 1 },
  itemsDropdownName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  itemsDropdownMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  itemsGstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemsGstLabel: { fontSize: 14, fontWeight: '500', color: '#475569' },
  itemsEmpty: { paddingVertical: 20, alignItems: 'center' },
  itemsEmptyText: { fontSize: 14, color: '#94a3b8' },
  estimateLineCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  estimateLineRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  estimateLineName: { fontSize: 15, fontWeight: '600', color: '#1e293b', flex: 1 },
  estimateLineRow2: { flexDirection: 'row', gap: 12 },
  estimateLineField: { flex: 1 },
  estimateLineLabel: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  estimateLineInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1e293b',
  },
  estimateLinePayableRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  estimateLinePayableField: { flex: 1 },
  payableInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payableInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1e293b',
  },
  payableUnitRow: { flexDirection: 'row' },
  payableUnitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    marginLeft: 4,
  },
  payableUnitBtnSelected: { backgroundColor: '#14b8a6' },
  payableUnitText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  payableUnitTextSelected: { color: '#fff' },
  customerPayableValue: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginTop: 4 },
  estimateLineRow3: { marginTop: 10 },
  estimateTaxChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  estimateTaxChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
  },
  estimateTaxChipSelected: { backgroundColor: '#14b8a6' },
  estimateTaxChipText: { fontSize: 12, color: '#475569' },
  estimateTaxChipTextSelected: { color: '#fff' },
  estimateLineTotals: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  estimateLineTaxLabel: { fontSize: 12, color: '#64748b' },
  estimateLineTotal: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  estimateSummary: {
    backgroundColor: '#f0fdfa',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  estimateSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  estimateSummaryLabel: { fontSize: 14, color: '#64748b' },
  estimateSummaryValue: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  estimateSummaryTotalRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#99f6e4',
  },
  estimateSummaryTotalLabel: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  estimateSummaryTotalValue: { fontSize: 16, fontWeight: '700', color: '#0d9488' },
  /* Estimate → Invoice → Payment flow */
  flowSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  flowSectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 10 },
  flowPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  flowPrimaryButtonWide: {
    flex: 1,
    minWidth: 140,
  },
  flowPrimaryButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  flowStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  flowLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  flowAmount: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  flowBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flowBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  flowBadge_draft: { backgroundColor: '#e2e8f0' },
  flowBadge_sent: { backgroundColor: '#dbeafe' },
  flowBadge_approved: { backgroundColor: '#dcfce7' },
  flowBadge_rejected: { backgroundColor: '#fee2e2' },
  flowBadgeText: { fontSize: 11, fontWeight: '700', color: '#1e293b' },
  flowBadgeExpired: { backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  flowBadgeExpiredText: { fontSize: 10, fontWeight: '700', color: '#dc2626' },
  flowValidUntil: { fontSize: 13, color: '#64748b', marginTop: 2, marginBottom: 8 },
  flowActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  flowPdfButton: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  flowPdfButtonText: { fontSize: 14, fontWeight: '600', color: '#3b82f6' },
  flowPdfButtonHalf: { flex: 1, minWidth: 120 },
  flowRevisionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  flowRevisionButtonText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  flowRevisionsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  flowRevisionsToggleText: { fontSize: 13, color: '#64748b' },
  flowRevisionsList: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, marginBottom: 8 },
  flowRevisionItem: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  flowRevisionVersion: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  flowRevisionMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  flowRevisionNote: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  flowHint: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  flowDemoRow: { marginTop: 8 },
  flowDemoButtons: { flexDirection: 'row', gap: 10 },
  flowApproveBtn: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  flowApproveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  flowRejectBtn: {
    flex: 1,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  flowRejectBtnText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
  flowSuccessText: { fontSize: 14, color: '#22c55e', fontWeight: '600', marginTop: 6 },
  flowRejectText: { fontSize: 14, color: '#ef4444', marginTop: 6 },
  flowSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 8 },
  flowSummaryLabel: { fontSize: 14, color: '#64748b' },
  flowSummaryValue: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  flowSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#0d9488',
  },
  flowSecondaryButtonText: { fontSize: 15, fontWeight: '600', color: '#0d9488' },
  /* Payment modal */
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  paymentModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  paymentModalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  paymentModalHint: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  paymentModalLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 10 },
  paymentModalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  paymentMethodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  paymentMethodChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  paymentMethodChipSelected: { backgroundColor: '#0d9488' },
  paymentMethodChipText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  paymentMethodChipTextSelected: { color: '#fff' },
  paymentModalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  paymentModalCancel: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  paymentModalCancelText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  paymentModalSubmit: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#0d9488',
  },
  paymentModalSubmitText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
