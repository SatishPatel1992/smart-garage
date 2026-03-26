import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MAKES_SQL = `
(1,  'Maruti Suzuki',  'India (Joint Venture)'),
(2,  'Tata Motors',    'India'),
(3,  'Mahindra',       'India'),
(4,  'Hyundai',        'South Korea'),
(5,  'Kia',            'South Korea'),
(6,  'Toyota',         'Japan'),
(7,  'Honda',          'Japan'),
(8,  'Renault',        'France'),
(9,  'Nissan',         'Japan'),
(10, 'Volkswagen',     'Germany'),
(11, 'Skoda',          'Czech Republic'),
(12, 'MG Motor',       'UK / China (SAIC)'),
(13, 'Jeep',           'USA'),
(14, 'Mercedes-Benz',  'Germany'),
(15, 'BMW',            'Germany'),
(16, 'Audi',           'Germany'),
(17, 'Volvo',          'Sweden'),
(18, 'Lexus',          'Japan'),
(19, 'Porsche',        'Germany'),
(20, 'Land Rover',     'UK'),
(21, 'Jaguar',         'UK'),
(22, 'Lamborghini',    'Italy'),
(23, 'Ferrari',        'Italy'),
(24, 'Rolls-Royce',    'UK'),
(25, 'Bentley',        'UK'),
(26, 'Maserati',       'Italy'),
(27, 'BYD',            'China'),
(28, 'Citroen',        'France'),
(29, 'Isuzu',          'Japan'),
(30, 'Force Motors',   'India');
`;

