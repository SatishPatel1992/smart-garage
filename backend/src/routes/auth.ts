import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { randomBytes } from 'crypto';

const router = Router();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-min-32-characters-long';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-min-32-characters-long';
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY ?? '24h';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY ?? '24h';

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase(), isActive: true },
  });
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials', message: 'Email or password is incorrect.' });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials', message: 'Email or password is incorrect.' });
    return;
  }
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );
  const refreshTokenValue = randomBytes(32).toString('hex');
  const refreshExpires = new Date();
  refreshExpires.setHours(refreshExpires.getHours() + 24);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshTokenValue,
      expiresAt: refreshExpires,
    },
  });
  const refreshToken = jwt.sign(
    { sub: user.id, jti: refreshTokenValue },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRY }
  );
  res.json({
    accessToken,
    refreshToken,
    expiresIn: ACCESS_EXPIRY,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

const refreshBody = z.object({
  refreshToken: z.string().min(1),
});

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const parsed = refreshBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const decoded = jwt.verify(parsed.data.refreshToken, REFRESH_SECRET) as { sub: string; jti?: string };
    const tokenId = decoded.jti ?? decoded.sub;
    const stored = await prisma.refreshToken.findFirst({
      where: { token: tokenId, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!stored || !stored.user.isActive) {
      res.status(401).json({ error: 'Invalid refresh token', message: 'Token expired or revoked.' });
      return;
    }
    const accessToken = jwt.sign(
      { sub: stored.user.id, email: stored.user.email },
      ACCESS_SECRET,
      { expiresIn: ACCESS_EXPIRY }
    );
    res.json({
      accessToken,
      expiresIn: ACCESS_EXPIRY,
      user: {
        id: stored.user.id,
        email: stored.user.email,
        name: stored.user.name,
        role: stored.user.role,
      },
    });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token', message: 'Token invalid or expired.' });
  }
});

export default router;
