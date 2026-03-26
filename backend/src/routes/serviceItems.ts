import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const createBody = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['part', 'labour']),
  defaultUnitPrice: z.number().min(0),
  defaultTaxRatePercent: z.number().min(0).max(100),
});

/** GET /service-items?q=&type= – list/search parts and labour for estimate builder */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const q = (req.query.q as string)?.trim() ?? '';
  const type = req.query.type as string | undefined;
  const where: { isActive: true; name?: { contains: string; mode: 'insensitive' }; type?: string } = { isActive: true };
  if (q) where.name = { contains: q, mode: 'insensitive' };
  if (type === 'part' || type === 'labour') where.type = type;
  const items = await prisma.serviceItem.findMany({
    where,
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
  res.json({
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      defaultUnitPrice: Number(i.defaultUnitPrice),
      defaultTaxRatePercent: Number(i.defaultTaxRatePercent),
    })),
  });
});

/** POST /service-items – add part or labour item (admin or advisor) */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { name, type, defaultUnitPrice, defaultTaxRatePercent } = parsed.data;
  const created = await prisma.serviceItem.create({
    data: {
      name: name.trim(),
      type,
      defaultUnitPrice,
      defaultTaxRatePercent,
      isActive: true,
    },
  });
  res.status(201).json({
    id: created.id,
    name: created.name,
    type: created.type,
    defaultUnitPrice: Number(created.defaultUnitPrice),
    defaultTaxRatePercent: Number(created.defaultTaxRatePercent),
  });
});

export default router;
