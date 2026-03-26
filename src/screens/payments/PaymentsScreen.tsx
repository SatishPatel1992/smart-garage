import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

/**
 * FR-070–FR-072: Payments
 * - Razorpay payment links, sync with invoice
 * - UPI, Cash, Card, Bank transfer
 */
export default function PaymentsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Payments</Text>
      <Text style={styles.subtitle}>
        FR-070–FR-072: Payment links (Razorpay), UPI/Cash/Card/Transfer. API pending.
      </Text>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Payment methods & status</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4, marginBottom: 16 },
  placeholder: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  placeholderText: { color: '#64748b' },
});
