import type { Invoice, CreditNote, RecurringContract, InvoiceFormat } from '../types/models';
import { getJobById } from './mockJobs';

export let MOCK_INVOICES: Invoice[] = [];
export let MOCK_CREDIT_NOTES: CreditNote[] = [];

const now = new Date();
const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
export let MOCK_RECURRING_CONTRACTS: RecurringContract[] = [
  {
    id: 'amc1',
    customerId: 'c1',
    vehicleId: 'v1',
    description: 'Annual Maintenance Contract – Maruti Swift',
    amount: 12000,
    frequency: 'yearly',
    nextDueDate: nextMonth.toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'amc2',
    customerId: 'c2',
    vehicleId: 'v2',
    description: 'Quarterly service pack – Hyundai i20',
    amount: 3500,
    frequency: 'quarterly',
    nextDueDate: nextMonth.toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  },
];

export function getInvoiceById(id: string): Invoice | undefined {
  return MOCK_INVOICES.find((i) => i.id === id);
}

export function getInvoiceByJobId(jobCardId: string): Invoice | undefined {
  return MOCK_INVOICES.find((i) => i.jobCardId === jobCardId);
}

export function getAllInvoices(): Invoice[] {
  return [...MOCK_INVOICES].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getInvoicesByCustomerId(customerId: string): Invoice[] {
  return MOCK_INVOICES.filter((inv) => getJobById(inv.jobCardId)?.customer.id === customerId);
}

export function saveInvoice(invoice: Invoice): void {
  const idx = MOCK_INVOICES.findIndex((i) => i.id === invoice.id);
  if (idx >= 0) MOCK_INVOICES = MOCK_INVOICES.map((i) => (i.id === invoice.id ? invoice : i));
  else MOCK_INVOICES = [...MOCK_INVOICES, invoice];
}

export function getNextInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const nums = MOCK_INVOICES.filter((i) => i.invoiceNumber.startsWith(prefix))
    .map((i) => parseInt(i.invoiceNumber.replace(prefix, ''), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return prefix + String(next).padStart(3, '0');
}

export function addCreditNote(invoiceId: string, amount: number, reason: string): CreditNote {
  const inv = getInvoiceById(invoiceId);
  if (!inv) throw new Error('Invoice not found');
  const nextNum = MOCK_CREDIT_NOTES.length + 1;
  const cn: CreditNote = {
    id: `cn-${Date.now()}`,
    creditNoteNumber: `CN-${inv.invoiceNumber}-${nextNum}`,
    invoiceId,
    amount,
    reason,
    createdAt: new Date().toISOString(),
  };
  MOCK_CREDIT_NOTES = [...MOCK_CREDIT_NOTES, cn];
  inv.paidAmount = Math.max(0, inv.paidAmount - amount);
  saveInvoice(inv);
  return cn;
}

export function getCreditNotesByInvoiceId(invoiceId: string): CreditNote[] {
  return MOCK_CREDIT_NOTES.filter((c) => c.invoiceId === invoiceId);
}

export function getAllCreditNotes(): CreditNote[] {
  return [...MOCK_CREDIT_NOTES].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function addRecurringContract(contract: RecurringContract): void {
  MOCK_RECURRING_CONTRACTS = [...MOCK_RECURRING_CONTRACTS, contract];
}

export function getAllRecurringContracts(): RecurringContract[] {
  return [...MOCK_RECURRING_CONTRACTS];
}

export function getRecurringContractsByCustomerId(customerId: string): RecurringContract[] {
  return MOCK_RECURRING_CONTRACTS.filter((r) => r.customerId === customerId);
}

/** Generate invoice from next due AMC and advance nextDueDate. Uses synthetic jobCardId amc-{contractId}. */
export function generateInvoiceFromRecurring(contractId: string): Invoice | null {
  const contract = MOCK_RECURRING_CONTRACTS.find((c) => c.id === contractId);
  if (!contract) return null;
  const invoiceNumber = getNextInvoiceNumber();
  const invoice: Invoice = {
    id: `inv-amc-${Date.now()}`,
    invoiceNumber,
    jobCardId: 'amc-' + contractId,
    estimateId: undefined,
    format: 'tax',
    partsAmount: 0,
    labourAmount: contract.amount,
    taxAmount: round2(contract.amount * 0.18),
    discountAmount: 0,
    totalAmount: round2(contract.amount * 1.18),
    paidAmount: 0,
    createdAt: new Date().toISOString(),
  };
  MOCK_INVOICES = [...MOCK_INVOICES, invoice];
  const next = new Date(contract.nextDueDate);
  if (contract.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  else if (contract.frequency === 'quarterly') next.setMonth(next.getMonth() + 3);
  else next.setFullYear(next.getFullYear() + 1);
  const updated = { ...contract, nextDueDate: next.toISOString().split('T')[0] };
  MOCK_RECURRING_CONTRACTS = MOCK_RECURRING_CONTRACTS.map((c) => (c.id === contractId ? updated : c));
  return invoice;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
