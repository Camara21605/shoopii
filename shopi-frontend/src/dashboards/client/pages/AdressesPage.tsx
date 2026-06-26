/* ============================================================
 * FICHIER : src/dashboards/client/pages/AdressesPage.tsx
 * RÔLE    : Page de gestion des adresses du client.
 *           Utilise l'API /location/addresses (entité Localisation).
 * ============================================================ */

import { useState, useEffect, lazy, Suspense } from 'react';
import { apiFetch }    from '../../../shared/services/apiFetch';
import AddressCard     from '../../../shared/location/components/AddressCard';
import '../../../shared/location/styles/location.css';
import type { ClientAddress } from '../../../shared/location/types/location.types';
import type { LocationPickerValue } from '../../../shared/location/components/LocationPicker';

// Lazy pour ne pas bloquer le chargement
const AddressForm = lazy(() => import('../../../shared/location/components/AddressForm'));

interface Props {
  onToast?: (msg: string, type?: string) => void;
}

type Mode = 'list' | 'create' | 'edit';

export default function AdressesPage({ onToast }: Props) {
  const [addresses,  setAddresses]  = useState<ClientAddress[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [mode,       setMode]       = useState<Mode>('list');
  const [editTarget, setEditTarget] = useState<ClientAddress | null>(null);
  const [saving,     setSaving]     = useState(false);

  /* ── Chargement ──────────────────────────────────────────── */
  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ClientAddress[]>('/location/addresses');
      setAddresses(Array.isArray(data) ? data : []);
    } catch { /* silencieux */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /* ── Créer ───────────────────────────────────────────────── */
  const handleCreate = async (
    form: Omit<ClientAddress, 'id' | 'creeLe' | 'misAJourLe'>,
  ) => {
    setSaving(true);
    try {
      await apiFetch('/location/addresses', { method: 'POST', body: form });
      onToast?.('✅ Adresse ajoutée avec succès !', 's');
      setMode('list');
      await load();
    } finally { setSaving(false); }
  };

  /* ── Modifier ────────────────────────────────────────────── */
  const handleUpdate = async (
    form: Omit<ClientAddress, 'id' | 'creeLe' | 'misAJourLe'>,
  ) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/location/addresses/${editTarget.id}`, { method: 'PATCH', body: form });
      onToast?.('✅ Adresse mise à jour.', 's');
      setMode('list');
      setEditTarget(null);
      await load();
    } finally { setSaving(false); }
  };

  /* ── Supprimer ───────────────────────────────────────────── */
  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette adresse ?')) return;
    try {
      await apiFetch(`/location/addresses/${id}`, { method: 'DELETE' });
      onToast?.('🗑️ Adresse supprimée.', 'i');
      setAddresses(prev => prev.filter(a => a.id !== id));
    } catch (e: any) {
      onToast?.(`❌ ${e.message}`, 'e');
    }
  };

  /* ── Définir par défaut ──────────────────────────────────── */
  const handleSetDefault = async (id: string) => {
    try {
      const updated = await apiFetch<ClientAddress[]>(`/location/addresses/${id}/default`, { method: 'PATCH' });
      if (Array.isArray(updated)) setAddresses(updated);
      onToast?.('⭐ Adresse par défaut mise à jour.', 's');
    } catch (e: any) {
      onToast?.(`❌ ${e.message}`, 'e');
    }
  };

  const startEdit = (address: ClientAddress) => {
    setEditTarget(address);
    setMode('edit');
  };

  /* ── Rendu ───────────────────────────────────────────────── */

  if (mode === 'create' || mode === 'edit') {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 0 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => { setMode('list'); setEditTarget(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--blue)', padding: 4 }}
          >
            <i className="fas fa-arrow-left" />
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            {mode === 'create' ? 'Nouvelle adresse' : 'Modifier l\'adresse'}
          </h2>
        </div>
        <Suspense fallback={
          <div style={{ textAlign: 'center', padding: 40 }}>
            <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 24, color: 'var(--blue)' }} />
          </div>
        }>
          <AddressForm
            initial={editTarget ?? undefined}
            onSave={mode === 'create' ? handleCreate : handleUpdate}
            onCancel={() => { setMode('list'); setEditTarget(null); }}
            loading={saving}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 0 32px' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Mes adresses</h2>
          <p style={{ fontSize: 12.5, color: 'var(--t2)', margin: '4px 0 0' }}>
            {addresses.length} adresse{addresses.length !== 1 ? 's' : ''} enregistrée{addresses.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setMode('create')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 18px', borderRadius: 10,
            background: 'var(--blue, #1A4FC4)', color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <i className="fas fa-plus" /> Ajouter
        </button>
      </div>

      {/* Chargement */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 24, color: 'var(--blue)' }} />
        </div>
      )}

      {/* Liste vide */}
      {!loading && addresses.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          background: 'var(--sky-2, #f0f4ff)', borderRadius: 16,
          border: '1.5px dashed var(--sky-3, #c7d9f8)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Aucune adresse</div>
          <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 20 }}>
            Ajoutez vos adresses pour faciliter vos livraisons.
          </div>
          <button
            onClick={() => setMode('create')}
            style={{
              padding: '10px 24px', borderRadius: 10,
              background: 'var(--blue)', color: '#fff',
              border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <i className="fas fa-plus" style={{ marginRight: 8 }} />
            Ajouter ma première adresse
          </button>
        </div>
      )}

      {/* Cartes */}
      {!loading && addresses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {addresses.map(address => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={startEdit}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
            />
          ))}
        </div>
      )}
    </div>
  );
}
