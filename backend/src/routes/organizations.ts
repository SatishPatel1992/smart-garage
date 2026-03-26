import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
router.use(requireAuth);

const settingsBody = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  gstin: z.string().max(50).optional().nullable(),
  settings: z.object({
    currency: z.string().max(10).optional(),
    defaultTaxRates: z.array(z.number().min(0).max(100)).optional(),
    defaultGstRatePercent: z.number().min(0).max(100).optional(),
    estimateValidityDays: z.number().int().min(1).max(365).optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
    invoiceDefaultFormat: z.enum(['proforma', 'tax']).optional(),
    logoUrl: z.string().max(500).optional().nullable(),
    gstEnabled: z.boolean().optional(),
  }).optional(),
});

/** PATCH /organizations/settings – update org (admin only). */
router.patch('/settings', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  if (!user.organizationId) {
    res.status(400).json({ error: 'No organization', message: 'User has no organization.' });
    return;
  }
  const parsed = settingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { name, address, phone, gstin, settings } = parsed.data;
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { settings: true },
  });
  if (!org) {
    res.status(404).json({ error: 'Not found', message: 'Organization not found.' });
    return;
  }
  const currentSettings = (org.settings as Record<string, unknown>) ?? {};
  const updatedSettings = settings ? { ...currentSettings, ...settings } : currentSettings;
  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(phone !== undefined && { phone }),
      ...(gstin !== undefined && { gstin }),
      settings: updatedSettings,
    },
  });
  res.json({ ok: true });
});

export default router;
