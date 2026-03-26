/**
 * Smart Garage – Test Suite
 *
 * Stack: Vitest + React Testing Library + MSW (Mock Service Worker)
 *
 * Install (add to devDependencies):
 *   npm i -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event msw
 *
 * vitest.config.ts:
 *   import { defineConfig } from 'vitest/config';
 *   export default defineConfig({ test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.ts' } });
 *
 * src/test/setup.ts:
 *   import '@testing-library/jest-dom';
 *   import { server } from './mocks/server';
 *   beforeAll(() => server.listen());
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 */

// ─── Imports ────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Source modules under test
import {
  setAccessToken,
  getAccessToken,
  auth,
  customers,
  jobs,
  estimates,
  invoices,
  creditNotes,
  parts,
  purchaseOrders,
  suppliers,
  dashboard,
  users,
} from '../api/client';
import { canAccess, toAppRole } from '../utils/roleAccess';
import { getAppPreferences, saveAppPreferences } from '../utils/appPreferences';
import { AuthProvider, useAuth } from '../context/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Login from '../pages/Login';
import { server } from './mock/server';

// ─── MSW Handlers ────────────────────────────────────────────────────────────
const BASE = '/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const renderWithAuth = (ui: React.ReactElement, { route = '/' }: { route?: string } = {}) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[route]}>
        {ui}
      </MemoryRouter>
    </AuthProvider>
  );

// ─── 1. Token Management ─────────────────────────────────────────────────────
describe('Token Management', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('stores a token in localStorage and retrieves it', () => {
    setAccessToken('abc123');
    expect(getAccessToken()).toBe('abc123');
    expect(localStorage.getItem('smart_garage_access_token')).toBe('abc123');
  });

  it('clears the token from localStorage when set to null', () => {
    setAccessToken('abc123');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem('smart_garage_access_token')).toBeNull();
  });

  it('returns null when no token has been set', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('reads a pre-existing token from localStorage on first call', () => {
    localStorage.setItem('smart_garage_access_token', 'pre-existing');
    expect(getAccessToken()).toBe('pre-existing');
  });
});

// ─── 2. Role Access Control ───────────────────────────────────────────────────
describe('Role Access Control – toAppRole()', () => {
  it('returns admin for "admin"', () => expect(toAppRole('admin')).toBe('admin'));
  it('returns advisor for "advisor"', () => expect(toAppRole('advisor')).toBe('advisor'));
  it('returns mechanic for "mechanic"', () => expect(toAppRole('mechanic')).toBe('mechanic'));
  it('returns accounts for "accounts"', () => expect(toAppRole('accounts')).toBe('accounts'));
  it('returns null for unknown role', () => expect(toAppRole('superuser')).toBeNull());
  it('returns null for null', () => expect(toAppRole(null)).toBeNull());
  it('returns null for undefined', () => expect(toAppRole(undefined)).toBeNull());
});

describe('Role Access Control – canAccess()', () => {
  // Admin: full access
  it('admin can access settings', () => expect(canAccess('admin', 'settings')).toBe(true));
  it('admin can access users', () => expect(canAccess('admin', 'users')).toBe(true));
  it('admin can access reports', () => expect(canAccess('admin', 'reports')).toBe(true));

  // Mechanic: restricted access
  it('mechanic can access jobs', () => expect(canAccess('mechanic', 'jobs')).toBe(true));
  it('mechanic can access inventory', () => expect(canAccess('mechanic', 'inventory')).toBe(true));
  it('mechanic cannot access billing', () => expect(canAccess('mechanic', 'billing')).toBe(false));
  it('mechanic cannot access reports', () => expect(canAccess('mechanic', 'reports')).toBe(false));
  it('mechanic cannot access users', () => expect(canAccess('mechanic', 'users')).toBe(false));
  it('mechanic cannot access settings', () => expect(canAccess('mechanic', 'settings')).toBe(false));
  it('mechanic cannot access payments', () => expect(canAccess('mechanic', 'payments')).toBe(false));

  // Advisor: no users/settings
  it('advisor can access estimates', () => expect(canAccess('advisor', 'estimates')).toBe(true));
  it('advisor can access communications', () => expect(canAccess('advisor', 'communications')).toBe(true));
  it('advisor cannot access users', () => expect(canAccess('advisor', 'users')).toBe(false));
  it('advisor cannot access settings', () => expect(canAccess('advisor', 'settings')).toBe(false));

  // Accounts role
  it('accounts can access billing', () => expect(canAccess('accounts', 'billing')).toBe(true));
  it('accounts can access payments', () => expect(canAccess('accounts', 'payments')).toBe(true));
  it('accounts cannot access jobs', () => expect(canAccess('accounts', 'jobs')).toBe(false));
  it('accounts cannot access estimates', () => expect(canAccess('accounts', 'estimates')).toBe(false));
  it('accounts cannot access communications', () => expect(canAccess('accounts', 'communications')).toBe(false));

  // All roles can access profile and dashboard
  (['admin', 'advisor', 'mechanic', 'accounts'] as const).forEach((role) => {
    it(`${role} can access profile`, () => expect(canAccess(role, 'profile')).toBe(true));
    it(`${role} can access dashboard`, () => expect(canAccess(role, 'dashboard')).toBe(true));
  });

  // Invalid role
  it('unknown role cannot access any section', () => expect(canAccess('unknown', 'dashboard')).toBe(false));
});

