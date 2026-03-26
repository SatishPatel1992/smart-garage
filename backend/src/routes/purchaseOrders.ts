import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

async function getNextPoNumber(organizationId: string | null): Promise<string> {
  const year = new Date().getFullYear();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.sequence.findFirst({
      where: { organizationId: organizationId ?? null, name: 'purchase_order_number', year },
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
          name: 'purchase_order_number',
          year,
          value: 1,
        },
      });
      num = created.value;
    }
    return `PO-${year}-${String(num).padStart(3, '0')}`;
  });
}

const createBody = z.object({
  vendorId: z.string().uuid(),
  expectedDate: z.string().optional(),
  notes: z.string().max(5000).optional(),
  lines: z.array(z.object({
    partId: z.string().uuid(),
    quantityOrdered: z.number().positive(),
    unitCost: z.number().min(0),
    taxRatePercent: z.number().min(0).max(100).optional(),
  })).min(1),
});

const statusBody = z.object({
  status: z.enum(['draft', 'sent', 'partially_received', 'received', 'cancelled']),
});

const receiveBody = z.object({
  lines: z.array(z.object({
    lineId: z.string().uuid(),
    quantityReceivedNow: z.number().positive(),
  })).min(1),
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { organizationId: user.organizationId ?? undefined },
    include: {
      vendor: true,
      lines: { include: { part: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    purchaseOrders: purchaseOrders.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      vendorId: po.vendorId,
      vendorName: po.vendor.name,
      status: po.status,
      expectedDate: po.expectedDate ? po.expectedDate.toISOString().slice(0, 10) : null,
      notes: po.notes,
      subtotalAmount: Number(po.subtotalAmount),
      taxAmount: Number(po.taxAmount),
      totalAmount: Number(po.totalAmount),
      createdAt: po.createdAt.toISOString(),
      lines: po.lines.map((l) => ({
        id: l.id,
        partId: l.partId,
        partCode: l.part.code,
        partName: l.part.name,
        quantityOrdered: Number(l.quantityOrdered),
        quantityReceived: Number(l.quantityReceived),
        unitCost: Number(l.unitCost),
        taxRatePercent: Number(l.taxRatePercent),
        lineAmount: Number(l.lineAmount),
      })),
    })),
  });
});

