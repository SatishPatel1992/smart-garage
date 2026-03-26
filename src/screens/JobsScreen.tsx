import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function JobsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Jobs</Text>
      <Text style={styles.subtitle}>Track all ongoing work. API integration coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 8,
  },
});
