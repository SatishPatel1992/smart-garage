import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const createCustomerBody = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(20),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  gstin: z.string().max(50).optional(),
  vehicles: z.array(z.object({
    registrationNo: z.string().min(1).max(30),
    make: z.string().min(1).max(80),
    model: z.string().min(1).max(80),
    year: z.number().int().min(1900).max(2100).optional(),
    vin: z.string().max(50).optional(),
    type: z.string().max(40).optional(),
    fuel: z.string().max(20).optional(),
  })).min(0),
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const q = (req.query.q as string)?.trim() ?? '';
  const withVehicles = req.query.withVehicles !== 'false';

  const where: { deletedAt: null; organizationId?: string | null } = { deletedAt: null };
  if (user.organizationId) where.organizationId = user.organizationId;

  if (q) {
    const or = [
      { name: { contains: q, mode: 'insensitive' as const } },
      { phone: { contains: q, mode: 'insensitive' as const } },
      { email: { contains: q, mode: 'insensitive' as const } },
      { vehicles: { some: { registrationNo: { contains: q, mode: 'insensitive' as const } } } },
      { vehicles: { some: { make: { contains: q, mode: 'insensitive' as const } } } },
      { vehicles: { some: { model: { contains: q, mode: 'insensitive' as const } } } },
    ];
    Object.assign(where, { OR: or });
  }

  const customers = await prisma.customer.findMany({
    where,
    include: {
      vehicles: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  const list = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email ?? undefined,
    address: c.address ?? undefined,
    gstin: c.gstin ?? undefined,
    vehicles: withVehicles
      ? c.vehicles.map((v) => ({
          id: v.id,
          registrationNo: v.registrationNo,
          make: v.make,
          model: v.model,
          year: v.year ?? undefined,
          vin: v.vin ?? undefined,
          type: v.type ?? undefined,
          fuel: v.fuel ?? undefined,
        }))
      : [],
  }));

  res.json({ customers: list });
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const id = req.params.id;

  const customer = await prisma.customer.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(user.organizationId ? { organizationId: user.organizationId } : {}),
    },
    include: {
      vehicles: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
    },
  });

  if (!customer) {
    res.status(404).json({ error: 'Not found', message: 'Customer not found.' });
    return;
  }

  res.json({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? undefined,
    address: customer.address ?? undefined,
    gstin: customer.gstin ?? undefined,
    vehicles: customer.vehicles.map((v) => ({
      id: v.id,
      registrationNo: v.registrationNo,
      make: v.make,
      model: v.model,
      year: v.year ?? undefined,
      vin: v.vin ?? undefined,
      type: v.type ?? undefined,
      fuel: v.fuel ?? undefined,
    })),
  });
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const parsed = createCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { name, phone, email, address, gstin, vehicles } = parsed.data;

  const customer = await prisma.customer.create({
    data: {
      organizationId: user.organizationId ?? undefined,
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || undefined,
      address: address?.trim() || undefined,
      gstin: gstin?.trim() || undefined,
      vehicles: {
        create: vehicles.map((v) => ({
          registrationNo: v.registrationNo.trim(),
          make: v.make.trim(),
          model: v.model.trim(),
          year: v.year,
          vin: v.vin?.trim(),
          type: v.type?.trim(),
          fuel: v.fuel?.trim(),
        })),
      },
    },
    include: {
      vehicles: { orderBy: { createdAt: 'asc' } },
    },
  });

  res.status(201).json({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? undefined,
    address: customer.address ?? undefined,
    gstin: customer.gstin ?? undefined,
    vehicles: customer.vehicles.map((v) => ({
      id: v.id,
      registrationNo: v.registrationNo,
      make: v.make,
      model: v.model,
      year: v.year ?? undefined,
      vin: v.vin ?? undefined,
      type: v.type ?? undefined,
      fuel: v.fuel ?? undefined,
    })),
  });
});

export default router;