router.get('/reorder-suggestions', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const parts = await prisma.part.findMany({
    where: { organizationId: user.organizationId ?? undefined },
    orderBy: { name: 'asc' },
    include: { vendor: true },
  });
  const suggestions = parts
    .filter((p) => Number(p.quantity) <= Number(p.minQuantity))
    .map((p) => {
      const qty = Number(p.quantity);
      const min = Number(p.minQuantity);
      const recommendedOrderQty = Math.max(1, min * 2 - qty);
      return {
        partId: p.id,
        code: p.code,
        name: p.name,
        currentQty: qty,
        minQty: min,
        unit: p.unit,
        vendorId: p.vendorId,
        vendorName: p.vendor?.name ?? null,
        recommendedOrderQty,
      };
    });
  res.json({ suggestions });
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  const poNumber = await getNextPoNumber(user.organizationId);

  const partIds = [...new Set(d.lines.map((l) => l.partId))];
  const validParts = await prisma.part.findMany({
    where: { id: { in: partIds }, organizationId: user.organizationId ?? undefined },
    select: { id: true },
  });
  if (validParts.length !== partIds.length) {
    res.status(400).json({ error: 'Validation failed', message: 'One or more parts are invalid.' });
    return;
  }

  const vendor = await prisma.vendor.findFirst({
    where: { id: d.vendorId, organizationId: user.organizationId ?? undefined },
  });
  if (!vendor) {
    res.status(404).json({ error: 'Not found', message: 'Supplier not found.' });
    return;
  }

  const subtotal = d.lines.reduce((s, l) => s + l.quantityOrdered * l.unitCost, 0);
  const tax = d.lines.reduce((s, l) => s + (l.quantityOrdered * l.unitCost * ((l.taxRatePercent ?? 0) / 100)), 0);
  const total = subtotal + tax;

  const created = await prisma.purchaseOrder.create({
    data: {
      organizationId: user.organizationId ?? undefined,
      poNumber,
      vendorId: d.vendorId,
      status: 'draft',
      expectedDate: d.expectedDate ? new Date(d.expectedDate) : null,
      notes: d.notes?.trim() || null,
      subtotalAmount: subtotal,
      taxAmount: tax,
      totalAmount: total,
      lines: {
        create: d.lines.map((l) => {
          const lineAmount = l.quantityOrdered * l.unitCost * (1 + ((l.taxRatePercent ?? 0) / 100));
          return {
            partId: l.partId,
            quantityOrdered: l.quantityOrdered,
            quantityReceived: 0,
            unitCost: l.unitCost,
            taxRatePercent: l.taxRatePercent ?? 0,
            lineAmount,
          };
        }),
      },
    },
    include: { vendor: true, lines: { include: { part: true } } },
  });

  res.status(201).json({
    id: created.id,
    poNumber: created.poNumber,
    vendorId: created.vendorId,
    vendorName: created.vendor.name,
    status: created.status,
    expectedDate: created.expectedDate ? created.expectedDate.toISOString().slice(0, 10) : null,
    notes: created.notes,
    subtotalAmount: Number(created.subtotalAmount),
    taxAmount: Number(created.taxAmount),
    totalAmount: Number(created.totalAmount),
    createdAt: created.createdAt.toISOString(),
    lines: created.lines.map((l) => ({
      id: l.id,
      partId: l.partId,
      partCode: l.part.code,
      partName: l.part.name,
      quantityOrdered: Number(l.quantityOrdered),
      quantityReceived: Number(l.quantityReceived),
      unitCost: Number(l.unitCost),
      taxRatePercent: Number(l.taxRatePercent),
      lineAmount: Number(l.lineAmount),
    })),
  });
});

router.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const parsed = statusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: req.params.id, organizationId: user.organizationId ?? undefined },
  });
  if (!po) {
    res.status(404).json({ error: 'Not found', message: 'Purchase order not found.' });
    return;
  }
  const updated = await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: { status: parsed.data.status },
  });
  res.json({ id: updated.id, status: updated.status });
});

router.post('/:id/receive', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const parsed = receiveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: req.params.id, organizationId: user.organizationId ?? undefined },
    include: { lines: true },
  });
  if (!po) {
    res.status(404).json({ error: 'Not found', message: 'Purchase order not found.' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const lineUpdate of parsed.data.lines) {
      const line = po.lines.find((l) => l.id === lineUpdate.lineId);
      if (!line) continue;
      const left = Number(line.quantityOrdered) - Number(line.quantityReceived);
      const receiveNow = Math.min(left, lineUpdate.quantityReceivedNow);
      if (receiveNow <= 0) continue;

      await tx.purchaseOrderLine.update({
        where: { id: line.id },
        data: { quantityReceived: { increment: receiveNow } },
      });

      await tx.part.update({
        where: { id: line.partId },
        data: { quantity: { increment: receiveNow } },
      });

      await tx.stockMovement.create({
        data: {
          partId: line.partId,
          type: 'purchase',
          quantity: receiveNow,
          referenceId: po.id,
          referenceLabel: po.poNumber,
          unitCost: line.unitCost,
        },
      });
    }

    const refreshedLines = await tx.purchaseOrderLine.findMany({
      where: { purchaseOrderId: po.id },
      select: { quantityOrdered: true, quantityReceived: true },
    });
    const fullyReceived = refreshedLines.every((l) => Number(l.quantityReceived) >= Number(l.quantityOrdered));
    const anyReceived = refreshedLines.some((l) => Number(l.quantityReceived) > 0);
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: fullyReceived ? 'received' : anyReceived ? 'partially_received' : po.status },
    });
  });

  res.json({ ok: true });
});

export default router;

