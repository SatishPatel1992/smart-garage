import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jobs as jobsApi, customers as customersApi, users as usersApi } from '../../api/client';
import type { CustomerWithVehiclesDto, UserDto } from '../../api/client';

const AUTOCOMPLETE_MAX = 8;
const FREQUENT_COMPLAINTS = [
  'General service',
  'AC not cooling',
  'Engine noise',
  'Brake issue',
  'Battery problem',
  'Pickup issue',
  'Oil leakage',
  'Starting trouble',
];

function formatDate(d: Date) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function customerLabel(c: CustomerWithVehiclesDto) {
  return `${c.name} — ${c.phone}`;
}

export default function CreateJob() {
  const navigate = useNavigate();
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [customers, setCustomers] = useState<CustomerWithVehiclesDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [complaints, setComplaints] = useState('');
  const [odometerReading, setOdometerReading] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCustomerData, setSelectedCustomerData] = useState<CustomerWithVehiclesDto | null>(null);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [assignedMechanicId, setAssignedMechanicId] = useState('');
  const [serviceAdvisorId, setServiceAdvisorId] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      customersApi
        .list(customerSearch.trim() || undefined, true)
        .then((res) => setCustomers(res.customers))
        .catch(() => setError('Failed to load customers'))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    usersApi.list().then((res) => setUsers(res.users)).catch(() => {});
  }, []);

  const selectedCustomer = selectedCustomerData ?? customers.find((c) => c.id === customerId);
  const vehicles = selectedCustomer?.vehicles ?? [];
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  useEffect(() => {
    if (customerId && selectedCustomerData && !vehicles.some((v) => v.id === vehicleId)) {
      setVehicleId(vehicles[0]?.id ?? '');
    }
  }, [customerId, selectedCustomerData, vehicles, vehicleId]);

  const mechanics = users.filter((u) => u.role === 'mechanic' && u.isActive);
  const advisors = users.filter((u) => u.role === 'advisor' && u.isActive);

  const addComplaintPreset = (text: string) => {
    setComplaints((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return text;
      const exists = trimmed.toLowerCase().includes(text.toLowerCase());
      return exists ? prev : `${trimmed}, ${text}`;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const odometer = parseInt(odometerReading, 10);
    if (!customerId || !vehicleId) { setError('Please select a customer and vehicle.'); return; }
    if (isNaN(odometer) || odometer < 0) { setError('Please enter a valid odometer reading.'); return; }
    setSubmitting(true);
    try {
      const job = await jobsApi.create({
        customerId, vehicleId,
        complaints: complaints.trim(),
        odometerReading: odometer,
        assignedMechanicId: assignedMechanicId || undefined,
      });
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  };

  const today = formatDate(new Date());

  if (loading && customers.length === 0) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  const infoVal = (val: string | null | undefined) => val || <span className="jobcard-info-value empty">N/A</span>;

  return (
    <div className="jobcard-page">
      <div className="page-header">
        <div className="jobcard-header-inner">
          <h1 className="jobcard-title">New Job Card</h1>
          <Link to="/jobs" className="jobcard-back">← Back to Jobs</Link>
        </div>
      </div>

      <div className="jobcard-content">
        <form onSubmit={handleSubmit}>

          {/* Customer search row */}
          <div className="jobcard-search-row">
            <div className="jobcard-search-combobox" ref={searchWrapRef}>
              <div className="jobcard-search-wrap">
                <span className="jobcard-search-icon">🔍</span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by vehicle no, customer name or phone…"
                  value={selectedCustomerData ? customerLabel(selectedCustomerData) : customerSearch}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (selectedCustomerData) {
                      setCustomerId(''); setVehicleId(''); setSelectedCustomerData(null);
                    }
                    setCustomerSearch(v);
                  }}
                  onFocus={() => setSearchFocused(true)}
                  aria-label="Search customer"
                />
              </div>
              {searchFocused && customers.length > 0 && (
                <ul className="jobcard-autocomplete-list" role="listbox">
                  {customers.slice(0, AUTOCOMPLETE_MAX).map((c) => (
                    <li
                      key={c.id}
                      role="option"
                      aria-selected={c.id === customerId}
                      className="jobcard-autocomplete-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCustomerId(c.id);
                        setSelectedCustomerData(c);
                        setVehicleId(c.vehicles[0]?.id ?? '');
                        setCustomerSearch(customerLabel(c));
                        setSearchFocused(false);
                      }}
                    >
                      <span className="jobcard-autocomplete-item-main">{c.name}</span>
                      <span className="jobcard-autocomplete-item-meta">{c.phone}</span>
                      {c.vehicles.length > 0 && (
                        <span className="jobcard-autocomplete-item-vehicle">
                          {c.vehicles.map((v) => v.registrationNo).join(', ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <span className="jobcard-or">OR</span>
            <Link to="/customers/new" state={{ returnTo: '/jobs/new' }} className="jobcard-add-customer">+ Add New Customer</Link>
          </div>

          {/* Info grid */}
          <div className="jobcard-info-grid">
            <div className="jobcard-info-panel">
              <h4>Customer Details</h4>
              <div className="jobcard-info-row"><span className="jobcard-info-label">Name</span><span className="jobcard-info-value">{infoVal(selectedCustomer?.name)}</span></div>
              <div className="jobcard-info-row"><span className="jobcard-info-label">Contact No</span><span className="jobcard-info-value">{infoVal(selectedCustomer?.phone)}</span></div>
              <div className="jobcard-info-row"><span className="jobcard-info-label">Email</span><span className="jobcard-info-value">{infoVal(selectedCustomer?.email)}</span></div>
              <div className="jobcard-info-row"><span className="jobcard-info-label">Address</span><span className="jobcard-info-value">{infoVal(selectedCustomer?.address)}</span></div>
              <div className="jobcard-info-row"><span className="jobcard-info-label">GST No.</span><span className="jobcard-info-value">{infoVal(selectedCustomer?.gstin)}</span></div>
            </div>

            <div className="jobcard-info-panel">
              <h4>Vehicle Details</h4>
              {selectedCustomerData && vehicles.length > 0 && (
                <div className="jobcard-info-row">
                  <span className="jobcard-info-label">Select Vehicle</span>
                  <select
                    className="form-control"
                    style={{ width: 'auto', minWidth: 160, fontSize: '0.8125rem' }}
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                  >
                    <option value="">Select vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.registrationNo} — {v.make} {v.model}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="jobcard-info-row"><span className="jobcard-info-label">Vehicle No</span><span className="jobcard-info-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{infoVal(selectedVehicle?.registrationNo)}</span></div>
              <div className="jobcard-info-row"><span className="jobcard-info-label">Make</span><span className="jobcard-info-value">{infoVal(selectedVehicle?.make)}</span></div>
              <div className="jobcard-info-row"><span className="jobcard-info-label">Model</span><span className="jobcard-info-value">{infoVal(selectedVehicle?.model)}</span></div>
              <div className="jobcard-info-row"><span className="jobcard-info-label">Type</span><span className="jobcard-info-value">{infoVal(selectedVehicle?.type)}</span></div>
              <div className="jobcard-info-row"><span className="jobcard-info-label">Fuel</span><span className="jobcard-info-value">{infoVal(selectedVehicle?.fuel)}</span></div>
            </div>
          </div>

          {/* Tabs */}
          <div className="jobcard-tabs">
            <button type="button" className="jobcard-tab active">📋 Job Item</button>
            <button type="button" className="jobcard-tab" disabled title="Available after creating job">🔄 Service History</button>
          </div>

          {/* Form fields */}
          <div className="jobcard-form-card jobcard-form-card-full">
            <div className="jobcard-form-row jobcard-form-row-full">
              <div className="jobcard-form-group">
                <label>Jobcard No.</label>
                <input className="form-control" readOnly value="Auto Generated" />
              </div>
              <div className="jobcard-form-group">
                <label>Date</label>
                <input className="form-control" readOnly value={today} />
              </div>
              <div className="jobcard-form-group">
                <label>Expected Delivery Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                />
              </div>
            </div>
            <div className="jobcard-form-row jobcard-form-row-full" style={{ marginTop: 16 }}>
              <div className="jobcard-form-group">
                <label>Odometer Reading (km) *</label>
                <input
                  type="number"
                  className="form-control"
                  min={0}
                  value={odometerReading}
                  onChange={(e) => setOdometerReading(e.target.value)}
                  placeholder="e.g. 45000"
                  required
                />
              </div>
              <div className="jobcard-form-group">
                <label>Assigned Mechanic</label>
                <select
                  className="form-control"
                  value={assignedMechanicId}
                  onChange={(e) => setAssignedMechanicId(e.target.value)}
                >
                  <option value="">— Select mechanic</option>
                  {mechanics.map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>
              <div className="jobcard-form-group">
                <label>Service Advisor</label>
                <select
                  className="form-control"
                  value={serviceAdvisorId}
                  onChange={(e) => setServiceAdvisorId(e.target.value)}
                  disabled={advisors.length === 0}
                >
                  <option value="">— Select advisor</option>
                  {advisors.map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Complaint */}
          <div className="jobcard-complaint-wrap">
            <label htmlFor="complaints">Customer Complaint / Concern</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {FREQUENT_COMPLAINTS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => addComplaintPreset(item)}
                  className="btn btn-sm"
                  style={{
                    minHeight: 'unset',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    borderRadius: 999,
                    background: '#f0fdfa',
                    border: '1px solid #99f6e4',
                    color: '#0f766e',
                  }}
                >
                  + {item}
                </button>
              ))}
            </div>
            <textarea
              id="complaints"
              className="form-control"
              rows={4}
              value={complaints}
              onChange={(e) => setComplaints(e.target.value)}
              placeholder="Describe the customer's complaint or service requirement (e.g. General service, AC not cooling, Engine noise…)"
            />
          </div>

          {error && <p className="error-msg" style={{ marginTop: 12 }}>⚠️ {error}</p>}

          <div className="jobcard-actions">
            <button type="submit" className="jobcard-btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : '✓ Create Job Card'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/jobs')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
