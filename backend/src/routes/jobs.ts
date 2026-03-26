import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const createJobBody = z.object({
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  complaints: z.string().min(1).max(5000),
  odometerReading: z.number().int().min(0),
  assignedMechanicId: z.string().optional().nullable(),
  insuranceCompanyId: z.string().uuid().optional().nullable(),
  photoPaths: z.array(z.string().max(500)).optional().default([]),
}).transform((data) => ({
  ...data,
  assignedMechanicId: data.assignedMechanicId && UUID_REGEX.test(data.assignedMechanicId) ? data.assignedMechanicId : undefined,
  insuranceCompanyId: data.insuranceCompanyId && UUID_REGEX.test(data.insuranceCompanyId) ? data.insuranceCompanyId : undefined,
}));

async function getNextJobNumber(organizationId: string | null): Promise<string> {
  const year = new Date().getFullYear();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.sequence.findFirst({
      where: {
        organizationId: organizationId ?? null,
        name: 'job_number',
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
          name: 'job_number',
          year,
          value: 1,
        },
      });
      num = created.value;
    }
    return `JC-${year}-${String(num).padStart(3, '0')}`;
  });
}

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { id: string; organizationId: string | null } }).user;
  const parsed = createJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { customerId, vehicleId, complaints, odometerReading, assignedMechanicId, insuranceCompanyId, photoPaths } = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      deletedAt: null,
      ...(user.organizationId ? { organizationId: user.organizationId } : {}),
    },
  });
  if (!customer) {
    res.status(404).json({ error: 'Not found', message: 'Customer not found.' });
    return;
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      customerId: customerId,
      deletedAt: null,
    },
  });
  if (!vehicle) {
    res.status(404).json({ error: 'Not found', message: 'Vehicle not found for this customer.' });
    return;
  }

  let resolvedAssignedMechanicId: string | undefined = assignedMechanicId ?? undefined;
  if (assignedMechanicId) {
    let mechanic = await prisma.mechanic.findFirst({
      where: {
        id: assignedMechanicId,
        ...(user.organizationId ? { organizationId: user.organizationId } : {}),
      },
      select: { id: true, isActive: true },
    });

    // Backward-compatible bridge:
    // UI currently sends user IDs for "mechanic" role. If there's no mechanic row
    // but a matching mechanic user exists in the same organization, create a profile.
    if (!mechanic) {
      const mechanicUser = await prisma.user.findFirst({
        where: {
          id: assignedMechanicId,
          role: 'mechanic',
          isActive: true,
          ...(user.organizationId ? { organizationId: user.organizationId } : {}),
        },
        select: { id: true, name: true, email: true },
      });

      if (mechanicUser) {
        const created = await prisma.mechanic.create({
          data: {
            id: mechanicUser.id,
            organizationId: user.organizationId ?? undefined,
            name: mechanicUser.name?.trim() || mechanicUser.email,
            isActive: true,
          },
          select: { id: true, isActive: true },
        });
        mechanic = created;
      }
    }

    if (!mechanic) {
      res.status(400).json({ error: 'Validation failed', message: 'Assigned mechanic is invalid for this organization.' });
      return;
    }
    if (!mechanic.isActive) {
      res.status(400).json({ error: 'Validation failed', message: 'Assigned mechanic is inactive.' });
      return;
    }
    resolvedAssignedMechanicId = mechanic.id;
  }

  if (insuranceCompanyId) {
    const company = await prisma.insuranceCompany.findUnique({
      where: { id: insuranceCompanyId },
      select: { id: true },
    });
    if (!company) {
      res.status(400).json({ error: 'Validation failed', message: 'Insurance company is invalid.' });
      return;
    }
  }

  const jobNumber = await getNextJobNumber(user.organizationId);

  let job;
  try {
    job = await prisma.jobCard.create({
      data: {
        organizationId: user.organizationId ?? undefined,
        jobNumber,
        customerId,
        vehicleId,
        complaints: complaints.trim(),
        odometerReading,
        assignedMechanicId: resolvedAssignedMechanicId,
        insuranceCompanyId: insuranceCompanyId ?? undefined,
        stage: 'pending',
        photos: {
          create: (photoPaths ?? []).map((filePath, i) => ({ filePath, sortOrder: i })),
        },
      },
      include: {
        customer: true,
        vehicle: true,
        mechanic: true,
        insuranceCompany: true,
        photos: { orderBy: { sortOrder: 'asc' } },
      },
    });
  } catch (error) {
    // Guard against FK/constraint errors so the server never crashes for bad input.
    res.status(400).json({ error: 'Validation failed', message: 'Invalid linked record in job creation request.' });
    return;
  }

  res.status(201).json({
    id: job.id,
    jobNumber: job.jobNumber,
    customer: {
      id: job.customer.id,
      name: job.customer.name,
      phone: job.customer.phone,
      email: job.customer.email ?? undefined,
      address: job.customer.address ?? undefined,
      gstin: job.customer.gstin ?? undefined,
    },
    vehicle: {
      id: job.vehicle.id,
      registrationNo: job.vehicle.registrationNo,
      make: job.vehicle.make,
      model: job.vehicle.model,
      year: job.vehicle.year ?? undefined,
      vin: job.vehicle.vin ?? undefined,
      type: job.vehicle.type ?? undefined,
      fuel: job.vehicle.fuel ?? undefined,
    },
    insuranceCompanyId: job.insuranceCompanyId ?? undefined,
    insuranceCompany: job.insuranceCompany ? { id: job.insuranceCompany.id, name: job.insuranceCompany.name } : undefined,
    complaints: job.complaints,
    odometerReading: job.odometerReading,
    photos: job.photos.map((p) => p.filePath),
    stage: job.stage,
    assignedMechanicId: job.assignedMechanicId ?? undefined,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  });
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const where: { deletedAt: null; organizationId?: string | null } = { deletedAt: null };
  if (user.organizationId) where.organizationId = user.organizationId;

  const jobs = await prisma.jobCard.findMany({
    where,
    include: {
      customer: true,
      vehicle: true,
      mechanic: true,
      insuranceCompany: true,
      photos: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      jobNumber: j.jobNumber,
      customer: {
        id: j.customer.id,
        name: j.customer.name,
        phone: j.customer.phone,
        email: j.customer.email ?? undefined,
        address: j.customer.address ?? undefined,
        gstin: j.customer.gstin ?? undefined,
      },
      vehicle: {
        id: j.vehicle.id,
        registrationNo: j.vehicle.registrationNo,
        make: j.vehicle.make,
        model: j.vehicle.model,
        year: j.vehicle.year ?? undefined,
        vin: j.vehicle.vin ?? undefined,
        type: j.vehicle.type ?? undefined,
        fuel: j.vehicle.fuel ?? undefined,
      },
      insuranceCompanyId: j.insuranceCompanyId ?? undefined,
      insuranceCompany: j.insuranceCompany ? { id: j.insuranceCompany.id, name: j.insuranceCompany.name } : undefined,
      complaints: j.complaints,
      odometerReading: j.odometerReading,
      photos: j.photos.map((p) => p.filePath),
      stage: j.stage,
      assignedMechanicId: j.assignedMechanicId ?? undefined,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    })),
  });
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const id = req.params.id;

  const job = await prisma.jobCard.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(user.organizationId ? { organizationId: user.organizationId } : {}),
    },
    include: {
      customer: true,
      vehicle: true,
      mechanic: true,
      insuranceCompany: true,
      photos: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!job) {
    res.status(404).json({ error: 'Not found', message: 'Job card not found.' });
    return;
  }

  res.json({
    id: job.id,
    jobNumber: job.jobNumber,
    customer: {
      id: job.customer.id,
      name: job.customer.name,
      phone: job.customer.phone,
      email: job.customer.email ?? undefined,
      address: job.customer.address ?? undefined,
      gstin: job.customer.gstin ?? undefined,
    },
    vehicle: {
      id: job.vehicle.id,
      registrationNo: job.vehicle.registrationNo,
      make: job.vehicle.make,
      model: job.vehicle.model,
      year: job.vehicle.year ?? undefined,
      vin: job.vehicle.vin ?? undefined,
      type: job.vehicle.type ?? undefined,
      fuel: job.vehicle.fuel ?? undefined,
    },
    insuranceCompanyId: job.insuranceCompanyId ?? undefined,
    insuranceCompany: job.insuranceCompany ? { id: job.insuranceCompany.id, name: job.insuranceCompany.name } : undefined,
    complaints: job.complaints,
    odometerReading: job.odometerReading,
    photos: job.photos.map((p) => p.filePath),
    stage: job.stage,
    assignedMechanicId: job.assignedMechanicId ?? undefined,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  });
});

