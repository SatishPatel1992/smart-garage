import type { JobCard, Estimate, Invoice, Payment, Reminder } from '../types/models';
import { MOCK_JOBS } from './mockJobs';
import { MOCK_CUSTOMERS } from './mockCustomers';

/** Mock estimates (link to job/customer). Replace with API. */
export const MOCK_ESTIMATES: (Estimate & { jobCardId: string; customerId: string })[] = [
  { id: 'est1', estimateNumber: 'EST-JC-2024-001', jobCardId: '1', customerId: 'c1', lines: [], totalAmount: 4307, status: 'approved', createdAt: new Date().toISOString(), approvedAt: new Date().toISOString() },
  { id: 'est2', estimateNumber: 'EST-JC-2024-002', jobCardId: '2', customerId: 'c2', lines: [], totalAmount: 5200, status: 'sent', createdAt: new Date().toISOString(), sentAt: new Date().toISOString() },
];

/** Mock invoices (link to job/customer). Replace with API. */
export const MOCK_INVOICES: (Invoice & { customerId: string })[] = [
  { id: 'inv1', invoiceNumber: 'INV-2024-001', jobCardId: '1', customerId: 'c1', estimateId: 'est1', partsAmount: 2000, labourAmount: 1650, taxAmount: 657, discountAmount: 0, totalAmount: 4307, paidAmount: 4307, createdAt: new Date().toISOString() },
  { id: 'inv2', invoiceNumber: 'INV-2024-002', jobCardId: '2', customerId: 'c2', partsAmount: 2500, labourAmount: 2000, taxAmount: 810, discountAmount: 0, totalAmount: 5310, paidAmount: 0, createdAt: new Date().toISOString() },
];

/** Mock payments. Replace with API. */
export const MOCK_PAYMENTS: Payment[] = [
  { id: 'pay1', invoiceId: 'inv1', amount: 4307, method: 'upi', status: 'completed', paidAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: 'pay2', invoiceId: 'inv2', amount: 2000, method: 'cash', status: 'completed', paidAt: new Date().toISOString(), createdAt: new Date().toISOString() },
];

/** Mock reminders. Replace with API. */
export let MOCK_REMINDERS: Reminder[] = [
  { id: 'rem1', customerId: 'c1', vehicleId: 'v1', type: 'service_due', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), title: 'Next service due', description: 'Oil change & filter', createdAt: new Date().toISOString() },
  { id: 'rem2', customerId: 'c2', vehicleId: 'v2', type: 'warranty_expiry', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), title: 'Warranty expires', description: 'Hyundai i20 – engine warranty', createdAt: new Date().toISOString() },
  { id: 'rem3', customerId: 'c3', vehicleId: 'v3', type: 'recall', dueDate: new Date().toISOString(), title: 'Recall campaign', description: 'Honda City – brake check', createdAt: new Date().toISOString() },
];

export function getJobsByCustomerId(customerId: string): JobCard[] {
  return MOCK_JOBS.filter((j) => j.customer.id === customerId);
}

export function getJobsByVehicleId(vehicleId: string): JobCard[] {
  return MOCK_JOBS.filter((j) => j.vehicle.id === vehicleId);
}

export function getEstimatesByCustomerId(customerId: string): (Estimate & { jobCardId: string; customerId: string })[] {
  return MOCK_ESTIMATES.filter((e) => e.customerId === customerId);
}

export function getInvoicesByCustomerId(customerId: string): (Invoice & { customerId: string })[] {
  return MOCK_INVOICES.filter((i) => i.customerId === customerId);
}

export function getPaymentsByCustomerId(customerId: string): Payment[] {
  const invIds = new Set(MOCK_INVOICES.filter((i) => i.customerId === customerId).map((i) => i.id));
  return MOCK_PAYMENTS.filter((p) => invIds.has(p.invoiceId));
}

export function getRemindersByCustomerId(customerId: string): Reminder[] {
  return MOCK_REMINDERS.filter((r) => r.customerId === customerId);
}

export function addReminder(reminder: Reminder): void {
  MOCK_REMINDERS = [...MOCK_REMINDERS, reminder];
}

export function getCustomerById(customerId: string) {
  return MOCK_CUSTOMERS.find((c) => c.id === customerId);
}

export function getVehicleById(vehicleId: string) {
  for (const c of MOCK_CUSTOMERS) {
    const v = c.vehicles.find((ve) => ve.id === vehicleId);
    if (v) return { vehicle: v, customer: c };
  }
  return null;
}
