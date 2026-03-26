import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/MainTabs';
import type { JobsStackParamList } from '../navigation/JobsStack';
import { dashboard as dashboardApi } from '../api/client';
import type { DashboardDto } from '../api/client';

type DashboardNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
  { navigate: (name: 'Jobs', params: { screen: keyof JobsStackParamList; params?: { jobId: string } }) => void }
>;

type Props = { navigation: DashboardNav };

const STAT_CONFIG = [
  { label: 'Today Jobs', key: 'todayJobs' as const, icon: 'briefcase-outline' as const, color: '#3b82f6', bg: '#eff6ff' },
  { label: 'In Progress', key: 'inProgress' as const, icon: 'sync-outline' as const, color: '#f59e0b', bg: '#fffbeb' },
  { label: 'Awaiting Approval', key: 'awaitingApproval' as const, icon: 'time-outline' as const, color: '#ef4444', bg: '#fef2f2' },
  { label: 'Ready for Delivery', key: 'readyForDelivery' as const, icon: 'checkmark-done-outline' as const, color: '#22c55e', bg: '#f0fdf4' },
];

const QUICK_ACTIONS = [
  {
    label: 'Create Job',
    desc: 'New vehicle service',
    icon: 'add-circle' as const,
    color: '#0d9488',
    onPress: (nav: DashboardNav) => nav.navigate('Jobs', { screen: 'CreateJobCard' }),
  },
  {
    label: 'View Jobs',
    desc: 'Track all work',
    icon: 'list-circle' as const,
    color: '#6366f1',
    onPress: (nav: DashboardNav) => nav.navigate('Jobs', { screen: 'JobList' }),
  },
];

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}

export default function DashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, 16);
  const [data, setData] = useState<DashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.get();
      setData(res);
    } catch {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard])
  );

  const onRefresh = useCallback(() => {
    fetchDashboard(true);
  }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchDashboard()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stats = data?.stats ?? { todayJobs: 0, inProgress: 0, awaitingApproval: 0, readyForDelivery: 0 };
  const recentActivity = data?.recentActivity ?? [];
  const attention = data?.attention ?? { awaitingApprovalCount: 0, deliveredNotBilledCount: 0 };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPadding + 8 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Welcome to GarageFlow</Text>
      </View>

      {/* Stats – 2x2 grid with icons */}
      <View style={styles.statsGrid}>
        {STAT_CONFIG.map((s) => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
            <View style={[styles.statIconWrap, { backgroundColor: s.color }]}>
              <Ionicons name={s.icon} size={20} color="#fff" />
            </View>
            <Text style={styles.statValue}>{stats[s.key]}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={[styles.quickCard, { borderLeftColor: a.color }]}
              onPress={() => a.onPress(navigation)}
              activeOpacity={0.8}
            >
              <Ionicons name={a.icon} size={28} color={a.color} />
              <Text style={styles.quickLabel}>{a.label}</Text>
              <Text style={styles.quickDesc}>{a.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent activity from API */}
      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent activity</Text>
        <View style={styles.recentCard}>
          {recentActivity.length === 0 ? (
            <View style={styles.recentEmpty}>
              <Text style={styles.recentEmptyText}>No recent activity</Text>
            </View>
          ) : (
            recentActivity.map((r) => (
              <TouchableOpacity
                key={`${r.type}-${r.id}`}
                style={styles.recentRow}
                onPress={() => r.jobCardId && (navigation as any).navigate('Jobs', { screen: 'JobDetail', params: { jobId: r.jobCardId } })}
                activeOpacity={r.jobCardId ? 0.7 : 1}
                disabled={!r.jobCardId}
              >
                <View style={[styles.recentIconWrap, { backgroundColor: `${r.iconColor}18` }]}>
                  <Ionicons name={r.icon as any} size={18} color={r.iconColor} />
                </View>
                <View style={styles.recentText}>
                  <Text style={styles.recentTitle}>{r.title}</Text>
                  <Text style={styles.recentDetail}>{r.detail}</Text>
                </View>
                <Text style={styles.recentTime}>{formatTimeAgo(r.createdAt)}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* Attention from API */}
      {(attention.awaitingApprovalCount > 0 || attention.deliveredNotBilledCount > 0) && (
        <View style={styles.attentionCard}>
          <View style={styles.attentionHeader}>
            <Ionicons name="warning" size={18} color="#ea580c" />
            <Text style={styles.attentionTitle}>Attention needed</Text>
          </View>
          {attention.awaitingApprovalCount > 0 && (
            <Text style={styles.attentionItem}>• {attention.awaitingApprovalCount} job(s) waiting for customer approval</Text>
          )}
          {attention.deliveredNotBilledCount > 0 && (
            <Text style={styles.attentionItem}>• {attention.deliveredNotBilledCount} vehicle(s) ready but not billed</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    fontWeight: '500',
  },
  quickSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  quickLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 10,
  },
  quickDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  recentSection: {
    marginBottom: 24,
  },
  recentCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  recentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recentText: {
    flex: 1,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  recentDetail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  recentTime: {
    fontSize: 11,
    color: '#94a3b8',
  },
  attentionCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#ea580c',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  attentionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  attentionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginLeft: 8,
  },
  attentionItem: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 12,
  },
  errorText: {
    fontSize: 15,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  recentEmpty: {
    padding: 24,
    alignItems: 'center',
  },
  recentEmptyText: {
    fontSize: 14,
    color: '#94a3b8',
  },
});