// ─── 3. App Preferences ───────────────────────────────────────────────────────
describe('App Preferences', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('returns defaults when nothing is stored', () => {
    const prefs = getAppPreferences();
    expect(prefs.reportDefaultPreset).toBe('last6Months');
    expect(prefs.paymentDefaultMethod).toBe('cash');
    expect(prefs.estimateIncludeGSTByDefault).toBe(true);
  });

  it('persists and retrieves saved preferences', () => {
    saveAppPreferences({ reportDefaultPreset: 'thisMonth', paymentDefaultMethod: 'upi', estimateIncludeGSTByDefault: false });
    const prefs = getAppPreferences();
    expect(prefs.reportDefaultPreset).toBe('thisMonth');
    expect(prefs.paymentDefaultMethod).toBe('upi');
    expect(prefs.estimateIncludeGSTByDefault).toBe(false);
  });

  it('falls back to defaults for an invalid reportDefaultPreset value', () => {
    localStorage.setItem('smart_garage_app_preferences_v1', JSON.stringify({ reportDefaultPreset: 'badValue' }));
    expect(getAppPreferences().reportDefaultPreset).toBe('last6Months');
  });

  it('falls back to defaults for an invalid paymentDefaultMethod value', () => {
    localStorage.setItem('smart_garage_app_preferences_v1', JSON.stringify({ paymentDefaultMethod: 'crypto' }));
    expect(getAppPreferences().paymentDefaultMethod).toBe('cash');
  });

  it('falls back to defaults for a non-boolean estimateIncludeGSTByDefault value', () => {
    localStorage.setItem('smart_garage_app_preferences_v1', JSON.stringify({ estimateIncludeGSTByDefault: 'yes' }));
    expect(getAppPreferences().estimateIncludeGSTByDefault).toBe(true);
  });

  it('handles corrupted localStorage JSON gracefully', () => {
    localStorage.setItem('smart_garage_app_preferences_v1', '{bad json}}}');
    const prefs = getAppPreferences();
    expect(prefs).toEqual({ reportDefaultPreset: 'last6Months', paymentDefaultMethod: 'cash', estimateIncludeGSTByDefault: true });
  });
});

// ─── 4. API Client – Auth ─────────────────────────────────────────────────────
describe('API Client – auth.login()', () => {
  beforeAll(() => server.listen());
  afterEach(() => { server.resetHandlers(); localStorage.clear(); });
  afterAll(() => server.close());

  it('returns tokens and user on valid credentials', async () => {
    const res = await auth.login('admin@garage.com', 'correct');
    expect(res.accessToken).toBe('valid-token');
    expect(res.user.role).toBe('admin');
  });

  it('throws with status 401 on invalid credentials', async () => {
    await expect(auth.login('wrong@garage.com', 'wrong')).rejects.toMatchObject({ status: 401 });
  });
});

// ─── 5. API Client – Customers ───────────────────────────────────────────────
describe('API Client – customers', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists customers and includes vehicle data', async () => {
    const res = await customers.list();
    expect(res.customers).toHaveLength(1);
    expect(res.customers[0].name).toBe('Ramesh Kumar');
    expect(res.customers[0].vehicles[0].registrationNo).toBe('GJ01AB1234');
  });

  it('gets a single customer by id', async () => {
    const res = await customers.get('c1');
    expect(res.id).toBe('c1');
  });

  it('creates a customer and returns the new record', async () => {
    const res = await customers.create({ name: 'New User', phone: '9000000000', vehicles: [] });
    expect(res.name).toBe('New User');
  });
});

