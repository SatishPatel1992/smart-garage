import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import {
  getJobsByCustomerId,
  getEstimatesByCustomerId,
  getInvoicesByCustomerId,
  getPaymentsByCustomerId,
  getRemindersByCustomerId,
} from '../../data/mockCrm';
import { customers as customersApi } from '../../api/client';
import type { CustomerWithVehicles } from '../../types/models';

function mapDtoToCustomer(d: {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  vehicles: Array<{ id: string; registrationNo: string; make: string; model: string; year?: number; vin?: string; type?: string; fuel?: string }>;
}): CustomerWithVehicles {
  return {
    id: d.id,
    name: d.name,
    phone: d.phone,
    email: d.email,
    address: d.address,
    gstin: d.gstin,
    vehicles: d.vehicles.map((v) => ({
      id: v.id,
      registrationNo: v.registrationNo,
      make: v.make,
      model: v.model,
      year: v.year,
      vin: v.vin,
      type: v.type,
      fuel: v.fuel,
    })),
  };
}

type ProfileRoute = RouteProp<MoreStackParamList, 'CustomerProfile'>;

function phoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.startsWith('91') && digits.length === 12) return digits;
  return digits;
}

function openWhatsApp(phone: string, text?: string) {
  const num = phoneForWhatsApp(phone);
  const url = text
    ? `whatsapp://send?phone=${num}&text=${encodeURIComponent(text)}`
    : `whatsapp://send?phone=${num}`;
  Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open WhatsApp.'));
}

function openSms(phone: string, body?: string) {
  const url = body ? `sms:${phone}?body=${encodeURIComponent(body)}` : `sms:${phone}`;
  Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open Messages.'));
}

function openTel(phone: string) {
  Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Error', 'Could not place call.'));
}

