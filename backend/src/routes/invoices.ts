import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const invoiceLineBody = z.object({
  description: z.string().min(1).max(2000),
  type: z.enum(['part', 'labour']),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  amount: z.number().min(0),
});

const createBody = z.object({
  jobCardId: z.string().uuid(),
  estimateId: z.string().uuid(),
  format: z.enum(['proforma', 'tax']).optional().default('tax'),
  partsAmount: z.number().min(0),
  labourAmount: z.number().min(0),
  taxAmount: z.number().min(0),
  discountAmount: z.number().min(0).optional().default(0),
  totalAmount: z.number().min(0),
  lines: z.array(invoiceLineBody).min(1).max(200),
});

const recordPaymentBody = z.object({
  paidAmount: z.number().min(0),
});

async function getNextInvoiceNumber(organizationId: string | null): Promise<string> {
  const year = new Date().getFullYear();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.sequence.findFirst({
      where: {
        organizationId: organizationId ?? null,
        name: 'invoice_number',
        year,
      },
    });
    let num: number;
    if (existing) {
      const updated = await tx.sequence.update({
        where: { id: existing.id },
        data: { value: { increment: 1 } },
      });
      num = updated.value;
    } else {
      const created = await tx.sequence.create({
        data: {
          organizationId: organizationId ?? undefined,
          name: 'invoice_number',
          year,
          value: 1,
        },
      });
      num = created.value;
    }
    return `INV-${year}-${String(num).padStart(4, '0')}`;
  });
}

