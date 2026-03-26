import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getStockValue,
  getMovementSummary,
  getFastSlowMoving,
  MOCK_PARTS,
} from '../../data/mockInventory';

export default function InventoryReportsScreen() {
  const totalValue = getStockValue();
  const summary = getMovementSummary();
  const fastSlow = getFastSlowMoving(30);
  const fastMoving = fastSlow.slice(0, 5);
  const slowMoving = fastSlow.filter((f) => f.quantityMoved === 0).slice(0, 5);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Ionicons name="wallet" size={28} color="#3b82f6" />
          <View style={styles.cardBody}>
            <Text style={styles.cardLabel}>Total stock value (at cost)</Text>
            <Text style={styles.cardValue}>₹{totalValue.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Movement summary (all time)</Text>
      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{summary.in}</Text>
          <Text style={styles.summaryLabel}>Purchased (in)</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{summary.out}</Text>
          <Text style={styles.summaryLabel}>Issued (out)</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{summary.returns}</Text>
          <Text style={styles.summaryLabel}>Returns</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Fast-moving (last 30 days)</Text>
      <View style={styles.listCard}>
        {fastMoving.map((f) => (
          <View key={f.partId} style={styles.reportRow}>
            <Text style={styles.reportName}>{f.partName}</Text>
            <Text style={styles.reportMeta}>{f.code} · Qty moved: {f.quantityMoved}</Text>
          </View>
        ))}
        {fastMoving.length === 0 && <Text style={styles.muted}>No issues in last 30 days</Text>}
      </View>

      <Text style={styles.sectionTitle}>Slow-moving (no issue in 30 days)</Text>
      <View style={styles.listCard}>
        {slowMoving.map((f) => (
          <View key={f.partId} style={styles.reportRow}>
            <Text style={styles.reportName}>{f.partName}</Text>
            <Text style={styles.reportMeta}>{f.code}</Text>
          </View>
        ))}
        {slowMoving.length === 0 && <Text style={styles.muted}>All parts had some movement</Text>}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardBody: { marginLeft: 14 },
  cardLabel: { fontSize: 14, color: '#64748b' },
  cardValue: { fontSize: 22, fontWeight: '700', color: '#1e293b', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryBox: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 14, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  summaryLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  listCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16 },
  reportRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  reportName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  reportMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  muted: { fontSize: 14, color: '#94a3b8', paddingVertical: 8 },
});
