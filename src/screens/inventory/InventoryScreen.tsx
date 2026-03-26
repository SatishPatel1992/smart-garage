import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import { getLowStockParts } from '../../data/mockInventory';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'Inventory'>;

type Props = { navigation: Nav };

const MENU_ITEMS: { key: keyof MoreStackParamList; label: string; icon: string; desc: string }[] = [
  { key: 'ServiceItems', label: 'Parts & labour (estimates)', icon: 'pricetags', desc: 'Catalogue of parts and labour for job estimates; search and add from job card' },
  { key: 'PartsCatalogue', label: 'Parts catalogue', icon: 'list', desc: 'Add/edit parts, SKU, cost, selling price, reorder level' },
  { key: 'StockInOut', label: 'Stock in/out', icon: 'swap-horizontal', desc: 'Purchase entries, issue to job, returns' },
  { key: 'LowStockAlerts', label: 'Low-stock alerts', icon: 'warning', desc: 'FR-052/053: List and notifications when below min' },
  { key: 'Vendors', label: 'Vendors & suppliers', icon: 'business', desc: 'Link parts to suppliers, reorder from vendor' },
  { key: 'InventoryReports', label: 'Inventory reports', icon: 'bar-chart', desc: 'Stock value, movement, fast/slow-moving' },
];

export default function InventoryScreen({ navigation }: Props) {
  const lowCount = getLowStockParts().length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {lowCount > 0 && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => navigation.navigate('LowStockAlerts')}
        >
          <Ionicons name="warning" size={24} color="#b45309" />
          <Text style={styles.alertText}>{lowCount} part(s) below reorder level</Text>
          <Ionicons name="chevron-forward" size={20} color="#b45309" />
        </TouchableOpacity>
      )}
      {MENU_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={styles.menuCard}
          onPress={() => navigation.navigate(item.key)}
          activeOpacity={0.7}
        >
          <View style={styles.menuIcon}>
            <Ionicons name={item.icon as any} size={24} color="#3b82f6" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuDesc}>{item.desc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 32 },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    gap: 10,
  },
  alertText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#92400e' },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  menuDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
