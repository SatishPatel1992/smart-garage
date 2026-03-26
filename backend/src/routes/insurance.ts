import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const createBody = z.object({
  name: z.string().min(1).max(200),
});

/** GET /insurance-companies – list insurance companies for estimate (e.g. insurance split) */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const list = await prisma.insuranceCompany.findMany({
    orderBy: { name: 'asc' },
  });
  res.json({ companies: list });
});

/** POST /insurance-companies – add insurance company */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const created = await prisma.insuranceCompany.create({
    data: { name: parsed.data.name.trim() },
  });
  res.status(201).json({ id: created.id, name: created.name });
});

export default router;
