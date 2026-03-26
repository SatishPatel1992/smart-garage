import type { CustomerWithVehicles, Vehicle } from '../types/models';

/** In-memory list; new customers added from Add Customer form are appended. Replace with API. */
export let MOCK_CUSTOMERS: CustomerWithVehicles[] = [
  {
    id: 'c1',
    name: 'Raj Kumar',
    phone: '9876543210',
    email: 'raj@example.com',
    address: '123 MG Road, Bangalore',
    gstin: '',
    vehicles: [
      { id: 'v1', registrationNo: 'KA-01-AB-1234', make: 'Maruti', model: 'Swift', year: 2020, type: 'Sedan', fuel: 'Petrol' },
    ],
  },
  {
    id: 'c2',
    name: 'Priya S',
    phone: '9123456789',
    address: '45 Anna Nagar, Chennai',
    vehicles: [
      { id: 'v2', registrationNo: 'TN-09-XY-5678', make: 'Hyundai', model: 'i20', year: 2021, type: 'Hatchback', fuel: 'Petrol' },
    ],
  },
  {
    id: 'c3',
    name: 'Amit Patel',
    phone: '9988776655',
    address: '78 Andheri East, Mumbai',
    vehicles: [
      { id: 'v3', registrationNo: 'MH-02-CD-9012', make: 'Honda', model: 'City', year: 2019, type: 'Sedan', fuel: 'Diesel' },
    ],
  },
];

export function addCustomer(customer: CustomerWithVehicles): void {
  MOCK_CUSTOMERS = [...MOCK_CUSTOMERS, customer];
}

export function searchCustomers(query: string): CustomerWithVehicles[] {
  const q = query.trim().toLowerCase();
  if (!q) return MOCK_CUSTOMERS;
  return MOCK_CUSTOMERS.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
      c.vehicles.some(
        (v) =>
          v.registrationNo.toLowerCase().includes(q) ||
          v.make.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q)
      )
  );
}
