import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import { getVendorById, MOCK_PARTS } from '../../data/mockInventory';

type Route = RouteProp<MoreStackParamList, 'VendorDetail'>;

export default function VendorDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { vendorId } = route.params;

  const vendor = getVendorById(vendorId);
  const linkedParts = MOCK_PARTS.filter((p) => p.vendorId === vendorId);

  if (!vendor) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Vendor not found</Text>
      </View>
    );
  }

  const reorder = () => {
    const msg = 'Hi, I need to reorder: ' + linkedParts.map((p) => p.name + ' (' + p.code + ')').join(', ');
    const phone = vendor.phone?.replace(/\D/g, '') ?? '';
    const num = phone.length === 10 ? '91' + phone : phone;
    if (num) Linking.openURL('whatsapp://send?phone=' + num + '&text=' + encodeURIComponent(msg));
    else if (vendor.email) Linking.openURL('mailto:' + vendor.email + '?subject=Reorder&body=' + encodeURIComponent(msg));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.name}>{vendor.name}</Text>
        {vendor.contactPerson ? <Text style={styles.rowText}>Contact: {vendor.contactPerson}</Text> : null}
        {vendor.phone ? (
          <TouchableOpacity onPress={() => Linking.openURL('tel:' + vendor.phone)}>
            <Text style={styles.link}>{vendor.phone}</Text>
          </TouchableOpacity>
        ) : null}
        {vendor.email ? (
          <TouchableOpacity onPress={() => Linking.openURL('mailto:' + vendor.email)}>
            <Text style={styles.link}>{vendor.email}</Text>
          </TouchableOpacity>
        ) : null}
        {vendor.address ? <Text style={styles.rowText}>{vendor.address}</Text> : null}
      </View>

      <Text style={styles.sectionTitle}>Parts linked to this vendor</Text>
      {linkedParts.length === 0 ? (
        <Text style={styles.muted}>No parts linked. Edit a part in Parts catalogue to set this vendor.</Text>
      ) : (
        linkedParts.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.partRow}
            onPress={() => navigation.navigate('PartForm', { partId: p.id })}
          >
            <Text style={styles.partName}>{p.name}</Text>
            <Text style={styles.partCode}>{p.code} - Qty: {p.quantity}</Text>
          </TouchableOpacity>
        ))
      )}

      <TouchableOpacity style={styles.reorderBtn} onPress={reorder}>
        <Ionicons name="cart" size={20} color="#fff" />
        <Text style={styles.reorderBtnText}>Reorder from vendor</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#64748b' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20 },
  name: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  rowText: { fontSize: 14, color: '#64748b', marginTop: 6 },
  link: { fontSize: 14, color: '#3b82f6', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 10 },
  muted: { fontSize: 14, color: '#94a3b8' },
  partRow: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  partName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  partCode: { fontSize: 13, color: '#64748b', marginTop: 2 },
  reorderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#22c55e', paddingVertical: 14, borderRadius: 10, gap: 8 },
  reorderBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