const MODELS_SQL = `
(1,  1, 'Alto K10',              'Hatchback'),
(2,  1, 'S-Presso',              'Hatchback'),
(3,  1, 'Celerio',               'Hatchback'),
(4,  1, 'Swift',                 'Hatchback'),
(5,  1, 'Baleno',                'Hatchback'),
(6,  1, 'Wagon R',               'Hatchback'),
(7,  1, 'Ignis',                 'Hatchback'),
(8,  1, 'Dzire',                 'Sedan'),
(9,  1, 'Ciaz',                  'Sedan'),
(10, 1, 'Ertiga',                'MPV'),
(11, 1, 'XL6',                   'MPV'),
(12, 1, 'Brezza',                'SUV'),
(13, 1, 'Grand Vitara',          'SUV'),
(14, 1, 'Jimny',                 'SUV'),
(15, 1, 'Invicto',               'MPV'),
(16, 1, 'FRONX',                 'SUV'),
(17, 1, 'e Vitara',              'Electric SUV'),
(18, 2, 'Tiago',                 'Hatchback'),
(19, 2, 'Tiago EV',              'Electric Hatchback'),
(20, 2, 'Altroz',                'Hatchback'),
(21, 2, 'Tigor',                 'Sedan'),
(22, 2, 'Tigor EV',              'Electric Sedan'),
(23, 2, 'Nexon',                 'SUV'),
(24, 2, 'Nexon EV',              'Electric SUV'),
(25, 2, 'Punch',                 'SUV'),
(26, 2, 'Punch EV',              'Electric SUV'),
(27, 2, 'Harrier',               'SUV'),
(28, 2, 'Safari',                'SUV'),
(29, 2, 'Sierra',                'SUV'),
(30, 2, 'Curvv',                 'SUV Coupe'),
(31, 2, 'Curvv EV',              'Electric SUV Coupe'),
(32, 2, 'Avinya EV',             'Electric SUV'),
(33, 3, 'Bolero',                'SUV'),
(34, 3, 'Bolero Neo',            'SUV'),
(35, 3, 'Scorpio Classic',       'SUV'),
(36, 3, 'Scorpio N',             'SUV'),
(37, 3, 'Thar',                  'SUV'),
(38, 3, 'Thar Roxx',             'SUV'),
(39, 3, 'XUV300',                'SUV'),
(40, 3, 'XUV400 EV',             'Electric SUV'),
(41, 3, 'XUV3XO',                'SUV'),
(42, 3, 'XUV700',                'SUV'),
(43, 3, 'XUV 9e',                'Electric SUV'),
(44, 3, 'BE 6',                  'Electric SUV Coupe'),
(45, 3, 'Marazzo',               'MPV'),
(46, 4, 'Grand i10 Nios',        'Hatchback'),
(47, 4, 'i20',                   'Hatchback'),
(48, 4, 'Aura',                  'Sedan'),
(49, 4, 'Verna',                 'Sedan'),
(50, 4, 'Exter',                 'SUV'),
(51, 4, 'Venue',                 'SUV'),
(52, 4, 'Creta',                 'SUV'),
(53, 4, 'Creta Electric',        'Electric SUV'),
(54, 4, 'Alcazar',               'SUV'),
(55, 4, 'Tucson',                'SUV'),
(56, 4, 'Ioniq 5',               'Electric SUV'),
(57, 4, 'Ioniq 6',               'Electric Sedan'),
(58, 5, 'Sonet',                 'SUV'),
(59, 5, 'Seltos',                'SUV'),
(60, 5, 'Carens',                'MPV'),
(61, 5, 'EV6',                   'Electric SUV'),
(62, 5, 'EV9',                   'Electric SUV'),
(63, 5, 'Syros',                 'SUV'),
(64, 6, 'Glanza',                'Hatchback'),
(65, 6, 'Rumion',                'MPV'),
(66, 6, 'Camry',                 'Sedan'),
(67, 6, 'Urban Cruiser Hyryder', 'SUV'),
(68, 6, 'Urban Cruiser Taisor',  'SUV'),
(69, 6, 'Fortuner',              'SUV'),
(70, 6, 'Fortuner Legender',     'SUV'),
(71, 6, 'Innova Crysta',         'MPV'),
(72, 6, 'Innova HyCross',        'MPV'),
(73, 6, 'Land Cruiser',          'SUV'),
(74, 6, 'Vellfire',              'MPV'),
(75, 6, 'bZ4X',                  'Electric SUV'),
(76, 7, 'Amaze',                 'Sedan'),
(77, 7, 'City',                  'Sedan'),
(78, 7, 'City Hybrid',           'Hybrid Sedan'),
(79, 7, 'Elevate',               'SUV'),
(80, 8, 'Kwid',                  'Hatchback'),
(81, 8, 'Triber',                'MPV'),
(82, 8, 'Kiger',                 'SUV'),
(83, 8, 'Duster',                'SUV'),
(84, 9, 'Magnite',               'SUV'),
(85, 9, 'Gravite',               'SUV'),
(86, 10, 'Polo',                 'Hatchback'),
(87, 10, 'Vento',                'Sedan'),
(88, 10, 'Virtus',               'Sedan'),
(89, 10, 'Taigun',               'SUV'),
(90, 10, 'Tiguan',               'SUV'),
(91, 10, 'ID.4',                 'Electric SUV'),
(92, 11, 'Slavia',               'Sedan'),
(93, 11, 'Kushaq',               'SUV'),
(94, 11, 'Octavia',              'Sedan'),
(95, 11, 'Superb',               'Sedan'),
(96, 11, 'Kodiaq',               'SUV'),
(97, 11, 'Enyaq',                'Electric SUV'),
(98,  12, 'Hector',              'SUV'),
(99,  12, 'Hector Plus',         'SUV'),
(100, 12, 'Astor',               'SUV'),
(101, 12, 'ZS EV',               'Electric SUV'),
(102, 12, 'Comet EV',            'Electric Hatchback'),
(103, 12, 'Windsor EV',          'Electric MPV'),
(104, 12, 'Gloster',             'SUV'),
(105, 13, 'Compass',             'SUV'),
(106, 13, 'Meridian',            'SUV'),
(107, 13, 'Wrangler',            'SUV'),
(108, 13, 'Grand Cherokee',      'SUV'),
(109, 14, 'A-Class',             'Hatchback'),
(110, 14, 'C-Class',             'Sedan'),
(111, 14, 'E-Class',             'Sedan'),
(112, 14, 'S-Class',             'Sedan'),
(113, 14, 'GLA',                 'SUV'),
(114, 14, 'GLC',                 'SUV'),
(115, 14, 'GLE',                 'SUV'),
(116, 14, 'GLS',                 'SUV'),
(117, 14, 'EQS',                 'Electric Sedan'),
(118, 14, 'EQB',                 'Electric SUV'),
(119, 14, 'AMG GT',              'Sports Car'),
(120, 15, '2 Series',            'Sedan'),
(121, 15, '3 Series',            'Sedan'),
(122, 15, '5 Series',            'Sedan'),
(123, 15, '7 Series',            'Sedan'),
(124, 15, 'X1',                  'SUV'),
(125, 15, 'X3',                  'SUV'),
(126, 15, 'X5',                  'SUV'),
(127, 15, 'X7',                  'SUV'),
(128, 15, 'iX',                  'Electric SUV'),
(129, 15, 'iX1',                 'Electric SUV'),
(130, 15, 'M4',                  'Sports Car'),
(131, 16, 'A4',                  'Sedan'),
(132, 16, 'A6',                  'Sedan'),
(133, 16, 'A8',                  'Sedan'),
(134, 16, 'Q3',                  'SUV'),
(135, 16, 'Q5',                  'SUV'),
(136, 16, 'Q7',                  'SUV'),
(137, 16, 'Q8',                  'SUV'),
(138, 16, 'e-tron',              'Electric SUV'),
(139, 16, 'Q8 e-tron',           'Electric SUV'),
(140, 16, 'RS5',                 'Sports Car'),
(141, 17, 'S90',                 'Sedan'),
(142, 17, 'XC40',                'SUV'),
(143, 17, 'XC60',                'SUV'),
(144, 17, 'XC90',                'SUV'),
(145, 17, 'C40 Recharge',        'Electric SUV'),
(146, 17, 'EX40',                'Electric SUV'),
(147, 17, 'EX90',                'Electric SUV'),
(148, 18, 'ES',                  'Sedan'),
(149, 18, 'NX',                  'SUV'),
(150, 18, 'RX',                  'SUV'),
(151, 18, 'LX',                  'SUV'),
(152, 18, 'LC',                  'Sports Car'),
(153, 18, 'UX 300e',             'Electric SUV'),
(154, 19, 'Cayenne',             'SUV'),
(155, 19, 'Macan',               'SUV'),
(156, 19, 'Panamera',            'Sedan'),
(157, 19, '911',                 'Sports Car'),
(158, 19, 'Taycan',              'Electric Sedan'),
(159, 20, 'Defender',            'SUV'),
(160, 20, 'Discovery',           'SUV'),
(161, 20, 'Discovery Sport',     'SUV'),
(162, 20, 'Freelander',          'SUV'),
(163, 20, 'Range Rover',         'SUV'),
(164, 20, 'Range Rover Sport',   'SUV'),
(165, 20, 'Range Rover Velar',   'SUV'),
(166, 20, 'Range Rover Evoque',  'SUV'),
(167, 21, 'XE',                  'Sedan'),
(168, 21, 'XF',                  'Sedan'),
(169, 21, 'F-Pace',              'SUV'),
(170, 21, 'I-Pace',              'Electric SUV'),
(171, 22, 'Huracan',             'Sports Car'),
(172, 22, 'Urus',                'SUV'),
(173, 22, 'Revuelto',            'Sports Car'),
(174, 23, 'Roma',                'Sports Car'),
(175, 23, 'Portofino M',         'Sports Car'),
(176, 23, 'SF90 Stradale',       'Sports Car'),
(177, 23, 'Purosangue',          'SUV'),
(178, 24, 'Ghost',               'Sedan'),
(179, 24, 'Phantom',             'Sedan'),
(180, 24, 'Cullinan',            'SUV'),
(181, 24, 'Spectre',             'Electric Coupe'),
(182, 25, 'Bentayga',            'SUV'),
(183, 25, 'Flying Spur',         'Sedan'),
(184, 25, 'Continental GT',      'Sports Car'),
(185, 26, 'Ghibli',              'Sedan'),
(186, 26, 'Levante',             'SUV'),
(187, 26, 'Quattroporte',        'Sedan'),
(188, 27, 'Atto 3',              'Electric SUV'),
(189, 27, 'Seal',                'Electric Sedan'),
(190, 27, 'Sealion 6',           'Electric SUV'),
(191, 28, 'C3',                  'Hatchback'),
(192, 28, 'C3 Aircross',         'SUV'),
(193, 28, 'eC3',                 'Electric Hatchback'),
(194, 29, 'D-Max',               'Pickup Truck'),
(195, 29, 'MU-X',                'SUV'),
(196, 30, 'Gurkha',              'SUV'),
(197, 30, 'Traveller',           'MPV');
`;

