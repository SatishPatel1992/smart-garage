import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import { MOCK_PARTS } from '../../data/mockInventory';
import type { Part } from '../../types/models';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'PartsCatalogue'>;

type Props = { navigation: Nav };

export default function PartsCatalogueScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [refresh, setRefresh] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setRefresh((r) => r + 1);
    }, [])
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_PARTS;
    return MOCK_PARTS.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
    );
  }, [query, refresh]);

  const renderItem = ({ item }: { item: Part }) => {
    const isLow = item.quantity < item.minQuantity;
    return (
      <TouchableOpacity
        style={[styles.row, isLow && styles.rowLow]}
        onPress={() => navigation.navigate('PartForm', { partId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.main}>
          <Text style={styles.code}>{item.code}</Text>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.meta}>
            <Text style={styles.qty}>Qty: {item.quantity} {item.unit}</Text>
            <Text style={styles.reorder}>Min: {item.minQuantity}</Text>
          </View>
        </View>
        <View style={styles.prices}>
          <Text style={styles.selling}>₹{item.price.toLocaleString()}</Text>
          {item.costPrice != null && (
            <Text style={styles.cost}>Cost ₹{item.costPrice.toLocaleString()}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by SKU or name..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('PartForm', {})}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.addBtnText}>Add part</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No parts found</Text>
          </View>
        }
      />
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
  rowLow: { borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  main: { flex: 1 },
  code: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  name: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginTop: 2 },
  meta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  qty: { fontSize: 13, color: '#64748b' },
  reorder: { fontSize: 13, color: '#94a3b8' },
  prices: { alignItems: 'flex-end', marginRight: 8 },
  selling: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  cost: { fontSize: 12, color: '#64748b', marginTop: 2 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#64748b' },
});
