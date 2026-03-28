import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * Public estimate view by ID (for customer links).
 * GET /estimates/public/:id
 */
router.get('/public/:id', async (req: Request, res: Response): Promise<void> => {
  const estimate = await prisma.estimate.findUnique({
    where: { id: req.params.id },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      jobCard: {
        include: {
          customer: { select: { name: true, phone: true } },
          vehicle: { select: { registrationNo: true, make: true, model: true } },
        },
      },
    },
  });

  if (!estimate || estimate.jobCard.deletedAt) {
    res.status(404).json({ error: 'Not found', message: 'Estimate not found.' });
    return;
  }

  res.json({
    id: estimate.id,
    estimateNumber: estimate.estimateNumber,
    status: estimate.status,
    totalAmount: Number(estimate.totalAmount),
    validUntil: estimate.validUntil?.toISOString().split('T')[0],
    sentAt: estimate.sentAt?.toISOString(),
    approvedAt: estimate.approvedAt?.toISOString(),
    rejectedAt: estimate.rejectedAt?.toISOString(),
    createdAt: estimate.createdAt.toISOString(),
    customer: {
      name: estimate.jobCard.customer.name,
      phone: estimate.jobCard.customer.phone,
    },
    vehicle: {
      registrationNo: estimate.jobCard.vehicle.registrationNo,
      make: estimate.jobCard.vehicle.make,
      model: estimate.jobCard.vehicle.model,
    },
    lines: estimate.lines.map((l) => ({
      id: l.id,
      description: l.description,
      type: l.type,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
    })),
  });
});

/**
 * Public approve endpoint for estimate links.
 * POST /estimates/public/:id/approve
 */
router.post('/public/:id/approve', async (req: Request, res: Response): Promise<void> => {
  const estimate = await prisma.estimate.findUnique({
    where: { id: req.params.id },
    include: { jobCard: { select: { deletedAt: true } } },
  });

  if (!estimate || estimate.jobCard.deletedAt) {
    res.status(404).json({ error: 'Not found', message: 'Estimate not found.' });
    return;
  }

  if (estimate.status === 'approved') {
    res.json({ ok: true, status: 'approved' });
    return;
  }

  if (estimate.validUntil && new Date(estimate.validUntil) < new Date()) {
    res.status(400).json({ error: 'Validation failed', message: 'Estimate has expired.' });
    return;
  }

  const now = new Date();
  const updated = await prisma.estimate.update({
    where: { id: estimate.id },
    data: { status: 'approved', approvedAt: now, rejectedAt: null },
    select: { id: true, status: true, approvedAt: true },
  });

  res.json({
    ok: true,
    id: updated.id,
    status: updated.status,
    approvedAt: updated.approvedAt?.toISOString(),
  });
});

router.use(requireAuth);

const estimateLineBody = z.object({
  description: z.string().min(1).max(2000),
  type: z.enum(['part', 'labour']),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  amount: z.number().min(0),
  insurancePayableMode: z.enum(['percent', 'rupees']).optional(),
  insurancePayableValue: z.number().min(0).optional(),
});

const createBody = z.object({
  jobCardId: z.string().uuid(),
  lines: z.array(estimateLineBody).min(1).max(200),
  totalAmount: z.number().min(0),
  validUntil: z.string().optional(), // ISO date YYYY-MM-DD
});

const updateStatusBody = z.object({
  status: z.enum(['draft', 'sent', 'approved', 'rejected']),
});

const addRevisionBody = z.object({
  lines: z.array(estimateLineBody).min(1).max(200),
  totalAmount: z.number().min(0),
  note: z.string().max(1000).optional(),
});

async function getNextEstimateNumber(organizationId: string | null): Promise<string> {
  const year = new Date().getFullYear();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.sequence.findFirst({
      where: {
        organizationId: organizationId ?? null,
        name: 'estimate_number',
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
          name: 'estimate_number',
          year,
          value: 1,
        },
      });
      num = created.value;
    }
    return `EST-${year}-${String(num).padStart(4, '0')}`;
  });
}

