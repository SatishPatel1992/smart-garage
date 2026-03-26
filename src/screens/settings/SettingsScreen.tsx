import React, { useState, useEffect } from 'react';
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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';

const ROLES_ADMIN = ['admin'];

export default function SettingsScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role != null && ROLES_ADMIN.includes(user.role);
  const {
    organization,
    loading,
    error,
    refresh,
    updateSettings,
    getTaxRates,
    getDefaultGstRatePercent,
    getEstimateValidityDays,
    getLowStockThreshold,
    getInvoiceDefaultFormat,
  } = useSettings();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [taxRatesStr, setTaxRatesStr] = useState('');
  const [defaultGstRate, setDefaultGstRate] = useState('');
  const [estimateValidityDays, setEstimateValidityDays] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [invoiceFormat, setInvoiceFormat] = useState<'proforma' | 'tax'>('tax');
  const [logoUrl, setLogoUrl] = useState('');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (organization) {
      setName(organization.name);
      setAddress(organization.address ?? '');
      setPhone(organization.phone ?? '');
      setGstin(organization.gstin ?? '');
      setTaxRatesStr(getTaxRates().join(', '));
      setDefaultGstRate(String(getDefaultGstRatePercent()));
      setEstimateValidityDays(String(getEstimateValidityDays()));
      setLowStockThreshold(String(getLowStockThreshold()));
      setInvoiceFormat(getInvoiceDefaultFormat());
      setLogoUrl(organization.settings?.logoUrl ?? '');
      setGstEnabled(organization.settings?.gstEnabled ?? false);
    }
  }, [organization, getTaxRates, getDefaultGstRatePercent, getEstimateValidityDays, getLowStockThreshold, getInvoiceDefaultFormat]);

  const handleSave = async () => {
    if (!isAdmin) {
      Alert.alert('Permission', 'Only administrators can change settings.');
      return;
    }
    const taxRates = taxRatesStr
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 0 && n <= 100);
    const gstNum = parseInt(defaultGstRate, 10);
    const validityNum = parseInt(estimateValidityDays, 10);
    const thresholdNum = parseInt(lowStockThreshold, 10);
    if (taxRates.length === 0) {
      Alert.alert('Validation', 'Enter at least one tax rate (e.g. 0, 5, 12, 18).');
      return;
    }
    if (isNaN(gstNum) || gstNum < 0 || gstNum > 100) {
      Alert.alert('Validation', 'Default GST % must be 0–100.');
      return;
    }
    if (isNaN(validityNum) || validityNum < 1 || validityNum > 365) {
      Alert.alert('Validation', 'Estimate validity days must be 1–365.');
      return;
    }
    if (isNaN(thresholdNum) || thresholdNum < 0) {
      Alert.alert('Validation', 'Low-stock threshold must be 0 or more.');
      return;
    }
    if (gstEnabled && !gstin.trim()) {
      Alert.alert('Validation', 'GST No (GSTIN) is required when GST is enabled.');
      return;
    }
    setSaving(true);
    try {
      await updateSettings({
        name: name.trim() || undefined,
        address: address.trim() || null,
        phone: phone.trim() || null,
        gstin: gstin.trim() || null,
        settings: {
          defaultTaxRates: taxRates,
          defaultGstRatePercent: gstNum,
          estimateValidityDays: validityNum,
          lowStockThreshold: thresholdNum,
          invoiceDefaultFormat: invoiceFormat,
          logoUrl: logoUrl.trim() || null,
          gstEnabled: gstEnabled,
        },
      });
      Alert.alert('Saved', 'Settings updated.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !organization) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading settings…</Text>
      </View>
    );
  }
  if (error && !organization) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organization</Text>
          <Text style={styles.label}>Business name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Garage name"
            placeholderTextColor="#94a3b8"
            editable={isAdmin}
          />
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={address}
            onChangeText={setAddress}
            placeholder="Address"
            placeholderTextColor="#94a3b8"
            multiline
            editable={isAdmin}
          />
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone"
            placeholderTextColor="#94a3b8"
            keyboardType="phone-pad"
            editable={isAdmin}
          />
          <Text style={styles.label}>Logo URL (for invoice / letterhead)</Text>
          <TextInput
            style={styles.input}
            value={logoUrl}
            onChangeText={setLogoUrl}
            placeholder="https://..."
            placeholderTextColor="#94a3b8"
            keyboardType="url"
            autoCapitalize="none"
            editable={isAdmin}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GST / Tax</Text>
          <View style={styles.switchRow}>
            <Text style={styles.label}>GST enabled</Text>
            <Switch
              value={gstEnabled}
              onValueChange={setGstEnabled}
              disabled={!isAdmin}
              trackColor={{ false: '#e2e8f0', true: '#22c55e' }}
              thumbColor="#fff"
            />
          </View>
          <Text style={styles.label}>{gstEnabled ? 'GSTIN (required)' : 'GSTIN (optional when GST disabled)'}</Text>
          <TextInput
            style={styles.input}
            value={gstin}
            onChangeText={setGstin}
            placeholder={gstEnabled ? 'e.g. 24AAAAA0000A1Z5' : 'Optional'}
            placeholderTextColor="#94a3b8"
            editable={isAdmin}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tax & invoicing</Text>
          <Text style={styles.label}>Tax rates (%) – comma separated (used when GST enabled)</Text>
          <TextInput
            style={styles.input}
            value={taxRatesStr}
            onChangeText={setTaxRatesStr}
            placeholder="e.g. 0, 5, 12, 18, 28"
            placeholderTextColor="#94a3b8"
            keyboardType="numbers-and-punctuation"
            editable={isAdmin}
          />
          <Text style={styles.label}>Default GST % (for new estimate lines)</Text>
          <TextInput
            style={styles.input}
            value={defaultGstRate}
            onChangeText={setDefaultGstRate}
            placeholder="18"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            editable={isAdmin}
          />
          <Text style={styles.label}>Default invoice format</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.chip, invoiceFormat === 'proforma' && styles.chipSelected]}
              onPress={() => isAdmin && setInvoiceFormat('proforma')}
              disabled={!isAdmin}
            >
              <Text style={[styles.chipText, invoiceFormat === 'proforma' && styles.chipTextSelected]}>Proforma</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, invoiceFormat === 'tax' && styles.chipSelected]}
              onPress={() => isAdmin && setInvoiceFormat('tax')}
              disabled={!isAdmin}
            >
              <Text style={[styles.chipText, invoiceFormat === 'tax' && styles.chipTextSelected]}>Tax (GST)</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estimates</Text>
          <Text style={styles.label}>Estimate validity (days)</Text>
          <TextInput
            style={styles.input}
            value={estimateValidityDays}
            onChangeText={setEstimateValidityDays}
            placeholder="14"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            editable={isAdmin}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory</Text>
          <Text style={styles.label}>Low-stock alert threshold</Text>
          <TextInput
            style={styles.input}
            value={lowStockThreshold}
            onChangeText={setLowStockThreshold}
            placeholder="5"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            editable={isAdmin}
          />
        </View>

        {!isAdmin && (
          <View style={styles.section}>
            <Text style={styles.hint}>Only administrators can edit and save settings.</Text>
          </View>
        )}

        {isAdmin && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Save settings</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scroll: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#64748b' },
  errorText: { fontSize: 15, color: '#dc2626', textAlign: 'center' },
  retryBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#3b82f6', borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', color: '#475569', marginBottom: 6 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 12,
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  chipSelected: { backgroundColor: '#3b82f6' },
  chipText: { fontSize: 14, color: '#475569' },
  chipTextSelected: { color: '#fff' },
  hint: { fontSize: 13, color: '#64748b' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
