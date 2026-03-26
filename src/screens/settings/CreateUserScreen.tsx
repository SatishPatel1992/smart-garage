import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import { users as usersApi } from '../../api/client';
import type { UserRole } from '../../api/client';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'CreateUser'>;
type Props = { navigation: Nav };

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin – full access' },
  { value: 'advisor', label: 'Advisor – customers, estimates, jobs' },
  { value: 'mechanic', label: 'Mechanic – jobs' },
  { value: 'accounts', label: 'Accounts – billing, invoices' },
];

export default function CreateUserScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('advisor');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleCreate = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('Validation', 'Enter a valid email.');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Validation', 'Password must be at least 6 characters.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Validation', 'Enter name.');
      return;
    }
    setSaving(true);
    try {
      await usersApi.create({ email: trimmedEmail, password, name: name.trim(), role });
      Alert.alert('User created', `${trimmedEmail} can now sign in.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.label}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#94a3b8" autoCapitalize="words" />
          <Text style={styles.label}>Email *</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="user@garage.com" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.label}>Password * (min 6)</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor="#94a3b8" secureTextEntry={!showPassword} />
          <TouchableOpacity onPress={() => setShowPassword((p) => !p)}><Text style={styles.link}>{showPassword ? 'Hide' : 'Show'} password</Text></TouchableOpacity>
          <Text style={styles.label}>Role *</Text>
          {ROLES.map((r) => (
            <TouchableOpacity key={r.value} style={[styles.roleRow, role === r.value && styles.roleRowSelected]} onPress={() => setRole(r.value)}>
              <Text style={[styles.roleLabel, role === r.value && styles.roleLabelSelected]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleCreate} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create user</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scroll: { padding: 16, paddingBottom: 32 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#1e293b', marginBottom: 12 },
  link: { fontSize: 13, color: '#3b82f6', marginBottom: 12 },
  roleRow: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#f8fafc', marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  roleRowSelected: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  roleLabel: { fontSize: 14, color: '#475569' },
  roleLabelSelected: { color: '#1e293b', fontWeight: '600' },
  saveBtn: { backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
