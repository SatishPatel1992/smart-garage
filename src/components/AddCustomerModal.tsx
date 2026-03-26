import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { CustomerWithVehicles, Vehicle } from '../types/models';
import type { CreateCustomerBody } from '../api/client';

const VEHICLE_TYPES = ['Sedan', 'Hatchback', 'SUV', 'MUV', 'Two-wheeler', 'Other'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'];

/** Common car makes (India). */
const MAKES = ['Maruti', 'Hyundai', 'Honda', 'Tata', 'Mahindra', 'Kia', 'Toyota', 'MG', 'Skoda', 'Volkswagen', 'Other'];

/** Models by make (India). "Other" has common models across brands. */
const MODELS_BY_MAKE: Record<string, string[]> = {
  Maruti: ['Swift', 'Dzire', 'Baleno', 'Ertiga', 'Brezza', 'Alto', 'Wagon R', 'Celerio', 'Eeco', 'Other'],
  Hyundai: ['i20', 'i10', 'Creta', 'Venue', 'Verna', 'Santro', 'Tucson', 'Alcazar', 'Other'],
  Honda: ['City', 'Amaze', 'Elevate', 'Jazz', 'WR-V', 'Other'],
  Tata: ['Nexon', 'Harrier', 'Punch', 'Safari', 'Tiago', 'Altroz', 'Tigor', 'Other'],
  Mahindra: ['XUV700', 'Scorpio', 'Thar', 'XUV300', 'Bolero', 'Marazzo', 'Other'],
  Kia: ['Seltos', 'Sonet', 'Carens', 'EV6', 'Other'],
  Toyota: ['Innova', 'Fortuner', 'Glanza', 'Urban Cruiser', 'Hilux', 'Other'],
  MG: ['Hector', 'Gloster', 'ZS EV', 'Other'],
  Skoda: ['Kushaq', 'Slavia', 'Kodiaq', 'Superb', 'Other'],
  Volkswagen: ['Taigun', 'Virtus', 'Tiguan', 'Polo', 'Other'],
  Other: ['Other'],
};

interface VehicleForm {
  registrationNo: string;
  make: string;
  model: string;
  type: string;
  fuel: string;
}

const emptyVehicle = (): VehicleForm => ({
  registrationNo: '',
  make: '',
  model: '',
  type: '',
  fuel: '',
});

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: (customer: CustomerWithVehicles) => void;
  /** When provided, saves via API and calls onSaved with the created customer. */
  saveCustomer?: (body: CreateCustomerBody) => Promise<CustomerWithVehicles>;
};

