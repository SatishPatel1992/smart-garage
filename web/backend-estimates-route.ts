/**
 * backend/src/routes/estimates.ts
 *
 * ADD the GET /estimates list handler below to your existing estimates router.
 * All other existing routes (POST, GET ?jobCardId=, PATCH /:id, POST /:id/revisions)
 * remain unchanged — this is purely additive.
 *
 * Dependencies already present in the backend:
 *   - express Router
 *   - requireAuth middleware (attaches req.user with organizationId)
 *   - prisma client
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * USAGE: copy the handler below into your router file, e.g.:
 *
 *   // GET /estimates  — list all estimates for this organisation
 *   router.get('/', requireAuth, listEstimates);
 *
 * Place it BEFORE the existing:
 *   router.get('/', requireAuth, getEstimateByJobId);
 *
 * and gate by checking for the ?jobCardId param so both handlers co-exist:
 *
 *   router.get('/', requireAuth, (req, res, next) => {
 *     if (req.query.jobCardId) return getEstimateByJobId(req, res, next);
 *     return listEstimates(req, res, next);
 *   });
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response, NextFunction } from 'express';
// import { prisma } from '../lib/prisma'; // adjust path to your prisma instance
// import { requireAuth } from '../middleware/auth'; // adjust path

/**
 * GET /estimates
 *
 * Query params:
 *   status?    — filter by estimate status ('draft'|'sent'|'approved'|'rejected')
 *   page?      — 1-based page number (default: 1)
 *   pageSize?  — records per page (default: 50, max: 200)
 *   sort?      — 'createdAt' only for now (default: desc)
 *
 * Response: { estimates: EstimateListItemDto[], total: number }
 *
 * EstimateListItemDto shape (mirrors web/src/api/client.ts):
 * {
 *   id, estimateNumber, jobCardId,
 *   jobNumber, customerName, vehicleRegistrationNo,
 *   status, totalAmount, validUntil,
 *   createdAt, updatedAt
 * }
 */
export async function listEstimates(
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // @ts-expect-error — req.user set by requireAuth middleware
  const { organizationId } = req.user as { organizationId: string };

  const status = req.query['status'] as string | undefined;
  const page     = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query['pageSize'] ?? '50'), 10)));
  const skip     = (page - 1) * pageSize;

  const where = {
    jobCard: { organizationId },
    ...(status ? { status } : {}),
  };

  // Run count + data in parallel
  const [total, rows] = await Promise.all([
    // @ts-expect-error — prisma types inferred at runtime
    prisma.estimate.count({ where }),
    // @ts-expect-error — prisma types inferred at runtime
    prisma.estimate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        jobCard: {
          select: {
            jobNumber: true,
            customer: { select: { name: true } },
            vehicle:  { select: { registrationNo: true } },
          },
        },
      },
    }),
  ]);

  // Map to DTO
  // @ts-expect-error — row shape from Prisma include
  const estimates = rows.map((row) => ({
    id:                    row.id,
    estimateNumber:        row.estimateNumber,
    jobCardId:             row.jobCardId,
    jobNumber:             row.jobCard.jobNumber,
    customerName:          row.jobCard.customer.name,
    vehicleRegistrationNo: row.jobCard.vehicle.registrationNo,
    status:                row.status,
    totalAmount:           row.totalAmount,
    validUntil:            row.validUntil?.toISOString() ?? null,
    createdAt:             row.createdAt.toISOString(),
    updatedAt:             row.updatedAt.toISOString(),
  }));

  return res.json({ estimates, total });
}

/*
 * ──────────────────────────────────────────────────────────────────────────────
 * EXAMPLE — how to wire it into your existing router (estimates.ts):
 *
 * import { listEstimates } from './estimatesListHandler'; // or inline above
 *
 * // Route: GET /estimates (list OR by-job-id)
 * router.get('/', requireAuth, (req, res, next) => {
 *   if (req.query.jobCardId) {
 *     // existing handler — returns single EstimateDto for a job
 *     return getEstimateByJobId(req, res, next);
 *   }
 *   // new handler — returns paginated list
 *   return listEstimates(req, res, next);
 * });
 * ──────────────────────────────────────────────────────────────────────────────
 */
