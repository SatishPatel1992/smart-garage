import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { customers as customersApi, jobs as jobsApi } from '../api/client';
import type { CustomerWithVehiclesDto, JobCardDto } from '../api/client';

// ─── types ───────────────────────────────────────────────────────────────────

type Vehicle = CustomerWithVehiclesDto['vehicles'][number];

type ServiceType = {
  id: string;
  label: string;
  icon: string;
  defaultIntervalKm: number;
  defaultIntervalDays: number;
  fuelTypes?: string[]; // only for specific fuel types (undefined = all)
};

type ReminderRecord = {
  vehicleId: string;
  serviceTypeId: string;
  lastServiceDate: string; // ISO
  lastServiceOdometer: number;
  nextDueDateOverride?: string;
  nextDueOdometerOverride?: number;
};

type ReminderRow = {
  svc: ServiceType;
  rem: ReminderRecord;
  nextDate: string;
  nextOdo: number | null;
  dDays: number;
  dKm: number | null;
  status: DueStatus;
  ss: { label: string; bg: string; color: string; dot: string };
};

const REMINDER_KEY = 'sg_service_reminders';

function loadReminders(): ReminderRecord[] {
  try { return JSON.parse(localStorage.getItem(REMINDER_KEY) ?? '[]'); } catch { return []; }
}
function saveReminders(r: ReminderRecord[]) {
  localStorage.setItem(REMINDER_KEY, JSON.stringify(r));
}

function normalizeIndianPhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// ─── service types config ────────────────────────────────────────────────────

