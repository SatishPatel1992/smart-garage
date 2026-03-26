import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const BASE = '/api';

const handlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email === 'admin@garage.com' && body.password === 'correct') {
      return HttpResponse.json({
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresIn: '1h',
        user: { id: 'u1', email: 'admin@garage.com', name: 'Admin', role: 'admin' },
      });
    }
    return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }),

  http.get(`${BASE}/me`, () =>
    HttpResponse.json({
      user: { id: 'u1', email: 'admin@garage.com', name: 'Admin', role: 'admin' },
      organization: { id: 'org1', name: 'Test Garage', address: null, phone: null, gstin: null, settings: null },
    })
  ),

  http.get(`${BASE}/customers`, () =>
    HttpResponse.json({
      customers: [
        {
          id: 'c1',
          name: 'Ramesh Kumar',
          phone: '9876543210',
          email: 'ramesh@example.com',
          vehicles: [{ id: 'v1', registrationNo: 'GJ01AB1234', make: 'Maruti', model: 'Swift', year: 2020 }],
        },
      ],
    })
  ),

  http.post(`${BASE}/customers`, async ({ request }) => {
    const body = (await request.json()) as { name: string; phone: string };
    return HttpResponse.json({ id: 'c2', ...body, vehicles: [] }, { status: 201 });
  }),

  http.get(`${BASE}/customers/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      name: 'Ramesh Kumar',
      phone: '9876543210',
      vehicles: [{ id: 'v1', registrationNo: 'GJ01AB1234', make: 'Maruti', model: 'Swift' }],
    })
  ),

  http.get(`${BASE}/jobs`, () =>
    HttpResponse.json({
      jobs: [
        {
          id: 'j1',
          jobNumber: 'JOB-001',
          customer: { id: 'c1', name: 'Ramesh Kumar', phone: '9876543210' },
          vehicle: { id: 'v1', registrationNo: 'GJ01AB1234', make: 'Maruti', model: 'Swift' },
          complaints: 'Engine noise',
          odometerReading: 45000,
          photos: [],
          stage: 'pending',
          createdAt: '2026-03-25T00:00:00Z',
          updatedAt: '2026-03-25T00:00:00Z',
        },
      ],
    })
  ),

  http.post(`${BASE}/jobs`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: 'j2', jobNumber: 'JOB-002', stage: 'pending', ...body }, { status: 201 });
  }),

  http.patch(`${BASE}/jobs/:id`, async ({ request, params }) => {
    const body = (await request.json()) as { stage?: string };
    return HttpResponse.json({ id: params.id, stage: body.stage ?? 'pending' });
  }),

  http.get(`${BASE}/estimates`, () =>
    HttpResponse.json({
      estimates: [
        {
          id: 'e1',
          estimateNumber: 'EST-001',
          jobCardId: 'j1',
          jobNumber: 'JOB-001',
          customerName: 'Ramesh Kumar',
          vehicleRegistrationNo: 'GJ01AB1234',
          status: 'draft',
          totalAmount: 5000,
          createdAt: '2026-03-25T00:00:00Z',
          updatedAt: '2026-03-25T00:00:00Z',
        },
      ],
      total: 1,
    })
  ),

  http.post(`${BASE}/estimates`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: 'e2', estimateNumber: 'EST-002', status: 'draft', ...body }, { status: 201 });
  }),

  http.patch(`${BASE}/estimates/:id`, async ({ request, params }) => {
    const body = (await request.json()) as { status?: string };
    return HttpResponse.json({ id: params.id, status: body.status });
  }),

  http.get(`${BASE}/invoices`, () =>
    HttpResponse.json({
      invoices: [
        {
          id: 'inv1',
          invoiceNumber: 'INV-001',
          jobCardId: 'j1',
          totalAmount: 5900,
          paidAmount: 0,
          partsAmount: 3000,
          labourAmount: 2000,
          taxAmount: 900,
          discountAmount: 0,
          format: 'tax',
          lines: [],
          createdAt: '2026-03-25T00:00:00Z',
        },
      ],
    })
  ),

  http.post(`${BASE}/invoices`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ invoices: [{ id: 'inv2', invoiceNumber: 'INV-002', ...body }] }, { status: 201 });
  }),

  http.get(`${BASE}/credit-notes`, () =>
    HttpResponse.json({
      creditNotes: [
        { id: 'cn1', creditNoteNumber: 'CN-001', invoiceId: 'inv1', amount: 500, reason: 'Overcharged', createdAt: '2026-03-25T00:00:00Z' },
      ],
    })
  ),

  http.get(`${BASE}/parts`, () =>
    HttpResponse.json({
      parts: [
        { id: 'p1', code: 'OIL-FILTER', name: 'Oil Filter', quantity: 10, minQuantity: 3, unit: 'pcs', price: 250, costPrice: 150 },
        { id: 'p2', code: 'BRAKE-PAD', name: 'Brake Pad', quantity: 2, minQuantity: 4, unit: 'set', price: 800, costPrice: 500 },
      ],
    })
  ),

  http.get(`${BASE}/purchase-orders/reorder-suggestions`, () =>
    HttpResponse.json({
      suggestions: [
        { partId: 'p2', code: 'BRAKE-PAD', name: 'Brake Pad', currentQty: 2, minQty: 4, unit: 'set', recommendedOrderQty: 10 },
      ],
    })
  ),

  http.get(`${BASE}/dashboard`, () =>
    HttpResponse.json({
      stats: { todayJobs: 5, inProgress: 3, awaitingApproval: 2, readyForDelivery: 1 },
      recentActivity: [],
      attention: { awaitingApprovalCount: 2, deliveredNotBilledCount: 1 },
    })
  ),

  http.get(`${BASE}/users`, () =>
    HttpResponse.json({
      users: [
        { id: 'u1', email: 'admin@garage.com', name: 'Admin', role: 'admin', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
        { id: 'u2', email: 'mech@garage.com', name: 'Mechanic Joe', role: 'mechanic', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
      ],
    })
  ),

  http.get(`${BASE}/suppliers`, () =>
    HttpResponse.json({ suppliers: [] })
  ),

  http.get(`${BASE}/purchase-orders`, () =>
    HttpResponse.json({ purchaseOrders: [] })
  ),

  http.get(`${BASE}/service-items`, () =>
    HttpResponse.json({ items: [] })
  ),

  http.get(`${BASE}/insurance-companies`, () =>
    HttpResponse.json({ companies: [] })
  ),

  http.get(`${BASE}/vehicle-makes`, () =>
    HttpResponse.json({
      makes: [
        { id: 'mk1', name: 'Maruti', models: [{ id: 'mo1', name: 'Swift', makeId: 'mk1' }, { id: 'mo2', name: 'Dzire', makeId: 'mk1' }] },
        { id: 'mk2', name: 'Hyundai', models: [{ id: 'mo3', name: 'i20', makeId: 'mk2' }, { id: 'mo4', name: 'Creta', makeId: 'mk2' }] },
      ],
    })
  ),

  http.post(`${BASE}/vehicle-makes`, async ({ request }) => {
    const body = await request.json() as { name: string };
    return HttpResponse.json({ id: 'mk99', name: body.name, models: [] }, { status: 201 });
  }),
];

export const server = setupServer(...handlers);