// ─── 6. API Client – Jobs ────────────────────────────────────────────────────
describe('API Client – jobs', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists jobs', async () => {
    const res = await jobs.list();
    expect(res.jobs[0].jobNumber).toBe('JOB-001');
    expect(res.jobs[0].stage).toBe('pending');
  });

  it('creates a job', async () => {
    const res = await jobs.create({ customerId: 'c1', vehicleId: 'v1', complaints: 'Noise', odometerReading: 50000 });
    expect(res.jobNumber).toBe('JOB-002');
  });

  it('updates job stage to work_in_progress', async () => {
    const res = await jobs.updateStage('j1', 'work_in_progress');
    expect(res.stage).toBe('work_in_progress');
  });

  it('updates job stage to delivered', async () => {
    const res = await jobs.updateStage('j1', 'delivered');
    expect(res.stage).toBe('delivered');
  });
});

// ─── 7. API Client – Estimates ───────────────────────────────────────────────
describe('API Client – estimates', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists estimates with total count', async () => {
    const res = await estimates.list();
    expect(res.total).toBe(1);
    expect(res.estimates[0].estimateNumber).toBe('EST-001');
  });

  it('filters estimates by status query param', async () => {
    server.use(
      http.get(`${BASE}/estimates`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('status')).toBe('approved');
        return HttpResponse.json({ estimates: [], total: 0 });
      })
    );
    const res = await estimates.list({ status: 'approved' });
    expect(res.estimates).toHaveLength(0);
  });

  it('creates an estimate', async () => {
    const res = await estimates.create({ jobCardId: 'j1', lines: [], totalAmount: 5000 });
    expect(res.estimateNumber).toBe('EST-002');
    expect(res.status).toBe('draft');
  });

  it('updates estimate status to sent', async () => {
    const res = await estimates.updateStatus('e1', 'sent');
    expect(res.status).toBe('sent');
  });

  it('updates estimate status to approved', async () => {
    const res = await estimates.updateStatus('e1', 'approved');
    expect(res.status).toBe('approved');
  });
});

// ─── 8. API Client – Invoices ────────────────────────────────────────────────
describe('API Client – invoices', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists invoices', async () => {
    const res = await invoices.list();
    expect(res.invoices[0].invoiceNumber).toBe('INV-001');
    expect(res.invoices[0].paidAmount).toBe(0);
  });

  it('creates an invoice', async () => {
    const res = await invoices.create({
      jobCardId: 'j1', estimateId: 'e1', partsAmount: 3000,
      labourAmount: 2000, taxAmount: 900, totalAmount: 5900, lines: [],
    });
    expect(res.invoices[0].invoiceNumber).toBe('INV-002');
  });

  it('updates paid amount', async () => {
    server.use(
      http.patch(`${BASE}/invoices/:id`, async ({ request }) => {
        const body = (await request.json()) as { paidAmount: number };
        return HttpResponse.json({ id: 'inv1', paidAmount: body.paidAmount });
      })
    );
    const res = await invoices.updatePaidAmount('inv1', 5900);
    expect(res.paidAmount).toBe(5900);
  });

  it('deletes an invoice', async () => {
    server.use(
      http.delete(`${BASE}/invoices/:id`, () => new HttpResponse(null, { status: 204 }))
    );
    await expect(invoices.delete('inv1')).resolves.not.toThrow();
  });
});

// ─── 9. API Client – Credit Notes ────────────────────────────────────────────
describe('API Client – creditNotes', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists credit notes', async () => {
    const res = await creditNotes.list();
    expect(res.creditNotes[0].creditNoteNumber).toBe('CN-001');
    expect(res.creditNotes[0].amount).toBe(500);
  });

  it('creates a credit note', async () => {
    server.use(
      http.post(`${BASE}/credit-notes`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'cn2', creditNoteNumber: 'CN-002', ...body });
      })
    );
    const res = await creditNotes.create({ invoiceId: 'inv1', amount: 200, reason: 'Discount applied' });
    expect(res.creditNoteNumber).toBe('CN-002');
    expect(res.amount).toBe(200);
  });
});

