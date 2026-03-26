import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainTabs';
import { getJobById } from '../../data/mockJobs';
import { getEstimateByJobId } from '../../data/mockEstimates';
import {
  getAllRecurringContracts,
  generateInvoiceFromRecurring,
  addRecurringContract,
} from '../../data/mockInvoices';
import { buildInvoiceHtml } from '../../utils/invoicePdf';
import { useSettings } from '../../context/SettingsContext';
import type { Invoice, RecurringContract, InvoiceFormat, RecurringFrequency } from '../../types/models';
import { MOCK_CUSTOMERS } from '../../data/mockCustomers';
import { invoices as invoicesApi, creditNotes as creditNotesApi } from '../../api/client';
import type { InvoiceListItemDto, CreditNoteDto } from '../../api/client';
import { jobs as jobsApi } from '../../api/client';
import { estimates as estimatesApi } from '../../api/client';
import type { JobCard } from '../../types/models';
import type { Estimate } from '../../types/models';
import type { JobCardDto } from '../../api/client';
import type { EstimateDto } from '../../api/client';

type Props = { navigation: BottomTabNavigationProp<MainTabParamList, 'Billing'> };

type TabType = 'invoices' | 'credit_notes' | 'recurring';

/** Invoice from API list with optional job number for display */
type InvoiceWithJobNumber = Invoice & { jobNumber?: string };

function dtoToInvoice(d: InvoiceListItemDto): InvoiceWithJobNumber {
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
    jobNumber: d.jobNumber,
  };
}

