import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import { customers as customersApi } from '../../api/client';
import type { CustomerWithVehicles } from '../../types/models';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'Customers'>;

type Props = { navigation: Nav };

type FilterMode = 'all' | 'with_vehicles';

function mapDtoToModel(d: { id: string; name: string; phone: string; email?: string; address?: string; gstin?: string; vehicles: Array<{ id: string; registrationNo: string; make: string; model: string; year?: number; vin?: string; type?: string; fuel?: string }> }): CustomerWithVehicles {
  return {
    id: d.id,
    name: d.name,
    phone: d.phone,
    email: d.email,
    address: d.address,
    gstin: d.gstin,
    vehicles: d.vehicles.map((v) => ({
      id: v.id,
      registrationNo: v.registrationNo,
      make: v.make,
      model: v.model,
      year: v.year,
      vin: v.vin,
      type: v.type,
      fuel: v.fuel,
    })),
  };
}

export default function CustomersScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [list, setList] = useState<CustomerWithVehicles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    customersApi.list(query || undefined)
      .then((res) => {
        if (!cancelled) {
          const mapped = res.customers.map(mapDtoToModel);
          setList(mapped);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load customers');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [query]);

  const filteredList = useMemo(() => {
    if (filter === 'with_vehicles') return list.filter((c) => c.vehicles.length > 0);
    return list;
  }, [list, filter]);

  const renderItem = ({ item }: { item: CustomerWithVehicles }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('CustomerProfile', { customerId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.phone}>{item.phone}</Text>
        <Text style={styles.meta}>{item.vehicles.length} vehicle(s)</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone, vehicle..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'with_vehicles' && styles.filterBtnActive]}
          onPress={() => setFilter('with_vehicles')}
        >
          <Text style={[styles.filterText, filter === 'with_vehicles' && styles.filterTextActive]}>With vehicles</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.emptyText}>Loading customers...</Text>
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No customers found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  searchRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16, color: '#1e293b', paddingVertical: 0 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  filterBtnActive: { backgroundColor: '#3b82f6' },
  filterText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  phone: { fontSize: 14, color: '#64748b', marginTop: 2 },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#64748b' },
  errorText: { fontSize: 15, color: '#dc2626' },
});
