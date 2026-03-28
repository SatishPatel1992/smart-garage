/**
 * REST API client for Smart Garage backend (web).
 * Uses VITE_API_URL or /api proxy (see vite.config proxy).
 */

import { getApiBaseUrl } from '../config/api';

const getBaseUrl = (): string => getApiBaseUrl();

const API_PREFIX = '/api';

let accessToken: string | null = null;

const TOKEN_KEY = 'smart_garage_access_token';

export function setAccessToken(token: string | null): void {
  accessToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) accessToken = stored;
    return accessToken;
  } catch {
    return null;
  }
}

type RequestOpts = Omit<RequestInit, 'body'> & { body?: object };

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { body, ...init } = opts;
  const base = getBaseUrl() || '';
  const pathStr = path.startsWith('/') ? path : `/${path}`;
  const url = base ? `${base}${pathStr}` : `${API_PREFIX}${pathStr}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    ...init,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      (data as { message?: string }).message ?? (data as { error?: string }).error ?? 'Request failed'
    ) as Error & { status?: number; data?: unknown };
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
  logoUrl?: string | null;
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

export type UpdateUserBody = {
  role?: UserRole;
  isActive?: boolean;
};

export const users = {
  list: () => request<{ users: UserDto[] }>('/users'),
  create: (body: CreateUserBody) =>
    request<{ id: string; email: string; name: string | null; role: string | null; createdAt: string }>('/users', { method: 'POST', body }),
  update: (id: string, body: UpdateUserBody) =>
    request<UserDto>(`/users/${id}`, { method: 'PATCH', body }),
  resetPassword: (id: string, newPassword: string) =>
    request<{ ok: boolean }>(`/users/${id}/reset-password`, { method: 'POST', body: { newPassword } }),
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

export type PublicEstimateDto = {
  id: string;
  estimateNumber: string;
  status: string;
  totalAmount: number;
  validUntil?: string;
  sentAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  customer: { name: string; phone: string };
  vehicle: { registrationNo: string; make: string; model: string };
  lines: Array<{
    id: string;
    description: string;
    type: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
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

/**
 * EstimateListItemDto – shape returned by GET /estimates (list endpoint).
 *
 * Backend route: GET /estimates
 *   Query params: status?, page?, pageSize?, sort? (default createdAt desc)
 *   Scoped to caller's organizationId via requireAuth.
 *   Returns { estimates: EstimateListItemDto[], total: number }
 *
 * Prisma query (backend/src/routes/estimates.ts):
 *   prisma.estimate.findMany({
 *     where: { jobCard: { organizationId: req.user.organizationId }, ...(status ? { status } : {}) },
 *     orderBy: { createdAt: 'desc' },
 *     skip, take,
 *     include: { jobCard: { include: { customer: true, vehicle: true } } },
 *   })
 *   Map each to EstimateListItemDto shape below.
 */
export type EstimateListItemDto = {
  id: string;
  estimateNumber: string;
  jobCardId: string;
  jobNumber: string;
  customerName: string;
  vehicleRegistrationNo: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  totalAmount: number;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
};

export type EstimateListParams = {
  status?: 'draft' | 'sent' | 'approved' | 'rejected';
  page?: number;
  pageSize?: number;
};

export const estimates = {
  /**
   * GET /estimates – list all estimates for this organisation.
   * Requires backend list endpoint (see EstimateListItemDto comment above).
   */
  list: (params: EstimateListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.page != null) qs.set('page', String(params.page));
    if (params.pageSize != null) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return request<{ estimates: EstimateListItemDto[]; total: number }>(
      `/estimates${query ? `?${query}` : ''}`
    );
  },
  create: (body: CreateEstimateBody) => request<EstimateDto>('/estimates', { method: 'POST', body }),
  getByJobId: (jobCardId: string) =>
    request<EstimateDto>(`/estimates?jobCardId=${encodeURIComponent(jobCardId)}`),
  updateStatus: (id: string, status: 'draft' | 'sent' | 'approved' | 'rejected') =>
    request<EstimateDto>(`/estimates/${id}`, { method: 'PATCH', body: { status } }),
  addRevision: (id: string, body: AddRevisionBody) =>
    request<EstimateDto>(`/estimates/${id}/revisions`, { method: 'POST', body }),
  getPublic: (id: string) =>
    request<PublicEstimateDto>(`/estimates/public/${id}`),
  approvePublic: (id: string) =>
    request<{ ok: boolean; id: string; status: string; approvedAt?: string }>(`/estimates/public/${id}/approve`, { method: 'POST', body: {} }),
};

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
  delete: (id: string) => request<void>(`/invoices/${id}`, { method: 'DELETE' }),
};

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

export type SupplierDto = {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  createdAt: string;
};

export type PartDto = {
  id: string;
  code: string;
  name: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  price: number;
  costPrice?: number | null;
  vendorId?: string | null;
  vendorName?: string | null;
  createdAt: string;
};

export type PurchaseOrderLineDto = {
  id: string;
  partId: string;
  partCode: string;
  partName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  taxRatePercent: number;
  lineAmount: number;
};

export type PurchaseOrderDto = {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  status: 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled';
  expectedDate?: string | null;
  notes?: string | null;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  createdAt: string;
  lines: PurchaseOrderLineDto[];
};

export const suppliers = {
  list: () => request<{ suppliers: SupplierDto[] }>('/suppliers'),
  create: (body: { name: string; contactPerson?: string; phone?: string; email?: string; address?: string; gstin?: string }) =>
    request<SupplierDto>('/suppliers', { method: 'POST', body }),
};

export const parts = {
  list: () => request<{ parts: PartDto[] }>('/parts'),
  create: (body: { code: string; name: string; quantity?: number; minQuantity?: number; unit?: string; price: number; costPrice?: number; vendorId?: string }) =>
    request<PartDto>('/parts', { method: 'POST', body }),
  update: (id: string, body: { name?: string; quantity?: number; minQuantity?: number; unit?: string; price?: number; costPrice?: number; vendorId?: string | null }) =>
    request<PartDto>(`/parts/${id}`, { method: 'PATCH', body }),
  importFromServiceItems: () =>
    request<{ ok: boolean; createdCount: number; totalSource: number }>('/parts/import-service-items', { method: 'POST', body: {} }),
};

export const purchaseOrders = {
  list: () => request<{ purchaseOrders: PurchaseOrderDto[] }>('/purchase-orders'),
  reorderSuggestions: () => request<{ suggestions: Array<{ partId: string; code: string; name: string; currentQty: number; minQty: number; unit: string; vendorId?: string | null; vendorName?: string | null; recommendedOrderQty: number }> }>('/purchase-orders/reorder-suggestions'),
  create: (body: { vendorId: string; expectedDate?: string; notes?: string; lines: Array<{ partId: string; quantityOrdered: number; unitCost: number; taxRatePercent?: number }> }) =>
    request<PurchaseOrderDto>('/purchase-orders', { method: 'POST', body }),
  updateStatus: (id: string, status: PurchaseOrderDto['status']) =>
    request<{ id: string; status: PurchaseOrderDto['status'] }>(`/purchase-orders/${id}/status`, { method: 'PATCH', body: { status } }),
  receive: (id: string, lines: Array<{ lineId: string; quantityReceivedNow: number }>) =>
    request<{ ok: boolean }>(`/purchase-orders/${id}/receive`, { method: 'POST', body: { lines } }),
};

// ── Vehicle Make / Model master ──────────────────────────────────────────────

export type VehicleModelDto = {
  id: string;
  name: string;
  makeId: string;
};

export type VehicleMakeDto = {
  id: string;
  name: string;
  models: VehicleModelDto[];
};

export type CreateVehicleMakeBody = { name: string };
export type UpdateVehicleMakeBody = { name?: string };
export type CreateVehicleModelBody = { name: string };
export type UpdateVehicleModelBody = { name?: string };

export const vehicleMakes = {
  /** GET /vehicle-makes  →  { makes: VehicleMakeDto[] } */
  list: () => request<{ makes: VehicleMakeDto[] }>('/vehicle-makes'),

  /** POST /vehicle-makes */
  create: (body: CreateVehicleMakeBody) =>
    request<VehicleMakeDto>('/vehicle-makes', { method: 'POST', body }),

  /** PATCH /vehicle-makes/:id */
  update: (id: string, body: UpdateVehicleMakeBody) =>
    request<VehicleMakeDto>(`/vehicle-makes/${id}`, { method: 'PATCH', body }),

  /** DELETE /vehicle-makes/:id */
  delete: (id: string) =>
    request<{ ok: boolean }>(`/vehicle-makes/${id}`, { method: 'DELETE' }),

  /** POST /vehicle-makes/:makeId/models */
  createModel: (makeId: string, body: CreateVehicleModelBody) =>
    request<VehicleModelDto>(`/vehicle-makes/${makeId}/models`, { method: 'POST', body }),

  /** PATCH /vehicle-makes/:makeId/models/:modelId */
  updateModel: (makeId: string, modelId: string, body: UpdateVehicleModelBody) =>
    request<VehicleModelDto>(`/vehicle-makes/${makeId}/models/${modelId}`, { method: 'PATCH', body }),

  /** DELETE /vehicle-makes/:makeId/models/:modelId */
  deleteModel: (makeId: string, modelId: string) =>
    request<{ ok: boolean }>(`/vehicle-makes/${makeId}/models/${modelId}`, { method: 'DELETE' }),
};