function toNum(v: unknown): number {
  if (typeof v === 'number' && !isNaN(v)) return v;
  if (v != null && typeof (v as { toNumber?: () => number }).toNumber === 'function') return (v as { toNumber: () => number }).toNumber();
  return Number(v);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mapInvoiceToDto(inv: {
  id: string;
  jobCardId: string;
  estimateId: string | null;
  billToType: string | null;
  invoiceNumber: string;
  format: string | null;
  partsAmount: unknown;
  labourAmount: unknown;
  taxAmount: unknown;
  discountAmount: unknown;
  totalAmount: unknown;
  paidAmount: unknown;
  pdfUrl: string | null;
  createdAt: Date;
  lines: Array<{ id: string; description: string; type: string; quantity: unknown; unitPrice: unknown; amount: unknown }>;
}) {
  return {
    id: inv.id,
    jobCardId: inv.jobCardId,
    estimateId: inv.estimateId ?? undefined,
    billToType: (inv.billToType ?? 'customer') as 'customer' | 'insurance',
    invoiceNumber: inv.invoiceNumber,
    format: inv.format ?? 'tax',
    partsAmount: toNum(inv.partsAmount),
    labourAmount: toNum(inv.labourAmount),
    taxAmount: toNum(inv.taxAmount),
    discountAmount: toNum(inv.discountAmount),
    totalAmount: toNum(inv.totalAmount),
    paidAmount: toNum(inv.paidAmount),
    pdfUrl: inv.pdfUrl ?? undefined,
    createdAt: inv.createdAt.toISOString(),
    lines: inv.lines.map((l) => ({
      id: l.id,
      description: l.description,
      type: l.type,
      quantity: toNum(l.quantity),
      unitPrice: toNum(l.unitPrice),
      amount: toNum(l.amount),
    })),
  };
}

/** POST /invoices – create invoice from approved estimate */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { id: string; organizationId: string | null } }).user;
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const {
    jobCardId,
    estimateId,
    format,
    partsAmount,
    labourAmount,
    taxAmount,
    discountAmount,
    totalAmount,
    lines,
  } = parsed.data;

  const job = await prisma.jobCard.findFirst({
    where: {
      id: jobCardId,
      deletedAt: null,
      ...(user.organizationId ? { organizationId: user.organizationId } : {}),
    },
  });
  if (!job) {
    res.status(404).json({ error: 'Not found', message: 'Job card not found.' });
    return;
  }

  const estimate = await prisma.estimate.findFirst({
    where: {
      id: estimateId,
      jobCardId,
      status: 'approved',
      jobCard: {
        deletedAt: null,
        ...(user.organizationId ? { organizationId: user.organizationId } : {}),
      },
    },
  });
  if (!estimate) {
    res.status(400).json({ error: 'Bad request', message: 'Estimate not found or not approved for this job.' });
    return;
  }

  const existingInvoices = await prisma.invoice.findMany({
    where: { jobCardId },
  });
  if (existingInvoices.length > 0) {
    res.status(409).json({ error: 'Conflict', message: 'Invoice(s) already exist for this job.' });
    return;
  }

  const jobWithInsurance = await prisma.jobCard.findFirst({
    where: {
      id: jobCardId,
      deletedAt: null,
      ...(user.organizationId ? { organizationId: user.organizationId } : {}),
    },
    include: { insuranceCompany: true },
  });
  const estimateWithLines = await prisma.estimate.findFirst({
    where: {
      id: estimateId,
      jobCardId,
      status: 'approved',
    },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
    },
  });

  const hasInsuranceSplit =
    !!jobWithInsurance?.insuranceCompanyId &&
    !!estimateWithLines?.lines.some((l) => {
      if (!l.insurancePayableMode) return false;
      const value = toNum(l.insurancePayableValue);
      return !isNaN(value) && value > 0;
    });

  if (hasInsuranceSplit && jobWithInsurance && estimateWithLines) {
    let insuranceParts = 0,
      insuranceLabour = 0,
      customerParts = 0,
      customerLabour = 0;
    const insuranceInvoiceLines: Array<{
      sortOrder: number;
      description: string;
      type: 'part' | 'labour';
      quantity: number;
      unitPrice: number;
      amount: number;
    }> = [];
    const customerInvoiceLines: Array<{
      sortOrder: number;
      description: string;
      type: 'part' | 'labour';
      quantity: number;
      unitPrice: number;
      amount: number;
    }> = [];
    for (const line of estimateWithLines.lines) {
      const amount = toNum(line.amount);
      const quantity = toNum(line.quantity);
      const unitPrice = toNum(line.unitPrice);
      const lineSubtotal = round2(quantity * unitPrice);
      let splitRatio = 0;
      if (line.insurancePayableMode === 'percent' && line.insurancePayableValue != null) {
        splitRatio = Math.min(1, Math.max(0, toNum(line.insurancePayableValue) / 100));
      } else if (line.insurancePayableMode === 'rupees' && line.insurancePayableValue != null) {
        const insuranceRupees = Math.min(lineSubtotal, Math.max(0, toNum(line.insurancePayableValue)));
        splitRatio = lineSubtotal > 0 ? insuranceRupees / lineSubtotal : 0;
      }
      // IMPORTANT:
      // invoice "lines.amount" should be the pre-tax share (subtotal share).
      // Tax for each party is computed separately below using the total pre-tax ratio.
      const insuranceShare = round2(lineSubtotal * splitRatio);
      const customerShare = round2(lineSubtotal - insuranceShare);
      const insuranceUnitPrice = round2(unitPrice * splitRatio);
      const customerUnitPrice = round2(unitPrice - insuranceUnitPrice);
      if (line.type === 'part') {
        insuranceParts += insuranceShare;
        customerParts += customerShare;
      } else {
        insuranceLabour += insuranceShare;
        customerLabour += customerShare;
      }
      if (insuranceShare > 0) {
        insuranceInvoiceLines.push({
          sortOrder: insuranceInvoiceLines.length,
          description: line.description,
          type: line.type as 'part' | 'labour',
          quantity,
          unitPrice: insuranceUnitPrice,
          amount: insuranceShare,
        });
      }
      if (customerShare > 0) {
        customerInvoiceLines.push({
          sortOrder: customerInvoiceLines.length,
          description: line.description,
          type: line.type as 'part' | 'labour',
          quantity,
          unitPrice: customerUnitPrice,
          amount: customerShare,
        });
      }
    }
    const totalInsurance = insuranceParts + insuranceLabour;
    const totalCustomer = customerParts + customerLabour;
    const subtotal = totalInsurance + totalCustomer;
    const ratio = subtotal > 0 ? totalInsurance / subtotal : 0.5;
    const insuranceTax = taxAmount * ratio;
    const customerTax = taxAmount * (1 - ratio);
    const insuranceDiscount = (discountAmount ?? 0) * ratio;
    const customerDiscount = (discountAmount ?? 0) * (1 - ratio);
    const insuranceTotal = totalInsurance + insuranceTax - insuranceDiscount;
    const customerTotal = totalCustomer + customerTax - customerDiscount;

    const invNum1 = await getNextInvoiceNumber(user.organizationId);
    const invNum2 = await getNextInvoiceNumber(user.organizationId);

    const created = await prisma.$transaction(async (tx) => {
      const invCustomer = await tx.invoice.create({
        data: {
          jobCardId,
          estimateId,
          billToType: 'customer',
          invoiceNumber: invNum1,
          format,
          partsAmount: customerParts,
          labourAmount: customerLabour,
          taxAmount: customerTax,
          discountAmount: customerDiscount,
          totalAmount: customerTotal,
          paidAmount: 0,
          lines: {
            create: customerInvoiceLines.length > 0
              ? customerInvoiceLines
              : [{
                sortOrder: 0,
                description: 'Customer payable',
                type: 'labour',
                quantity: 1,
                // Pre-tax fallback line (tax is in invoice.taxAmount)
                unitPrice: totalCustomer,
                amount: totalCustomer,
              }],
          },
        },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
      const invInsurance = await tx.invoice.create({
        data: {
          jobCardId,
          estimateId,
          billToType: 'insurance',
          invoiceNumber: invNum2,
          format,
          partsAmount: insuranceParts,
          labourAmount: insuranceLabour,
          taxAmount: insuranceTax,
          discountAmount: insuranceDiscount,
          totalAmount: insuranceTotal,
          paidAmount: 0,
          lines: {
            create: insuranceInvoiceLines.length > 0
              ? insuranceInvoiceLines
              : [{
                sortOrder: 0,
                description: 'Insurance claim',
                type: 'labour',
                quantity: 1,
                // Pre-tax fallback line (tax is in invoice.taxAmount)
                unitPrice: totalInsurance,
                amount: totalInsurance,
              }],
          },
        },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
      return [invCustomer, invInsurance] as const;
    });

    res.status(201).json({
      invoices: [mapInvoiceToDto(created[0]), mapInvoiceToDto(created[1])],
    });
    return;
  }

  const invoiceNumber = await getNextInvoiceNumber(user.organizationId);

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        jobCardId,
        estimateId,
        billToType: 'customer',
        invoiceNumber,
        format,
        partsAmount,
        labourAmount,
        taxAmount,
        discountAmount: discountAmount ?? 0,
        totalAmount,
        paidAmount: 0,
        lines: {
          create: lines.map((l, i) => ({
            sortOrder: i,
            description: l.description,
            type: l.type,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            amount: l.amount,
          })),
        },
      },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
      },
    });
    return inv;
  });

  res.status(201).json({ invoices: [mapInvoiceToDto(invoice)] });
});

