import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { id: string; organizationId: string | null } }).user;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, role: true, organizationId: true },
  });
  if (!dbUser) {
    res.status(404).json({ error: 'Not found', message: 'User not found.' });
    return;
  }
  let organization: { id: string; name: string; address: string | null; phone: string | null; gstin: string | null; settings: unknown } | null = null;
  if (dbUser.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: dbUser.organizationId },
      select: { id: true, name: true, address: true, phone: true, gstin: true, settings: true },
    });
    if (org) organization = { ...org, settings: org.settings ?? null };
  }
  res.json({
    user: { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role },
    organization,
  });
});

export default router;