function defaultValidUntil(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** POST /estimates – create estimate for a job */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { id: string; organizationId: string | null } }).user;
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { jobCardId, lines, totalAmount, validUntil } = parsed.data;

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

  const existing = await prisma.estimate.findFirst({
    where: { jobCardId },
  });
  if (existing) {
    res.status(409).json({ error: 'Conflict', message: 'An estimate already exists for this job.' });
    return;
  }

  const estimateNumber = await getNextEstimateNumber(user.organizationId);
  const validUntilDate = validUntil
    ? new Date(validUntil + 'T00:00:00.000Z')
    : defaultValidUntil();

  const estimate = await prisma.$transaction(async (tx) => {
    const est = await tx.estimate.create({
      data: {
        jobCardId,
        estimateNumber,
        status: 'draft',
        totalAmount,
        validUntil: validUntilDate,
        lines: {
          create: lines.map((l, i) => ({
            sortOrder: i,
            description: l.description,
            type: l.type,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            amount: l.amount,
            insurancePayableMode: l.insurancePayableMode ?? undefined,
            insurancePayableValue: l.insurancePayableValue ?? undefined,
          })),
        },
      },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
      },
    });
    return est;
  });

  res.status(201).json({
    id: estimate.id,
    estimateNumber: estimate.estimateNumber,
    jobCardId: estimate.jobCardId,
    status: estimate.status,
    totalAmount: Number(estimate.totalAmount),
    validUntil: estimate.validUntil?.toISOString().split('T')[0],
    lines: estimate.lines.map((l) => ({
      id: l.id,
      description: l.description,
      type: l.type,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
      insurancePayableMode: l.insurancePayableMode ?? undefined,
      insurancePayableValue: l.insurancePayableValue != null ? Number(l.insurancePayableValue) : undefined,
    })),
    revisions: [],
    createdAt: estimate.createdAt.toISOString(),
    updatedAt: estimate.updatedAt.toISOString(),
  });
});

