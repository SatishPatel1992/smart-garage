import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const nameBody = z.object({
  name: z.string().min(1).max(200),
});

function getOrgId(req: Request): string | null {
  return (req as Request & { user: { organizationId: string | null } }).user.organizationId;
}

// GET /vehicle-makes -> { makes: VehicleMakeDto[] }
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.status(400).json({ error: 'Bad Request', message: 'Organization not found.' });
    return;
  }

  const makes = await prisma.vehicleMake.findMany({
    where: { organizationId: orgId },
    orderBy: { name: 'asc' },
    include: {
      models: {
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      },
    },
  });

  res.json({
    makes: makes.map((m) => ({
      id: m.id,
      name: m.name,
      models: m.models.map((mo) => ({
        id: mo.id,
        name: mo.name,
        makeId: m.id,
      })),
    })),
  });
});

// POST /vehicle-makes -> { name }
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.status(400).json({ error: 'Bad Request', message: 'Organization not found.' });
    return;
  }

  const parsed = nameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const name = parsed.data.name.trim();

  // Prevent duplicates (case-insensitive).
  const existing = await prisma.vehicleMake.findFirst({
    where: { organizationId: orgId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) {
    res.status(409).json({ error: 'Conflict', message: 'Vehicle make already exists.' });
    return;
  }

  const created = await prisma.vehicleMake.create({
    data: {
      organizationId: orgId,
      name,
    },
    select: { id: true, name: true },
  });

  res.status(201).json({ ...created, models: [] });
});

// PATCH /vehicle-makes/:id -> { name }
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.status(400).json({ error: 'Bad Request', message: 'Organization not found.' });
    return;
  }

  const parsed = nameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const makeId = req.params.id;
  const name = parsed.data.name.trim();

  const make = await prisma.vehicleMake.findFirst({
    where: { id: makeId, organizationId: orgId },
    select: { id: true },
  });

  if (!make) {
    res.status(404).json({ error: 'Not found', message: 'Vehicle make not found.' });
    return;
  }

  const existing = await prisma.vehicleMake.findFirst({
    where: {
      organizationId: orgId,
      name: { equals: name, mode: 'insensitive' },
      id: { not: make.id },
    },
    select: { id: true },
  });
  if (existing) {
    res.status(409).json({ error: 'Conflict', message: 'Vehicle make already exists.' });
    return;
  }

  const updated = await prisma.vehicleMake.update({
    where: { id: make.id },
    data: { name },
    select: { id: true, name: true },
  });

  res.json({ ...updated, models: [] });
});

// DELETE /vehicle-makes/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.status(400).json({ error: 'Bad Request', message: 'Organization not found.' });
    return;
  }

  const makeId = req.params.id;
  const make = await prisma.vehicleMake.findFirst({
    where: { id: makeId, organizationId: orgId },
    select: { id: true },
  });
  if (!make) {
    res.status(404).json({ error: 'Not found', message: 'Vehicle make not found.' });
    return;
  }

  await prisma.vehicleMake.delete({ where: { id: make.id } });
  res.json({ ok: true });
});

// POST /vehicle-makes/:makeId/models -> { name }
router.post('/:makeId/models', async (req: Request, res: Response): Promise<void> => {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.status(400).json({ error: 'Bad Request', message: 'Organization not found.' });
    return;
  }

  const parsed = nameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const makeId = req.params.makeId;
  const name = parsed.data.name.trim();

  const make = await prisma.vehicleMake.findFirst({
    where: { id: makeId, organizationId: orgId },
    select: { id: true },
  });
  if (!make) {
    res.status(404).json({ error: 'Not found', message: 'Vehicle make not found.' });
    return;
  }

  const existing = await prisma.vehicleModel.findFirst({
    where: {
      vehicleMakeId: make.id,
      name: { equals: name, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (existing) {
    res.status(409).json({ error: 'Conflict', message: 'Vehicle model already exists for this make.' });
    return;
  }

  const created = await prisma.vehicleModel.create({
    data: {
      vehicleMakeId: make.id,
      name,
    },
    select: { id: true, name: true, vehicleMakeId: true },
  });

  res.status(201).json({ id: created.id, name: created.name, makeId: created.vehicleMakeId });
});

// PATCH /vehicle-makes/:makeId/models/:modelId -> { name }
router.patch('/:makeId/models/:modelId', async (req: Request, res: Response): Promise<void> => {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.status(400).json({ error: 'Bad Request', message: 'Organization not found.' });
    return;
  }

  const parsed = nameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const makeId = req.params.makeId;
  const modelId = req.params.modelId;
  const name = parsed.data.name.trim();

  const make = await prisma.vehicleMake.findFirst({
    where: { id: makeId, organizationId: orgId },
    select: { id: true },
  });
  if (!make) {
    res.status(404).json({ error: 'Not found', message: 'Vehicle make not found.' });
    return;
  }

  const model = await prisma.vehicleModel.findFirst({
    where: { id: modelId, vehicleMakeId: make.id },
    select: { id: true },
  });
  if (!model) {
    res.status(404).json({ error: 'Not found', message: 'Vehicle model not found.' });
    return;
  }

  const existing = await prisma.vehicleModel.findFirst({
    where: {
      vehicleMakeId: make.id,
      name: { equals: name, mode: 'insensitive' },
      id: { not: model.id },
    },
    select: { id: true },
  });
  if (existing) {
    res.status(409).json({ error: 'Conflict', message: 'Vehicle model already exists for this make.' });
    return;
  }

  const updated = await prisma.vehicleModel.update({
    where: { id: model.id },
    data: { name },
    select: { id: true, name: true, vehicleMakeId: true },
  });

  res.json({ id: updated.id, name: updated.name, makeId: updated.vehicleMakeId });
});

// DELETE /vehicle-makes/:makeId/models/:modelId
router.delete('/:makeId/models/:modelId', async (req: Request, res: Response): Promise<void> => {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.status(400).json({ error: 'Bad Request', message: 'Organization not found.' });
    return;
  }

  const makeId = req.params.makeId;
  const modelId = req.params.modelId;

  const make = await prisma.vehicleMake.findFirst({
    where: { id: makeId, organizationId: orgId },
    select: { id: true },
  });
  if (!make) {
    res.status(404).json({ error: 'Not found', message: 'Vehicle make not found.' });
    return;
  }

  const model = await prisma.vehicleModel.findFirst({
    where: { id: modelId, vehicleMakeId: make.id },
    select: { id: true },
  });
  if (!model) {
    res.status(404).json({ error: 'Not found', message: 'Vehicle model not found.' });
    return;
  }

  await prisma.vehicleModel.delete({ where: { id: model.id } });
  res.json({ ok: true });
});

export default router;

