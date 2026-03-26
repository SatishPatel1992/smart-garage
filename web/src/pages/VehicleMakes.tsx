import { useEffect, useState } from 'react';
import { vehicleMakes as api } from '../api/client';
import type { VehicleMakeDto } from '../api/client';

type ModalState =
  | { type: 'addMake' }
  | { type: 'editMake'; make: VehicleMakeDto }
  | { type: 'deleteMake'; make: VehicleMakeDto }
  | { type: 'addModel'; make: VehicleMakeDto }
  | { type: 'editModel'; make: VehicleMakeDto; modelId: string; modelName: string }
  | { type: 'deleteModel'; make: VehicleMakeDto; modelId: string; modelName: string }
  | null;

export default function VehicleMakes() {
  const [makes, setMakes] = useState<VehicleMakeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMake, setExpandedMake] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [inputVal, setInputVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    api.list()
      .then(res => setMakes(res.makes))
      .catch(() => setError('Failed to load vehicle makes.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openModal = (m: ModalState, prefill = '') => {
    setModal(m);
    setInputVal(prefill);
    setModalError('');
  };

  const closeModal = () => { setModal(null); setInputVal(''); setModalError(''); };

  const handleSave = async () => {
    const name = inputVal.trim();
    if (!name) { setModalError('Name is required.'); return; }
    setSaving(true);
    setModalError('');
    try {
      if (modal?.type === 'addMake') {
        const created = await api.create({ name });
        setMakes(prev => [...prev, created]);
      } else if (modal?.type === 'editMake') {
        const updated = await api.update(modal.make.id, { name });
        setMakes(prev => prev.map(m => m.id === updated.id ? { ...m, name: updated.name } : m));
      } else if (modal?.type === 'addModel') {
        const newModel = await api.createModel(modal.make.id, { name });
        setMakes(prev => prev.map(m =>
          m.id === modal.make.id ? { ...m, models: [...m.models, newModel] } : m
        ));
        setExpandedMake(modal.make.id);
      } else if (modal?.type === 'editModel') {
        const updated = await api.updateModel(modal.make.id, modal.modelId, { name });
        setMakes(prev => prev.map(m =>
          m.id === modal.make.id
            ? { ...m, models: m.models.map(mo => mo.id === updated.id ? updated : mo) }
            : m
        ));
      }
      closeModal();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setModalError('');
    try {
      if (modal?.type === 'deleteMake') {
        await api.delete(modal.make.id);
        setMakes(prev => prev.filter(m => m.id !== modal.make.id));
        if (expandedMake === modal.make.id) setExpandedMake(null);
      } else if (modal?.type === 'deleteModel') {
        await api.deleteModel(modal.make.id, modal.modelId);
        setMakes(prev => prev.map(m =>
          m.id === modal.make.id
            ? { ...m, models: m.models.filter(mo => mo.id !== modal.modelId) }
            : m
        ));
      }
      closeModal();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Failed to delete.');
    } finally {
      setSaving(false);
    }
  };

  const isNameModal = modal?.type === 'addMake' || modal?.type === 'editMake' ||
    modal?.type === 'addModel' || modal?.type === 'editModel';
  const isDeleteModal = modal?.type === 'deleteMake' || modal?.type === 'deleteModel';

  const modalTitle = () => {
    if (!modal) return '';
    if (modal.type === 'addMake') return 'Add Vehicle Make';
    if (modal.type === 'editMake') return `Edit Make — ${modal.make.name}`;
    if (modal.type === 'deleteMake') return 'Delete Make';
    if (modal.type === 'addModel') return `Add Model to ${modal.make.name}`;
    if (modal.type === 'editModel') return `Edit Model — ${modal.modelName}`;
    if (modal.type === 'deleteModel') return 'Delete Model';
    return '';
  };

  const deleteWarning = () => {
    if (modal?.type === 'deleteMake')
      return `Delete "${modal.make.name}" and all its ${modal.make.models?.length ?? 0} model(s)? This cannot be undone.`;
    if (modal?.type === 'deleteModel')
      return `Delete model "${modal.modelName}"? This cannot be undone.`;
    return '';
  };

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div>
              <h1 className="page-title">Vehicle Makes &amp; Models</h1>
              <p className="page-subtitle">Master list of brands and models available when adding vehicles</p>
            </div>
            <button className="btn btn-primary" onClick={() => openModal({ type: 'addMake' })}>
              + Add Make
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>
            <div className="alert-icon">⚠️</div>
            <div className="alert-body">{error}</div>
          </div>
        )}

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : makes.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚗</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No vehicle makes yet</div>
            <div style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
              Add makes and their models to populate the vehicle dropdowns.
            </div>
            <button className="btn btn-primary" onClick={() => openModal({ type: 'addMake' })}>
              + Add First Make
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {makes.map(make => {
              const expanded = expandedMake === make.id;
              return (
                <div key={make.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Make row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '14px 18px',
                      cursor: 'pointer',
                      gap: 12,
                      background: expanded ? 'var(--bg-subtle)' : undefined,
                      borderBottom: expanded ? '1px solid var(--border)' : undefined,
                    }}
                    onClick={() => setExpandedMake(expanded ? null : make.id)}
                  >
                    <span style={{
                      fontSize: '0.8rem',
                      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s',
                      color: 'var(--text-muted)',
                      display: 'inline-block',
                    }}>▶</span>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', flex: 1 }}>
                      {make.name}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: 20,
                      padding: '2px 10px',
                    }}>
                      {(make.models?.length ?? 0)} model{(make.models?.length ?? 0) !== 1 ? 's' : ''}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openModal({ type: 'addModel', make }, '')}
                      >
                        + Model
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openModal({ type: 'editMake', make }, make.name)}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => openModal({ type: 'deleteMake', make })}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Models list */}
                  {expanded && (
                    <div style={{ padding: '10px 18px 14px 44px' }}>
                      {(make.models?.length ?? 0) === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '6px 0' }}>
                          No models yet — click <strong>+ Model</strong> to add one.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {(make.models ?? []).map(model => (
                            <div
                              key={model.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                background: 'var(--bg-base)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '4px 10px',
                                fontSize: '0.85rem',
                              }}
                            >
                              <span>{model.name}</span>
                              <button
                                className="btn btn-sm"
                                style={{ padding: '0 4px', fontSize: '0.75rem', lineHeight: 1.2, minHeight: 'unset', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                title="Edit model"
                                onClick={() => openModal({ type: 'editModel', make, modelId: model.id, modelName: model.name }, model.name)}
                              >
                                ✏️
                              </button>
                              <button
                                className="btn btn-sm"
                                style={{ padding: '0 4px', fontSize: '0.75rem', lineHeight: 1.2, minHeight: 'unset', background: 'none', border: 'none', color: 'var(--danger, #e53e3e)', cursor: 'pointer' }}
                                title="Delete model"
                                onClick={() => openModal({ type: 'deleteModel', make, modelId: model.id, modelName: model.name })}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            padding: '28px 28px 24px',
            width: '100%',
            maxWidth: 420,
          }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 18 }}>
              {modalTitle()}
            </div>

            {isNameModal && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">
                  {modal.type === 'addMake' || modal.type === 'editMake' ? 'Make Name' : 'Model Name'}
                </label>
                <input
                  className="form-control"
                  autoFocus
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                  placeholder={
                    modal.type === 'addMake' || modal.type === 'editMake'
                      ? 'e.g. Maruti, Toyota…'
                      : 'e.g. Swift, Creta…'
                  }
                />
              </div>
            )}

            {isDeleteModal && (
              <p style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{deleteWarning()}</p>
            )}

            {modalError && (
              <div style={{ color: 'var(--danger, #e53e3e)', fontSize: '0.85rem', marginTop: 10 }}>
                ⚠️ {modalError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              {isNameModal && (
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              )}
              {isDeleteModal && (
                <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                  {saving ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