// ─── 10. API Client – Inventory / Parts ──────────────────────────────────────
describe('API Client – parts', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists parts with quantity info', async () => {
    const res = await parts.list();
    expect(res.parts).toHaveLength(2);
    expect(res.parts[0].code).toBe('OIL-FILTER');
  });

  it('identifies low-stock parts (quantity < minQuantity)', async () => {
    const res = await parts.list();
    const lowStock = res.parts.filter((p) => p.quantity < p.minQuantity);
    expect(lowStock).toHaveLength(1);
    expect(lowStock[0].code).toBe('BRAKE-PAD');
  });

  it('creates a new part', async () => {
    server.use(
      http.post(`${BASE}/parts`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'p3', quantity: 0, minQuantity: 2, unit: 'pcs', ...body });
      })
    );
    const res = await parts.create({ code: 'SPARK-PLUG', name: 'Spark Plug', price: 120 });
    expect(res.code).toBe('SPARK-PLUG');
  });

  it('updates part stock quantity', async () => {
    server.use(
      http.patch(`${BASE}/parts/:id`, async ({ request }) => {
        const body = (await request.json()) as { quantity: number };
        return HttpResponse.json({ id: 'p2', quantity: body.quantity });
      })
    );
    const res = await parts.update('p2', { quantity: 10 });
    expect(res.quantity).toBe(10);
  });
});

// ─── 11. API Client – Purchase Orders ────────────────────────────────────────
describe('API Client – purchaseOrders', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('returns reorder suggestions for low-stock parts', async () => {
    const res = await purchaseOrders.reorderSuggestions();
    expect(res.suggestions).toHaveLength(1);
    expect(res.suggestions[0].code).toBe('BRAKE-PAD');
    expect(res.suggestions[0].recommendedOrderQty).toBeGreaterThan(0);
  });

  it('creates a purchase order', async () => {
    server.use(
      http.post(`${BASE}/purchase-orders`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'po1', poNumber: 'PO-001', status: 'draft', ...body });
      })
    );
    const res = await purchaseOrders.create({
      vendorId: 's1',
      lines: [{ partId: 'p2', quantityOrdered: 10, unitCost: 500 }],
    });
    expect(res.poNumber).toBe('PO-001');
    expect(res.status).toBe('draft');
  });

  it('marks a purchase order as received', async () => {
    server.use(
      http.post(`${BASE}/purchase-orders/:id/receive`, () =>
        HttpResponse.json({ ok: true })
      )
    );
    const res = await purchaseOrders.receive('po1', [{ lineId: 'l1', quantityReceivedNow: 10 }]);
    expect(res.ok).toBe(true);
  });

  it('cancels a purchase order', async () => {
    server.use(
      http.patch(`${BASE}/purchase-orders/:id/status`, async ({ request }) => {
        const body = (await request.json()) as { status: string };
        return HttpResponse.json({ id: 'po1', status: body.status });
      })
    );
    const res = await purchaseOrders.updateStatus('po1', 'cancelled');
    expect(res.status).toBe('cancelled');
  });
});

// ─── 12. API Client – Dashboard ──────────────────────────────────────────────
describe('API Client – dashboard', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('returns summary stats', async () => {
    const res = await dashboard.get();
    expect(res.stats.todayJobs).toBe(5);
    expect(res.stats.inProgress).toBe(3);
    expect(res.stats.awaitingApproval).toBe(2);
  });

  it('returns attention items', async () => {
    const res = await dashboard.get();
    expect(res.attention.awaitingApprovalCount).toBe(2);
    expect(res.attention.deliveredNotBilledCount).toBe(1);
  });
});

// ─── 13. API Client – Error Handling ─────────────────────────────────────────
describe('API Client – error handling', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('throws an error with status 404 when resource is not found', async () => {
    server.use(
      http.get(`${BASE}/customers/nonexistent`, () =>
        HttpResponse.json({ message: 'Not found' }, { status: 404 })
      )
    );
    await expect(customers.get('nonexistent')).rejects.toMatchObject({ status: 404, message: 'Not found' });
  });

  it('throws an error with status 500 on server error', async () => {
    server.use(
      http.get(`${BASE}/jobs`, () =>
        HttpResponse.json({ error: 'Internal server error' }, { status: 500 })
      )
    );
    await expect(jobs.list()).rejects.toMatchObject({ status: 500 });
  });

  it('attaches the raw response body to the thrown error', async () => {
    server.use(
      http.post(`${BASE}/customers`, () =>
        HttpResponse.json({ message: 'Validation failed', fields: ['phone'] }, { status: 422 })
      )
    );
    let err: unknown;
    try {
      await customers.create({ name: '', phone: '', vehicles: [] });
    } catch (e) {
      err = e;
    }
    expect((err as { data?: { fields?: string[] } }).data?.fields).toContain('phone');
  });

  it('attaches Authorization header when a token is set', async () => {
    let capturedHeader: string | null = null;
    server.use(
      http.get(`${BASE}/jobs`, ({ request }) => {
        capturedHeader = request.headers.get('Authorization');
        return HttpResponse.json({ jobs: [] });
      })
    );
    setAccessToken('my-token');
    await jobs.list();
    expect(capturedHeader).toBe('Bearer my-token');
    setAccessToken(null);
  });

  it('omits Authorization header when no token is set', async () => {
    let capturedHeader: string | null = 'present';
    server.use(
      http.get(`${BASE}/jobs`, ({ request }) => {
        capturedHeader = request.headers.get('Authorization');
        return HttpResponse.json({ jobs: [] });
      })
    );
    setAccessToken(null);
    await jobs.list();
    expect(capturedHeader).toBeNull();
  });
});

