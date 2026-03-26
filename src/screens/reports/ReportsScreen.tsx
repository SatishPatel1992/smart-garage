import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

/**
 * FR-080–FR-082: Reporting & Analytics
 * - Daily summary: jobs completed, in-progress, payments collected
 * - Revenue breakdown (parts vs labour)
 * - Mechanic performance
 */
export default function ReportsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Reports & Analytics</Text>
      <Text style={styles.subtitle}>
        FR-080–FR-082: Daily summary, revenue breakdown, mechanic performance. API pending.
      </Text>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Daily summary & revenue reports</Text>
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
