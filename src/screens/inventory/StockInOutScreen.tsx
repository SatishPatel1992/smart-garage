import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import {
  MOCK_STOCK_MOVEMENTS,
  MOCK_PARTS,
  MOCK_VENDORS,
  addStockMovement,
  getPartById,
  getVendorById,
} from '../../data/mockInventory';
import { MOCK_JOBS } from '../../data/mockJobs';
import type { StockMovementType } from '../../types/models';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'StockInOut'>;

type Props = { navigation: Nav };

type TabType = 'list' | 'purchase' | 'issue' | 'return';

export default function StockInOutScreen({ navigation }: Props) {
  const [tab, setTab] = useState<TabType>('list');
  const [partId, setPartId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const part = partId ? getPartById(partId) : null;
  const vendor = referenceId && tab === 'purchase' ? getVendorById(referenceId) : null;
  const job = referenceId && tab === 'issue' ? MOCK_JOBS.find((j) => j.id === referenceId) : null;

  const submit = useCallback(() => {
    const qty = parseInt(quantity, 10) || 0;
    if (!partId || qty <= 0) {
      Alert.alert('Error', 'Select a part and enter quantity.');
      return;
    }
    let type: StockMovementType;
    let refId: string | undefined;
    let refLabel: string | undefined;
    let moveQty = qty;
    if (tab === 'purchase') {
      type = 'purchase';
      refId = referenceId || undefined;
      refLabel = vendor?.name;
    } else if (tab === 'issue') {
      type = 'issue_to_job';
      refId = referenceId || undefined;
      refLabel = job?.jobNumber;
      moveQty = -qty;
    } else {
      type = 'return';
      refId = referenceId || undefined;
      refLabel = referenceId ? 'Return' : undefined;
    }
    addStockMovement({
      id: 'm' + Date.now(),
      partId,
      type,
      quantity: moveQty,
      referenceId: refId,
      referenceLabel: refLabel,
      unitCost: tab === 'purchase' && unitCost ? parseFloat(unitCost) : undefined,
      createdAt: new Date().toISOString(),
    });
    setQuantity('');
    setUnitCost('');
    setTab('list');
  }, [tab, partId, quantity, referenceId, unitCost, vendor, job]);

  const recent = [...MOCK_STOCK_MOVEMENTS].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 30);

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(['list', 'purchase', 'issue', 'return'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'list' ? 'History' : t === 'purchase' ? 'Purchase' : t === 'issue' ? 'Issue' : 'Return'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'list' ? (
        <ScrollView style={styles.body} contentContainerStyle={styles.listContent}>
          {recent.map((m) => {
            const p = getPartById(m.partId);
            return (
              <View key={m.id} style={styles.movementRow}>
                <View style={styles.movementLeft}>
                  <Text style={styles.movementPart}>{p?.name ?? m.partId}</Text>
                  <Text style={styles.movementMeta}>
                    {m.type.replace(/_/g, ' ')} · {m.quantity > 0 ? '+' : ''}{m.quantity} · {new Date(m.createdAt).toLocaleDateString()}
                  </Text>
                  {m.referenceLabel ? <Text style={styles.movementRef}>{m.referenceLabel}</Text> : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.formContent}>
          <Text style={styles.label}>Part</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.partChips}>
            {MOCK_PARTS.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, partId === p.id && styles.chipActive]}
                onPress={() => setPartId(p.id)}
              >
                <Text style={[styles.chipText, partId === p.id && styles.chipTextActive]} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>Quantity</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#94a3b8"
          />
          {tab === 'purchase' && (
            <>
              <Text style={styles.label}>Vendor</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.partChips}>
                {MOCK_VENDORS.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.chip, referenceId === v.id && styles.chipActive]}
                    onPress={() => setReferenceId(v.id)}
                  >
                    <Text style={[styles.chipText, referenceId === v.id && styles.chipTextActive]} numberOfLines={1}>{v.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.label}>Unit cost (₹) optional</Text>
              <TextInput
                style={styles.input}
                value={unitCost}
                onChangeText={setUnitCost}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </>
          )}
          {tab === 'issue' && (
            <>
              <Text style={styles.label}>Job</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.partChips}>
                {MOCK_JOBS.map((j) => (
                  <TouchableOpacity
                    key={j.id}
                    style={[styles.chip, referenceId === j.id && styles.chipActive]}
                    onPress={() => setReferenceId(j.id)}
                  >
                    <Text style={[styles.chipText, referenceId === j.id && styles.chipTextActive]}>{j.jobNumber}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
          <TouchableOpacity style={styles.submitBtn} onPress={submit}>
            <Text style={styles.submitBtnText}>
              {tab === 'purchase' ? 'Record purchase' : tab === 'issue' ? 'Issue to job' : 'Record return'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  tabs: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  body: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 24 },
  movementRow: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  movementLeft: {},
  movementPart: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  movementMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  movementRef: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  formContent: { padding: 16, paddingBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#1e293b', marginBottom: 16 },
  partChips: { marginBottom: 16, maxHeight: 44 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e2e8f0', marginRight: 8 },
  chipActive: { backgroundColor: '#3b82f6' },
  chipText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
