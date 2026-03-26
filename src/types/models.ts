/**
 * Domain models for Smart Garage (FR-020–FR-082).
 * API integration will map to these types.
 */

// ----- Job Card (FR-020, FR-021, FR-022, FR-023) -----
export type JobStage = 'pending' | 'work_in_progress' | 'delivered';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
}

export interface Vehicle {
  id: string;
  registrationNo: string;
  make: string;
  model: string;
  year?: number;
  vin?: string;
  type?: string;   // e.g. Sedan, SUV
  fuel?: string;   // e.g. Petrol, Diesel
}

/** Customer with their vehicles (for add-customer form & search) */
export interface CustomerWithVehicles extends Customer {
  vehicles: Vehicle[];
}

// ----- CRM: Reminders & follow-ups -----
export type ReminderType = 'service_due' | 'warranty_expiry' | 'recall' | 'other';

export interface Reminder {
  id: string;
  customerId: string;
  vehicleId?: string;
  type: ReminderType;
  dueDate: string; // ISO
  title: string;
  description?: string;
  createdAt: string;
}

export interface JobCard {
  id: string;
  jobNumber: string;
  customer: Customer;
  vehicle: Vehicle;
  insuranceCompanyId?: string;
  insuranceCompany?: { id: string; name: string };
  complaints: string;
  odometerReading: number;
  photos: string[];
  stage: JobStage;
  assignedMechanicId?: string;
  createdAt: string;
  updatedAt: string;
}

// ----- Mechanic & Task (FR-030, FR-031, FR-032) -----
export type MechanicTaskStatus = 'assigned' | 'started' | 'completed';

export interface Mechanic {
  id: string;
  name: string;
  phone?: string;
}

export interface MechanicTask {
  id: string;
  jobCardId: string;
  mechanicId: string;
  status: MechanicTaskStatus;
  updatedAt: string;
}

// ----- Estimate (FR-040–FR-043) -----
export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'rejected';

export interface EstimateLine {
  description: string;
  type: 'part' | 'labour';
  quantity: number;
  unitPrice: number;
  amount: number;
  insurancePayableMode?: 'percent' | 'rupees';
  insurancePayableValue?: number;
}

/** Single line in estimate items screen (with tax, optional insurance split) */
export interface EstimateItemLine {
  id: string;
  description: string;
  type: 'part' | 'labour';
  quantity: number;
  unitPrice: number;
  taxRatePercent: number;
  taxAmount: number;
  lineTotal: number;
  /** When insurance company selected: % or ₹ for insurance share */
  insurancePayableMode?: 'percent' | 'rupees';
  insurancePayableValue?: number;
}

/** Searchable part or labour item for dropdown */
export interface PartOrLabourItem {
  id: string;
  name: string;
  type: 'part' | 'labour';
  defaultUnitPrice: number;
  defaultTaxRatePercent: number;
}

/** Single revision of an estimate (version history). */
export interface EstimateRevision {
  id: string;
  estimateId: string;
  version: number;
  lines: EstimateLine[];
  totalAmount: number;
  note?: string;
  createdAt: string;
}

export interface Estimate {
  id: string;
  estimateNumber: string;
  jobCardId: string;
  lines: EstimateLine[];
  totalAmount: number;
  status: EstimateStatus;
  sentAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  /** Estimate valid until date (ISO). Lock or flag after expiry. */
  validUntil?: string;
  /** Version history (revisions). */
  revisions?: EstimateRevision[];
  createdAt: string;
  updatedAt?: string;
}

// ----- Inventory (FR-050–FR-053) -----
export interface Part {
  id: string;
  code: string;           // SKU
  name: string;
  quantity: number;
  minQuantity: number;    // reorder level
  unit: string;
  price: number;         // selling price
  costPrice?: number;    // cost
  vendorId?: string;     // preferred supplier
  createdAt?: string;
  updatedAt?: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
}

export type StockMovementType = 'purchase' | 'issue_to_job' | 'return';

export interface StockMovement {
  id: string;
  partId: string;
  type: StockMovementType;
  quantity: number;
  /** For purchase: vendorId; for issue: jobCardId; for return: optional reference */
  referenceId?: string;
  referenceLabel?: string;  // e.g. job number or vendor name
  unitCost?: number;
  createdAt: string;
}

// ----- Invoice (FR-060–FR-064) -----
/** Proforma = preliminary; Tax = GST-compliant with GSTIN, HSN, CGST/SGST. */
export type InvoiceFormat = 'proforma' | 'tax';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  jobCardId: string;
  estimateId?: string;
  /** customer = bill to customer; insurance = bill to insurance company */
  billToType?: 'customer' | 'insurance';
  /** proforma = simple format; tax = GST-compliant invoice */
  format?: InvoiceFormat;
  partsAmount: number;
  labourAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  pdfUrl?: string;
  createdAt: string;
}

/** Credit note for returns or adjustments against an invoice. */
export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  invoiceId: string;
  amount: number;
  reason: string;
  createdAt: string;
}

/** Recurring / AMC contract – auto-invoicing. */
export type RecurringFrequency = 'monthly' | 'quarterly' | 'yearly';

export interface RecurringContract {
  id: string;
  customerId: string;
  vehicleId?: string;
  description: string;
  amount: number;
  frequency: RecurringFrequency;
  nextDueDate: string;
  createdAt: string;
}

// ----- Payment (FR-070–FR-072) -----
export type PaymentMethod = 'upi' | 'cash' | 'card' | 'bank_transfer';

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  status: 'pending' | 'completed' | 'failed';
  razorpayOrderId?: string;
  paidAt?: string;
  createdAt: string;
}

// ----- Reports (FR-080–FR-082) -----
export interface DailySummary {
  date: string;
  jobsCompleted: number;
  jobsInProgress: number;
  paymentsCollected: number;
}

export interface RevenueBreakdown {
  partsRevenue: number;
  labourRevenue: number;
  totalRevenue: number;
}

export interface MechanicPerformance {
  mechanicId: string;
  mechanicName: string;
  jobsCompleted: number;
  totalLabourAmount: number;
}