/** GET /estimates – list all estimates or get by jobCardId */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const jobCardId = req.query.jobCardId as string | undefined;
  const status = req.query.status as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  // If jobCardId is provided, return single estimate for backward compatibility
  if (jobCardId) {
    const estimate = await prisma.estimate.findFirst({
      where: {
        jobCardId,
        jobCard: {
          deletedAt: null,
          ...(user.organizationId ? { organizationId: user.organizationId } : {}),
        },
      },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        revisions: { orderBy: { version: 'asc' } },
      },
    });

    if (!estimate) {
      res.status(404).json({ error: 'Not found', message: 'No estimate for this job.' });
      return;
    }

    res.json({
      id: estimate.id,
      estimateNumber: estimate.estimateNumber,
      jobCardId: estimate.jobCardId,
      status: estimate.status,
      totalAmount: Number(estimate.totalAmount),
      validUntil: estimate.validUntil?.toISOString().split('T')[0],
      sentAt: estimate.sentAt?.toISOString(),
      approvedAt: estimate.approvedAt?.toISOString(),
      rejectedAt: estimate.rejectedAt?.toISOString(),
      lines: estimate.lines.map((l) => ({
        id: l.id,
        description: l.description,
        type: l.type,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        amount: Number(l.amount),
        insurancePayableMode: l.insurancePayableMode ?? undefined,
        insurancePayableValue: l.insurancePayableValue != null ? Number(l.insurancePayableValue) : undefined,
      })),
      revisions: estimate.revisions.map((r) => ({
        id: r.id,
        estimateId: r.estimateId,
        version: r.version,
        totalAmount: Number(r.totalAmount),
        note: r.note ?? undefined,
        createdAt: r.createdAt.toISOString(),
        lines: (r.linesSnapshot as Array<{ description: string; type: string; quantity: number; unitPrice: number; amount: number }>) ?? [],
      })),
      createdAt: estimate.createdAt.toISOString(),
      updatedAt: estimate.updatedAt.toISOString(),
    });
    return;
  }

  // Build where clause for listing estimates
  const where: { jobCard: { deletedAt: null; organizationId?: string | null }; status?: string } = {
    jobCard: {
      deletedAt: null,
      ...(user.organizationId ? { organizationId: user.organizationId } : {}),
    },
  };

  if (status) {
    where.status = status;
  }

  const [estimates, total] = await Promise.all([
    prisma.estimate.findMany({
      where,
      include: {
        jobCard: {
          select: {
            id: true,
            jobNumber: true,
            customerId: true,
          },
        },
        lines: { select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.estimate.count({ where }),
  ]);

  res.json({
    data: estimates.map((est) => ({
      id: est.id,
      estimateNumber: est.estimateNumber,
      jobCardId: est.jobCardId,
      jobNumber: est.jobCard.jobNumber,
      status: est.status,
      totalAmount: Number(est.totalAmount),
      validUntil: est.validUntil?.toISOString().split('T')[0],
      lineCount: est.lines.length,
      createdAt: est.createdAt.toISOString(),
      updatedAt: est.updatedAt.toISOString(),
    })),
    pagination: {
      limit,
      offset,
      total,
    },
  });
});

/** PATCH /estimates/:id – update estimate status (sent, approved, rejected) */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const id = req.params.id;
  const parsed = updateStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { status } = parsed.data;

  const estimate = await prisma.estimate.findFirst({
    where: {
      id,
      jobCard: {
        deletedAt: null,
        ...(user.organizationId ? { organizationId: user.organizationId } : {}),
      },
    },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      revisions: { orderBy: { version: 'asc' } },
    },
  });

  if (!estimate) {
    res.status(404).json({ error: 'Not found', message: 'Estimate not found.' });
    return;
  }

  const now = new Date();
  const data: { status: string; sentAt?: Date | null; approvedAt?: Date | null; rejectedAt?: Date | null } = { status };
  if (status === 'sent') {
    data.sentAt = now;
    data.approvedAt = null;
    data.rejectedAt = null;
  }
  if (status === 'approved') {
    data.approvedAt = now;
    data.rejectedAt = null;
  }
  if (status === 'rejected') data.rejectedAt = now;

  const updated = await prisma.estimate.update({
    where: { id },
    data,
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      revisions: { orderBy: { version: 'asc' } },
    },
  });

  res.json({
    id: updated.id,
    estimateNumber: updated.estimateNumber,
    jobCardId: updated.jobCardId,
    status: updated.status,
    totalAmount: Number(updated.totalAmount),
    validUntil: updated.validUntil?.toISOString().split('T')[0],
    sentAt: updated.sentAt?.toISOString(),
    approvedAt: updated.approvedAt?.toISOString(),
    rejectedAt: updated.rejectedAt?.toISOString(),
    lines: updated.lines.map((l) => ({
      id: l.id,
      description: l.description,
      type: l.type,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
      insurancePayableMode: l.insurancePayableMode ?? undefined,
      insurancePayableValue: l.insurancePayableValue != null ? Number(l.insurancePayableValue) : undefined,
    })),
    revisions: updated.revisions.map((r) => ({
      id: r.id,
      estimateId: r.estimateId,
      version: r.version,
      totalAmount: Number(r.totalAmount),
      note: r.note ?? undefined,
      createdAt: r.createdAt.toISOString(),
      lines: (r.linesSnapshot as Array<{ description: string; type: string; quantity: number; unitPrice: number; amount: number }>) ?? [],
    })),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

/** POST /estimates/:id/revisions – add a revision (version history) */
router.post('/:id/revisions', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const id = req.params.id;
  const parsed = addRevisionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { lines, totalAmount, note } = parsed.data;

  const estimate = await prisma.estimate.findFirst({
    where: {
      id,
      jobCard: {
        deletedAt: null,
        ...(user.organizationId ? { organizationId: user.organizationId } : {}),
      },
    },
    include: { revisions: true },
  });

  if (!estimate) {
    res.status(404).json({ error: 'Not found', message: 'Estimate not found.' });
    return;
  }

  const version = (estimate.revisions?.length ?? 0) + 1;
  const linesSnapshot = lines.map((l) => ({
    description: l.description,
    type: l.type,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    amount: l.amount,
  }));

  await prisma.$transaction(async (tx) => {
    await tx.estimateRevision.create({
      data: {
        estimateId: id,
        version,
        totalAmount,
        note: note ?? null,
        linesSnapshot: linesSnapshot as Prisma.InputJsonValue,
      },
    });
    // Update the estimate's current lines and total to the latest revision
    await tx.estimateLine.deleteMany({ where: { estimateId: id } });
    await tx.estimate.update({
      where: { id },
      data: {
        totalAmount,
        lines: {
          create: lines.map((l, i) => ({
            sortOrder: i,
            description: l.description,
            type: l.type,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            amount: l.amount,
            insurancePayableMode: l.insurancePayableMode ?? undefined,
            insurancePayableValue: l.insurancePayableValue ?? undefined,
          })),
        },
      },
    });
  });

  const updated = await prisma.estimate.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      revisions: { orderBy: { version: 'asc' } },
    },
  });

  if (!updated) {
    res.status(500).json({ error: 'Failed to load estimate after revision' });
    return;
  }

  res.status(201).json({
    id: updated.id,
    estimateNumber: updated.estimateNumber,
    jobCardId: updated.jobCardId,
    status: updated.status,
    totalAmount: Number(updated.totalAmount),
    validUntil: updated.validUntil?.toISOString().split('T')[0],
    sentAt: updated.sentAt?.toISOString(),
    approvedAt: updated.approvedAt?.toISOString(),
    rejectedAt: updated.rejectedAt?.toISOString(),
    lines: updated.lines.map((l) => ({
      id: l.id,
      description: l.description,
      type: l.type,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
      insurancePayableMode: l.insurancePayableMode ?? undefined,
      insurancePayableValue: l.insurancePayableValue != null ? Number(l.insurancePayableValue) : undefined,
    })),
    revisions: updated.revisions.map((r) => ({
      id: r.id,
      estimateId: r.estimateId,
      version: r.version,
      totalAmount: Number(r.totalAmount),
      note: r.note ?? undefined,
      createdAt: r.createdAt.toISOString(),
      lines: (r.linesSnapshot as Array<{ description: string; type: string; quantity: number; unitPrice: number; amount: number }>) ?? [],
    })),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

export default router;
