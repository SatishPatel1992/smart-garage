import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { customers as customersApi, vehicleMakes as vehicleMakesApi } from '../../api/client';
import type { CreateCustomerBody, VehicleMakeDto } from '../../api/client';

const VEHICLE_TYPES = ['Sedan', 'Hatchback', 'SUV', 'MUV', 'Two-wheeler', 'Other'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'];

interface VehicleForm {
  registrationNo: string; make: string; model: string; type: string; fuel: string;
}
const emptyVehicle = (): VehicleForm => ({ registrationNo: '', make: '', model: '', type: '', fuel: '' });

export default function AddCustomer() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo =
    typeof (location.state as { returnTo?: unknown } | null)?.returnTo === 'string'
      ? (location.state as { returnTo: string }).returnTo
      : null;
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [vehicles, setVehicles] = useState<VehicleForm[]>([emptyVehicle()]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Vehicle make/model master ────────────────────────────────────────────
  const [makesData, setMakesData] = useState<VehicleMakeDto[]>([]);
  const [makesLoading, setMakesLoading] = useState(true);

  useEffect(() => {
    vehicleMakesApi.list()
      .then(res => setMakesData(res.makes))
      .catch(() => { /* silently fall back to empty — user can still type */ })
      .finally(() => setMakesLoading(false));
  }, []);

  /** Returns model names for the selected make, or [] if make not found. */
  const modelsForMake = (makeName: string): string[] => {
    const found = makesData.find(m => m.name === makeName);
    return found ? found.models.map(mo => mo.name) : [];
  };

  const addVehicle = () => setVehicles(prev => [...prev, emptyVehicle()]);
  const updateVehicle = (index: number, field: keyof VehicleForm, value: string) => {
    setVehicles(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
    if (field === 'make') {
      const models = modelsForMake(value);
      const current = vehicles[index];
      if (current?.model && !models.includes(current.model)) {
        setVehicles(prev => prev.map((v, i) => i === index ? { ...v, model: '' } : v));
      }
    }
  };
  const removeVehicle = (index: number) => {
    if (vehicles.length <= 1) return;
    setVehicles(prev => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    if (!name.trim() || name.trim().length < 3) { setError('Name is required (min 3 characters)'); return false; }
    if (mobile.replace(/\D/g, '').length !== 10) { setError('Please enter a valid 10-digit mobile number.'); return false; }
    if (!vehicles.some(v => v.registrationNo.trim() && v.make.trim() && v.model.trim())) {
      setError('Please add at least one vehicle with number, brand and model.'); return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    const validVehicles = vehicles.filter(v => v.registrationNo.trim() && v.make.trim() && v.model.trim());
    const body: CreateCustomerBody = {
      name: name.trim(),
      phone: mobile.trim(),
      address: address.trim() || undefined,
      gstin: gstin.trim() || undefined,
      vehicles: validVehicles.map(v => ({
        registrationNo: v.registrationNo.trim(),
        make: v.make.trim(),
        model: v.model.trim(),
        type: v.type || undefined,
        fuel: v.fuel || undefined,
      })),
    };
    setSubmitting(true);
    try {
      const created = await customersApi.create(body);
      if (returnTo) navigate(returnTo);
      else navigate(`/customers/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(returnTo || '/customers')}>
              ← Back
            </button>
            <div>
              <h1 className="page-title">Add Customer</h1>
              <p className="page-subtitle">Create a new customer record with vehicles</p>
            </div>
          </div>
        </div>
      </div>

      <div className="page-content">
        <form onSubmit={handleSubmit}>
          {/* Customer Details */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Customer Details</div>
                <div className="card-subtitle">Basic contact information</div>
              </div>
              <span style={{ fontSize: 24 }}>👤</span>
            </div>

            <div className="form-row form-row-2" style={{ marginBottom: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">Full Name</label>
                <input className="form-control" placeholder="e.g. Rajesh Kumar" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">Mobile Number</label>
                <input className="form-control" placeholder="10-digit mobile number" value={mobile} onChange={e => setMobile(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <textarea className="form-control" rows={2} placeholder="Street, city, state…" value={address} onChange={e => setAddress(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">GSTIN <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input className="form-control" placeholder="GST Identification Number" value={gstin} onChange={e => setGstin(e.target.value)} style={{ fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>

          {/* Vehicles */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Vehicles</div>
                <div className="card-subtitle">Add one or more vehicles for this customer</div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addVehicle}>
                + Add Vehicle
              </button>
            </div>

            {vehicles.map((v, index) => (
              <div key={index} style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 18px',
                marginBottom: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Vehicle {index + 1}
                  </span>
                  {vehicles.length > 1 && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeVehicle(index)}>
                      Remove
                    </button>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label required">Registration Number</label>
                  <input className="form-control" placeholder="e.g. GJ01AB1234" value={v.registrationNo}
                    onChange={e => updateVehicle(index, 'registrationNo', e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontWeight: 600 }} />
                </div>

                <div className="form-row form-row-2" style={{ marginBottom: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label required">Brand / Make</label>
                    <select className="form-control" value={v.make} onChange={e => updateVehicle(index, 'make', e.target.value)}
                      disabled={makesLoading}>
                      <option value="">{makesLoading ? 'Loading…' : 'Select brand'}</option>
                      {makesData.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label required">Model</label>
                    <select className="form-control" value={v.model} onChange={e => updateVehicle(index, 'model', e.target.value)}
                      disabled={makesLoading || !v.make}>
                      <option value="">{!v.make ? '— Select brand first' : 'Select model'}</option>
                      {modelsForMake(v.make).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Vehicle Type</label>
                    <select className="form-control" value={v.type} onChange={e => updateVehicle(index, 'type', e.target.value)}>
                      <option value="">— Select type</option>
                      {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Fuel Type</label>
                    <select className="form-control" value={v.fuel} onChange={e => updateVehicle(index, 'fuel', e.target.value)}>
                      <option value="">— Select fuel</option>
                      {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Submit */}
          {error && <div className="error-msg" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
              {submitting ? 'Saving…' : '✓ Save Customer'}
            </button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate(returnTo || '/customers')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
