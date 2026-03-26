import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobs as jobsApi } from '../../api/client';
import type { JobCardDto } from '../../api/client';

type JobStage = 'pending' | 'work_in_progress' | 'delivered';

const STAGES: { key: JobStage; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'work_in_progress', label: 'In Progress' },
  { key: 'delivered', label: 'Delivered' },
];

function stageBadge(stage: string): string {
  if (stage === 'pending') return 'badge-pending';
  if (stage === 'work_in_progress') return 'badge-progress';
  return 'badge-delivered';
}
function stageLabel(stage: string): string {
  if (stage === 'work_in_progress') return 'In Progress';
  if (stage === 'delivered') return 'Delivered';
  return 'Pending';
}

export default function JobList() {
  const [jobs, setJobs] = useState<JobCardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<JobStage | 'all'>('all');

  const fetchJobs = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await jobsApi.list(); setJobs(res.jobs); }
    catch { setError('Failed to load jobs'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.stage === filter);

  if (loading && jobs.length === 0) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Job Cards</h1>
            <p className="page-subtitle">Track and manage all workshop jobs</p>
          </div>
          <div className="page-header-actions">
            <Link to="/jobs/new" className="btn btn-primary">+ Create Job</Link>
          </div>
        </div>
      </div>

      <div className="page-content">
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>
            <div className="alert-icon">⚠️</div>
            <div className="alert-body">
              {error}
              <button type="button" className="btn btn-sm btn-secondary" style={{ marginLeft: 12 }} onClick={fetchJobs}>Retry</button>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="card-title">All Jobs</div>
              <div className="card-subtitle">{filtered.length} job{filtered.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="filter-tabs">
              <button type="button" className={`filter-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All ({jobs.length})</button>
              {STAGES.map((s) => (
                <button key={s.key} type="button" className={`filter-tab ${filter === s.key ? 'active' : ''}`} onClick={() => setFilter(s.key)}>
                  {s.label} ({jobs.filter(j => j.stage === s.key).length})
                </button>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job #</th>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th>Odometer</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📋</div>
                      <div className="empty-state-title">No jobs found</div>
                      <div className="empty-state-desc">Create your first job card to get started.</div>
                    </div>
                  </td></tr>
                ) : (
                  filtered.map((j) => (
                    <tr key={j.id}>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.875rem' }}>{j.jobNumber}</span></td>
                      <td style={{ fontWeight: 500 }}>{j.customer.name}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{j.vehicle.registrationNo}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{j.vehicle.make} {j.vehicle.model}</span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{j.odometerReading.toLocaleString()} km</td>
                      <td><span className={`badge ${stageBadge(j.stage)}`}>{stageLabel(j.stage)}</span></td>
                      <td>
                        <Link to={`/jobs/${j.id}`} className="btn btn-sm btn-secondary">View →</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
