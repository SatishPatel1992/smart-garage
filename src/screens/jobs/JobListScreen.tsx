import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { JobsStackParamList } from '../../navigation/JobsStack';
import type { JobCard, JobStage } from '../../types/models';
import { jobs as jobsApi } from '../../api/client';

type JobListNav = NativeStackNavigationProp<JobsStackParamList, 'JobList'>;

type Props = { navigation: JobListNav };

function mapDtoToJobCard(d: import('../../api/client').JobCardDto): JobCard {
  return {
    id: d.id,
    jobNumber: d.jobNumber,
    customer: d.customer,
    vehicle: d.vehicle,
    complaints: d.complaints,
    odometerReading: d.odometerReading,
    photos: d.photos ?? [],
    stage: d.stage as JobCard['stage'],
    assignedMechanicId: d.assignedMechanicId,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

const STAGES: { key: JobStage; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'work_in_progress', label: 'In Progress' },
  { key: 'delivered', label: 'Delivered' },
];

function StageChip({
  stage,
  label,
  selected,
  onPress,
}: {
  stage: JobStage;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function getStageBg(stage: JobStage): string {
  if (stage === 'pending') return '#fef3c7';
  if (stage === 'work_in_progress') return '#dbeafe';
  return '#dcfce7';
}

function JobListItem({
  item,
  onPress,
}: {
  item: JobCard;
  onPress: () => void;
}) {
  const stageLabel =
    item.stage === 'work_in_progress'
      ? 'In Progress'
      : item.stage === 'delivered'
        ? 'Delivered'
        : 'Pending';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardRow}>
        <Text style={styles.jobNumber}>{item.jobNumber}</Text>
        <View style={[styles.badge, { backgroundColor: getStageBg(item.stage) }]}>
          <Text style={styles.badgeText}>{stageLabel}</Text>
        </View>
      </View>
      <Text style={styles.vehicle}>
        {item.vehicle.registrationNo} · {item.vehicle.make} {item.vehicle.model}
      </Text>
      <Text style={styles.customer}>{item.customer.name}</Text>
      <Text style={styles.complaints} numberOfLines={1}>{item.complaints}</Text>
    </TouchableOpacity>
  );
}

export default function JobListScreen({ navigation }: Props) {
  const [filterStage, setFilterStage] = useState<JobStage | 'all'>('all');
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(() => {
    setLoading(true);
    setError(null);
    jobsApi
      .list()
      .then((res) => setJobs(res.jobs.map(mapDtoToJobCard)))
      .catch(() => setError('Failed to load jobs'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [fetchJobs])
  );

  const filteredJobs =
    filterStage === 'all'
      ? jobs
      : jobs.filter((j) => j.stage === filterStage);

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.chip, filterStage === 'all' && styles.chipSelected]}
          onPress={() => setFilterStage('all')}
        >
          <Text style={[styles.chipText, filterStage === 'all' && styles.chipTextSelected]}>
            All
          </Text>
        </TouchableOpacity>
        {STAGES.map(({ key, label }) => (
          <StageChip
            key={key}
            stage={key}
            label={label}
            selected={filterStage === key}
            onPress={() => setFilterStage(key)}
          />
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.empty}>Loading jobs...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <JobListItem
            item={item}
            onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>No jobs in this stage.</Text>
        }
      />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateJobCard')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  chipSelected: {
    backgroundColor: '#3b82f6',
  },
  chipText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 88,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  jobNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  vehicle: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 2,
  },
  customer: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  complaints: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 24,
  },
  errorText: { fontSize: 15, color: '#dc2626', textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
