import type { Request, Response, NextFunction } from 'express';

type Role = 'admin' | 'advisor' | 'mechanic' | 'accounts';

export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as Request & { user: { role: string | null } }).user;
    const role = (user?.role ?? 'advisor') as Role;
    if (!allowed.includes(role)) {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions.' });
      return;
    }
    next();
  };
}