export default function CustomerProfileScreen() {
  const route = useRoute<ProfileRoute>();
  const navigation = useNavigation();
  const { customerId } = route.params;

  const [customer, setCustomer] = useState<CustomerWithVehicles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    customersApi.get(customerId)
      .then((d) => {
        if (!cancelled) setCustomer(mapDtoToCustomer(d));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load customer');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [customerId]);

  const jobs = customer ? getJobsByCustomerId(customer.id) : [];
  const estimates = customer ? getEstimatesByCustomerId(customer.id) : [];
  const invoices = customer ? getInvoicesByCustomerId(customer.id) : [];
  const payments = customer ? getPaymentsByCustomerId(customer.id) : [];
  const reminders = customer ? getRemindersByCustomerId(customer.id) : [];

  const sendEstimateLink = useCallback(() => {
    const lastEst = estimates[0];
    const msg = lastEst
      ? `Hi, here is your estimate: ${lastEst.estimateNumber}. View: https://garage.example.com/estimate/${lastEst.id}`
      : 'Hi, here is your estimate link. (Generate one from the job first.)';
    openWhatsApp(customer?.phone ?? '', msg);
  }, [customer?.phone, estimates]);

  const sendInvoiceLink = useCallback(() => {
    const lastInv = invoices[0];
    const msg = lastInv
      ? `Hi, here is your invoice: ${lastInv.invoiceNumber}. Pay: https://garage.example.com/invoice/${lastInv.id}`
      : 'Hi, here is your invoice link. (Generate one from the job first.)';
    openWhatsApp(customer?.phone ?? '', msg);
  }, [customer?.phone, invoices]);

  const sendReminder = useCallback(() => {
    const next = reminders[0];
    const msg = next
      ? `Reminder: ${next.title}${next.description ? ` – ${next.description}` : ''}. Due: ${new Date(next.dueDate).toLocaleDateString()}. Contact us to book.`
      : 'Reminder: your next service is due. Contact us to book an appointment.';
    openWhatsApp(customer?.phone ?? '', msg);
  }, [customer?.phone, reminders]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.muted}>Loading customer...</Text>
      </View>
    );
  }
  if (error || !customer) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Customer not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{customer.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{customer.name}</Text>
            <Text style={styles.phone}>{customer.phone}</Text>
            {customer.email ? <Text style={styles.email}>{customer.email}</Text> : null}
            {customer.address ? <Text style={styles.address}>{customer.address}</Text> : null}
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openTel(customer.phone)}>
            <Ionicons name="call" size={22} color="#0ea5e9" />
            <Text style={styles.actionLabel}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openWhatsApp(customer.phone)}>
            <Ionicons name="logo-whatsapp" size={22} color="#22c55e" />
            <Text style={styles.actionLabel}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openSms(customer.phone)}>
            <Ionicons name="chatbubble" size={22} color="#8b5cf6" />
            <Text style={styles.actionLabel}>SMS</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sendLinks}>
          <TouchableOpacity style={styles.linkBtn} onPress={sendEstimateLink}>
            <Ionicons name="document-text" size={18} color="#3b82f6" />
            <Text style={styles.linkBtnText}>Send estimate link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={sendInvoiceLink}>
            <Ionicons name="receipt" size={18} color="#3b82f6" />
            <Text style={styles.linkBtnText}>Send invoice link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={sendReminder}>
            <Ionicons name="notifications" size={18} color="#3b82f6" />
            <Text style={styles.linkBtnText}>Send reminder</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Vehicles</Text>
      {customer.vehicles.length === 0 ? (
        <Text style={styles.muted}>No vehicles added</Text>
      ) : (
        customer.vehicles.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={styles.row}
            onPress={() => navigation.navigate('VehicleHistory', { vehicleId: v.id })}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="car-sport" size={20} color="#3b82f6" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{v.registrationNo} – {v.make} {v.model}</Text>
                <Text style={styles.rowSub}>{[v.year, v.fuel].filter(Boolean).join(' · ') || '—'}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </TouchableOpacity>
        ))
      )}

      <Text style={styles.sectionTitle}>Reminders & follow-ups</Text>
      {reminders.length === 0 ? (
        <Text style={styles.muted}>No reminders</Text>
      ) : (
        reminders.map((r) => (
          <View key={r.id} style={styles.reminderRow}>
            <View style={styles.reminderIcon}>
              <Ionicons name={r.type === 'recall' ? 'warning' : r.type === 'warranty_expiry' ? 'shield-checkmark' : 'calendar'} size={18} color="#f59e0b" />
            </View>
            <View style={styles.reminderBody}>
              <Text style={styles.reminderTitle}>{r.title}</Text>
              {r.description ? <Text style={styles.reminderDesc}>{r.description}</Text> : null}
              <Text style={styles.reminderDate}>Due: {new Date(r.dueDate).toLocaleDateString()}</Text>
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Recent jobs</Text>
      {jobs.length === 0 ? (
        <Text style={styles.muted}>No jobs yet</Text>
      ) : (
        jobs.slice(0, 10).map((j) => (
          <TouchableOpacity key={j.id} style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="construct" size={20} color="#64748b" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{j.jobNumber}</Text>
                <Text style={styles.rowSub}>{j.vehicle.registrationNo} · {j.stage} · {j.odometerReading} km</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </TouchableOpacity>
        ))
      )}

      <Text style={styles.sectionTitle}>Estimates</Text>
      {estimates.length === 0 ? (
        <Text style={styles.muted}>No estimates</Text>
      ) : (
        estimates.map((e) => (
          <View key={e.id} style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="document-text" size={20} color="#64748b" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{e.estimateNumber}</Text>
                <Text style={styles.rowSub}>₹{e.totalAmount.toLocaleString()} · {e.status}</Text>
              </View>
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Invoices</Text>
      {invoices.length === 0 ? (
        <Text style={styles.muted}>No invoices</Text>
      ) : (
        invoices.map((i) => (
          <View key={i.id} style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="receipt" size={20} color="#64748b" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{i.invoiceNumber}</Text>
                <Text style={styles.rowSub}>₹{i.totalAmount.toLocaleString()} · Paid ₹{i.paidAmount.toLocaleString()}</Text>
              </View>
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Payments</Text>
      {payments.length === 0 ? (
        <Text style={styles.muted}>No payments</Text>
      ) : (
        payments.map((p) => (
          <View key={p.id} style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="card" size={20} color="#64748b" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>₹{p.amount.toLocaleString()}</Text>
                <Text style={styles.rowSub}>{p.method} · {p.status}</Text>
              </View>
            </View>
          </View>
        ))
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#64748b' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerRow: { flexDirection: 'row', marginBottom: 16 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerInfo: { flex: 1 },
  name: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  phone: { fontSize: 15, color: '#64748b', marginTop: 4 },
  email: { fontSize: 14, color: '#64748b', marginTop: 2 },
  address: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  actionBtn: { alignItems: 'center' },
  actionLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  sendLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
  linkBtnText: { fontSize: 14, color: '#3b82f6', fontWeight: '500' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 10 },
  muted: { fontSize: 14, color: '#94a3b8', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowText: { marginLeft: 10, flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  rowSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  reminderRow: { flexDirection: 'row', backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  reminderIcon: { marginRight: 10 },
  reminderBody: { flex: 1 },
  reminderTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  reminderDesc: { fontSize: 13, color: '#64748b', marginTop: 2 },
  reminderDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
});
