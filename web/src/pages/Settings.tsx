import { useEffect, useState } from 'react';
import { me as meApi, organizations as orgApi } from '../api/client';
import type { MeResponse, OrgSettings } from '../api/client';
import { getAppPreferences, saveAppPreferences } from '../utils/appPreferences';

export default function Settings() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [orgForm, setOrgForm] = useState({
    name: '',
    address: '',
    phone: '',
    gstin: '',
    currency: 'INR',
    gstEnabled: true,
    defaultGstRatePercent: 18,
    estimateValidityDays: 14,
    lowStockThreshold: 5,
    invoiceDefaultFormat: 'tax' as 'tax' | 'proforma',
    logoUrl: '',
    defaultTaxRatesCsv: '0,5,12,18,28',
  });

  const [prefs, setPrefs] = useState(getAppPreferences());

  useEffect(() => {
    setLoading(true);
    setError(null);
    meApi.get()
      .then((res: MeResponse) => {
        const org = res.organization;
        if (!org) return;
        const s = org.settings ?? ({} as OrgSettings);
        setOrgId(org.id);
        setOrgForm({
          name: org.name ?? '',
          address: org.address ?? '',
          phone: org.phone ?? '',
          gstin: org.gstin ?? '',
          currency: s.currency ?? 'INR',
          gstEnabled: s.gstEnabled ?? true,
          defaultGstRatePercent: s.defaultGstRatePercent ?? 18,
          estimateValidityDays: s.estimateValidityDays ?? 14,
          lowStockThreshold: s.lowStockThreshold ?? 5,
          invoiceDefaultFormat: s.invoiceDefaultFormat ?? 'tax',
          logoUrl: s.logoUrl ?? '',
          defaultTaxRatesCsv: (s.defaultTaxRates ?? [0, 5, 12, 18, 28]).join(','),
        });
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const saveOrganizationSettings = async () => {
    setSavingOrg(true);
    setError(null);
    setMsg(null);
    try {
      const parsedRates = orgForm.defaultTaxRatesCsv
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((x) => !Number.isNaN(x) && x >= 0 && x <= 100);
      await orgApi.updateSettings({
        name: orgForm.name.trim(),
        address: orgForm.address.trim() || null,
        phone: orgForm.phone.trim() || null,
        gstin: orgForm.gstin.trim() || null,
        settings: {
          currency: orgForm.currency.trim() || 'INR',
          gstEnabled: orgForm.gstEnabled,
          defaultGstRatePercent: Number(orgForm.defaultGstRatePercent) || 18,
          estimateValidityDays: Number(orgForm.estimateValidityDays) || 14,
          lowStockThreshold: Number(orgForm.lowStockThreshold) || 5,
          invoiceDefaultFormat: orgForm.invoiceDefaultFormat,
          logoUrl: orgForm.logoUrl.trim() || null,
          defaultTaxRates: parsedRates.length > 0 ? parsedRates : [0, 5, 12, 18, 28],
        },
      });
      setMsg('Organization settings saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save organization settings');
    } finally {
      setSavingOrg(false);
    }
  };

  const savePreferences = () => {
    setSavingPrefs(true);
    setError(null);
    setMsg(null);
    try {
      saveAppPreferences(prefs);
      setMsg('App preferences saved for this client environment.');
    } catch {
      setError('Failed to save app preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Configure this client before going live</p>
          </div>
        </div>
      </div>
      <div className="page-content">
        {msg && <div className="alert alert-success"><div className="alert-icon">✅</div><div className="alert-body">{msg}</div></div>}
        {error && <div className="alert alert-danger"><div className="alert-icon">⚠️</div><div className="alert-body">{error}</div></div>}

        <div className="card" style={{ maxWidth: 860 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Organization & Compliance</div>
              <div className="card-subtitle">Legal details used in documents and GST reports</div>
            </div>
            <span style={{ fontSize: 24 }}>🏢</span>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner spinner-sm" /></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label>Name</label>
                <input className="form-control" value={orgForm.name} onChange={(e) => setOrgForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="form-control" value={orgForm.phone} onChange={(e) => setOrgForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Address</label>
                <input className="form-control" value={orgForm.address} onChange={(e) => setOrgForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>GSTIN</label>
                <input className="form-control" value={orgForm.gstin} onChange={(e) => setOrgForm((p) => ({ ...p, gstin: e.target.value }))} style={{ fontFamily: 'var(--font-mono)' }} />
              </div>
              <div className="form-group">
                <label>Currency</label>
                <input className="form-control" value={orgForm.currency} onChange={(e) => setOrgForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} />
              </div>
              <div className="form-group">
                <label>Default Invoice Format</label>
                <select className="form-control" value={orgForm.invoiceDefaultFormat} onChange={(e) => setOrgForm((p) => ({ ...p, invoiceDefaultFormat: e.target.value as 'tax' | 'proforma' }))}>
                  <option value="tax">Tax Invoice</option>
                  <option value="proforma">Proforma</option>
                </select>
              </div>
              <div className="form-group">
                <label>GST Enabled by Default</label>
                <select className="form-control" value={orgForm.gstEnabled ? 'yes' : 'no'} onChange={(e) => setOrgForm((p) => ({ ...p, gstEnabled: e.target.value === 'yes' }))}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="form-group">
                <label>Default GST Rate %</label>
                <input type="number" min={0} max={100} step={0.5} className="form-control" value={orgForm.defaultGstRatePercent} onChange={(e) => setOrgForm((p) => ({ ...p, defaultGstRatePercent: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label>Estimate Validity (days)</label>
                <input type="number" min={1} max={90} className="form-control" value={orgForm.estimateValidityDays} onChange={(e) => setOrgForm((p) => ({ ...p, estimateValidityDays: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label>Low Stock Threshold</label>
                <input type="number" min={0} className="form-control" value={orgForm.lowStockThreshold} onChange={(e) => setOrgForm((p) => ({ ...p, lowStockThreshold: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label>Default Tax Rates (comma-separated)</label>
                <input className="form-control" value={orgForm.defaultTaxRatesCsv} onChange={(e) => setOrgForm((p) => ({ ...p, defaultTaxRatesCsv: e.target.value }))} placeholder="0,5,12,18,28" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Logo URL (optional)</label>
                <input className="form-control" value={orgForm.logoUrl} onChange={(e) => setOrgForm((p) => ({ ...p, logoUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Organization ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{orgId ?? '—'}</span></div>
                <button type="button" className="btn btn-primary" onClick={saveOrganizationSettings} disabled={savingOrg}>
                  {savingOrg ? 'Saving…' : 'Save Organization Settings'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ maxWidth: 860 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Client App Preferences</div>
              <div className="card-subtitle">Saved in browser for this SaaS client environment</div>
            </div>
            <span style={{ fontSize: 24 }}>⚙️</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label>Default Reports Date Preset</label>
              <select className="form-control" value={prefs.reportDefaultPreset} onChange={(e) => setPrefs((p) => ({ ...p, reportDefaultPreset: e.target.value as typeof p.reportDefaultPreset }))}>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="last6Months">Last 6 Months</option>
                <option value="financialYear">Current Financial Year</option>
              </select>
            </div>
            <div className="form-group">
              <label>Default Payment Method</label>
              <select className="form-control" value={prefs.paymentDefaultMethod} onChange={(e) => setPrefs((p) => ({ ...p, paymentDefaultMethod: e.target.value as typeof p.paymentDefaultMethod }))}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="form-group">
              <label>Include GST in Estimate Builder by Default</label>
              <select className="form-control" value={prefs.estimateIncludeGSTByDefault ? 'yes' : 'no'} onChange={(e) => setPrefs((p) => ({ ...p, estimateIncludeGSTByDefault: e.target.value === 'yes' }))}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end', display: 'flex', alignItems: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={savePreferences} disabled={savingPrefs}>
                {savingPrefs ? 'Saving…' : 'Save App Preferences'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