function dtoToJobCard(d: JobCardDto): JobCard {
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

function dtoToEstimate(d: EstimateDto): Estimate {
  return {
    id: d.id,
    estimateNumber: d.estimateNumber,
    jobCardId: d.jobCardId,
    status: d.status as Estimate['status'],
    lines: d.lines.map((l) => ({ ...l, type: l.type as 'part' | 'labour' })),
    totalAmount: d.totalAmount,
    validUntil: d.validUntil,
    revisions: d.revisions ?? [],
  };
}

export default function BillingScreen({ navigation }: Props) {
  const { organization, isGstEnabled } = useSettings();
  const [tab, setTab] = useState<TabType>('invoices');
  const [invoices, setInvoices] = useState<InvoiceWithJobNumber[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [creditNotes, setCreditNotes] = useState<CreditNoteDto[]>([]);
  const [creditNotesLoading, setCreditNotesLoading] = useState(false);
  const [recurring, setRecurring] = useState<RecurringContract[]>([]);
  const [creditNoteModal, setCreditNoteModal] = useState<InvoiceWithJobNumber | null>(null);
  const [cnAmount, setCnAmount] = useState('');
  const [cnReason, setCnReason] = useState('');
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [newRecurringCustomerId, setNewRecurringCustomerId] = useState('');
  const [newRecurringDesc, setNewRecurringDesc] = useState('');
  const [newRecurringAmount, setNewRecurringAmount] = useState('');
  const [newRecurringFreq, setNewRecurringFreq] = useState<RecurringFrequency>('monthly');

  const refreshInvoices = useCallback(() => {
    setInvoicesLoading(true);
    setInvoicesError(null);
    invoicesApi
      .list()
      .then((res) => setInvoices(res.invoices.map(dtoToInvoice)))
      .catch(() => setInvoicesError('Failed to load invoices'))
      .finally(() => setInvoicesLoading(false));
  }, []);

  const refreshCreditNotes = useCallback(() => {
    setCreditNotesLoading(true);
    creditNotesApi
      .list()
      .then((res) => setCreditNotes(res.creditNotes))
      .catch(() => setCreditNotes([]))
      .finally(() => setCreditNotesLoading(false));
  }, []);

  const refresh = useCallback(() => {
    refreshInvoices();
    refreshCreditNotes();
    setRecurring(getAllRecurringContracts());
  }, [refreshInvoices, refreshCreditNotes]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const openJob = (jobCardId: string) => {
    if (jobCardId.startsWith('amc-')) return;
    (navigation as any).navigate('Jobs', { screen: 'JobDetail', params: { jobId: jobCardId } });
  };

  const shareInvoicePdf = async (inv: Invoice, format: InvoiceFormat) => {
    try {
      const { printToFileAsync } = await import('expo-print');
      const { shareAsync } = await import('expo-sharing');
      let job: JobCard | undefined = getJobById(inv.jobCardId) ?? undefined;
      let est: Estimate | undefined = getEstimateByJobId(inv.jobCardId) ?? undefined;
      if (!job && !inv.jobCardId.startsWith('amc-')) {
        try {
          const [jobRes, estRes] = await Promise.all([
            jobsApi.get(inv.jobCardId),
            estimatesApi.getByJobId(inv.jobCardId).catch(() => null),
          ]);
          job = dtoToJobCard(jobRes);
          est = estRes ? dtoToEstimate(estRes) : undefined;
        } catch (_) {}
      }
      const company = organization
        ? { name: organization.name, address: organization.address, phone: organization.phone, gstin: organization.gstin, logoUrl: organization.settings?.logoUrl ?? null }
        : undefined;
      const billToOverride =
        inv.billToType === 'insurance' && job?.insuranceCompany
          ? { name: job.insuranceCompany.name, address: null, phone: null, gstin: null }
          : undefined;
      const html = buildInvoiceHtml(inv, format, job ?? undefined, est ?? undefined, company, isGstEnabled(), billToOverride);
      const { uri } = await printToFileAsync({ html });
      await shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${inv.invoiceNumber}` });
    } catch (e) {
      Alert.alert('PDF', e instanceof Error ? e.message : 'Install: npx expo install expo-print expo-sharing');
    }
  };

  /** Generate invoice PDF and open share sheet so user can send via WhatsApp (or other apps). */
  const sendInvoicePdf = async (inv: Invoice, format: InvoiceFormat = 'tax') => {
    try {
      const { printToFileAsync } = await import('expo-print');
      const { shareAsync } = await import('expo-sharing');
      let job: JobCard | undefined = getJobById(inv.jobCardId) ?? undefined;
      let est: Estimate | undefined = getEstimateByJobId(inv.jobCardId) ?? undefined;
      if (!job && !inv.jobCardId.startsWith('amc-')) {
        try {
          const [jobRes, estRes] = await Promise.all([
            jobsApi.get(inv.jobCardId),
            estimatesApi.getByJobId(inv.jobCardId).catch(() => null),
          ]);
          job = dtoToJobCard(jobRes);
          est = estRes ? dtoToEstimate(estRes) : undefined;
        } catch (_) {}
      }
      const company = organization
        ? { name: organization.name, address: organization.address, phone: organization.phone, gstin: organization.gstin, logoUrl: organization.settings?.logoUrl ?? null }
        : undefined;
      const billToOverride =
        inv.billToType === 'insurance' && job?.insuranceCompany
          ? { name: job.insuranceCompany.name, address: null, phone: null, gstin: null }
          : undefined;
      const html = buildInvoiceHtml(inv, format, job ?? undefined, est ?? undefined, company, isGstEnabled(), billToOverride);
      const { uri } = await printToFileAsync({ html });
      await shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Send invoice ${inv.invoiceNumber} (e.g. via WhatsApp)` });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not generate or share PDF. Install: npx expo install expo-print expo-sharing');
    }
  };

  const submitCreditNote = async () => {
    if (!creditNoteModal) return;
    const amount = parseFloat(cnAmount);
    if (isNaN(amount) || amount <= 0 || !cnReason.trim()) {
      Alert.alert('Invalid', 'Enter amount and reason.');
      return;
    }
    try {
      await creditNotesApi.create({
        invoiceId: creditNoteModal.id,
        amount,
        reason: cnReason.trim(),
      });
      setCreditNoteModal(null);
      setCnAmount('');
      setCnReason('');
      refresh();
      Alert.alert('Done', 'Credit note created.');
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? (e as { message?: string }).message : 'Could not create credit note.';
      Alert.alert('Error', String(msg));
    }
  };

  const handleGenerateAmc = (contractId: string) => {
    const inv = generateInvoiceFromRecurring(contractId);
    if (inv) {
      refresh();
      Alert.alert('Invoice generated', `${inv.invoiceNumber} created. Next due date updated.`);
    }
  };

  const submitNewRecurring = () => {
    if (!newRecurringCustomerId || !newRecurringDesc.trim()) {
      Alert.alert('Invalid', 'Select customer and enter description.');
      return;
    }
    const amount = parseFloat(newRecurringAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid', 'Enter a valid amount.');
      return;
    }
    const next = new Date();
    if (newRecurringFreq === 'monthly') next.setMonth(next.getMonth() + 1);
    else if (newRecurringFreq === 'quarterly') next.setMonth(next.getMonth() + 3);
    else next.setFullYear(next.getFullYear() + 1);
    addRecurringContract({
      id: 'amc-' + Date.now(),
      customerId: newRecurringCustomerId,
      description: newRecurringDesc.trim(),
      amount,
      frequency: newRecurringFreq,
      nextDueDate: next.toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    });
    setShowAddRecurring(false);
    setNewRecurringCustomerId('');
    setNewRecurringDesc('');
    setNewRecurringAmount('');
    setNewRecurringFreq('monthly');
    refresh();
    Alert.alert('Done', 'Recurring contract added.');
  };

  const customerName = (id: string) => MOCK_CUSTOMERS.find((c) => c.id === id)?.name ?? id;

  const tabOptions: { key: TabType; label: string }[] = [
    { key: 'invoices', label: 'Invoices' },
    { key: 'credit_notes', label: 'Credit notes' },
    { key: 'recurring', label: 'Recurring / AMC' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.tabWrapper}>
        <View style={styles.tabTrack}>
          {tabOptions.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.tabSegment, tab === key && styles.tabSegmentActive]}
              onPress={() => setTab(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabSegmentText, tab === key && styles.tabSegmentTextActive]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === 'invoices' && (
        <>
          {invoicesLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.emptyText}>Loading invoices…</Text>
            </View>
          ) : invoicesError ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>{invoicesError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={refreshInvoices}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
        <FlatList
          data={invoices}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No invoices yet</Text>
              <Text style={styles.emptyHint}>Create from a job: approve estimate then Create invoice.</Text>
            </View>
          }
          renderItem={({ item: inv }) => {
            const isAmc = inv.jobCardId.startsWith('amc-');
            const jobRef = isAmc ? 'AMC' : (inv.jobNumber ? `Job: ${inv.jobNumber}` : inv.jobCardId);
            const paid = inv.paidAmount ?? 0;
            const isPaid = paid >= inv.totalAmount;
            return (
              <View style={styles.card}>
                <TouchableOpacity onPress={() => openJob(inv.jobCardId)} activeOpacity={0.9}>
                  <View style={styles.cardRow}>
                    <Text style={styles.invNumber}>{inv.invoiceNumber}</Text>
                    <View style={[styles.badge, isPaid ? styles.badgePaid : styles.badgePending]}>
                      <Text style={styles.badgeText}>{isPaid ? 'Paid' : 'Pending'}</Text>
                    </View>
                  </View>
                  <Text style={styles.jobRef}>{jobRef}</Text>
                  <Text style={styles.total}>₹{inv.totalAmount.toLocaleString('en-IN')} · Paid ₹{paid.toLocaleString('en-IN')}</Text>
                </TouchableOpacity>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => shareInvoicePdf(inv, 'proforma')}>
                    <Ionicons name="document-outline" size={18} color="#3b82f6" />
                    <Text style={styles.actionText}>Proforma</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => shareInvoicePdf(inv, 'tax')}>
                    <Ionicons name="document-text" size={18} color="#3b82f6" />
                    <Text style={styles.actionText}>Tax (FR-062)</Text>
                  </TouchableOpacity>
                  {!isAmc && (
                    <>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => sendInvoicePdf(inv, 'tax')}>
                        <Ionicons name="logo-whatsapp" size={18} color="#22c55e" />
                        <Text style={styles.actionText}>Send PDF</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => setCreditNoteModal(inv)}>
                        <Ionicons name="return-down-back-outline" size={18} color="#8b5cf6" />
                        <Text style={styles.actionText}>Credit note</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          }}
        />
          )}
        </>
      )}

      {tab === 'credit_notes' && (
        <FlatList
          data={creditNotes}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{creditNotesLoading ? 'Loading…' : 'No credit notes'}</Text>
            </View>
          }
          renderItem={({ item: cn }) => (
            <View style={styles.card}>
              <Text style={styles.invNumber}>{cn.creditNoteNumber}</Text>
              <Text style={styles.jobRef}>Invoice: {cn.invoiceNumber ?? cn.invoiceId}</Text>
              <Text style={styles.total}>₹{cn.amount.toLocaleString('en-IN')}</Text>
              <Text style={styles.meta}>{cn.reason}</Text>
              <Text style={styles.date}>{new Date(cn.createdAt).toLocaleDateString()}</Text>
            </View>
          )}
        />
      )}

      {tab === 'recurring' && (
        <FlatList
          data={recurring}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <TouchableOpacity style={styles.addAmcButton} onPress={() => setShowAddRecurring(true)}>
              <Ionicons name="add-circle-outline" size={22} color="#fff" />
              <Text style={styles.addAmcButtonText}>Add recurring / AMC contract</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No recurring contracts</Text></View>}
          renderItem={({ item: r }) => (
            <View style={styles.card}>
              <Text style={styles.invNumber}>{r.description}</Text>
              <Text style={styles.jobRef}>{customerName(r.customerId)} · {r.frequency}</Text>
              <Text style={styles.total}>₹{r.amount.toLocaleString('en-IN')} / {r.frequency}</Text>
              <Text style={styles.meta}>Next due: {new Date(r.nextDueDate).toLocaleDateString()}</Text>
              <TouchableOpacity style={styles.amcButton} onPress={() => handleGenerateAmc(r.id)}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.amcButtonText}>Generate invoice</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={showAddRecurring} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add recurring / AMC contract</Text>
            <Text style={styles.inputLabel}>Customer</Text>
            <View style={styles.customerChips}>
              {MOCK_CUSTOMERS.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.customerChip, newRecurringCustomerId === c.id && styles.customerChipActive]}
                  onPress={() => setNewRecurringCustomerId(c.id)}
                >
                  <Text style={[styles.customerChipText, newRecurringCustomerId === c.id && styles.customerChipTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={styles.input}
              value={newRecurringDesc}
              onChangeText={setNewRecurringDesc}
              placeholder="e.g. Annual Maintenance Contract"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.inputLabel}>Amount (₹) per cycle</Text>
            <TextInput
              style={styles.input}
              value={newRecurringAmount}
              onChangeText={setNewRecurringAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.inputLabel}>Frequency</Text>
            <View style={styles.freqRow}>
              {(['monthly', 'quarterly', 'yearly'] as RecurringFrequency[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.freqChip, newRecurringFreq === f && styles.freqChipActive]}
                  onPress={() => setNewRecurringFreq(f)}
                >
                  <Text style={[styles.freqChipText, newRecurringFreq === f && styles.freqChipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAddRecurring(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={submitNewRecurring}>
                <Text style={styles.modalSubmitText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!creditNoteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Create credit note</Text>
            {creditNoteModal && (
              <>
                <Text style={styles.modalHint}>Invoice: {creditNoteModal.invoiceNumber}</Text>
                <Text style={styles.inputLabel}>Amount (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={cnAmount}
                  onChangeText={setCnAmount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                />
                <Text style={styles.inputLabel}>Reason (returns / adjustments)</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={cnReason}
                  onChangeText={setCnReason}
                  placeholder="e.g. Part returned, discount"
                  placeholderTextColor="#94a3b8"
                  multiline
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => { setCreditNoteModal(null); setCnAmount(''); setCnReason(''); }}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalSubmit} onPress={submitCreditNote}>
                    <Text style={styles.modalSubmitText}>Create</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  tabWrapper: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: '#f1f5f9' },
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
  },
  tabSegment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tabSegmentActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabSegmentText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  tabSegmentTextActive: { color: '#1e293b', fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#64748b' },
  emptyHint: { fontSize: 13, color: '#94a3b8', marginTop: 8, textAlign: 'center' },
  errorText: { fontSize: 15, color: '#dc2626', textAlign: 'center', marginBottom: 12 },
  retryButton: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#3b82f6', borderRadius: 10 },
  retryButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
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
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  invNumber: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  jobRef: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  total: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  meta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  date: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgePaid: { backgroundColor: '#dcfce7' },
  badgePending: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 14, color: '#3b82f6', fontWeight: '500' },
  amcButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  amcButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  modalHint: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 16,
  },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: '#f1f5f9' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  modalSubmit: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: '#3b82f6' },
  modalSubmitText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  addAmcButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  addAmcButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  customerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  customerChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0' },
  customerChipActive: { backgroundColor: '#3b82f6' },
  customerChipText: { fontSize: 14, color: '#475569' },
  customerChipTextActive: { color: '#fff' },
  freqRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  freqChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0' },
  freqChipActive: { backgroundColor: '#3b82f6' },
  freqChipText: { fontSize: 14, color: '#475569' },
  freqChipTextActive: { color: '#fff' },
});
