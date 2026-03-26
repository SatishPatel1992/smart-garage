import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { jobs as jobsApi, estimates as estimatesApi } from '../api/client';
import type { JobCardDto, EstimateDto } from '../api/client';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtINR(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getEstimateLink(estimateId: string) {
  return `${window.location.origin}/public/estimate/${estimateId}`;
}

function normalizeIndianPhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// ─── message templates ──────────────────────────────────────────────────────

type TemplateId =
  | 'job_received'
  | 'work_started'
  | 'estimate_ready'
  | 'job_delivered'
  | 'payment_reminder';

type TemplateCtx = {
  customerName: string;
  jobNumber: string;
  vehicleLabel: string;
  estimateAmount?: number;
  estimateNumber?: string;
  estimateLink?: string;
  estimateValidUntil?: string;
  invoiceTotal?: number;
};

const TEMPLATES: Record<TemplateId, { label: string; icon: string; build: (c: TemplateCtx) => string }> = {
  job_received: {
    label: 'Job received',
    icon: '📋',
    build: (c) =>
      `Hi ${c.customerName} 👋\n\nWe've received your *${c.vehicleLabel}* at Smart Garage.\n\nJob No: *${c.jobNumber}*\n\nOur team will inspect your vehicle and share an estimate shortly. We'll keep you updated at every step.\n\nThank you for choosing us! 🔧`,
  },
  work_started: {
    label: 'Work started',
    icon: '🔧',
    build: (c) =>
      `Hi ${c.customerName},\n\nGood news! Work has started on your *${c.vehicleLabel}*.\n\nJob No: *${c.jobNumber}*\nStatus: *In Progress* 🔧\n\nWe'll notify you as soon as your vehicle is ready for delivery.`,
  },
  estimate_ready: {
    label: 'Estimate ready',
    icon: '📄',
    build: (c) =>
      `Hi ${c.customerName},\n\nYour service estimate is ready for *${c.vehicleLabel}*.\n\nEstimate No: *${c.estimateNumber ?? '—'}*\nTotal Amount: *${c.estimateAmount != null ? fmtINR(c.estimateAmount) : '—'}*\nValid Until: ${c.estimateValidUntil ?? '—'}\n\n👉 View & Approve: ${c.estimateLink ?? '—'}\n\nPlease review and let us know to proceed.`,
  },
  job_delivered: {
    label: 'Ready for delivery',
    icon: '✅',
    build: (c) =>
      `Hi ${c.customerName},\n\nGreat news! Your *${c.vehicleLabel}* is ready for pickup! ✅\n\nJob No: *${c.jobNumber}*\n\nPlease visit us at your convenience. Kindly carry a valid ID for vehicle handover.\n\nThank you for trusting Smart Garage! 🙏`,
  },
  payment_reminder: {
    label: 'Payment reminder',
    icon: '💰',
    build: (c) =>
      `Hi ${c.customerName},\n\nThis is a gentle reminder regarding the pending payment for your *${c.vehicleLabel}* service.\n\nJob No: *${c.jobNumber}*${c.invoiceTotal != null ? `\nAmount Due: *${fmtINR(c.invoiceTotal)}*` : ''}\n\nKindly settle the amount at your earliest convenience. We accept Cash, UPI, and Card.`,
  },
};

// ─── types ──────────────────────────────────────────────────────────────────

type JobWithEstimate = JobCardDto & { estimate?: EstimateDto | null };

type LogEntry = {
  id: string;
  jobNumber: string;
  customerName: string;
  phone: string;
  vehicleLabel: string;
  templateId: TemplateId;
  sentAt: string;
};

const LOG_KEY = 'sg_comm_log';

function loadLog(): LogEntry[] {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]'); } catch { return []; }
}

function appendLog(entry: Omit<LogEntry, 'id' | 'sentAt'>) {
  const log = loadLog();
  log.unshift({ ...entry, id: crypto.randomUUID(), sentAt: new Date().toISOString() });
  localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 100)));
}

// ─── WhatsApp icon ───────────────────────────────────────────────────────────

const WaIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// ─── SendModal ───────────────────────────────────────────────────────────────