function parseMakeRows(sql: string): Array<{ id: number; make: string; origin: string }> {
  const rows: Array<{ id: number; make: string; origin: string }> = [];
  const re = /\((\d+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    rows.push({ id: Number(m[1]), make: m[2].trim(), origin: m[3].trim() });
  }
  return rows;
}

function parseModelRows(sql: string): Array<{ id: number; makeId: number; model: string; segment: string }> {
  const rows: Array<{ id: number; makeId: number; model: string; segment: string }> = [];
  const re = /\((\d+)\s*,\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    rows.push({
      id: Number(m[1]),
      makeId: Number(m[2]),
      model: m[3].trim(),
      segment: m[4].trim(),
    });
  }
  return rows;
}

async function main() {
  const makeRows = parseMakeRows(MAKES_SQL);
  const modelRows = parseModelRows(MODELS_SQL);

  const org =
    (await prisma.organization.findUnique({ where: { slug: 'smart-garage' } })) ??
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: 'Smart Garage', slug: 'smart-garage' } }));

  const makeIdToDbId = new Map<number, string>();
  let createdMakes = 0;
  let createdModels = 0;

  for (const row of makeRows) {
    const existing = await prisma.vehicleMake.findFirst({
      where: {
        organizationId: org.id,
        name: { equals: row.make, mode: 'insensitive' },
      },
      select: { id: true },
    });

    let dbId: string;
    if (existing) {
      dbId = existing.id;
    } else {
      const created = await prisma.vehicleMake.create({
        data: { organizationId: org.id, name: row.make },
        select: { id: true },
      });
      dbId = created.id;
      createdMakes += 1;
    }

    makeIdToDbId.set(row.id, dbId);
  }

  for (const row of modelRows) {
    const makeDbId = makeIdToDbId.get(row.makeId);
    if (!makeDbId) continue;

    const existing = await prisma.vehicleModel.findFirst({
      where: {
        vehicleMakeId: makeDbId,
        name: { equals: row.model, mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.vehicleModel.create({
        data: { vehicleMakeId: makeDbId, name: row.model },
      });
      createdModels += 1;
    }
  }

  console.log(
    `Imported Indian list into vehicle tables for org "${org.name}": +${createdMakes} makes, +${createdModels} models.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

