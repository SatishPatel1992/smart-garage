import type { Estimate, EstimateLine, EstimateRevision } from '../types/models';

/** In-memory estimate store keyed by job. Replace with API. */
const byJob = new Map<string, Estimate>();

function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split('T')[0];
}

export function getEstimateByJobId(jobCardId: string): Estimate | undefined {
  return byJob.get(jobCardId);
}

export function saveEstimate(estimate: Estimate): void {
  const updated = {
    ...estimate,
    updatedAt: new Date().toISOString(),
  };
  byJob.set(estimate.jobCardId, updated);
}

export function createEstimateForJob(
  jobCardId: string,
  jobNumber: string,
  lines: EstimateLine[],
  totalAmount: number
): Estimate {
  const id = `est-${jobCardId}-${Date.now()}`;
  const estimateNumber = `EST-${jobNumber}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const estimate: Estimate = {
    id,
    estimateNumber,
    jobCardId,
    lines: [...lines],
    totalAmount,
    status: 'draft',
    validUntil: defaultValidUntil(),
    revisions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  byJob.set(jobCardId, estimate);
  return estimate;
}

export function addEstimateRevision(estimateId: string, jobCardId: string, lines: EstimateLine[], totalAmount: number, note?: string): Estimate | undefined {
  const est = byJob.get(jobCardId);
  if (!est || est.id !== estimateId) return undefined;
  const version = (est.revisions?.length ?? 0) + 1;
  const rev: EstimateRevision = {
    id: `rev-${estimateId}-${Date.now()}`,
    estimateId,
    version,
    lines: lines.map((l) => ({ ...l })),
    totalAmount,
    note,
    createdAt: new Date().toISOString(),
  };
  const revisions = [...(est.revisions ?? []), rev];
  const updated: Estimate = { ...est, revisions, updatedAt: new Date().toISOString() };
  byJob.set(jobCardId, updated);
  return updated;
}

export function getAllEstimates(): Estimate[] {
  return Array.from(byJob.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getViewEstimateLink(estimateId: string): string {
  return `https://garage.example.com/estimate/${estimateId}`;
}

export function isEstimateExpired(estimate: Estimate): boolean {
  if (!estimate.validUntil) return false;
  return new Date(estimate.validUntil) < new Date();
}
