import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import { getPartById, updatePart, addPart, MOCK_PARTS, MOCK_VENDORS } from '../../data/mockInventory';
import type { Part } from '../../types/models';

type Route = RouteProp<MoreStackParamList, 'PartForm'>;

export default function PartFormScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const partId = route.params?.partId;
  const existing = partId ? getPartById(partId) : null;

  const [code, setCode] = useState(existing?.code ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [quantity, setQuantity] = useState(String(existing?.quantity ?? 0));
  const [minQuantity, setMinQuantity] = useState(String(existing?.minQuantity ?? 0));
  const [unit, setUnit] = useState(existing?.unit ?? 'piece');
  const [price, setPrice] = useState(String(existing?.price ?? ''));
  const [costPrice, setCostPrice] = useState(String(existing?.costPrice ?? ''));
  const [vendorId, setVendorId] = useState(existing?.vendorId ?? '');

  const save = useCallback(() => {
    const qty = parseInt(quantity, 10) || 0;
    const minQ = parseInt(minQuantity, 10) || 0;
    const sellP = parseFloat(price) || 0;
    const costP = costPrice ? parseFloat(costPrice) : undefined;
    if (!code.trim() || !name.trim()) {
      Alert.alert('Error', 'SKU and name are required.');
      return;
    }
    if (existing) {
      const updated: Part = {
        ...existing,
        code: code.trim(),
        name: name.trim(),
        quantity: qty,
        minQuantity: minQ,
        unit: unit.trim() || 'piece',
        price: sellP,
        costPrice: costP,
        vendorId: vendorId || undefined,
      };
      updatePart(updated);
      navigation.goBack();
    } else {
      const newId = 'p' + Date.now();
      addPart({
        id: newId,
        code: code.trim(),
        name: name.trim(),
        quantity: qty,
        minQuantity: minQ,
        unit: unit.trim() || 'piece',
        price: sellP,
        costPrice: costP,
        vendorId: vendorId || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      navigation.goBack();
    }
  }, [existing, code, name, quantity, minQuantity, unit, price, costPrice, vendorId, navigation]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>SKU / Code</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholder="e.g. BRK-PAD-001"
        placeholderTextColor="#94a3b8"
        editable={!existing}
      />
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Part name"
        placeholderTextColor="#94a3b8"
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Quantity</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#94a3b8"
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Reorder level (min)</Text>
          <TextInput
            style={styles.input}
            value={minQuantity}
            onChangeText={setMinQuantity}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>
      <Text style={styles.label}>Unit</Text>
      <TextInput
        style={styles.input}
        value={unit}
        onChangeText={setUnit}
        placeholder="piece, set, bottle, etc."
        placeholderTextColor="#94a3b8"
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Selling price (₹)</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#94a3b8"
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Cost price (₹)</Text>
          <TextInput
            style={styles.input}
            value={costPrice}
            onChangeText={setCostPrice}
            keyboardType="decimal-pad"
            placeholder="Optional"
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>
      <Text style={styles.label}>Preferred vendor</Text>
      <View style={styles.vendorRow}>
        <TouchableOpacity
          style={[styles.vendorChip, !vendorId && styles.vendorChipActive]}
          onPress={() => setVendorId('')}
        >
          <Text style={[styles.vendorChipText, !vendorId && styles.vendorChipTextActive]}>None</Text>
        </TouchableOpacity>
        {MOCK_VENDORS.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={[styles.vendorChip, vendorId === v.id && styles.vendorChipActive]}
            onPress={() => setVendorId(v.id)}
          >
            <Text style={[styles.vendorChipText, vendorId === v.id && styles.vendorChipTextActive]} numberOfLines={1}>{v.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={save}>
        <Text style={styles.saveBtnText}>{existing ? 'Update part' : 'Add part'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 16,
  },
  inputText: { fontSize: 16, color: '#1e293b' },
  placeholderText: { fontSize: 16, color: '#94a3b8' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  vendorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  vendorChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e2e8f0' },
  vendorChipActive: { backgroundColor: '#3b82f6' },
  vendorChipText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  vendorChipTextActive: { color: '#fff' },
  saveBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
