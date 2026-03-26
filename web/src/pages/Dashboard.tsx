import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboard as dashboardApi } from '../api/client';
import type { DashboardDto } from '../api/client';

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

const STAT_CONFIG = [
  { label: "Today's Jobs", key: 'todayJobs' as const, icon: '📋', colorClass: 'blue', valueColor: '#1d4ed8' },
  { label: 'In Progress', key: 'inProgress' as const, icon: '🔧', colorClass: 'amber', valueColor: '#b45309' },
  { label: 'Awaiting Approval', key: 'awaitingApproval' as const, icon: '⏳', colorClass: 'red', valueColor: '#b91c1c' },
  { label: 'Ready for Delivery', key: 'readyForDelivery' as const, icon: '✅', colorClass: 'green', valueColor: '#15803d' },
];

export default function Dashboard() {
  const [data, setData] = useState<DashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.get();
      setData(res);
    } catch {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading dashboard…</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="page-content">
        <div className="card">
          <p className="error-msg">{error}</p>
          <button type="button" className="btn btn-primary" onClick={fetchDashboard}>Retry</button>
        </div>
      </div>
    );
  }

  const stats = data?.stats ?? { todayJobs: 0, inProgress: 0, awaitingApproval: 0, readyForDelivery: 0 };
  const recentActivity = data?.recentActivity ?? [];
  const attention = data?.attention ?? { awaitingApprovalCount: 0, deliveredNotBilledCount: 0 };
  const hasAttention = attention.awaitingApprovalCount > 0 || attention.deliveredNotBilledCount > 0;
  const pipelineTotal = Math.max(stats.todayJobs, stats.inProgress + stats.awaitingApproval + stats.readyForDelivery);
  const deliveryRate = pipelineTotal > 0 ? Math.round((stats.readyForDelivery / pipelineTotal) * 100) : 0;
  const approvalBacklogRate = pipelineTotal > 0 ? Math.round((stats.awaitingApproval / pipelineTotal) * 100) : 0;
  const healthScore = Math.max(0, Math.min(100, 100 - approvalBacklogRate - (attention.deliveredNotBilledCount * 8)));

  const ownerHighlights = [
    {
      title: 'Delivery Readiness',
      value: `${deliveryRate}%`,
      detail: `${stats.readyForDelivery} ready out of ${pipelineTotal}`,
      tone: deliveryRate >= 40 ? 'good' : deliveryRate >= 20 ? 'warn' : 'bad',
      icon: '🚚',
    },
    {
      title: 'Approval Backlog',
      value: `${approvalBacklogRate}%`,
      detail: `${attention.awaitingApprovalCount} waiting customer response`,
      tone: approvalBacklogRate <= 20 ? 'good' : approvalBacklogRate <= 40 ? 'warn' : 'bad',
      icon: '📝',
    },
    {
      title: 'Billing Misses',
      value: attention.deliveredNotBilledCount,
      detail: 'Delivered but not billed',
      tone: attention.deliveredNotBilledCount === 0 ? 'good' : attention.deliveredNotBilledCount <= 2 ? 'warn' : 'bad',
      icon: '🧾',
    },
  ] as const;

  return (
    <>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Owner summary of workshop performance and daily priorities</p>
          </div>
          <div className="page-header-actions">
            <Link to="/reports" className="btn btn-secondary">
              View Reports
            </Link>
            <Link to="/jobs/new" className="btn btn-primary">
              + New Job
            </Link>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="dashboard-owner-hero">
          <div>
            <div className="dashboard-owner-title">Today&apos;s Business Snapshot</div>
            <div className="dashboard-owner-subtitle">
              Track queue movement, approvals, and billing follow-up in one view.
            </div>
          </div>
          <div className="dashboard-health-wrap">
            <div className="dashboard-health-label">Ops Health</div>
            <div className="dashboard-health-value">{healthScore}</div>
            <div className="dashboard-health-note">/ 100</div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="stat-grid">
          {STAT_CONFIG.map((s) => (
            <div key={s.key} className="stat-card">
              <div className="stat-card-top">
                <div className={`stat-card-icon ${s.colorClass}`}>{s.icon}</div>
              </div>
              <div className="stat-card-value" style={{ color: s.valueColor }}>{stats[s.key]}</div>
              <div className="stat-card-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="dashboard-highlights-grid">
          {ownerHighlights.map((h) => (
            <div key={h.title} className={`dashboard-highlight-card ${h.tone}`}>
              <div className="dashboard-highlight-top">
                <div className="dashboard-highlight-icon">{h.icon}</div>
                <div className="dashboard-highlight-title">{h.title}</div>
              </div>
              <div className="dashboard-highlight-value">{h.value}</div>
              <div className="dashboard-highlight-detail">{h.detail}</div>
            </div>
          ))}
        </div>

        {/* Attention banner */}
        {hasAttention && (
          <div className="alert alert-warning">
            <div className="alert-icon">⚠️</div>
            <div className="alert-body">
              <div className="alert-title">Action required</div>
              {attention.awaitingApprovalCount > 0 && (
                <div style={{ marginTop: 2 }}>{attention.awaitingApprovalCount} job(s) awaiting customer approval</div>
              )}
              {attention.deliveredNotBilledCount > 0 && (
                <div style={{ marginTop: 2 }}>{attention.deliveredNotBilledCount} vehicle(s) delivered but not yet billed</div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Workflow Pipeline</div>
                <div className="card-subtitle">How jobs are moving through your workshop</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'In Progress', value: stats.inProgress, color: '#2563eb' },
                { label: 'Awaiting Approval', value: stats.awaitingApproval, color: '#f59e0b' },
                { label: 'Ready for Delivery', value: stats.readyForDelivery, color: '#16a34a' },
              ].map((row) => {
                const pct = pipelineTotal > 0 ? Math.round((row.value / pipelineTotal) * 100) : 0;
                return (
                  <div key={row.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{row.label}</span>
                      <span style={{ fontWeight: 700 }}>{row.value} ({pct}%)</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: row.color, borderRadius: 999 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Owner Priorities</div>
                <div className="card-subtitle">Most important actions for today</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="info-row">
                <span className="info-label">Call approvals</span>
                <span className="info-value">{attention.awaitingApprovalCount} pending</span>
              </div>
              <div className="info-row">
                <span className="info-label">Generate pending bills</span>
                <span className="info-value">{attention.deliveredNotBilledCount} vehicles</span>
              </div>
              <div className="info-row">
                <span className="info-label">Monitor active work</span>
                <span className="info-value">{stats.inProgress} jobs</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Quick actions */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Quick Actions</div>
                <div className="card-subtitle">Move faster on jobs, customers and billing</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link to="/jobs/new" className="quick-action-btn">
                <div className="quick-action-icon">📋</div>
                Create New Job Card
              </Link>
              <Link to="/jobs" className="quick-action-btn">
                <div className="quick-action-icon">🔍</div>
                View All Jobs
              </Link>
              <Link to="/customers/new" className="quick-action-btn">
                <div className="quick-action-icon">👤</div>
                Add New Customer
              </Link>
              <Link to="/billing" className="quick-action-btn">
                <div className="quick-action-icon">🧾</div>
                View Invoices
              </Link>
              <Link to="/reports" className="quick-action-btn">
                <div className="quick-action-icon">📊</div>
                Open Reports
              </Link>
            </div>
          </div>

          {/* Recent activity */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Recent Activity</div>
                <div className="card-subtitle">Latest updates from the workshop</div>
              </div>
            </div>
            {recentActivity.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-state-icon">📭</div>
                <div className="empty-state-title">No recent activity</div>
              </div>
            ) : (
              <ul className="activity-list">
                {recentActivity.map((r) => (
                  <li key={`${r.type}-${r.id}`} className="activity-item">
                    <div className="activity-dot" />
                    <div className="activity-body">
                      {r.jobCardId ? (
                        <Link to={`/jobs/${r.jobCardId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          <div className="activity-title">{r.title}</div>
                          <div className="activity-detail">{r.detail}</div>
                        </Link>
                      ) : (
                        <>
                          <div className="activity-title">{r.title}</div>
                          <div className="activity-detail">{r.detail}</div>
                        </>
                      )}
                    </div>
                    <div className="activity-time">{formatTimeAgo(r.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
