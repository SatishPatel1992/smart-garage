import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/** GET /dashboard – stats, recent activity, and attention items for the dashboard */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const orgFilter = user.organizationId ? { organizationId: user.organizationId } : {};

  const baseJobWhere = {
    deletedAt: null,
    ...orgFilter,
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    todayJobsCount,
    inProgressCount,
    deliveredCount,
    awaitingApprovalCount,
    recentJobs,
    recentEstimates,
    recentInvoices,
    recentPayments,
  ] = await Promise.all([
    prisma.jobCard.count({
      where: { ...baseJobWhere, createdAt: { gte: startOfToday } },
    }),
    prisma.jobCard.count({
      where: { ...baseJobWhere, stage: 'work_in_progress' },
    }),
    prisma.jobCard.count({
      where: { ...baseJobWhere, stage: 'delivered' },
    }),
    prisma.estimate.count({
      where: {
        status: 'sent',
        jobCard: { deletedAt: null, ...orgFilter },
      },
    }),
    prisma.jobCard.findMany({
      where: baseJobWhere,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { vehicle: true },
    }),
    prisma.estimate.findMany({
      where: {
        jobCard: { deletedAt: null, ...orgFilter },
        sentAt: { not: null },
      },
      take: 5,
      orderBy: { sentAt: 'desc' },
      include: { jobCard: { include: { vehicle: true } } },
    }),
    prisma.invoice.findMany({
      where: { jobCard: { deletedAt: null, ...orgFilter } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { jobCard: { include: { vehicle: true } } },
    }),
    prisma.payment.findMany({
      where: {
        invoice: {
          jobCard: { deletedAt: null, ...orgFilter },
        },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { invoice: true },
    }),
  ]);

  const deliveredNoInvoiceCount = await (async () => {
    const delivered = await prisma.jobCard.findMany({
      where: { ...baseJobWhere, stage: 'delivered' },
      select: { id: true },
    });
    if (delivered.length === 0) return 0;
    const withInv = await prisma.invoice.count({
      where: { jobCardId: { in: delivered.map((j) => j.id) } },
    });
    return Math.max(0, delivered.length - withInv);
  })();

  type ActivityItem = {
    type: string;
    id: string;
    jobCardId?: string;
    title: string;
    detail: string;
    createdAt: string;
    icon: string;
    iconColor: string;
  };

  const activities: ActivityItem[] = [];

  recentJobs.forEach((j) => {
    activities.push({
      type: 'job_created',
      id: j.id,
      jobCardId: j.id,
      title: 'Job card created',
      detail: `${j.jobNumber} · ${j.vehicle.make} ${j.vehicle.model}`,
      createdAt: j.createdAt.toISOString(),
      icon: 'document-text',
      iconColor: '#3b82f6',
    });
  });

  recentEstimates.forEach((e) => {
    const vehicle = e.jobCard?.vehicle;
    const detail = vehicle ? `${e.estimateNumber} · ${vehicle.make} ${vehicle.model}` : e.estimateNumber;
    activities.push({
      type: 'estimate_sent',
      id: e.id,
      jobCardId: e.jobCardId,
      title: 'Estimate sent to client',
      detail,
      createdAt: (e.sentAt ?? e.createdAt).toISOString(),
      icon: 'send',
      iconColor: '#f59e0b',
    });
  });

  recentInvoices.forEach((inv) => {
    const vehicle = inv.jobCard?.vehicle;
    const total = Number(inv.totalAmount);
    const detail = vehicle
      ? `${inv.invoiceNumber} · ₹${total.toLocaleString('en-IN')} · ${vehicle.make} ${vehicle.model}`
      : `${inv.invoiceNumber} · ₹${total.toLocaleString('en-IN')}`;
    activities.push({
      type: 'invoice_created',
      id: inv.id,
      jobCardId: inv.jobCardId,
      title: 'Invoice created',
      detail,
      createdAt: inv.createdAt.toISOString(),
      icon: 'receipt',
      iconColor: '#6366f1',
    });
  });

  recentPayments.forEach((p) => {
    const amount = Number(p.amount);
    activities.push({
      type: 'payment_received',
      id: p.id,
      jobCardId: p.invoice?.jobCardId,
      title: 'Payment received',
      detail: `₹${amount.toLocaleString('en-IN')} · ${p.invoice?.invoiceNumber ?? 'Invoice'}`,
      createdAt: p.createdAt.toISOString(),
      icon: 'card',
      iconColor: '#22c55e',
    });
  });

  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recentActivity = activities.slice(0, 15);

  res.json({
    stats: {
      todayJobs: todayJobsCount,
      inProgress: inProgressCount,
      awaitingApproval: awaitingApprovalCount,
      readyForDelivery: deliveredCount,
    },
    recentActivity,
    attention: {
      awaitingApprovalCount,
      deliveredNotBilledCount: deliveredNoInvoiceCount,
    },
  });
});

export default router;
