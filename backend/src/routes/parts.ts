import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const createBody = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  quantity: z.number().min(0).optional(),
  minQuantity: z.number().min(0).optional(),
  unit: z.string().min(1).max(50).optional(),
  price: z.number().min(0),
  costPrice: z.number().min(0).optional(),
  vendorId: z.string().uuid().optional(),
});

const updateBody = z.object({
  name: z.string().min(1).max(200).optional(),
  quantity: z.number().min(0).optional(),
  minQuantity: z.number().min(0).optional(),
  unit: z.string().min(1).max(50).optional(),
  price: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  vendorId: z.string().uuid().nullable().optional(),
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const parts = await prisma.part.findMany({
    where: { organizationId: user.organizationId ?? undefined },
    include: { vendor: true },
    orderBy: { name: 'asc' },
  });
  res.json({
    parts: parts.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      quantity: Number(p.quantity),
      minQuantity: Number(p.minQuantity),
      unit: p.unit,
      price: Number(p.price),
      costPrice: p.costPrice != null ? Number(p.costPrice) : null,
      vendorId: p.vendorId,
      vendorName: p.vendor?.name ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  const created = await prisma.part.create({
    data: {
      organizationId: user.organizationId ?? undefined,
      code: d.code.trim().toUpperCase(),
      name: d.name.trim(),
      quantity: d.quantity ?? 0,
      minQuantity: d.minQuantity ?? 0,
      unit: d.unit?.trim() || 'piece',
      price: d.price,
      costPrice: d.costPrice ?? null,
      vendorId: d.vendorId ?? null,
    },
  });
  res.status(201).json({
    id: created.id,
    code: created.code,
    name: created.name,
    quantity: Number(created.quantity),
    minQuantity: Number(created.minQuantity),
    unit: created.unit,
    price: Number(created.price),
    costPrice: created.costPrice != null ? Number(created.costPrice) : null,
    vendorId: created.vendorId,
    createdAt: created.createdAt.toISOString(),
  });
});

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const parsed = updateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const part = await prisma.part.findFirst({
    where: { id: req.params.id, organizationId: user.organizationId ?? undefined },
  });
  if (!part) {
    res.status(404).json({ error: 'Not found', message: 'Part not found.' });
    return;
  }
  const d = parsed.data;
  const updated = await prisma.part.update({
    where: { id: part.id },
    data: {
      ...(d.name ? { name: d.name.trim() } : {}),
      ...(typeof d.quantity === 'number' ? { quantity: d.quantity } : {}),
      ...(typeof d.minQuantity === 'number' ? { minQuantity: d.minQuantity } : {}),
      ...(d.unit ? { unit: d.unit.trim() } : {}),
      ...(typeof d.price === 'number' ? { price: d.price } : {}),
      ...(typeof d.costPrice === 'number' ? { costPrice: d.costPrice } : {}),
      ...(d.vendorId !== undefined ? { vendorId: d.vendorId } : {}),
    },
    include: { vendor: true },
  });
  res.json({
    id: updated.id,
    code: updated.code,
    name: updated.name,
    quantity: Number(updated.quantity),
    minQuantity: Number(updated.minQuantity),
    unit: updated.unit,
    price: Number(updated.price),
    costPrice: updated.costPrice != null ? Number(updated.costPrice) : null,
    vendorId: updated.vendorId,
    vendorName: updated.vendor?.name ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.post('/import-service-items', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;

  const serviceItems = await prisma.serviceItem.findMany({
    where: { type: 'part', isActive: true },
    orderBy: { name: 'asc' },
  });
  const existing = await prisma.part.findMany({
    where: { organizationId: user.organizationId ?? undefined },
    select: { name: true, code: true },
  });
  const existingNameSet = new Set(existing.map((e) => e.name.toLowerCase()));
  const existingCodeSet = new Set(existing.map((e) => e.code.toUpperCase()));

  let createdCount = 0;
  for (const item of serviceItems) {
    if (existingNameSet.has(item.name.toLowerCase())) continue;
    let code = `SI-${item.id.slice(0, 8).toUpperCase()}`;
    let idx = 1;
    while (existingCodeSet.has(code)) {
      idx += 1;
      code = `SI-${item.id.slice(0, 6).toUpperCase()}-${idx}`;
    }
    await prisma.part.create({
      data: {
        organizationId: user.organizationId ?? undefined,
        code,
        name: item.name.trim(),
        quantity: 0,
        minQuantity: 5,
        unit: 'piece',
        price: item.defaultUnitPrice,
        costPrice: item.defaultUnitPrice,
      },
    });
    existingCodeSet.add(code);
    existingNameSet.add(item.name.toLowerCase());
    createdCount += 1;
  }

  res.json({ ok: true, createdCount, totalSource: serviceItems.length });
});

export default router;