const updateStageBody = z.object({
  stage: z.enum(['pending', 'work_in_progress', 'delivered']),
});

const updateJobBody = z.object({
  stage: z.enum(['pending', 'work_in_progress', 'delivered']).optional(),
  insuranceCompanyId: z.string().uuid().nullable().optional(),
});

/** PATCH /jobs/:id – update job stage and/or insurance company */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: { organizationId: string | null } }).user;
  const id = req.params.id;
  const parsed = updateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { stage, insuranceCompanyId } = parsed.data;

  const job = await prisma.jobCard.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(user.organizationId ? { organizationId: user.organizationId } : {}),
    },
    include: {
      customer: true,
      vehicle: true,
      mechanic: true,
      insuranceCompany: true,
      photos: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!job) {
    res.status(404).json({ error: 'Not found', message: 'Job card not found.' });
    return;
  }

  const data: { stage?: string; insuranceCompanyId?: string | null } = {};
  if (stage !== undefined) data.stage = stage;
  if (insuranceCompanyId !== undefined) {
    if (insuranceCompanyId) {
      const company = await prisma.insuranceCompany.findUnique({
        where: { id: insuranceCompanyId },
        select: { id: true },
      });
      if (!company) {
        res.status(400).json({ error: 'Validation failed', message: 'Insurance company is invalid.' });
        return;
      }
    }
    data.insuranceCompanyId = insuranceCompanyId ?? null;
  }

  const updated = await prisma.jobCard.update({
    where: { id },
    data,
    include: {
      customer: true,
      vehicle: true,
      mechanic: true,
      insuranceCompany: true,
      photos: { orderBy: { sortOrder: 'asc' } },
    },
  });

  res.json({
    id: updated.id,
    jobNumber: updated.jobNumber,
    customer: {
      id: updated.customer.id,
      name: updated.customer.name,
      phone: updated.customer.phone,
      email: updated.customer.email ?? undefined,
      address: updated.customer.address ?? undefined,
      gstin: updated.customer.gstin ?? undefined,
    },
    vehicle: {
      id: updated.vehicle.id,
      registrationNo: updated.vehicle.registrationNo,
      make: updated.vehicle.make,
      model: updated.vehicle.model,
      year: updated.vehicle.year ?? undefined,
      vin: updated.vehicle.vin ?? undefined,
      type: updated.vehicle.type ?? undefined,
      fuel: updated.vehicle.fuel ?? undefined,
    },
    insuranceCompanyId: updated.insuranceCompanyId ?? undefined,
    insuranceCompany: updated.insuranceCompany ? { id: updated.insuranceCompany.id, name: updated.insuranceCompany.name } : undefined,
    complaints: updated.complaints,
    odometerReading: updated.odometerReading,
    photos: updated.photos.map((p) => p.filePath),
    stage: updated.stage,
    assignedMechanicId: updated.assignedMechanicId ?? undefined,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

export default router;