export default function AddCustomerModal({ visible, onClose, onSaved, saveCustomer }: Props) {
  const insets = useSafeAreaInsets();
  const headerTopPadding = Math.max(insets.top, 16) + 12;
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [vehicles, setVehicles] = useState<VehicleForm[]>([emptyVehicle()]);
  const [nameError, setNameError] = useState('');
  const [pickerOpen, setPickerOpen] = useState<{ kind: 'make' | 'model'; vehicleIndex: number } | null>(null);

  const reset = () => {
    setName('');
    setMobile('');
    setAddress('');
    setGstin('');
    setVehicles([emptyVehicle()]);
    setNameError('');
  };

  const addVehicle = () => setVehicles((prev) => [...prev, emptyVehicle()]);

  const getModelsForMake = (make: string) => MODELS_BY_MAKE[make] ?? MODELS_BY_MAKE.Other;

  const updateVehicle = (index: number, field: keyof VehicleForm, value: string) => {
    setVehicles((prev) => {
      const next = prev.map((v, i) => (i === index ? { ...v, [field]: value } : v));
      if (field === 'make' && index < next.length) {
        const models = MODELS_BY_MAKE[value] ?? MODELS_BY_MAKE.Other;
        const currentModel = next[index].model;
        if (currentModel && !models.includes(currentModel)) next[index] = { ...next[index], model: '' };
      }
      return next;
    });
  };

  const removeVehicle = (index: number) => {
    if (vehicles.length <= 1) return;
    setVehicles((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    if (!name.trim()) {
      setNameError('Name is required (min 3 characters)');
      return false;
    }
    if (name.trim().length < 3) {
      setNameError('Name is required (min 3 characters)');
      return false;
    }
    setNameError('');
    const mobileDigits = mobile.replace(/\D/g, '');
    if (mobileDigits.length !== 10) {
      Alert.alert('Validation', 'Please enter a valid 10-digit mobile number.');
      return false;
    }
    const validVehicles = vehicles.filter(
      (v) => v.registrationNo.trim() && v.make.trim() && v.model.trim()
    );
    if (validVehicles.length === 0) {
      Alert.alert('Validation', 'Please add at least one vehicle with number, brand and model.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const validVehicles = vehicles.filter(
      (v) => v.registrationNo.trim() && v.make.trim() && v.model.trim()
    );
    const body: CreateCustomerBody = {
      name: name.trim(),
      phone: mobile.trim(),
      address: address.trim() || undefined,
      gstin: gstin.trim() || undefined,
      vehicles: validVehicles.map((v) => ({
        registrationNo: v.registrationNo.trim(),
        make: v.make.trim(),
        model: v.model.trim(),
        type: v.type || undefined,
        fuel: v.fuel || undefined,
      })),
    };
    if (saveCustomer) {
      try {
        const created = await saveCustomer(body);
        onSaved(created);
        reset();
        onClose();
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save customer.');
      }
      return;
    }
    const id = `c${Date.now()}`;
    const customer: CustomerWithVehicles = {
      id,
      name: body.name,
      phone: body.phone,
      address: body.address ?? '',
      gstin: body.gstin,
      vehicles: validVehicles.map((v, i) => ({
        id: `v${id}-${i}`,
        registrationNo: v.registrationNo.trim(),
        make: v.make.trim(),
        model: v.model.trim(),
        type: v.type || undefined,
        fuel: v.fuel || undefined,
      } as Vehicle)),
    };
    onSaved(customer);
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.wrapper} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.header, { paddingTop: headerTopPadding, paddingBottom: 16 }]}>
            <Text style={styles.title}>Add Customer & Vehicles</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Customer details</Text>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={[styles.input, nameError ? styles.inputError : null]}
                  placeholder="Customer name"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={(t) => {
                    setName(t);
                    if (nameError) setNameError('');
                  }}
                />
                {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
                <Text style={styles.label}>Mobile *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#94a3b8"
                  value={mobile}
                  onChangeText={setMobile}
                  keyboardType="phone-pad"
                  maxLength={14}
                />
                <Text style={styles.label}>Address (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Address"
                  placeholderTextColor="#94a3b8"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                />
                <Text style={styles.label}>GSTIN (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="GSTIN (optional)"
                  placeholderTextColor="#94a3b8"
                  value={gstin}
                  onChangeText={setGstin}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Vehicles *</Text>
                {vehicles.map((v, index) => (
                  <View key={index} style={styles.vehicleBlock}>
                    <Text style={styles.vehicleLabel}>Vehicle {index + 1}</Text>
                    <Text style={styles.label}>Vehicle No. e.g. GJ01</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Registration number"
                      placeholderTextColor="#94a3b8"
                      value={v.registrationNo}
                      onChangeText={(t) => updateVehicle(index, 'registrationNo', t)}
                      autoCapitalize="characters"
                    />
                    <View style={styles.row}>
                      <View style={styles.half}>
                        <Text style={styles.label}>Brand</Text>
                        <TouchableOpacity
                          style={[styles.input, styles.dropdownTouch]}
                          onPress={() => setPickerOpen({ kind: 'make', vehicleIndex: index })}
                        >
                          <Text style={v.make ? styles.dropdownText : styles.dropdownPlaceholder}>
                            {v.make || 'Select brand'}
                          </Text>
                          <Ionicons name="chevron-down" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.half}>
                        <Text style={styles.label}>Model</Text>
                        <TouchableOpacity
                          style={[styles.input, styles.dropdownTouch]}
                          onPress={() => setPickerOpen({ kind: 'model', vehicleIndex: index })}
                        >
                          <Text style={v.model ? styles.dropdownText : styles.dropdownPlaceholder}>
                            {v.model || 'Select model'}
                          </Text>
                          <Ionicons name="chevron-down" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {pickerOpen && pickerOpen.vehicleIndex === index && (
                      <Modal
                        visible
                        transparent
                        animationType="fade"
                        onRequestClose={() => setPickerOpen(null)}
                      >
                        <TouchableOpacity
                          style={styles.pickerOverlay}
                          activeOpacity={1}
                          onPress={() => setPickerOpen(null)}
                        >
                          <View style={styles.pickerBox}>
                            <Text style={styles.pickerTitle}>
                              {pickerOpen.kind === 'make' ? 'Select brand' : 'Select model'}
                            </Text>
                            <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled">
                              {(pickerOpen.kind === 'make' ? MAKES : getModelsForMake(v.make)).map((opt) => (
                                <TouchableOpacity
                                  key={opt}
                                  style={styles.pickerOption}
                                  onPress={() => {
                                    updateVehicle(index, pickerOpen.kind, opt);
                                    setPickerOpen(null);
                                  }}
                                >
                                  <Text style={styles.pickerOptionText}>{opt}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                            <TouchableOpacity style={styles.pickerCancel} onPress={() => setPickerOpen(null)}>
                              <Text style={styles.pickerCancelText}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      </Modal>
                    )}
                    <View style={styles.row}>
                      <View style={styles.half}>
                        <Text style={styles.label}>Type</Text>
                        <View style={styles.pickerRow}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {VEHICLE_TYPES.map((opt) => (
                              <TouchableOpacity
                                key={opt}
                                style={[
                                  styles.chip,
                                  v.type === opt && styles.chipSelected,
                                ]}
                                onPress={() => updateVehicle(index, 'type', opt)}
                              >
                                <Text
                                  style={[
                                    styles.chipText,
                                    v.type === opt && styles.chipTextSelected,
                                  ]}
                                >
                                  {opt}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      </View>
                      <View style={styles.half}>
                        <Text style={styles.label}>Fuel</Text>
                        <View style={styles.pickerRow}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {FUEL_TYPES.map((opt) => (
                              <TouchableOpacity
                                key={opt}
                                style={[
                                  styles.chip,
                                  v.fuel === opt && styles.chipSelected,
                                ]}
                                onPress={() => updateVehicle(index, 'fuel', opt)}
                              >
                                <Text
                                  style={[
                                    styles.chipText,
                                    v.fuel === opt && styles.chipTextSelected,
                                  ]}
                                >
                                  {opt}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      </View>
                    </View>
                    {vehicles.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeVehicle}
                        onPress={() => removeVehicle(index)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        <Text style={styles.removeVehicleText}>Remove vehicle</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity style={styles.addVehicleBtn} onPress={addVehicle}>
                  <Ionicons name="add" size={22} color="#22c55e" />
                  <Text style={styles.addVehicleText}>Add Vehicle</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                  <Text style={styles.saveBtnText}>Save Customer</Text>
                </TouchableOpacity>
              </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboard: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 20 },
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
  dropdownTouch: { flexDirection: 'row', alignItems: 'center' },
  dropdownText: { fontSize: 16, color: '#1e293b', flex: 1 },
  dropdownPlaceholder: { fontSize: 16, color: '#94a3b8', flex: 1 },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 360,
  },
  pickerTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  pickerScroll: { maxHeight: 260 },
  pickerOption: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerOptionText: { fontSize: 16, color: '#1e293b' },
  pickerCancel: { padding: 16, alignItems: 'center' },
  pickerCancelText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  inputError: { borderColor: '#ef4444' },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  errorText: { fontSize: 12, color: '#ef4444', marginTop: -8, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  vehicleBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  vehicleLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  pickerRow: { marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 6,
  },
  chipSelected: { backgroundColor: '#3b82f6' },
  chipText: { fontSize: 13, color: '#475569' },
  chipTextSelected: { color: '#fff' },
  removeVehicle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  removeVehicleText: { fontSize: 13, color: '#ef4444' },
  addVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#22c55e',
    borderRadius: 10,
  },
  addVehicleText: { fontSize: 15, fontWeight: '600', color: '#22c55e' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: '#475569' },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#22c55e',
  },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
