import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import customerRoutes from './routes/customers.js';
import jobRoutes from './routes/jobs.js';
import organizationRoutes from './routes/organizations.js';
import userRoutes from './routes/users.js';
import serviceItemRoutes from './routes/serviceItems.js';
import insuranceRoutes from './routes/insurance.js';
import estimateRoutes from './routes/estimates.js';
import invoiceRoutes from './routes/invoices.js';
import dashboardRoutes from './routes/dashboard.js';
import creditNoteRoutes from './routes/creditNotes.js';
import supplierRoutes from './routes/suppliers.js';
import partRoutes from './routes/parts.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import vehicleMakeRoutes from './routes/vehicleMakes.js';

const app = express();
const PORT = process.env.PORT ?? 3000;

/** Comma-separated frontend origins (e.g. https://app.onrender.com). If unset, reflect request Origin. */
function corsOriginOption(): boolean | string[] {
  const raw = process.env.CORS_ORIGINS;
  if (!raw?.trim()) return true;
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : true;
}

app.use(
  cors({
    origin: corsOriginOption(),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/me', meRoutes);
app.use('/customers', customerRoutes);
app.use('/jobs', jobRoutes);
app.use('/organizations', organizationRoutes);
app.use('/users', userRoutes);
app.use('/service-items', serviceItemRoutes);
app.use('/insurance-companies', insuranceRoutes);
app.use('/estimates', estimateRoutes);
app.use('/invoices', invoiceRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/credit-notes', creditNoteRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/parts', partRoutes);
app.use('/purchase-orders', purchaseOrderRoutes);
app.use('/vehicle-makes', vehicleMakeRoutes);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
