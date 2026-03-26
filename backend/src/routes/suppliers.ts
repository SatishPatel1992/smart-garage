import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const createBody = z.object({
  name: z.string().min(1).max(200),
  contactPerson: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  gstin: z.string().max(50).optional(),
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const suppliers = await prisma.vendor.findMany({
    where: { organizationId: user.organizationId ?? undefined },
    orderBy: { name: 'asc' },
  });
  res.json({
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      contactPerson: s.contactPerson,
      phone: s.phone,
      email: s.email,
      address: s.address,
      gstin: s.gstin,
      createdAt: s.createdAt.toISOString(),
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
  const data = parsed.data;
  const created = await prisma.vendor.create({
    data: {
      organizationId: user.organizationId ?? undefined,
      name: data.name.trim(),
      contactPerson: data.contactPerson?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim().toLowerCase() || null,
      address: data.address?.trim() || null,
      gstin: data.gstin?.trim() || null,
    },
  });
  res.status(201).json({
    id: created.id,
    name: created.name,
    contactPerson: created.contactPerson,
    phone: created.phone,
    email: created.email,
    address: created.address,
    gstin: created.gstin,
    createdAt: created.createdAt.toISOString(),
  });
});

export default router;

