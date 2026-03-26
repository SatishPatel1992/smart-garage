import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import { MOCK_VENDORS, MOCK_PARTS } from '../../data/mockInventory';
import type { Vendor } from '../../types/models';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'Vendors'>;
type Props = { navigation: Nav };

function partsLinkedCount(vendorId: string): number {
  return MOCK_PARTS.filter((p) => p.vendorId === vendorId).length;
}

export default function VendorsScreen({ navigation }: Props) {
  const renderItem = ({ item }: { item: Vendor }) => {
    const count = partsLinkedCount(item.id);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('VendorDetail', { vendorId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="business" size={22} color="#3b82f6" />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          {item.contactPerson ? <Text style={styles.meta}>{item.contactPerson}</Text> : null}
          {item.phone ? <Text style={styles.meta}>{item.phone}</Text> : null}
          <Text style={styles.partsCount}>{count} parts linked</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_VENDORS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  listContent: { padding: 16, paddingBottom: 24 },
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
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  meta: { fontSize: 14, color: '#64748b', marginTop: 2 },
  partsCount: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
});
