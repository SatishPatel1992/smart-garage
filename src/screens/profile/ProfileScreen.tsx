import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import { useAuth } from '../../context/AuthContext';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'Profile'>;
type Props = { navigation: Nav };

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  advisor: 'Advisor',
  mechanic: 'Mechanic',
  accounts: 'Accounts',
};

export default function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name || user?.email || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.name || '—'}</Text>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '—'}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={22} color="#fff" />
        <Text style={styles.logoutBtnText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  email: { fontSize: 15, color: '#64748b', marginBottom: 8 },
  roleBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  roleText: { fontSize: 14, fontWeight: '600', color: '#3b82f6' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 16,
  },
  logoutBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
