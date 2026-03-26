import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import { users as usersApi } from '../../api/client';
import type { UserDto } from '../../api/client';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'Users'>;

type Props = { navigation: Nav };

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  advisor: 'Advisor',
  mechanic: 'Mechanic',
  accounts: 'Accounts',
};

export default function UsersScreen({ navigation }: Props) {
  const [list, setList] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await usersApi.list();
      setList(res.users);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading && list.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading users…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No users yet. Add one with the button below.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(item.name || item.email).charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name || item.email}</Text>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={styles.role}>{ROLE_LABELS[item.role ?? ''] ?? item.role ?? '—'}</Text>
            </View>
            {!item.isActive && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>Inactive</Text>
              </View>
            )}
          </View>
        )}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateUser')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
        <Text style={styles.fabText}>Add user</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#64748b' },
  errorBar: { backgroundColor: '#fef2f2', padding: 12 },
  errorText: { fontSize: 14, color: '#dc2626', textAlign: 'center' },
  list: { padding: 16, paddingBottom: 100 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#64748b', textAlign: 'center' },
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
  email: { fontSize: 14, color: '#64748b', marginTop: 2 },
  role: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  inactiveBadge: { backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  inactiveBadgeText: { fontSize: 12, color: '#dc2626', fontWeight: '500' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fabText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
