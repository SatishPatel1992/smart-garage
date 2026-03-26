import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import { getLowStockParts } from '../../data/mockInventory';
import type { Part } from '../../types/models';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'LowStockAlerts'>;

type Props = { navigation: Nav };

/**
 * FR-052/053: Low-stock alerts – list when below min.
 * Notifications (push) can be wired later to backend.
 */
export default function LowStockAlertsScreen({ navigation }: Props) {
  const list = getLowStockParts();

  const renderItem = ({ item }: { item: Part }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('PartForm', { partId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="warning" size={22} color="#b45309" />
      </View>
      <View style={styles.info}>
        <Text style={styles.code}>{item.code}</Text>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>
          Current: {item.quantity} {item.unit} · Reorder at: {item.minQuantity}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          Parts below reorder level. Tap to edit or add stock via Stock in/out.
        </Text>
        <Text style={styles.bannerNote}>FR-052/053: Push notifications can be enabled when backend is ready.</Text>
      </View>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
            <Text style={styles.emptyText}>All parts above reorder level</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  banner: { backgroundColor: '#fffbeb', padding: 14, margin: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  bannerText: { fontSize: 14, color: '#92400e', fontWeight: '500' },
  bannerNote: { fontSize: 12, color: '#a16207', marginTop: 6 },
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
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  info: { flex: 1 },
  code: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  name: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginTop: 2 },
  meta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#22c55e', marginTop: 12, fontWeight: '500' },
});