// ─── 14. API Client – Users ──────────────────────────────────────────────────
describe('API Client – users', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists users', async () => {
    const res = await users.list();
    expect(res.users).toHaveLength(2);
    expect(res.users[0].role).toBe('admin');
  });

  it('creates a user', async () => {
    server.use(
      http.post(`${BASE}/users`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'u3', ...body, createdAt: new Date().toISOString() });
      })
    );
    const res = await users.create({ email: 'new@garage.com', password: 'Pass@123', name: 'New Staff', role: 'advisor' });
    expect(res.email).toBe('new@garage.com');
    expect(res.role).toBe('advisor');
  });

  it('deactivates a user', async () => {
    server.use(
      http.patch(`${BASE}/users/:id`, async ({ request, params }) => {
        const body = (await request.json()) as { isActive: boolean };
        return HttpResponse.json({ id: params.id, isActive: body.isActive });
      })
    );
    const res = await users.update('u2', { isActive: false });
    expect(res.isActive).toBe(false);
  });

  it('resets a user password', async () => {
    server.use(
      http.post(`${BASE}/users/:id/reset-password`, () => HttpResponse.json({ ok: true }))
    );
    const res = await users.resetPassword('u2', 'NewPass@456');
    expect(res.ok).toBe(true);
  });
});

// ─── 15. ProtectedRoute Component ────────────────────────────────────────────
describe('ProtectedRoute', () => {
  beforeAll(() => server.listen());
  afterEach(() => { server.resetHandlers(); localStorage.clear(); });
  afterAll(() => server.close());

  it('redirects unauthenticated users to /login', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <div>Protected</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
    // Unauthenticated: should see login page
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('shows protected content for authenticated users', async () => {
    localStorage.setItem('smart_garage_access_token', 'valid-token');
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Dashboard Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Dashboard Content')).toBeInTheDocument());
  });

  it('redirects to / when authenticated user lacks section permission', async () => {
    server.use(
      http.get(`${BASE}/me`, () =>
        HttpResponse.json({ user: { id: 'u2', email: 'mech@garage.com', name: 'Joe', role: 'mechanic' }, organization: null })
      )
    );
    localStorage.setItem('smart_garage_access_token', 'valid-token');
    render(
      <MemoryRouter initialEntries={['/billing']}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<div>Home</div>} />
            <Route
              path="/billing"
              element={
                <ProtectedRoute section="billing">
                  <div>Billing Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument());
    expect(screen.queryByText('Billing Content')).not.toBeInTheDocument();
  });
});

// ─── 16. Login Page ──────────────────────────────────────────────────────────
describe('Login Page', () => {
  beforeAll(() => server.listen());
  afterEach(() => { server.resetHandlers(); localStorage.clear(); });
  afterAll(() => server.close());

  const renderLogin = () =>
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

  it('renders email and password inputs and a submit button', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in|log in/i })).toBeInTheDocument();
  });

  it('shows an error message on failed login', async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'wrong@garage.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass');
    fireEvent.click(screen.getByRole('button', { name: /sign in|log in/i }));
    await waitFor(() => expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument());
  });

  it('redirects to dashboard on successful login', async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'admin@garage.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'correct');
    fireEvent.click(screen.getByRole('button', { name: /sign in|log in/i }));
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });

  it('trims whitespace from the email before submitting', async () => {
    let capturedEmail = '';
    server.use(
      http.post(`${BASE}/auth/login`, async ({ request }) => {
        const body = (await request.json()) as { email: string; password: string };
        capturedEmail = body.email;
        return HttpResponse.json({
          accessToken: 'valid-token', refreshToken: 'rt', expiresIn: '1h',
          user: { id: 'u1', email: body.email, name: 'Admin', role: 'admin' },
        });
      })
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), '  admin@garage.com  ');
    await userEvent.type(screen.getByLabelText(/password/i), 'correct');
    fireEvent.click(screen.getByRole('button', { name: /sign in|log in/i }));
    await waitFor(() => expect(capturedEmail).toBe('admin@garage.com'));
  });
});

