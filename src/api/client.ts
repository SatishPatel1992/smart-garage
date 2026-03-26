/**
 * REST API client for Smart Garage backend.
 * Default: Android emulator → http://10.0.2.2:3000, else http://localhost:3000.
 * Override with EXPO_PUBLIC_API_URL (e.g. http://YOUR_PC_IP:3000 for physical device).
 */

import { Platform } from 'react-native';

const DEFAULT_BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000'  // Android emulator: host machine
    : 'http://192.168.29.157:3000'; // iOS simulator / web

const getBaseUrl = (): string => {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env && env.trim()) return env.trim().replace(/\/$/, '');
  return DEFAULT_BASE_URL;
};

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

type RequestOpts = RequestInit & { body?: object };

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { body, ...init } = opts;
  const url = `${getBaseUrl().replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(url, {
    ...init,
    headers,
    body: body != null ? JSON.stringify(body) : init.body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { message?: string }).message ?? (data as { error?: string }).error ?? 'Request failed') as Error & { status?: number; data?: unknown };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: { id: string; email: string; name: string | null; role: string | null };
};

export type RefreshResponse = {
  accessToken: string;
  expiresIn: string;
  user: { id: string; email: string; name: string | null; role: string | null };
};

export const auth = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  refresh: (refreshToken: string) =>
    request<RefreshResponse>('/auth/refresh', { method: 'POST', body: { refreshToken } }),
};

export type CustomerWithVehiclesDto = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  vehicles: Array<{
    id: string;
    registrationNo: string;
    make: string;
    model: string;
    year?: number;
    vin?: string;
    type?: string;
    fuel?: string;
  }>;
};

export type CreateCustomerBody = {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  vehicles: Array<{
    registrationNo: string;
    make: string;
    model: string;
    year?: number;
    vin?: string;
    type?: string;
    fuel?: string;
  }>;
};

export const customers = {
  list: (query?: string, withVehicles = true) =>
    request<{ customers: CustomerWithVehiclesDto[] }>(
      `/customers?q=${encodeURIComponent(query ?? '')}&withVehicles=${withVehicles}`
    ),
  get: (id: string) => request<CustomerWithVehiclesDto>(`/customers/${id}`),
  create: (body: CreateCustomerBody) =>
    request<CustomerWithVehiclesDto>('/customers', { method: 'POST', body }),
};

export type JobCardDto = {
  id: string;
  jobNumber: string;
  customer: { id: string; name: string; phone: string; email?: string; address?: string; gstin?: string };
  vehicle: { id: string; registrationNo: string; make: string; model: string; year?: number; vin?: string; type?: string; fuel?: string };
  insuranceCompanyId?: string;
  insuranceCompany?: { id: string; name: string };
  complaints: string;
  odometerReading: number;
  photos: string[];
  stage: string;
  assignedMechanicId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateJobBody = {
  customerId: string;
  vehicleId: string;
  complaints: string;
  odometerReading: number;
  assignedMechanicId?: string | null;
  insuranceCompanyId?: string | null;
  photoPaths?: string[];
};

export type UpdateJobBody = {
  stage?: 'pending' | 'work_in_progress' | 'delivered';
  insuranceCompanyId?: string | null;
};

export const jobs = {
  create: (body: CreateJobBody) => request<JobCardDto>('/jobs', { method: 'POST', body }),
  list: () => request<{ jobs: JobCardDto[] }>('/jobs'),
  get: (id: string) => request<JobCardDto>(`/jobs/${id}`),
  update: (id: string, body: UpdateJobBody) => request<JobCardDto>(`/jobs/${id}`, { method: 'PATCH', body }),
  updateStage: (id: string, stage: 'pending' | 'work_in_progress' | 'delivered') =>
    request<JobCardDto>(`/jobs/${id}`, { method: 'PATCH', body: { stage } }),
};

export type MeResponse = {
  user: { id: string; email: string; name: string | null; role: string | null };
  organization: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    gstin: string | null;
    settings: OrgSettings | null;
  } | null;
};

export type OrgSettings = {
  currency?: string;
  defaultTaxRates?: number[];
  defaultGstRatePercent?: number;
  estimateValidityDays?: number;
  lowStockThreshold?: number;
  invoiceDefaultFormat?: 'proforma' | 'tax';
  /** Logo URL for invoice/letterhead (optional) */
  logoUrl?: string | null;
  /** When true, show tax in estimates/invoices and require GSTIN in settings */
  gstEnabled?: boolean;
};

export const me = {
  get: () => request<MeResponse>('/me'),
};

export type UpdateOrgBody = {
  name?: string;
  address?: string | null;
  phone?: string | null;
  gstin?: string | null;
  settings?: Partial<OrgSettings>;
};

export const organizations = {
  updateSettings: (body: UpdateOrgBody) =>
    request<{ ok: boolean }>('/organizations/settings', { method: 'PATCH', body }),
};

export type UserRole = 'admin' | 'advisor' | 'mechanic' | 'accounts';

export type UserDto = {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  isActive: boolean;
  createdAt: string;
};

export type CreateUserBody = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
};

export const users = {
  list: () => request<{ users: UserDto[] }>('/users'),
  create: (body: CreateUserBody) =>
    request<{ id: string; email: string; name: string | null; role: string | null; createdAt: string }>('/users', { method: 'POST', body }),
};

export type ServiceItemDto = {
  id: string;
  name: string;
  type: string;
  defaultUnitPrice: number;
  defaultTaxRatePercent: number;
};

export const serviceItems = {
  list: (query?: string, type?: 'part' | 'labour') =>
    request<{ items: ServiceItemDto[] }>(
      `/service-items?q=${encodeURIComponent(query ?? '')}&type=${type ?? ''}`
    ),
  create: (body: { name: string; type: 'part' | 'labour'; defaultUnitPrice: number; defaultTaxRatePercent: number }) =>
    request<ServiceItemDto>('/service-items', { method: 'POST', body }),
};

export type InsuranceCompanyDto = { id: string; name: string };

export const insurance = {
  list: () => request<{ companies: InsuranceCompanyDto[] }>('/insurance-companies'),
};

// ----- Estimates -----
export type EstimateLineDto = {
  id: string;
  description: string;
  type: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  insurancePayableMode?: 'percent' | 'rupees';
  insurancePayableValue?: number;
};

export type EstimateRevisionDto = {
  id: string;
  estimateId: string;
  version: number;
  totalAmount: number;
  note?: string;
  createdAt: string;
  lines: Array<{ description: string; type: string; quantity: number; unitPrice: number; amount: number }>;
};

export type EstimateDto = {
  id: string;
  estimateNumber: string;
  jobCardId: string;
  status: string;
  totalAmount: number;
  validUntil?: string;
  sentAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  lines: EstimateLineDto[];
  revisions: EstimateRevisionDto[];
  createdAt: string;
  updatedAt: string;
};

export type CreateEstimateBody = {
  jobCardId: string;
  lines: Array<{
    description: string;
    type: 'part' | 'labour';
    quantity: number;
    unitPrice: number;
    amount: number;
    insurancePayableMode?: 'percent' | 'rupees';
    insurancePayableValue?: number;
  }>;
  totalAmount: number;
  validUntil?: string;
};

export type AddRevisionBody = {
  lines: Array<{
    description: string;
    type: 'part' | 'labour';
    quantity: number;
    unitPrice: number;
    amount: number;
    insurancePayableMode?: 'percent' | 'rupees';
    insurancePayableValue?: number;
  }>;
  totalAmount: number;
  note?: string;
};

export const estimates = {
  create: (body: CreateEstimateBody) => request<EstimateDto>('/estimates', { method: 'POST', body }),
  getByJobId: (jobCardId: string) =>
    request<EstimateDto>(`/estimates?jobCardId=${encodeURIComponent(jobCardId)}`),
  updateStatus: (id: string, status: 'draft' | 'sent' | 'approved' | 'rejected') =>
    request<EstimateDto>(`/estimates/${id}`, { method: 'PATCH', body: { status } }),
  addRevision: (id: string, body: AddRevisionBody) =>
    request<EstimateDto>(`/estimates/${id}/revisions`, { method: 'POST', body }),
};

// ----- Invoices -----
export type InvoiceLineDto = {
  id: string;
  description: string;
  type: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type InvoiceDto = {
  id: string;
  jobCardId: string;
  estimateId?: string;
  billToType?: 'customer' | 'insurance';
  invoiceNumber: string;
  format: string;
  partsAmount: number;
  labourAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  pdfUrl?: string;
  createdAt: string;
  lines: InvoiceLineDto[];
};

export type CreateInvoiceBody = {
  jobCardId: string;
  estimateId: string;
  format?: 'proforma' | 'tax';
  partsAmount: number;
  labourAmount: number;
  taxAmount: number;
  discountAmount?: number;
  totalAmount: number;
  lines: Array<{ description: string; type: 'part' | 'labour'; quantity: number; unitPrice: number; amount: number }>;
};

export type InvoiceListItemDto = InvoiceDto & { jobNumber?: string };

export const invoices = {
  list: () => request<{ invoices: InvoiceListItemDto[] }>('/invoices'),
  create: (body: CreateInvoiceBody) => request<{ invoices: InvoiceDto[] }>('/invoices', { method: 'POST', body }),
  getByJobId: (jobCardId: string) =>
    request<{ invoices: InvoiceDto[] }>(`/invoices?jobCardId=${encodeURIComponent(jobCardId)}`),
  updatePaidAmount: (id: string, paidAmount: number) =>
    request<InvoiceDto>(`/invoices/${id}`, { method: 'PATCH', body: { paidAmount } }),
  delete: (id: string) =>
    request<void>(`/invoices/${id}`, { method: 'DELETE' }),
};

// ----- Dashboard -----
export type DashboardActivityDto = {
  type: string;
  id: string;
  jobCardId?: string;
  title: string;
  detail: string;
  createdAt: string;
  icon: string;
  iconColor: string;
};

export type DashboardDto = {
  stats: {
    todayJobs: number;
    inProgress: number;
    awaitingApproval: number;
    readyForDelivery: number;
  };
  recentActivity: DashboardActivityDto[];
  attention: {
    awaitingApprovalCount: number;
    deliveredNotBilledCount: number;
  };
};

export const dashboard = {
  get: () => request<DashboardDto>('/dashboard'),
};

// ----- Credit Notes -----
export type CreditNoteDto = {
  id: string;
  creditNoteNumber: string;
  invoiceId: string;
  invoiceNumber?: string;
  jobCardId?: string;
  amount: number;
  reason: string;
  createdAt: string;
};

export type CreateCreditNoteBody = {
  invoiceId: string;
  amount: number;
  reason: string;
};

export const creditNotes = {
  list: () => request<{ creditNotes: CreditNoteDto[] }>('/credit-notes'),
  create: (body: CreateCreditNoteBody) =>
    request<CreditNoteDto>('/credit-notes', { method: 'POST', body }),
};
