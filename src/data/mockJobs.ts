import type { JobCard, Mechanic } from '../types/models';

export const MOCK_MECHANICS: Mechanic[] = [
  { id: 'm1', name: 'Suresh', phone: '+91 98765 11111' },
  { id: 'm2', name: 'Kumar', phone: '+91 98765 22222' },
];

export let MOCK_JOBS: JobCard[] = [
  {
    id: '1',
    jobNumber: 'JC-2024-001',
    customer: { id: 'c1', name: 'Raj Kumar', phone: '+91 98765 43210' },
    vehicle: { id: 'v1', registrationNo: 'KA-01-AB-1234', make: 'Maruti', model: 'Swift' },
    complaints: 'Brake noise, engine check light',
    odometerReading: 45000,
    photos: [],
    stage: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    jobNumber: 'JC-2024-002',
    customer: { id: 'c2', name: 'Priya S', phone: '+91 91234 56789' },
    vehicle: { id: 'v2', registrationNo: 'TN-09-XY-5678', make: 'Hyundai', model: 'i20' },
    complaints: 'Oil change, tyre rotation',
    odometerReading: 22000,
    photos: [],
    stage: 'work_in_progress',
    assignedMechanicId: 'm1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    jobNumber: 'JC-2024-003',
    customer: { id: 'c3', name: 'Amit Patel', phone: '+91 99887 76655' },
    vehicle: { id: 'v3', registrationNo: 'MH-02-CD-9012', make: 'Honda', model: 'City' },
    complaints: 'AC not cooling',
    odometerReading: 67000,
    photos: [],
    stage: 'delivered',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function getJobById(id: string): JobCard | undefined {
  return MOCK_JOBS.find((j) => j.id === id);
}

export function addJob(job: JobCard): void {
  MOCK_JOBS = [...MOCK_JOBS, job];
}

export function getNextJobNumber(): string {
  const year = new Date().getFullYear();
  const prefix = `JC-${year}-`;
  const nums = MOCK_JOBS.filter((j) => j.jobNumber.startsWith(prefix))
    .map((j) => parseInt(j.jobNumber.replace(prefix, ''), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return prefix + String(next).padStart(3, '0');
}
