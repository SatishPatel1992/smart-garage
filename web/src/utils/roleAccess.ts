export type AppRole = 'admin' | 'advisor' | 'mechanic' | 'accounts';

export type AppSection =
  | 'dashboard'
  | 'jobs'
  | 'billing'
  | 'customers'
  | 'estimates'
  | 'inventory'
  | 'procurement'
  | 'payments'
  | 'creditNotes'
  | 'reports'
  | 'communications'
  | 'serviceReminders'
  | 'settings'
  | 'users'
  | 'profile'
  | 'vehicleMakes';

const ROLE_ACCESS: Record<AppRole, AppSection[]> = {
  admin: [
    'dashboard',
    'jobs',
    'billing',
    'customers',
    'estimates',
    'inventory',
    'procurement',
    'payments',
    'creditNotes',
    'reports',
    'communications',
    'serviceReminders',
    'settings',
    'users',
    'profile',
    'vehicleMakes',
  ],
  advisor: [
    'dashboard',
    'jobs',
    'customers',
    'estimates',
    'inventory',
    'procurement',
    'billing',
    'payments',
    'creditNotes',
    'reports',
    'communications',
    'serviceReminders',
    'profile',
  ],
  mechanic: [
    'dashboard',
    'jobs',
    'inventory',
    'profile',
  ],
  accounts: [
    'dashboard',
    'procurement',
    'billing',
    'payments',
    'creditNotes',
    'reports',
    'customers',
    'settings',
    'profile',
  ],
};

export function toAppRole(role: string | null | undefined): AppRole | null {
  if (role === 'admin' || role === 'advisor' || role === 'mechanic' || role === 'accounts') return role;
  return null;
}

export function canAccess(role: string | null | undefined, section: AppSection): boolean {
  const r = toAppRole(role);
  if (!r) return false;
  return ROLE_ACCESS[r].includes(section);
}

