import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../navigation/MoreStack';
import { useAuth } from '../context/AuthContext';

type MoreNav = NativeStackNavigationProp<MoreStackParamList, 'MoreMenu'>;

type Props = { navigation: MoreNav };

const MENU_ITEMS: { key: keyof MoreStackParamList; label: string; icon: string; fr: string; adminOnly?: boolean }[] = [
  { key: 'Profile', label: 'Profile', icon: 'person-outline', fr: 'Account and log out' },
  { key: 'Settings', label: 'Settings', icon: 'settings-outline', fr: 'Organization, tax, estimates, inventory' },
  { key: 'Customers', label: 'Customers & CRM', icon: 'people-outline', fr: 'Customer list, profile, reminders' },
  { key: 'Estimates', label: 'Estimates & Approval', icon: 'document-text-outline', fr: 'FR-040–043' },
  { key: 'Inventory', label: 'Inventory', icon: 'cube-outline', fr: 'FR-050–053' },
  { key: 'Payments', label: 'Payments', icon: 'card-outline', fr: 'FR-070–072' },
  { key: 'Reports', label: 'Reports & Analytics', icon: 'bar-chart-outline', fr: 'FR-080–082' },
  { key: 'Users', label: 'Users & roles', icon: 'person-add-outline', fr: 'Create user, admin / advisor / mechanic / accounts', adminOnly: true },
];

export default function MoreScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };
  const topPadding = Math.max(insets.top, 16) + 8;
  const visibleItems = MENU_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: topPadding }]}>
      <Text style={styles.subtitle}>Job cards, estimates, billing, payments & reports</Text>
      {visibleItems.map((item) => (
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
            <Text style={styles.menuFr}>{item.fr}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.logoutRow} onPress={handleLogout} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={24} color="#dc2626" />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
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
  menuFr: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#dc2626' },
});