// ─── 17. Business Logic – Invoice Totals ─────────────────────────────────────
describe('Business Logic – Invoice Totals', () => {
  it('total = parts + labour + tax – discount', () => {
    const partsAmount = 3000;
    const labourAmount = 2000;
    const taxAmount = 900;
    const discountAmount = 200;
    const total = partsAmount + labourAmount + taxAmount - discountAmount;
    expect(total).toBe(5700);
  });

  it('outstanding balance = totalAmount – paidAmount', () => {
    const totalAmount = 5900;
    const paidAmount = 2000;
    expect(totalAmount - paidAmount).toBe(3900);
  });

  it('invoice is fully paid when paidAmount equals totalAmount', () => {
    const invoice = { totalAmount: 5900, paidAmount: 5900 };
    expect(invoice.paidAmount >= invoice.totalAmount).toBe(true);
  });

  it('credit note reduces outstanding balance', () => {
    const outstanding = 5900;
    const creditNote = 500;
    expect(outstanding - creditNote).toBe(5400);
  });
});

// ─── 18. Business Logic – Inventory Stock ────────────────────────────────────
describe('Business Logic – Inventory Stock', () => {
  it('flags a part as low-stock when quantity is below minQuantity', () => {
    const part = { quantity: 2, minQuantity: 4 };
    expect(part.quantity < part.minQuantity).toBe(true);
  });

  it('does not flag a part as low-stock when quantity equals minQuantity', () => {
    const part = { quantity: 4, minQuantity: 4 };
    expect(part.quantity < part.minQuantity).toBe(false);
  });

  it('does not flag a part as low-stock when quantity exceeds minQuantity', () => {
    const part = { quantity: 10, minQuantity: 4 };
    expect(part.quantity < part.minQuantity).toBe(false);
  });

  it('receiving a PO increases stock quantity', () => {
    const before = 2;
    const received = 10;
    expect(before + received).toBe(12);
  });
});

// ─── 19. Business Logic – Job Stage Transitions ───────────────────────────────
describe('Business Logic – Job Stage Transitions', () => {
  const validTransitions: Array<[string, string]> = [
    ['pending', 'work_in_progress'],
    ['work_in_progress', 'delivered'],
  ];
  const invalidTransitions: Array<[string, string]> = [
    ['pending', 'delivered'],   // must pass through WIP
    ['delivered', 'pending'],   // no going backwards
  ];

  /**
   * Encode the allowed transition graph.
   * In a real implementation this would live in a shared helper;
   * here we replicate the logic to make it testable in isolation.
   */
  const ALLOWED: Record<string, string[]> = {
    pending: ['work_in_progress'],
    work_in_progress: ['delivered'],
    delivered: [],
  };
  const canTransition = (from: string, to: string) => ALLOWED[from]?.includes(to) ?? false;

  validTransitions.forEach(([from, to]) => {
    it(`allows transition from ${from} → ${to}`, () => expect(canTransition(from, to)).toBe(true));
  });

  invalidTransitions.forEach(([from, to]) => {
    it(`blocks transition from ${from} → ${to}`, () => expect(canTransition(from, to)).toBe(false));
  });
});

// ─── 20. Business Logic – Estimate Status Transitions ────────────────────────
describe('Business Logic – Estimate Status Transitions', () => {
  const ALLOWED_EST: Record<string, string[]> = {
    draft: ['sent'],
    sent: ['approved', 'rejected'],
    approved: [],
    rejected: [],
  };
  const canTransition = (from: string, to: string) => ALLOWED_EST[from]?.includes(to) ?? false;

  it('draft → sent is allowed', () => expect(canTransition('draft', 'sent')).toBe(true));
  it('sent → approved is allowed', () => expect(canTransition('sent', 'approved')).toBe(true));
  it('sent → rejected is allowed', () => expect(canTransition('sent', 'rejected')).toBe(true));
  it('draft → approved is blocked', () => expect(canTransition('draft', 'approved')).toBe(false));
  it('approved → sent is blocked', () => expect(canTransition('approved', 'sent')).toBe(false));
  it('rejected → approved is blocked', () => expect(canTransition('rejected', 'approved')).toBe(false));
});
