import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import type { MainTabParamList } from '../../navigation/MainTabs';
import { getAllEstimates, isEstimateExpired } from '../../data/mockEstimates';
import { getJobById } from '../../data/mockJobs';
import type { Estimate } from '../../types/models';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<MoreStackParamList, 'Estimates'>,
  BottomTabNavigationProp<MainTabParamList>
>;

type Props = { navigation: Nav };

export default function EstimatesScreen({ navigation }: Props) {
  const [list, setList] = React.useState<Estimate[]>([]);

  useFocusEffect(
    useCallback(() => {
      setList(getAllEstimates());
    }, [])
  );

  const openJob = (jobCardId: string) => {
    const tabNav = navigation.getParent();
    (tabNav as any)?.navigate('Jobs', { screen: 'JobDetail', params: { jobId: jobCardId } });
  };

  const renderItem = ({ item }: { item: Estimate }) => {
    const job = getJobById(item.jobCardId);
    const expired = isEstimateExpired(item);
    return (
      <TouchableOpacity
        style={[styles.row, expired && styles.rowExpired]}
        onPress={() => openJob(item.jobCardId)}
        activeOpacity={0.7}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="document-text" size={22} color="#3b82f6" />
        </View>
        <View style={styles.info}>
          <Text style={styles.estimateNumber}>{item.estimateNumber}</Text>
          <Text style={styles.meta}>
            {job?.jobNumber ?? item.jobCardId} · {job?.customer.name ?? '—'}
          </Text>
          <Text style={styles.amount}>₹{item.totalAmount.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, styles[`badge_${item.status}` as keyof typeof styles]]}>
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
          {expired && (
            <View style={styles.badgeExpired}>
              <Text style={styles.badgeExpiredText}>Expired</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>FR-041/042: Send link to client to view and approve/reject.</Text>
      </View>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No estimates yet</Text>
            <Text style={styles.emptyHint}>Create an estimate from a job card (Jobs → Job detail → Add items → Create estimate).</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { padding: 16, paddingBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748b' },
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
  rowExpired: { borderLeftWidth: 4, borderLeftColor: '#fecaca' },
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
  estimateNumber: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  meta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '600', color: '#1e293b', marginTop: 2 },
  badgeRow: { alignItems: 'flex-end', marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badge_draft: { backgroundColor: '#e2e8f0' },
  badge_sent: { backgroundColor: '#dbeafe' },
  badge_approved: { backgroundColor: '#dcfce7' },
  badge_rejected: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  badgeExpired: { backgroundColor: '#fef2f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  badgeExpiredText: { fontSize: 10, fontWeight: '600', color: '#dc2626' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#64748b', marginTop: 12 },
  emptyHint: { fontSize: 13, color: '#94a3b8', marginTop: 8, textAlign: 'center' },
});