const SERVICE_TYPES: ServiceType[] = [
  { id: 'oil_change',      label: 'Engine Oil Change',    icon: '🛢️',  defaultIntervalKm: 5000,  defaultIntervalDays: 90  },
  { id: 'tyre_rotation',   label: 'Tyre Rotation',        icon: '🛞',  defaultIntervalKm: 10000, defaultIntervalDays: 180 },
  { id: 'air_filter',      label: 'Air Filter',           icon: '💨',  defaultIntervalKm: 15000, defaultIntervalDays: 365 },
  { id: 'brake_service',   label: 'Brake Service',        icon: '🔴',  defaultIntervalKm: 20000, defaultIntervalDays: 365 },
  { id: 'ac_service',      label: 'AC Service',           icon: '❄️',  defaultIntervalKm: 0,     defaultIntervalDays: 365 },
  { id: 'battery_check',   label: 'Battery Check',        icon: '🔋',  defaultIntervalKm: 0,     defaultIntervalDays: 180 },
  { id: 'coolant_flush',   label: 'Coolant Flush',        icon: '💧',  defaultIntervalKm: 40000, defaultIntervalDays: 730 },
  { id: 'spark_plugs',     label: 'Spark Plugs',          icon: '⚡',  defaultIntervalKm: 30000, defaultIntervalDays: 730, fuelTypes: ['Petrol', 'CNG', 'Hybrid'] },
  { id: 'full_service',    label: 'Full Service',         icon: '🔧',  defaultIntervalKm: 10000, defaultIntervalDays: 365 },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function kmUntil(current: number, lastOdometer: number, intervalKm: number): number {
  return (lastOdometer + intervalKm) - current;
}

type DueStatus = 'overdue' | 'due_soon' | 'ok' | 'unknown';

function getDueStatus(daysLeft: number | null, kmLeft: number | null): DueStatus {
  if (daysLeft === null && kmLeft === null) return 'unknown';
  const overdue = (daysLeft !== null && daysLeft < 0) || (kmLeft !== null && kmLeft <= 0);
  if (overdue) return 'overdue';
  const soon = (daysLeft !== null && daysLeft <= 14) || (kmLeft !== null && kmLeft <= 500);
  if (soon) return 'due_soon';
  return 'ok';
}

const STATUS_STYLE: Record<DueStatus, { label: string; bg: string; color: string; dot: string }> = {
  overdue:   { label: 'Overdue',   bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  due_soon:  { label: 'Due soon',  bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  ok:        { label: 'OK',        bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
  unknown:   { label: 'Not set',   bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', dot: '#94a3b8' },
};

// ─── AddReminderModal ─────────────────────────────────────────────────────────

function AddReminderModal({
  vehicle,
  customer,
  latestJob,
  existing,
  onClose,
  onSaved,
}: {
  vehicle: Vehicle;
  customer: CustomerWithVehiclesDto;
  latestJob?: JobCardDto;
  existing?: ReminderRecord;
  onClose: () => void;
  onSaved: (r: ReminderRecord) => void;
}) {
  const [serviceTypeId, setServiceTypeId] = useState(existing?.serviceTypeId ?? 'oil_change');
  const [lastDate, setLastDate] = useState(existing?.lastServiceDate?.slice(0, 10) ?? latestJob?.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [lastOdo, setLastOdo] = useState(String(existing?.lastServiceOdometer ?? latestJob?.odometerReading ?? 0));
  const [nextDueDate, setNextDueDate] = useState(existing?.nextDueDateOverride?.slice(0, 10) ?? '');
  const [nextDueOdo, setNextDueOdo] = useState(String(existing?.nextDueOdometerOverride ?? ''));

  const svc = SERVICE_TYPES.find((s) => s.id === serviceTypeId)!;

  const autoNextDate = useMemo(() => {
    if (!lastDate) return '';
    return addDays(lastDate, svc.defaultIntervalDays).slice(0, 10);
  }, [lastDate, svc]);

  const autoNextOdo = useMemo(() => {
    const odo = Number(lastOdo);
    if (!odo || !svc.defaultIntervalKm) return '';
    return String(odo + svc.defaultIntervalKm);
  }, [lastOdo, svc]);

  const handleSave = () => {
    const record: ReminderRecord = {
      vehicleId: vehicle.id,
      serviceTypeId,
      lastServiceDate: lastDate,
      lastServiceOdometer: Number(lastOdo) || 0,
      nextDueDateOverride: nextDueDate || undefined,
      nextDueOdometerOverride: nextDueOdo ? Number(nextDueOdo) : undefined,
    };
    onSaved(record);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 620, maxHeight: 'calc(100vh - 32px)', boxShadow: '0 8px 32px rgba(0,0,0,0.16)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Set service reminder</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {vehicle.make} {vehicle.model} · {vehicle.registrationNo} · {customer.name}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div className="form-group">
            <label>Service type</label>
            <select className="form-control" value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)}>
              {SERVICE_TYPES.map((s) => (
                <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div className="form-group">
              <label>Last service date</label>
              <input type="date" className="form-control" value={lastDate} onChange={(e) => setLastDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Odometer at last service (km)</label>
              <input type="number" className="form-control" value={lastOdo} onChange={(e) => setLastOdo(e.target.value)} min={0} />
            </div>
          </div>

          <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Auto schedule: due in <strong>{svc.defaultIntervalDays} days</strong>
            {svc.defaultIntervalKm > 0 && <> or <strong>+{svc.defaultIntervalKm.toLocaleString('en-IN')} km</strong></>}
            {' '}— override below if needed
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div className="form-group">
              <label>Next due date (override)</label>
              <input type="date" className="form-control" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} placeholder={autoNextDate} />
              {!nextDueDate && autoNextDate && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Auto: {fmtDate(autoNextDate)}</div>
              )}
            </div>
            <div className="form-group">
              <label>Next due odometer (km)</label>
              <input type="number" className="form-control" value={nextDueOdo} onChange={(e) => setNextDueOdo(e.target.value)} placeholder={autoNextOdo} min={0} />
              {!nextDueOdo && autoNextOdo && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Auto: {Number(autoNextOdo).toLocaleString('en-IN')} km</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="button" onClick={handleSave} className="btn btn-primary btn-sm">Save reminder</button>
        </div>
      </div>
    </div>
  );
}

// ─── WhatsApp nudge builder ───────────────────────────────────────────────────

function buildReminderMsg(customer: CustomerWithVehiclesDto, vehicle: Vehicle, svc: ServiceType, daysLeft: number | null): string {
  const vLabel = `${vehicle.make} ${vehicle.model} (${vehicle.registrationNo})`;
  const urgency = daysLeft !== null && daysLeft < 0 ? 'is now overdue' : daysLeft !== null && daysLeft <= 14 ? 'is coming up soon' : 'is due';
  return `Hi ${customer.name} 👋\n\nThis is a friendly reminder that your *${svc.label}* for *${vLabel}* ${urgency}.\n\nRegular servicing keeps your vehicle running smoothly and prevents costly repairs. 🔧\n\nPlease book an appointment at your earliest convenience.\n\nCall us or reply here to schedule. We look forward to seeing you at Smart Garage! 🙏`;
}

// ─── VehicleReminderRow ───────────────────────────────────────────────────────

function VehicleReminderCard({
  vehicle,
  customer,
  latestJob,
  reminders,
  onAdd,
  onEdit,
  onDelete,
  onWhatsApp,
}: {
  vehicle: Vehicle;
  customer: CustomerWithVehiclesDto;
  latestJob?: JobCardDto;
  reminders: ReminderRecord[];
  onAdd: () => void;
  onEdit: (r: ReminderRecord) => void;
  onDelete: (r: ReminderRecord) => void;
  onWhatsApp: (r: ReminderRecord) => void;
}) {
  const currentOdo = latestJob?.odometerReading ?? 0;

  const rows: ReminderRow[] = SERVICE_TYPES.map((svc) => {
    const rem = reminders.find((r) => r.serviceTypeId === svc.id);
    if (!rem) return null;

    const nextDate = rem.nextDueDateOverride ?? addDays(rem.lastServiceDate, svc.defaultIntervalDays);
    const nextOdo = rem.nextDueOdometerOverride ?? (svc.defaultIntervalKm > 0 ? rem.lastServiceOdometer + svc.defaultIntervalKm : null);

    const dDays = daysUntil(nextDate);
    const dKm = nextOdo !== null ? kmUntil(currentOdo, rem.lastServiceOdometer, nextOdo - rem.lastServiceOdometer) : null;
    const status = getDueStatus(dDays, dKm);
    const ss = STATUS_STYLE[status];

    return { svc, rem, nextDate, nextOdo, dDays, dKm, status, ss };
  }).filter((row): row is ReminderRow => row !== null);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Vehicle header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: rows.length > 0 ? 16 : 0 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🚗</div>
          <div>
            <div style={{ fontWeight: 500 }}>{vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{vehicle.registrationNo}</span>
              {vehicle.fuel && <span style={{ marginLeft: 8 }}>· {vehicle.fuel}</span>}
              {currentOdo > 0 && <span style={{ marginLeft: 8 }}>· {currentOdo.toLocaleString('en-IN')} km (last recorded)</span>}
            </div>
            <Link to={`/customers/${customer.id}`} style={{ fontSize: '0.8125rem', color: '#0d9488', textDecoration: 'none' }}>
              {customer.name} · {customer.phone}
            </Link>
          </div>
        </div>
        <button type="button" onClick={onAdd} className="btn btn-secondary btn-sm">+ Add reminder</button>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', padding: '8px 0' }}>
          No reminders set. Click "Add reminder" to track service intervals.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden' }}>
          {rows.map((row, idx) => (
            <div key={row.svc.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderBottom: idx < rows.length - 1 ? '1px solid var(--color-border-tertiary)' : 'none',
              background: row.status === 'overdue' ? '#fff5f5' : row.status === 'due_soon' ? '#fffbeb' : 'transparent',
            }}>
              <div style={{ fontSize: 18, flexShrink: 0 }}>{row.svc.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{row.svc.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Last: {fmtDate(row.rem.lastServiceDate)}
                  {row.rem.lastServiceOdometer > 0 && ` at ${row.rem.lastServiceOdometer.toLocaleString('en-IN')} km`}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 120 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Due: {fmtDate(row.nextDate)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {row.dDays >= 0 ? `in ${row.dDays}d` : `${Math.abs(row.dDays)}d overdue`}
                  {row.nextOdo !== null && <> · {row.nextOdo.toLocaleString('en-IN')} km</>}
                </div>
              </div>
              <span style={{ background: row.ss.bg, color: row.ss.color, padding: '3px 10px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 500, flexShrink: 0 }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: row.ss.dot, marginRight: 5, verticalAlign: 'middle' }} />
                {row.ss.label}
              </span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => onWhatsApp(row.rem)}
                  title="Send WhatsApp reminder"
                  style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#25d366', color: '#fff', fontSize: '0.75rem', fontWeight: 500 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: 4 }}>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Remind
                </button>
                <button type="button" onClick={() => onEdit(row.rem)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border-secondary)', cursor: 'pointer', background: 'none', color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>Edit</button>
                <button type="button" onClick={() => onDelete(row.rem)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border-secondary)', cursor: 'pointer', background: 'none', color: 'var(--color-text-danger)', fontSize: '0.75rem' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

type ModalState = { vehicle: Vehicle; customer: CustomerWithVehiclesDto; latestJob?: JobCardDto; existing?: ReminderRecord } | null;
type FilterStatus = 'all' | 'overdue' | 'due_soon' | 'ok';

export default function ServiceReminders() {
  const [customers, setCustomers] = useState<CustomerWithVehiclesDto[]>([]);
  const [allJobs, setAllJobs] = useState<JobCardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderRecord[]>(loadReminders);
  const [modal, setModal] = useState<ModalState>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [custRes, jobRes] = await Promise.all([
        customersApi.list('', true),
        jobsApi.list(),
      ]);
      setCustomers(custRes.customers);
      setAllJobs(jobRes.jobs);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Latest job per vehicle (for last odometer reading)
  const latestJobByVehicle = useMemo(() => {
    const map = new Map<string, JobCardDto>();
    for (const j of allJobs) {
      const existing = map.get(j.vehicle.id);
      if (!existing || new Date(j.createdAt) > new Date(existing.createdAt)) {
        map.set(j.vehicle.id, j);
      }
    }
    return map;
  }, [allJobs]);

  // Flatten all vehicles with their customer
  const vehicleRows = useMemo(() => {
    const rows: { vehicle: Vehicle; customer: CustomerWithVehiclesDto }[] = [];
    for (const c of customers) {
      for (const v of c.vehicles) {
        rows.push({ vehicle: v, customer: c });
      }
    }
    return rows;
  }, [customers]);

  // Compute statuses for filtering / summary
  const vehicleStatuses = useMemo(() => {
    const result = new Map<string, DueStatus>();
    for (const { vehicle } of vehicleRows) {
      const vReminders = reminders.filter((r) => r.vehicleId === vehicle.id);
      if (vReminders.length === 0) { result.set(vehicle.id, 'unknown'); continue; }
      const latestJob = latestJobByVehicle.get(vehicle.id);
      const currentOdo = latestJob?.odometerReading ?? 0;
      let worst: DueStatus = 'ok';
      for (const rem of vReminders) {
        const svc = SERVICE_TYPES.find((s) => s.id === rem.serviceTypeId);
        if (!svc) continue;
        const nextDate = rem.nextDueDateOverride ?? addDays(rem.lastServiceDate, svc.defaultIntervalDays);
        const nextOdo = rem.nextDueOdometerOverride ?? (svc.defaultIntervalKm > 0 ? rem.lastServiceOdometer + svc.defaultIntervalKm : null);
        const dDays = daysUntil(nextDate);
        const dKm = nextOdo !== null ? kmUntil(currentOdo, rem.lastServiceOdometer, nextOdo - rem.lastServiceOdometer) : null;
        const st = getDueStatus(dDays, dKm);
        if (st === 'overdue') { worst = 'overdue'; break; }
        if (st === 'due_soon') worst = 'due_soon';
      }
      result.set(vehicle.id, worst);
    }
    return result;
  }, [vehicleRows, reminders, latestJobByVehicle]);

  const summary = useMemo(() => {
    const statuses = Array.from(vehicleStatuses.values());
    return {
      overdue: statuses.filter((s) => s === 'overdue').length,
      due_soon: statuses.filter((s) => s === 'due_soon').length,
      ok: statuses.filter((s) => s === 'ok').length,
      total: vehicleRows.length,
    };
  }, [vehicleStatuses, vehicleRows]);

  const filteredRows = useMemo(() => {
    let rows = vehicleRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        ({ vehicle, customer }) =>
          customer.name.toLowerCase().includes(q) ||
          customer.phone.includes(q) ||
          vehicle.registrationNo.toLowerCase().includes(q) ||
          vehicle.make.toLowerCase().includes(q) ||
          vehicle.model.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      rows = rows.filter(({ vehicle }) => vehicleStatuses.get(vehicle.id) === filterStatus);
    }
    // Sort: overdue first, then due_soon, then ok, then unknown
    const order: Record<DueStatus, number> = { overdue: 0, due_soon: 1, ok: 2, unknown: 3 };
    rows = [...rows].sort((a, b) => (order[vehicleStatuses.get(a.vehicle.id) ?? 'unknown'] ?? 3) - (order[vehicleStatuses.get(b.vehicle.id) ?? 'unknown'] ?? 3));
    return rows;
  }, [vehicleRows, search, filterStatus, vehicleStatuses]);

  const handleSaveReminder = (record: ReminderRecord) => {
    setReminders((prev) => {
      const filtered = prev.filter(
        (r) => !(r.vehicleId === record.vehicleId && r.serviceTypeId === record.serviceTypeId)
      );
      const next = [...filtered, record];
      saveReminders(next);
      return next;
    });
    setModal(null);
  };

  const handleDeleteReminder = (rem: ReminderRecord) => {
    setReminders((prev) => {
      const next = prev.filter((r) => !(r.vehicleId === rem.vehicleId && r.serviceTypeId === rem.serviceTypeId));
      saveReminders(next);
      return next;
    });
  };

  const handleWhatsApp = (rem: ReminderRecord, customer: CustomerWithVehiclesDto, vehicle: Vehicle) => {
    const svc = SERVICE_TYPES.find((s) => s.id === rem.serviceTypeId);
    if (!svc) return;
    const nextDate = rem.nextDueDateOverride ?? addDays(rem.lastServiceDate, svc.defaultIntervalDays);
    const dDays = daysUntil(nextDate);
    const msg = buildReminderMsg(customer, vehicle, svc, dDays);
    const phone = normalizeIndianPhone(customer.phone);
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  const statusFilters: { key: FilterStatus; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All vehicles', count: summary.total, color: 'var(--color-text-secondary)' },
    { key: 'overdue', label: 'Overdue', count: summary.overdue, color: '#991b1b' },
    { key: 'due_soon', label: 'Due soon', count: summary.due_soon, color: '#92400e' },
    { key: 'ok', label: 'All good', count: summary.ok, color: '#065f46' },
  ];

  return (
    <>
      {modal && (
        <AddReminderModal
          vehicle={modal.vehicle}
          customer={modal.customer}
          latestJob={modal.latestJob}
          existing={modal.existing}
          onClose={() => setModal(null)}
          onSaved={handleSaveReminder}
        />
      )}

      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Service Reminders</h1>
            <p className="page-subtitle">Track upcoming service intervals and send proactive reminders to vehicle owners</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Overdue', value: summary.overdue, bg: '#fee2e2', color: '#991b1b', icon: '🔴' },
            { label: 'Due soon', value: summary.due_soon, bg: '#fef3c7', color: '#92400e', icon: '🟡' },
            { label: 'All good', value: summary.ok, bg: '#d1fae5', color: '#065f46', icon: '🟢' },
            { label: 'Total vehicles', value: summary.total, bg: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', icon: '🚗' },
          ].map((s) => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: '1.375rem', fontWeight: 500, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '0.75rem', color: s.color, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-control"
            placeholder="Search customer, vehicle, registration…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 280, fontSize: '0.875rem' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {statusFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterStatus(f.key)}
                style={{
                  padding: '5px 13px', borderRadius: 20, cursor: 'pointer', fontSize: '0.8125rem',
                  border: `1.5px solid ${filterStatus === f.key ? '#0d9488' : 'var(--color-border-tertiary)'}`,
                  background: filterStatus === f.key ? '#f0fdfa' : 'var(--color-background-secondary)',
                  color: filterStatus === f.key ? '#0d9488' : 'var(--color-text-secondary)',
                  fontWeight: filterStatus === f.key ? 500 : 400,
                }}
              >
                {f.label} <span style={{ opacity: 0.7 }}>({f.count})</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : error ? (
          <div className="card">
            <p className="error-msg">{error}</p>
            <button className="btn btn-primary" onClick={fetchData}>Retry</button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔧</div>
            <div style={{ fontWeight: 500, marginBottom: 6 }}>
              {vehicleRows.length === 0 ? 'No vehicles found' : 'No vehicles match this filter'}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              {vehicleRows.length === 0
                ? 'Add customers with vehicles to start tracking service intervals'
                : 'Try adjusting your search or filter'}
            </div>
          </div>
        ) : (
          filteredRows.map(({ vehicle, customer }) => {
            const latestJob = latestJobByVehicle.get(vehicle.id);
            const vReminders = reminders.filter((r) => r.vehicleId === vehicle.id);
            return (
              <VehicleReminderCard
                key={vehicle.id}
                vehicle={vehicle}
                customer={customer}
                latestJob={latestJob}
                reminders={vReminders}
                onAdd={() => setModal({ vehicle, customer, latestJob })}
                onEdit={(rem) => setModal({ vehicle, customer, latestJob, existing: rem })}
                onDelete={handleDeleteReminder}
                onWhatsApp={(rem) => handleWhatsApp(rem, customer, vehicle)}
              />
            );
          })
        )}
      </div>
    </>
  );
}