function SendModal({
  job,
  estimate,
  onClose,
  onSent,
}: {
  job: JobCardDto;
  estimate: EstimateDto | null | undefined;
  onClose: () => void;
  onSent: (templateId: TemplateId) => void;
}) {
  const [selected, setSelected] = useState<TemplateId>('job_received');
  const [customMsg, setCustomMsg] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  useEffect(() => {
    if (job.stage === 'delivered') setSelected('job_delivered');
    else if (job.stage === 'work_in_progress') setSelected('work_started');
    else setSelected('job_received');
  }, [job.stage]);

  const ctx: TemplateCtx = {
    customerName: job.customer.name,
    jobNumber: job.jobNumber,
    vehicleLabel: `${job.vehicle.make} ${job.vehicle.model} (${job.vehicle.registrationNo})`,
    estimateAmount: estimate?.totalAmount,
    estimateNumber: estimate?.estimateNumber,
    estimateLink: estimate ? getEstimateLink(estimate.id) : undefined,
    estimateValidUntil: estimate?.validUntil ? fmtDate(estimate.validUntil) : undefined,
  };

  const generatedMsg = TEMPLATES[selected].build(ctx);
  const finalMsg = useCustom ? customMsg : generatedMsg;

  const handleWhatsApp = () => {
    const phone = normalizeIndianPhone(job.customer.phone);
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(finalMsg)}`, '_blank');
    onSent(selected);
  };

  const handleSMS = () => {
    const phone = job.customer.phone.replace(/\D/g, '');
    window.open(`sms:${phone}?body=${encodeURIComponent(finalMsg)}`, '_blank');
    onSent(selected);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(finalMsg);
    onSent(selected);
  };

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 760,
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              Send message
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {job.customer.name} · {job.customer.phone}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 22, lineHeight: 1, color: 'var(--text-muted)',
              padding: '2px 6px', borderRadius: 6,
            }}
          >×</button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 18px', display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: 14 }}>

          {/* Template grid — 2 columns, 3 rows */}
          <div>
            <div style={{
              fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
            }}>
              Template
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
            }}>
              {(Object.entries(TEMPLATES) as [TemplateId, typeof TEMPLATES[TemplateId]][]).map(([id, tpl]) => {
                const active = selected === id && !useCustom;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setSelected(id); setUseCustom(false); }}
                    style={{
                      padding: '8px 11px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                      border: `1.5px solid ${active ? '#0d9488' : 'var(--border)'}`,
                      background: active ? '#f0fdfa' : 'var(--bg-base)',
                      color: active ? '#0d9488' : 'var(--text-primary)',
                      fontWeight: active ? 500 : 400,
                      fontSize: '0.8125rem',
                      lineHeight: 1.3,
                      transition: 'border-color 0.1s, background 0.1s',
                    }}
                  >
                    <span style={{ marginRight: 5 }}>{tpl.icon}</span>{tpl.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message preview / editor */}
          <div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
            }}>
              <div style={{
                fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {useCustom ? 'Custom message' : 'Message preview'}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!useCustom) setCustomMsg(generatedMsg);
                  setUseCustom(!useCustom);
                }}
                style={{
                  fontSize: '0.75rem', color: '#0d9488', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline',
                }}
              >
                {useCustom ? 'Use template' : 'Edit message'}
              </button>
            </div>

            {useCustom ? (
              <textarea
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                rows={9}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                  borderRadius: 8, border: '1.5px solid var(--border)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', lineHeight: 1.6,
                  resize: 'vertical',
                  minHeight: 260,
                }}
              />
            ) : (
              <div style={{
                background: '#f0fdfa',
                border: '1.5px solid #99f6e4',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: '0.8125rem',
                lineHeight: 1.7,
                color: '#134e4a',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'pre-wrap',
                minHeight: 260,
                maxHeight: 360,
                overflowY: 'auto',
              }}>
                {generatedMsg}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}>
          <button
            type="button"
            onClick={handleCopy}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            📋 Copy
          </button>
          <button
            type="button"
            onClick={handleSMS}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            💬 SMS
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            style={{
              padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
              background: '#25d366', color: '#fff', border: 'none',
              fontWeight: 500, fontSize: '0.875rem',
              display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            <WaIcon size={16} />
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ─── main component ──────────────────────────────────────────────────────────

type FilterStage = 'all' | 'pending' | 'work_in_progress' | 'delivered';

export default function Communications() {
  const [jobs, setJobs] = useState<JobWithEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState<FilterStage>('all');
  const [search, setSearch] = useState('');
  const [activeJob, setActiveJob] = useState<JobWithEstimate | null>(null);
  const [log, setLog] = useState<LogEntry[]>(loadLog);
  const [tab, setTab] = useState<'jobs' | 'log'>('jobs');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { jobs: allJobs } = await jobsApi.list();
      const withEstimates: JobWithEstimate[] = await Promise.all(
        allJobs.map(async (j) => {
          try {
            const est = await estimatesApi.getByJobId(j.id);
            return { ...j, estimate: est };
          } catch {
            return { ...j, estimate: null };
          }
        })
      );
      setJobs(withEstimates);
    } catch {
      setError('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let list = jobs;
    if (filterStage !== 'all') list = list.filter((j) => j.stage === filterStage);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.customer.name.toLowerCase().includes(q) ||
          j.customer.phone.includes(q) ||
          j.jobNumber.toLowerCase().includes(q) ||
          j.vehicle.registrationNo.toLowerCase().includes(q)
      );
    }
    return list;
  }, [jobs, filterStage, search]);

  const handleSent = (job: JobWithEstimate, templateId: TemplateId) => {
    appendLog({
      jobNumber: job.jobNumber,
      customerName: job.customer.name,
      phone: job.customer.phone,
      vehicleLabel: `${job.vehicle.make} ${job.vehicle.model} (${job.vehicle.registrationNo})`,
      templateId,
    });
    setLog(loadLog());
    setActiveJob(null);
  };

  const stageBadge = (stage: string) => {
    if (stage === 'pending') return { label: 'Pending', bg: '#fef3c7', color: '#92400e' };
    if (stage === 'work_in_progress') return { label: 'In Progress', bg: '#dbeafe', color: '#1e40af' };
    return { label: 'Delivered', bg: '#d1fae5', color: '#065f46' };
  };

  const stageFilters: { key: FilterStage; label: string; count: number }[] = [
    { key: 'all', label: 'All jobs', count: jobs.length },
    { key: 'pending', label: 'Pending', count: jobs.filter((j) => j.stage === 'pending').length },
    { key: 'work_in_progress', label: 'In Progress', count: jobs.filter((j) => j.stage === 'work_in_progress').length },
    { key: 'delivered', label: 'Delivered', count: jobs.filter((j) => j.stage === 'delivered').length },
  ];

  return (
    <>
      {activeJob && (
        <SendModal
          job={activeJob}
          estimate={activeJob.estimate}
          onClose={() => setActiveJob(null)}
          onSent={(tid) => handleSent(activeJob, tid)}
        />
      )}

      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Communications</h1>
            <p className="page-subtitle">Send WhatsApp / SMS updates to customers for job status changes</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--color-border-tertiary)' }}>
          {(['jobs', 'log'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: '8px 18px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: tab === t ? 500 : 400,
                color: tab === t ? '#0d9488' : 'var(--color-text-secondary)',
                borderBottom: `2px solid ${tab === t ? '#0d9488' : 'transparent'}`,
                marginBottom: -1, transition: 'all 0.15s',
              }}
            >
              {t === 'jobs' ? '📤 Send messages' : `📋 Sent log (${log.length})`}
            </button>
          ))}
        </div>

        {tab === 'jobs' && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="form-control"
                placeholder="Search customer, phone, job no, reg…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 280, fontSize: '0.875rem' }}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {stageFilters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilterStage(f.key)}
                    style={{
                      padding: '5px 13px', borderRadius: 20, cursor: 'pointer', fontSize: '0.8125rem',
                      border: `1.5px solid ${filterStage === f.key ? '#0d9488' : 'var(--color-border-tertiary)'}`,
                      background: filterStage === f.key ? '#f0fdfa' : 'var(--color-background-secondary)',
                      color: filterStage === f.key ? '#0d9488' : 'var(--color-text-secondary)',
                      fontWeight: filterStage === f.key ? 500 : 400,
                    }}
                  >
                    {f.label} <span style={{ opacity: 0.7 }}>({f.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Job table */}
            {loading ? (
              <div className="loading"><div className="spinner" /></div>
            ) : error ? (
              <div className="card">
                <p className="error-msg">{error}</p>
                <button className="btn btn-primary" onClick={fetchData}>Retry</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>No jobs found</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  {search || filterStage !== 'all' ? 'Try adjusting your filters' : 'Jobs will appear here once created'}
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
                      {['Job', 'Customer', 'Vehicle', 'Stage', 'Last updated', ''].map((h) => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((job, idx) => {
                      const badge = stageBadge(job.stage);
                      const sentEntry = log.find((l) => l.jobNumber === job.jobNumber);
                      return (
                        <tr key={job.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--color-border-tertiary)' : 'none' }}>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <Link to={`/jobs/${job.id}`} style={{ fontWeight: 500, color: 'var(--color-text-info)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}>
                              {job.jobNumber}
                            </Link>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 500 }}>{job.customer.name}</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{job.customer.phone}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div>{job.vehicle.make} {job.vehicle.model}</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{job.vehicle.registrationNo}</div>
                          </td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{ background: badge.bg, color: badge.color, padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 500 }}>
                              {badge.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                            <div>{fmtDate(job.updatedAt)}</div>
                            {sentEntry && (
                              <div style={{ fontSize: '0.75rem', color: '#0d9488', marginTop: 2 }}>
                                ✓ {TEMPLATES[sentEntry.templateId].label}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <button
                              type="button"
                              onClick={() => setActiveJob(job)}
                              style={{
                                padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.8125rem',
                                background: '#25d366', color: '#fff', border: 'none', fontWeight: 500,
                                display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                              }}
                            >
                              <WaIcon size={14} />
                              Send
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'log' && (
          log.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>No messages sent yet</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Messages you send will be logged here for reference</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
                    {['Sent at', 'Job', 'Customer', 'Vehicle', 'Template'].map((h) => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {log.map((entry, idx) => (
                    <tr key={entry.id} style={{ borderBottom: idx < log.length - 1 ? '1px solid var(--color-border-tertiary)' : 'none' }}>
                      <td style={{ padding: '11px 16px', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                        {new Date(entry.sentAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{entry.jobNumber}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <div>{entry.customerName}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{entry.phone}</div>
                      </td>
                      <td style={{ padding: '11px 16px', color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>{entry.vehicleLabel}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ background: '#f0fdfa', color: '#0d9488', padding: '3px 10px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {TEMPLATES[entry.templateId].icon} {TEMPLATES[entry.templateId].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </>
  );
}
