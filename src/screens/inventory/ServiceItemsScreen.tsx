import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import { serviceItems as serviceItemsApi } from '../../api/client';
import type { ServiceItemDto } from '../../api/client';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'ServiceItems'>;

type Props = { navigation: Nav };

export default function ServiceItemsScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'part' | 'labour' | ''>('');
  const [items, setItems] = useState<ServiceItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<'part' | 'labour'>('part');
  const [createPrice, setCreatePrice] = useState('');
  const [createTaxPercent, setCreateTaxPercent] = useState('18');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const fetchItems = useCallback(() => {
    setLoading(true);
    const type = typeFilter === 'part' || typeFilter === 'labour' ? typeFilter : undefined;
    serviceItemsApi.list(query, type)
      .then((res) => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [query, typeFilter]);

  useEffect(() => {
    const t = setTimeout(fetchItems, 300);
    return () => clearTimeout(t);
  }, [fetchItems]);

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [fetchItems])
  );

  const handleCreate = async () => {
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
      setItems((prev) => [created, ...prev]);
      setShowModal(false);
      setCreateName('');
      setCreatePrice('');
      setCreateTaxPercent('18');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: ServiceItemDto }) => (
    <View style={[styles.row, item.type === 'labour' ? styles.rowLabour : styles.rowPart]}>
      <View style={styles.rowIcon}>
        <Ionicons name={item.type === 'part' ? 'cube-outline' : 'construct-outline'} size={22} color="#fff" />
      </View>
      <View style={styles.main}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>
          {item.type === 'part' ? 'Part' : 'Labour'} · Tax {item.defaultTaxRatePercent}%
        </Text>
      </View>
      <Text style={styles.price}>₹{item.defaultUnitPrice.toLocaleString('en-IN')}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search parts or labour..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeChip, typeFilter === '' && styles.typeChipSelected]}
            onPress={() => setTypeFilter('')}
          >
            <Text style={[styles.typeChipText, typeFilter === '' && styles.typeChipTextSelected]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeChip, typeFilter === 'part' && styles.typeChipSelected]}
            onPress={() => setTypeFilter('part')}
          >
            <Text style={[styles.typeChipText, typeFilter === 'part' && styles.typeChipTextSelected]}>Part</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeChip, typeFilter === 'labour' && styles.typeChipSelected]}
            onPress={() => setTypeFilter('labour')}
          >
            <Text style={[styles.typeChipText, typeFilter === 'labour' && styles.typeChipTextSelected]}>Labour</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.addBtnText}>Add part / labour</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No parts or labour items. Add from job card or here.</Text>
            </View>
          }
        />
      )}

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New part or labour</Text>
              <TouchableOpacity
                style={styles.dismissKeyboardBtn}
                onPress={Keyboard.dismiss}
                activeOpacity={0.8}
              >
                <Ionicons name="keypad-outline" size={18} color="#64748b" />
                <Text style={styles.dismissKeyboardText}>Dismiss keyboard</Text>
              </TouchableOpacity>
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
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowModal(false)} disabled={createSubmitting}>
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleCreate} disabled={createSubmitting}>
                  {createSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSubmitBtnText}>Create</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  searchRow: { padding: 16, paddingBottom: 8 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 16, color: '#1e293b', paddingVertical: 0 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e2e8f0' },
  typeChipSelected: { backgroundColor: '#3b82f6' },
  typeChipText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  typeChipTextSelected: { color: '#fff' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  addBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#64748b' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  rowPart: { borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  rowLabour: { borderLeftWidth: 4, borderLeftColor: '#14b8a6' },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  main: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  meta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  price: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#64748b', textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalScroll: {
    width: '100%',
    maxWidth: 400,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  dismissKeyboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  dismissKeyboardText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
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
  modalTypeChipSelected: { backgroundColor: '#3b82f6' },
  modalTypeChipText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  modalTypeChipTextSelected: { color: '#fff' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  modalCancelBtnText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  modalSubmitBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#3b82f6', alignItems: 'center', minWidth: 100 },
  modalSubmitBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
