import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const createBody = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().min(0.01),
  reason: z.string().min(1).max(2000),
});

async function getNextCreditNoteNumber(organizationId: string | null): Promise<string> {
  const year = new Date().getFullYear();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.sequence.findFirst({
      where: {
        organizationId: organizationId ?? null,
        name: 'credit_note_number',
        year,
      },
    });
    let num: number;
    if (existing) {
      const updated = await tx.sequence.update({
        where: { id: existing.id },
        data: { value: { increment: 1 } },
      });
      num = updated.value;
    } else {
      const created = await tx.sequence.create({
        data: {
          organizationId: organizationId ?? undefined,
          name: 'credit_note_number',
          year,
          value: 1,
        },
      });
      num = created.value;
    }
    return `CN-${year}-${String(num).padStart(4, '0')}`;
  });
}

/** GET /credit-notes – list all credit notes for the organization */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const orgFilter = user.organizationId ? { organizationId: user.organizationId } : {};

  const notes = await prisma.creditNote.findMany({
    where: {
      invoice: {
        jobCard: {
          deletedAt: null,
          ...orgFilter,
        },
      },
    },
    include: {
      invoice: { select: { id: true, invoiceNumber: true, jobCardId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    creditNotes: notes.map((cn) => ({
      id: cn.id,
      creditNoteNumber: cn.creditNoteNumber,
      invoiceId: cn.invoiceId,
      invoiceNumber: cn.invoice.invoiceNumber,
      jobCardId: cn.invoice.jobCardId,
      amount: Number(cn.amount),
      reason: cn.reason,
      createdAt: cn.createdAt.toISOString(),
    })),
  });
});

/** POST /credit-notes – create a credit note and reduce invoice paid amount */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { invoiceId, amount, reason } = parsed.data;

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      jobCard: {
        deletedAt: null,
        ...(user.organizationId ? { organizationId: user.organizationId } : {}),
      },
    },
  });

  if (!invoice) {
    res.status(404).json({ error: 'Not found', message: 'Invoice not found.' });
    return;
  }

  const totalAmount = Number(invoice.totalAmount);
  if (amount > totalAmount) {
    res.status(400).json({ error: 'Bad request', message: 'Credit note amount cannot exceed invoice total.' });
    return;
  }

  const currentPaid = Number(invoice.paidAmount);
  const newPaid = Math.max(0, currentPaid - amount);

  const creditNoteNumber = await getNextCreditNoteNumber(user.organizationId);

  const [creditNote] = await prisma.$transaction([
    prisma.creditNote.create({
      data: {
        invoiceId,
        creditNoteNumber,
        amount,
        reason: reason.trim(),
      },
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount: newPaid },
    }),
  ]);

  res.status(201).json({
    id: creditNote.id,
    creditNoteNumber: creditNote.creditNoteNumber,
    invoiceId: creditNote.invoiceId,
    amount: Number(creditNote.amount),
    reason: creditNote.reason,
    createdAt: creditNote.createdAt.toISOString(),
  });
});

export default router;
