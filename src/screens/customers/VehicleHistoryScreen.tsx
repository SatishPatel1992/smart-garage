import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import { getJobsByVehicleId, getVehicleById } from '../../data/mockCrm';

type Route = RouteProp<MoreStackParamList, 'VehicleHistory'>;

export default function VehicleHistoryScreen() {
  const route = useRoute<Route>();
  const { vehicleId } = route.params;

  const pair = getVehicleById(vehicleId);
  const jobs = getJobsByVehicleId(vehicleId);

  if (!pair) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Vehicle not found</Text>
      </View>
    );
  }

  const { vehicle, customer } = pair;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.vehicleCard}>
        <Ionicons name="car-sport" size={32} color="#3b82f6" />
        <View style={styles.vehicleInfo}>
          <Text style={styles.regNo}>{vehicle.registrationNo}</Text>
          <Text style={styles.makeModel}>{vehicle.make} {vehicle.model}</Text>
          <Text style={styles.meta}>{vehicle.year} · {vehicle.fuel} · {vehicle.type}</Text>
          <Text style={styles.customer}>Customer: {customer.name}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Service history</Text>
      {jobs.length === 0 ? (
        <Text style={styles.empty}>No jobs recorded for this vehicle.</Text>
      ) : (
        jobs.map((item) => (
          <View key={item.id} style={styles.jobCard}>
            <View style={styles.jobHeader}>
              <Text style={styles.jobNumber}>{item.jobNumber}</Text>
              <View style={[styles.stageBadge, { backgroundColor: item.stage === 'delivered' ? '#dcfce7' : item.stage === 'work_in_progress' ? '#fef3c7' : '#f1f5f9' }]}>
                <Text style={styles.stageText}>{item.stage.replace(/_/g, ' ')}</Text>
              </View>
            </View>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            <Text style={styles.odometer}>Mileage: {item.odometerReading.toLocaleString()} km</Text>
            {item.complaints ? (
              <Text style={styles.complaints}>{item.complaints}</Text>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { paddingBottom: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#64748b' },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  vehicleInfo: { marginLeft: 14, flex: 1 },
  regNo: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  makeModel: { fontSize: 16, color: '#64748b', marginTop: 2 },
  meta: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
  customer: { fontSize: 13, color: '#64748b', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginHorizontal: 16, marginBottom: 10 },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobNumber: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  stageBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  stageText: { fontSize: 12, fontWeight: '500', color: '#475569' },
  date: { fontSize: 14, color: '#64748b', marginTop: 6 },
  odometer: { fontSize: 14, color: '#64748b', marginTop: 2 },
  complaints: { fontSize: 14, color: '#475569', marginTop: 8, fontStyle: 'italic' },
  empty: { fontSize: 14, color: '#94a3b8', marginHorizontal: 16, marginBottom: 16 },
});
