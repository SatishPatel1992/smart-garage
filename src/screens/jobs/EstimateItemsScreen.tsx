import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { JobsStackParamList } from '../../navigation/JobsStack';
import type { EstimateItemLine, PartOrLabourItem } from '../../types/models';
import { serviceItems as serviceItemsApi } from '../../api/client';
import { useSettings } from '../../context/SettingsContext';

type Props = NativeStackScreenProps<JobsStackParamList, 'EstimateItems'>;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function computeLine(line: Omit<EstimateItemLine, 'taxAmount' | 'lineTotal'>): EstimateItemLine {
  const subtotal = line.quantity * line.unitPrice;
  const taxAmount = round2((subtotal * line.taxRatePercent) / 100);
  const lineTotal = round2(subtotal + taxAmount);
  return { ...line, taxAmount, lineTotal };
}

export default function EstimateItemsScreen({ route }: Props) {
  const { jobId } = route.params;
  const { getTaxRates, isGstEnabled } = useSettings();
  const gstEnabled = isGstEnabled();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [includeGST, setIncludeGST] = useState(true);
  const [lines, setLines] = useState<EstimateItemLine[]>([]);
  const [paidAmount, setPaidAmount] = useState(0);
  const [searchResults, setSearchResults] = useState<PartOrLabourItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<'part' | 'labour'>('part');
  const [createPrice, setCreatePrice] = useState('');
  const [createTaxPercent, setCreateTaxPercent] = useState('18');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      serviceItemsApi.list(searchQuery)
        .then((res) => { if (!cancelled) setSearchResults(res.items as PartOrLabourItem[]); })
        .catch(() => { if (!cancelled) setSearchResults([]); });
    }, 300);
    return () => { clearTimeout(t); cancelled = true; };
  }, [searchQuery]);

  const taxRates = gstEnabled ? getTaxRates() : [0];

  const addItem = (item: PartOrLabourItem) => {
    const newLine: Omit<EstimateItemLine, 'taxAmount' | 'lineTotal'> = {
      id: `line-${Date.now()}-${item.id}`,
      description: item.name,
      type: item.type,
      quantity: 1,
      unitPrice: item.defaultUnitPrice,
      taxRatePercent: gstEnabled && includeGST ? item.defaultTaxRatePercent : 0,
    };
    setLines((prev) => [...prev, computeLine(newLine)]);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const updateLine = (id: string, updates: Partial<EstimateItemLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...updates };
        return computeLine(next);
      })
    );
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleCreatePartOrLabour = async () => {
    const name = createName.trim();
    const price = parseFloat(createPrice);
    const taxPercent = parseFloat(createTaxPercent);
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
    setCreateSubmitting(true);
    try {
      const created = await serviceItemsApi.create({
        name,
        type: createType,
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
      addItem(item);
      setShowCreateModal(false);
      setCreateName('');
      setCreatePrice('');
      setCreateTaxPercent('18');
      setSearchResults((prev) => [item, ...prev]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create part/labour.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const subtotal = useMemo(
    () => round2(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)),
    [lines]
  );
  const totalTax = useMemo(
    () => round2(lines.reduce((sum, l) => sum + l.taxAmount, 0)),
    [lines]
  );
  const totalAmount = round2(subtotal + totalTax);
  const sgst = round2(totalTax / 2);
  const cgst = round2(totalTax / 2);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search parts or labour"
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
            />
          </View>
          {showDropdown && (
            <View style={styles.dropdown}>
              {searchResults.length === 0 ? (
                <TouchableOpacity
                  style={styles.dropdownEmptyRow}
                  onPress={() => { setShowDropdown(false); setShowCreateModal(true); }}
                >
                  <Text style={styles.dropdownEmpty}>No matches</Text>
                  <Text style={styles.addNewLink}>Add new part/labour</Text>
                </TouchableOpacity>
              ) : (
                searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.dropdownItem}
                    onPress={() => addItem(item)}
                  >
                    <Text style={styles.dropdownName}>{item.name}</Text>
                    <Text style={styles.dropdownMeta}>
                      {item.type === 'part' ? 'Part' : 'Labour'} · ₹{item.defaultUnitPrice}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
          <TouchableOpacity style={styles.addNewBtn} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.addNewBtnText}>Add new part or labour (catalogue)</Text>
          </TouchableOpacity>
          {gstEnabled && (
            <View style={styles.gstRow}>
              <Text style={styles.gstLabel}>Include GST</Text>
              <Switch
                value={includeGST}
                onValueChange={setIncludeGST}
                trackColor={{ false: '#e2e8f0', true: '#14b8a6' }}
                thumbColor="#fff"
              />
            </View>
          )}
        </View>

        <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New part or labour</Text>
              <Text style={styles.modalLabel}>Name</Text>
              <TextInput
                style={styles.modalInput}
                value={createName}
                onChangeText={setCreateName}
                placeholder="e.g. Brake Pad Set"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.modalLabel}>Type</Text>
              <View style={styles.modalTypeRow}>
                <TouchableOpacity
                  style={[styles.modalTypeChip, createType === 'part' && styles.modalTypeChipSelected]}
                  onPress={() => setCreateType('part')}
                >
                  <Text style={[styles.modalTypeChipText, createType === 'part' && styles.modalTypeChipTextSelected]}>Part</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalTypeChip, createType === 'labour' && styles.modalTypeChipSelected]}
                  onPress={() => setCreateType('labour')}
                >
                  <Text style={[styles.modalTypeChipText, createType === 'labour' && styles.modalTypeChipTextSelected]}>Labour</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>Default unit price (₹)</Text>
              <TextInput
                style={styles.modalInput}
                value={createPrice}
                onChangeText={setCreatePrice}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
              />
              <Text style={styles.modalLabel}>Default tax %</Text>
              <TextInput
                style={styles.modalInput}
                value={createTaxPercent}
                onChangeText={setCreateTaxPercent}
                placeholder="18"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCreateModal(false)} disabled={createSubmitting}>
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleCreatePartOrLabour} disabled={createSubmitting}>
                  {createSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSubmitBtnText}>Create & add</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {lines.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No items added</Text>
            <Text style={styles.emptyHint}>Search above to add parts or labour</Text>
          </View>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={styles.thItem}>Item</Text>
              <Text style={styles.thQty}>Qty</Text>
              <Text style={styles.thPrice}>Price (₹)</Text>
              {gstEnabled && <Text style={styles.thTax}>Tax %</Text>}
              <Text style={styles.thTotal}>Total (₹)</Text>
            </View>
            {lines.map((line) => (
              <View key={line.id} style={styles.lineCard}>
                <View style={styles.lineRow1}>
                  <Text style={styles.lineName} numberOfLines={1}>{line.description}</Text>
                  <TouchableOpacity onPress={() => removeLine(line.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <View style={styles.lineRow2}>
                  <View style={styles.lineField}>
                    <Text style={styles.lineLabel}>Qty</Text>
                    <TextInput
                      style={styles.lineInput}
                      value={String(line.quantity)}
                      onChangeText={(t) => {
                        const n = parseInt(t, 10);
                        if (!isNaN(n) && n >= 0) updateLine(line.id, { quantity: n });
                      }}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.lineField}>
                    <Text style={styles.lineLabel}>Unit price (₹)</Text>
                    <TextInput
                      style={styles.lineInput}
                      value={String(line.unitPrice)}
                      onChangeText={(t) => {
                        const n = parseFloat(t);
                        if (!isNaN(n) && n >= 0) updateLine(line.id, { unitPrice: n });
                      }}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                {gstEnabled && (
                  <View style={styles.lineRow3}>
                    <View style={styles.lineField}>
                      <Text style={styles.lineLabel}>Tax rate %</Text>
                      <View style={styles.taxChips}>
                        {taxRates.map((r) => (
                          <TouchableOpacity
                            key={r}
                            style={[styles.taxChip, line.taxRatePercent === r && styles.taxChipSelected]}
                            onPress={() => updateLine(line.id, { taxRatePercent: r })}
                          >
                            <Text style={[styles.taxChipText, line.taxRatePercent === r && styles.taxChipTextSelected]}>
                              {r}%
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}
                <View style={styles.lineTotals}>
                  {gstEnabled && <Text style={styles.lineTaxLabel}>Tax amount: ₹{line.taxAmount.toFixed(2)}</Text>}
                  <Text style={styles.lineTotal}>Line total: ₹{line.lineTotal.toLocaleString('en-IN')}</Text>
                </View>
              </View>
            ))}

            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Sub total</Text>
                <Text style={styles.summaryValue}>₹{subtotal.toLocaleString('en-IN')}</Text>
              </View>
              {gstEnabled && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Taxable amount</Text>
                    <Text style={styles.summaryValue}>₹{subtotal.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>SGST</Text>
                    <Text style={styles.summaryValue}>₹{sgst.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>CGST</Text>
                    <Text style={styles.summaryValue}>₹{cgst.toLocaleString('en-IN')}</Text>
                  </View>
                </>
              )}
              <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                <Text style={styles.summaryTotalLabel}>Total amount</Text>
                <Text style={styles.summaryTotalValue}>₹{totalAmount.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Paid amount</Text>
                <Text style={styles.summaryValue}>₹{(paidAmount || 0).toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  searchSection: {
    backgroundColor: '#14b8a6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginTop: 8,
    maxHeight: 200,
  },
  dropdownEmptyRow: { padding: 16, alignItems: 'center' },
  dropdownEmpty: { fontSize: 14, color: '#64748b' },
  addNewLink: { marginTop: 8, fontSize: 14, color: '#14b8a6', fontWeight: '600' },
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
  },
  addNewBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  dropdownMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  gstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  gstLabel: { fontSize: 15, fontWeight: '600', color: '#fff' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: { fontSize: 16, color: '#64748b', marginTop: 12 },
  emptyHint: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 8,
  },
  thItem: { flex: 1.5, fontSize: 12, fontWeight: '600', color: '#475569' },
  thQty: { width: 44, fontSize: 12, fontWeight: '600', color: '#475569' },
  thPrice: { width: 72, fontSize: 12, fontWeight: '600', color: '#475569' },
  thTax: { width: 48, fontSize: 12, fontWeight: '600', color: '#475569' },
  thTotal: { flex: 1, fontSize: 12, fontWeight: '600', color: '#475569', textAlign: 'right' },
  lineCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  lineRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  lineName: { fontSize: 15, fontWeight: '600', color: '#1e293b', flex: 1 },
  lineRow2: { flexDirection: 'row', gap: 12 },
  lineField: { flex: 1 },
  lineLabel: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  lineInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1e293b',
  },
  lineRow3: { marginTop: 10 },
  taxChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  taxChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  taxChipSelected: { backgroundColor: '#14b8a6' },
  taxChipText: { fontSize: 12, color: '#475569' },
  taxChipTextSelected: { color: '#fff' },
  lineTotals: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lineTaxLabel: { fontSize: 12, color: '#64748b' },
  lineTotal: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  summary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#64748b' },
  summaryValue: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  summaryTotalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  summaryTotalLabel: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  summaryTotalValue: { fontSize: 16, fontWeight: '700', color: '#3b82f6' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 6 },
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
  modalTypeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f1f5f9' },
  modalTypeChipSelected: { backgroundColor: '#14b8a6' },
  modalTypeChipText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  modalTypeChipTextSelected: { color: '#fff' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  modalCancelBtnText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  modalSubmitBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#14b8a6', alignItems: 'center', minWidth: 100 },
  modalSubmitBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
