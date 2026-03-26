import type { Part, Vendor, StockMovement } from '../types/models';

export let MOCK_VENDORS: Vendor[] = [
  { id: 'vnd1', name: 'Auto Parts India', contactPerson: 'Ramesh', phone: '+91 98765 11111', address: 'Bangalore' },
  { id: 'vnd2', name: 'Spare Hub', contactPerson: 'Sita', phone: '+91 98765 22222', email: 'orders@sparehub.com' },
  { id: 'vnd3', name: 'OEM Supplies', contactPerson: 'Kiran', phone: '+91 98765 33333' },
];

/** In-memory parts catalogue. Add/edit via addPart, updatePart. */
export let MOCK_PARTS: Part[] = [
  { id: 'p1', code: 'BRK-PAD-001', name: 'Brake Pad Set', quantity: 12, minQuantity: 5, unit: 'set', price: 2500, costPrice: 1800, vendorId: 'vnd1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p2', code: 'OIL-1L-001', name: 'Engine Oil (1L)', quantity: 48, minQuantity: 20, unit: 'bottle', price: 550, costPrice: 380, vendorId: 'vnd1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p3', code: 'AIR-FLT-001', name: 'Air Filter', quantity: 8, minQuantity: 10, unit: 'piece', price: 450, costPrice: 280, vendorId: 'vnd2', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p4', code: 'CLNT-001', name: 'Coolant', quantity: 6, minQuantity: 8, unit: 'bottle', price: 380, costPrice: 220, vendorId: 'vnd2', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p5', code: 'AC-GAS', name: 'AC Refrigerant R134a', quantity: 4, minQuantity: 5, unit: 'can', price: 650, costPrice: 400, vendorId: 'vnd3', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

/** Stock movements (purchase, issue to job, return). */
export let MOCK_STOCK_MOVEMENTS: StockMovement[] = [
  { id: 'm1', partId: 'p1', type: 'purchase', quantity: 20, referenceId: 'vnd1', referenceLabel: 'Auto Parts India', unitCost: 1800, createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'm2', partId: 'p1', type: 'issue_to_job', quantity: -2, referenceId: '1', referenceLabel: 'JC-2024-001', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'm3', partId: 'p2', type: 'purchase', quantity: 24, referenceId: 'vnd1', referenceLabel: 'Auto Parts India', unitCost: 380, createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'm4', partId: 'p2', type: 'issue_to_job', quantity: -4, referenceId: '1', referenceLabel: 'JC-2024-001', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'm5', partId: 'p3', type: 'return', quantity: 2, referenceId: '1', referenceLabel: 'JC-2024-001 return', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
];

export function getPartById(id: string): Part | undefined {
  return MOCK_PARTS.find((p) => p.id === id);
}

export function getVendorById(id: string): Vendor | undefined {
  return MOCK_VENDORS.find((v) => v.id === id);
}

export function getMovementsByPartId(partId: string): StockMovement[] {
  return [...MOCK_STOCK_MOVEMENTS].filter((m) => m.partId === partId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getLowStockParts(): Part[] {
  return MOCK_PARTS.filter((p) => p.quantity < p.minQuantity);
}

export function addPart(part: Part): void {
  part.createdAt = new Date().toISOString();
  part.updatedAt = part.createdAt;
  MOCK_PARTS = [...MOCK_PARTS, part];
}

export function updatePart(part: Part): void {
  part.updatedAt = new Date().toISOString();
  MOCK_PARTS = MOCK_PARTS.map((p) => (p.id === part.id ? part : p));
}

export function addStockMovement(movement: StockMovement): void {
  MOCK_STOCK_MOVEMENTS = [...MOCK_STOCK_MOVEMENTS, movement];
  const part = MOCK_PARTS.find((p) => p.id === movement.partId);
  if (part) {
    part.quantity = Math.max(0, part.quantity + movement.quantity);
    part.updatedAt = new Date().toISOString();
    MOCK_PARTS = MOCK_PARTS.map((p) => (p.id === part.id ? part : p));
  }
}

export function getStockValue(): number {
  return MOCK_PARTS.reduce((sum, p) => sum + p.quantity * (p.costPrice ?? p.price), 0);
}

export function getMovementSummary(partId?: string): { in: number; out: number; returns: number } {
  const list = partId ? MOCK_STOCK_MOVEMENTS.filter((m) => m.partId === partId) : MOCK_STOCK_MOVEMENTS;
  let inQty = 0, outQty = 0, returns = 0;
  list.forEach((m) => {
    if (m.type === 'purchase') inQty += m.quantity;
    else if (m.type === 'issue_to_job') outQty += Math.abs(m.quantity);
    else if (m.type === 'return') returns += m.quantity;
  });
  return { in: inQty, out: outQty, returns };
}

/** Fast-moving: most quantity issued in last 30 days. Slow-moving: least. */
export function getFastSlowMoving(dayWindow = 30): { partId: string; partName: string; code: string; quantityMoved: number }[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dayWindow);
  const byPart: Record<string, { partId: string; partName: string; code: string; quantityMoved: number }> = {};
  MOCK_STOCK_MOVEMENTS.filter((m) => m.type === 'issue_to_job' && new Date(m.createdAt) >= cutoff).forEach((m) => {
    const p = MOCK_PARTS.find((x) => x.id === m.partId);
    if (!p) return;
    if (!byPart[m.partId]) byPart[m.partId] = { partId: p.id, partName: p.name, code: p.code, quantityMoved: 0 };
    byPart[m.partId].quantityMoved += Math.abs(m.quantity);
  });
  MOCK_PARTS.forEach((p) => {
    if (!byPart[p.id]) byPart[p.id] = { partId: p.id, partName: p.name, code: p.code, quantityMoved: 0 };
  });
  return Object.values(byPart).sort((a, b) => b.quantityMoved - a.quantityMoved);
}

export function addVendor(vendor: Vendor): void {
  MOCK_VENDORS = [...MOCK_VENDORS, vendor];
}
