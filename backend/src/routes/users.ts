import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin'));

const ROLES = ['admin', 'advisor', 'mechanic', 'accounts'] as const;

const createUserBody = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1).max(200),
  role: z.enum(ROLES),
});

const updateUserBody = z.object({
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
});

const resetPasswordBody = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

/** GET /users – list users in same organization (admin only) */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const where = user.organizationId ? { organizationId: user.organizationId } : {};
  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
    })),
  });
});

/** POST /users – create user (admin only) */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const parsed = createUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { email, password, name, role } = parsed.data;
  const emailLower = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: emailLower } });
  if (existing) {
    res.status(409).json({ error: 'Conflict', message: 'A user with this email already exists.' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const created = await prisma.user.create({
    data: {
      email: emailLower,
      passwordHash,
      name: name.trim(),
      role,
      organizationId: user.organizationId ?? undefined,
      isActive: true,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  res.status(201).json({
    id: created.id,
    email: created.email,
    name: created.name,
    role: created.role,
    createdAt: created.createdAt.toISOString(),
  });
});

/** PATCH /users/:id – update role/active state (admin only) */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const authUser = (req as Request & { user: { id: string; organizationId: string | null } }).user;
  const parsed = updateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: 'Validation failed', message: 'No fields provided to update.' });
    return;
  }

  const target = await prisma.user.findFirst({
    where: { id: req.params.id, organizationId: authUser.organizationId ?? undefined },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });
  if (!target) {
    res.status(404).json({ error: 'Not found', message: 'User not found.' });
    return;
  }

  if (target.id === authUser.id && parsed.data.isActive === false) {
    res.status(400).json({ error: 'Validation failed', message: 'You cannot deactivate your own account.' });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(typeof parsed.data.isActive === 'boolean' ? { isActive: parsed.data.isActive } : {}),
    },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });

  res.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    isActive: updated.isActive,
    createdAt: updated.createdAt.toISOString(),
  });
});

/** POST /users/:id/reset-password – set new password (admin only) */
router.post('/:id/reset-password', async (req: Request, res: Response): Promise<void> => {
  const authUser = (req as Request & { user: { organizationId: string | null } }).user;
  const parsed = resetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const target = await prisma.user.findFirst({
    where: { id: req.params.id, organizationId: authUser.organizationId ?? undefined },
    select: { id: true },
  });
  if (!target) {
    res.status(404).json({ error: 'Not found', message: 'User not found.' });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash },
  });
  res.json({ ok: true });
});

export default router;
