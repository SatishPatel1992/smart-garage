import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-min-32-characters-long';

export type JwtPayload = { sub: string; email: string };

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header.' });
    return;
  }
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub, isActive: true },
      select: { id: true, email: true, name: true, role: true, organizationId: true },
    });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not found or inactive.' });
      return;
    }
    (req as Request & { user: typeof user }).user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token.' });
  }
}
