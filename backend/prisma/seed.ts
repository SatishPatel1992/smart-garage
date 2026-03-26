import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import https from 'https';

const prisma = new PrismaClient();

type IndiancarsRow = { brand: string; model: string };
type IndiancarsDataset = { cars: IndiancarsRow[] };

const normalizeName = (s: string) => s.replace(/\s+/g, ' ').trim();

async function downloadJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Failed to download ${url}. Status: ${res.statusCode}`));
          return;
        }
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw) as T);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: 'smart-garage' },
    create: {
      name: 'Smart Garage',
      slug: 'smart-garage',
      address: null,
      phone: null,
      gstin: null,
    },
    update: {},
  });

  const hash = await bcrypt.hash('password', 12);
  await prisma.user.upsert({
    where: { email: 'admin@garage.com' },
    create: {
      email: 'admin@garage.com',
      passwordHash: hash,
      name: 'Admin',
      role: 'admin',
      organizationId: org.id,
      isActive: true,
    },
    update: { passwordHash: hash, isActive: true },
  });

  const insuranceCount = await prisma.insuranceCompany.count();
  if (insuranceCount === 0) {
    const insuranceNames = ['No insurance', 'Future Generali India Insurance', 'ICICI Lombard', 'HDFC Ergo', 'Bajaj Allianz', 'Tata AIG'];
    for (const name of insuranceNames) {
      await prisma.insuranceCompany.create({ data: { name } });
    }
  }

  const serviceItems = [
    { name: 'EGR Service', type: 'labour' as const, defaultUnitPrice: 2850, defaultTaxRatePercent: 18 },
    { name: 'Scanning', type: 'labour' as const, defaultUnitPrice: 800, defaultTaxRatePercent: 18 },
    { name: 'Oil Change', type: 'labour' as const, defaultUnitPrice: 600, defaultTaxRatePercent: 18 },
    { name: 'Brake Pad Set', type: 'part' as const, defaultUnitPrice: 2500, defaultTaxRatePercent: 18 },
    { name: 'Air Filter', type: 'part' as const, defaultUnitPrice: 450, defaultTaxRatePercent: 18 },
    { name: 'AC Gas Refill', type: 'labour' as const, defaultUnitPrice: 1200, defaultTaxRatePercent: 18 },
    { name: 'Wheel Alignment', type: 'labour' as const, defaultUnitPrice: 400, defaultTaxRatePercent: 18 },
    { name: 'Engine Oil (1L)', type: 'part' as const, defaultUnitPrice: 550, defaultTaxRatePercent: 18 },
    { name: 'Coolant', type: 'part' as const, defaultUnitPrice: 380, defaultTaxRatePercent: 18 },
    { name: 'Tyre Replacement', type: 'labour' as const, defaultUnitPrice: 200, defaultTaxRatePercent: 18 },
  ];
  const count = await prisma.serviceItem.count();
  if (count === 0) {
    for (const item of serviceItems) {
      await prisma.serviceItem.create({
        data: {
          name: item.name,
          type: item.type,
          defaultUnitPrice: item.defaultUnitPrice,
          defaultTaxRatePercent: item.defaultTaxRatePercent,
          isActive: true,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Backfill Vehicle Makes/Models from existing customer vehicles.
  // This makes sure the dropdown lookup tables contain "existing" values
  // already present in your database test/real data.
  // ---------------------------------------------------------------------------
  const makeModelRows = await prisma.$queryRaw<
    Array<{ organizationId: string; make: string; model: string }>
  >`
    SELECT
      c.organization_id AS "organizationId",
      v.make AS make,
      v.model AS model
    FROM "vehicles" v
    INNER JOIN "customers" c
      ON c.id = v.customer_id
    WHERE
      c.organization_id IS NOT NULL
      AND v.deleted_at IS NULL
      AND TRIM(COALESCE(v.make, '')) <> ''
      AND TRIM(COALESCE(v.model, '')) <> ''
    GROUP BY
      c.organization_id, v.make, v.model
  `;

  const orgIds = Array.from(new Set(makeModelRows.map((r) => r.organizationId)));
  const existingMakes = await prisma.vehicleMake.findMany({
    where: { organizationId: { in: orgIds } },
    select: { id: true, organizationId: true, name: true },
  });

  const makeKey = (organizationId: string, name: string) => `${organizationId}|${name.trim().toLowerCase()}`;
  const makeByKey = new Map<string, { id: string; name: string }>();
  for (const m of existingMakes) {
    makeByKey.set(makeKey(m.organizationId ?? '', m.name), { id: m.id, name: m.name });
  }

  // Preload existing models for any makes we already have.
  const existingMakeIds = existingMakes.map((m) => m.id);
  const existingModels = existingMakeIds.length
    ? await prisma.vehicleModel.findMany({
        where: { vehicleMakeId: { in: existingMakeIds } },
        select: { id: true, vehicleMakeId: true, name: true },
      })
    : [];

  const modelKey = (vehicleMakeId: string, name: string) => `${vehicleMakeId}|${name.trim().toLowerCase()}`;
  const modelByKey = new Set<string>();
  for (const mo of existingModels) {
    modelByKey.add(modelKey(mo.vehicleMakeId, mo.name));
  }

  let createdMakes = 0;
  let createdModels = 0;

  for (const row of makeModelRows) {
    const trimmedMake = row.make.trim();
    const trimmedModel = row.model.trim();
    const orgId = row.organizationId;

    const mKey = makeKey(orgId, trimmedMake);
    let make = makeByKey.get(mKey);
    if (!make) {
      const created = await prisma.vehicleMake.create({
        data: { organizationId: orgId, name: trimmedMake },
        select: { id: true, name: true },
      });
      make = created;
      makeByKey.set(mKey, make);
      createdMakes += 1;
    }

    const modelK = modelKey(make.id, trimmedModel);
    if (!modelByKey.has(modelK)) {
      await prisma.vehicleModel.create({
        data: { vehicleMakeId: make.id, name: trimmedModel },
      });
      modelByKey.add(modelK);
      createdModels += 1;
    }
  }

  // Fallback: if there is no vehicle data to derive makes/models from (e.g. fresh DB),
  // seed a small starter set so the UI can work immediately.
  const makeCountForOrg = await prisma.vehicleMake.count({ where: { organizationId: org.id } });
  if (makeCountForOrg === 0) {
    const starter = [
      { name: 'Maruti', models: ['Swift', 'Dzire'] },
      { name: 'Hyundai', models: ['i20', 'Creta'] },
    ];

    for (const s of starter) {
      const makeName = s.name.trim();
      const existingMake = await prisma.vehicleMake.findFirst({
        where: { organizationId: org.id, name: { equals: makeName, mode: 'insensitive' } },
        select: { id: true },
      });

      const make = existingMake
        ? existingMake
        : await prisma.vehicleMake.create({
            data: { organizationId: org.id, name: makeName },
            select: { id: true },
          });

      if (!existingMake) createdMakes += 1;

      for (const modelNameRaw of s.models) {
        const modelName = modelNameRaw.trim();
        const existingModel = await prisma.vehicleModel.findFirst({
          where: { vehicleMakeId: make.id, name: { equals: modelName, mode: 'insensitive' } },
          select: { id: true },
        });

        if (!existingModel) {
          await prisma.vehicleModel.create({
            data: { vehicleMakeId: make.id, name: modelName },
          });
          createdModels += 1;
        }
      }
    }

    console.log(`Seed starter vehicle makes/models added (UI-ready).`);
  }

  console.log(
    `Seed done: organization + admin + insurance + service items. Backfilled vehicle makes: ${createdMakes}, models: ${createdModels}`,
  );

  // ---------------------------------------------------------------------------
  // Add broader "existing makes/models" for the Indian market.
  //
  // Note: "all models ever in India" is not realistically enumerable here,
  // but we can import a large, practical dataset to populate your lookups.
  // ---------------------------------------------------------------------------
  const sourceEnabled = process.env.IMPORT_INDIAN_VEHICLE_MAKES_MODELS ?? 'true';
  const shouldImport = sourceEnabled.toLowerCase() === 'true';
  if (shouldImport) {
    const LOCAL_PATH = path.resolve(__dirname, 'indiancars.json');
    const REMOTE_URL = 'https://raw.githubusercontent.com/deepakssn/indiancars/master/indiancars.json';

    try {
      const dataset: IndiancarsDataset = fs.existsSync(LOCAL_PATH)
        ? JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf8')) as IndiancarsDataset
        : await downloadJson<IndiancarsDataset>(REMOTE_URL);

      const incoming = new Map<string, { canonicalName: string; models: Set<string> }>(); // makeLower -> models (Set)
      for (const row of dataset.cars ?? []) {
        const brand = normalizeName(row.brand ?? '');
        const model = normalizeName(row.model ?? '');
        if (!brand || !model) continue;

        const makeLower = brand.toLowerCase();
        if (!incoming.has(makeLower)) incoming.set(makeLower, { canonicalName: brand, models: new Set() });
        incoming.get(makeLower)!.models.add(model);
      }

      const existingMakes = await prisma.vehicleMake.findMany({
        where: { organizationId: org.id },
        select: { id: true, name: true },
      });

      const makeByLower = new Map<string, { id: string; name: string }>();
      for (const m of existingMakes) {
        makeByLower.set(m.name.trim().toLowerCase(), { id: m.id, name: m.name });
      }

      let addedMakes = 0;
      let addedModels = 0;

      // Import per make: fetch existing models for that make, then create missing.
      for (const [makeLower, entry] of incoming.entries()) {
        const models = entry.models;
        let make = makeByLower.get(makeLower);

        if (!make) {
          const created = await prisma.vehicleMake.create({
            data: { organizationId: org.id, name: entry.canonicalName },
            select: { id: true, name: true },
          });
          make = created;
          makeByLower.set(makeLower, make);
          addedMakes += 1;
        }

        const existingModels = await prisma.vehicleModel.findMany({
          where: { vehicleMakeId: make.id },
          select: { id: true, name: true },
        });

        const modelLowerSet = new Set(existingModels.map((m) => m.name.trim().toLowerCase()));

        const missing = Array.from(models)
          .map((m) => normalizeName(m))
          .filter((m) => !!m)
          .filter((m) => !modelLowerSet.has(m.toLowerCase()));

        if (missing.length === 0) continue;

        const createdMany = await prisma.vehicleModel.createMany({
          data: missing.map((name) => ({ vehicleMakeId: make!.id, name })),
          skipDuplicates: true,
        });

        addedModels += createdMany.count;
      }

      console.log(`Vehicle makes/models import complete: +${addedMakes} makes, +${addedModels} models.`);
    } catch (e) {
      console.warn('Vehicle makes/models import failed; kept existing lookups.', e);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