/** GET /invoices – list all invoices, or GET /invoices?jobCardId= – get single by job */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const jobCardId = req.query.jobCardId as string | undefined;

  if (jobCardId) {
    const invoices = await prisma.invoice.findMany({
      where: {
        jobCardId,
        jobCard: {
          deletedAt: null,
          ...(user.organizationId ? { organizationId: user.organizationId } : {}),
        },
      },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ invoices: invoices.map(mapInvoiceToDto) });
    return;
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      jobCard: {
        deletedAt: null,
        ...(user.organizationId ? { organizationId: user.organizationId } : {}),
      },
    },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      jobCard: { select: { jobNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    invoices: invoices.map((inv) => ({
      ...mapInvoiceToDto(inv),
      jobNumber: inv.jobCard?.jobNumber ?? undefined,
    })),
  });
});

/** PATCH /invoices/:id – update paid amount (record payment) */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const id = req.params.id;
  const parsed = recordPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { paidAmount } = parsed.data;

  const invoice = await prisma.invoice.findFirst({
    where: {
      id,
      jobCard: {
        deletedAt: null,
        ...(user.organizationId ? { organizationId: user.organizationId } : {}),
      },
    },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!invoice) {
    res.status(404).json({ error: 'Not found', message: 'Invoice not found.' });
    return;
  }

  const totalAmount = Number(invoice.totalAmount);
  if (paidAmount > totalAmount) {
    res.status(400).json({ error: 'Bad request', message: 'Paid amount cannot exceed total amount.' });
    return;
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { paidAmount },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
    },
  });

  res.json(mapInvoiceToDto(updated));
});

/** DELETE /invoices/:id – delete invoice and go back to estimate (only when no credit notes) */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const id = req.params.id;

  const invoice = await prisma.invoice.findFirst({
    where: {
      id,
      jobCard: {
        deletedAt: null,
        ...(user.organizationId ? { organizationId: user.organizationId } : {}),
      },
    },
    include: {
      _count: { select: { creditNotes: true } },
    },
  });

  if (!invoice) {
    res.status(404).json({ error: 'Not found', message: 'Invoice not found.' });
    return;
  }

  if (invoice._count.creditNotes > 0) {
    res.status(400).json({ error: 'Bad request', message: 'Cannot delete invoice that has credit notes.' });
    return;
  }

  await prisma.invoice.delete({ where: { id } });
  res.status(204).send();
});

export default router;
