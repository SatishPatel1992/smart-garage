import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { JobsStackParamList } from '../../navigation/JobsStack';
import type { CustomerWithVehicles, Vehicle } from '../../types/models';
import { customers as customersApi, jobs as jobsApi } from '../../api/client';
import { MOCK_MECHANICS } from '../../data/mockJobs';
import AddCustomerModal from '../../components/AddCustomerModal';

type CreateJobNav = NativeStackNavigationProp<JobsStackParamList, 'CreateJobCard'>;

type Props = { navigation: CreateJobNav };

function mapDtoToCustomer(d: import('../../api/client').CustomerWithVehiclesDto): CustomerWithVehicles {
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

export default function CreateJobCardScreen({ navigation }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerWithVehicles[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithVehicles | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [odometer, setOdometer] = useState('');
  const [assignedMechanicId, setAssignedMechanicId] = useState<string | null>(null);
  const [complaints, setComplaints] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSearchLoading(true);
    customersApi.list(searchQuery || undefined)
      .then((res) => {
        if (!cancelled) setSearchResults(res.customers.map(mapDtoToCustomer));
      })
      .catch(() => {
        if (!cancelled) setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => { cancelled = true; };
  }, [searchQuery]);

  const saveCustomerViaApi = useCallback(async (body: import('../../api/client').CreateCustomerBody) => {
    const created = await customersApi.create(body);
    return mapDtoToCustomer(created);
  }, []);

  const onSelectCustomer = (customer: CustomerWithVehicles) => {
    setSelectedCustomer(customer);
    setSelectedVehicle(customer.vehicles.length > 0 ? customer.vehicles[0] : null);
    setSearchQuery(customer.name);
    setShowCustomerDropdown(false);
  };

  const onClearCustomer = () => {
    setSelectedCustomer(null);
    setSelectedVehicle(null);
    setSearchQuery('');
  };

  const onSavedNewCustomer = (customer: CustomerWithVehicles) => {
    onSelectCustomer(customer);
  };

  const addPhoto = () => {
    setPhotoUris((prev) => [...prev, `placeholder_${prev.length + 1}`]);
  };

  const removePhoto = (index: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      Alert.alert('Validation', 'Please search and select a customer or add a new customer.');
      return;
    }
    if (!selectedVehicle) {
      Alert.alert('Validation', 'Please select a vehicle for this job.');
      return;
    }
    if (!complaints.trim()) {
      Alert.alert('Validation', 'Please enter complaint / issue.');
      return;
    }
    const odo = parseInt(odometer, 10);
    if (isNaN(odo) || odo < 0) {
      Alert.alert('Validation', 'Please enter a valid odometer reading.');
      return;
    }

    setSubmitting(true);
    try {
      // Only send assignedMechanicId if it's a valid UUID (backend rejects mock ids like 'm1')
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const mechanicId = assignedMechanicId && uuidRegex.test(assignedMechanicId) ? assignedMechanicId : undefined;
      // Only send paths that look like stored paths (skip placeholders until real upload exists)
      const photoPaths = photoUris.filter((p) => typeof p === 'string' && p.length > 0 && !p.startsWith('placeholder_'));

      const created = await jobsApi.create({
        customerId: selectedCustomer.id,
        vehicleId: selectedVehicle.id,
        complaints: complaints.trim(),
        odometerReading: odo,
        assignedMechanicId: mechanicId ?? undefined,
        photoPaths,
      });
      navigation.replace('JobDetail', { jobId: created.id });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create job card.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Customer & Vehicle */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color="#64748b" />
            <Text style={styles.sectionTitle}>Customer & Vehicle</Text>
          </View>
          <Text style={styles.hint}>
            Search existing customer or add new customer and assign vehicle.
          </Text>

          <View style={styles.customerInputRow}>
            <TextInput
              style={styles.customerInput}
              placeholder="Search customer by name, mobile, or vehicle"
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                setShowCustomerDropdown(true);
                if (!t.trim()) setSelectedCustomer(null);
              }}
              onFocus={() => setShowCustomerDropdown(true)}
            />
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() => setShowCustomerDropdown(!showCustomerDropdown)}
            >
              <Ionicons name="chevron-down" size={22} color="#64748b" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addCustomerBtn}
              onPress={() => setShowAddCustomerModal(true)}
            >
              <Ionicons name="add" size={24} color="#3b82f6" />
            </TouchableOpacity>
          </View>

          {showCustomerDropdown && (
            <View style={styles.dropdown}>
              {searchLoading ? (
                <View style={styles.dropdownLoading}>
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <Text style={styles.dropdownEmpty}>Searching...</Text>
                </View>
              ) : searchResults.length === 0 ? (
                <Text style={styles.dropdownEmpty}>No customers found</Text>
              ) : (
                searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.dropdownItem}
                    onPress={() => onSelectCustomer(item)}
                  >
                    <Text style={styles.dropdownItemName}>{item.name}</Text>
                    <Text style={styles.dropdownItemPhone}>{item.phone}</Text>
                    {item.vehicles.length > 0 && (
                      <Text style={styles.dropdownItemVehicle} numberOfLines={1}>
                        {item.vehicles.map((v) => v.registrationNo).join(', ')}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {selectedCustomer && (
            <View style={styles.selectedBlock}>
              <View style={styles.selectedRow}>
                <Text style={styles.selectedLabel}>Customer</Text>
                <TouchableOpacity onPress={onClearCustomer} hitSlop={8}>
                  <Text style={styles.clearText}>Change</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.selectedValue}>
                {selectedCustomer.name} · {selectedCustomer.phone}
              </Text>
              {selectedCustomer.vehicles.length > 0 && (
                <>
                  <Text style={styles.selectedLabel}>Vehicle</Text>
                  <View style={styles.vehicleChips}>
                    {selectedCustomer.vehicles.map((v) => (
                      <TouchableOpacity
                        key={v.id}
                        style={[
                          styles.vehicleChip,
                          selectedVehicle?.id === v.id && styles.vehicleChipSelected,
                        ]}
                        onPress={() => setSelectedVehicle(v)}
                      >
                        <Text
                          style={[
                            styles.vehicleChipText,
                            selectedVehicle?.id === v.id && styles.vehicleChipTextSelected,
                          ]}
                        >
                          {v.registrationNo} · {v.make} {v.model}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          <Text style={styles.label}>Odometer (km) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 45000"
            placeholderTextColor="#94a3b8"
            value={odometer}
            onChangeText={setOdometer}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Mechanic</Text>
          <View style={styles.mechanicRow}>
            {MOCK_MECHANICS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.mechanicChip,
                  assignedMechanicId === m.id && styles.mechanicChipSelected,
                ]}
                onPress={() => setAssignedMechanicId(assignedMechanicId === m.id ? null : m.id)}
              >
                <Text
                  style={[
                    styles.mechanicChipText,
                    assignedMechanicId === m.id && styles.mechanicChipTextSelected,
                  ]}
                >
                  {m.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Complaint / Issue</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Customer reported issue..."
            placeholderTextColor="#94a3b8"
            value={complaints}
            onChangeText={setComplaints}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <View style={styles.photoRow}>
            {photoUris.map((_, index) => (
              <View key={index} style={styles.photoBox}>
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => removePhoto(index)}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
                <Ionicons name="image" size={32} color="#94a3b8" />
              </View>
            ))}
            <TouchableOpacity style={styles.photoAdd} onPress={addPhoto}>
              <Ionicons name="add" size={32} color="#64748b" />
              <Text style={styles.photoAddText}>Add photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Create Job Card</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <AddCustomerModal
        visible={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        onSaved={onSavedNewCustomer}
        saveCustomer={saveCustomerViaApi}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  hint: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  customerInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  customerInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  dropdownBtn: { padding: 8 },
  addCustomerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  dropdown: {
    maxHeight: 220,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  dropdownEmpty: { padding: 16, textAlign: 'center', color: '#64748b' },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  dropdownItemPhone: { fontSize: 13, color: '#64748b', marginTop: 2 },
  dropdownItemVehicle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  selectedBlock: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 12 },
  selectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  selectedLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 8 },
  selectedValue: { fontSize: 15, color: '#1e293b' },
  clearText: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  vehicleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  vehicleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  vehicleChipSelected: { backgroundColor: '#3b82f6' },
  vehicleChipText: { fontSize: 13, color: '#475569' },
  vehicleChipTextSelected: { color: '#fff' },
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
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  mechanicRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mechanicChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  mechanicChipSelected: { backgroundColor: '#3b82f6' },
  mechanicChipText: { fontSize: 14, color: '#475569' },
  mechanicChipTextSelected: { color: '#fff' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoBox: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  photoAdd: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddText: { fontSize: 10, color: '#64748b', marginTop: 4 },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  dropdownLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
});
