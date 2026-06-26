/* ============================================================
 * FICHIER : src/shared/location/components/AddressForm.tsx
 * RÔLE    : Formulaire complet de saisie d'adresse avec carte
 *           interactive (LocationPicker intégré).
 * ============================================================ */

import React, { useState, useEffect } from 'react';
import LocationPicker                  from './LocationPicker';
import '../styles/location.css';
import type { ClientAddress, TypeAdresse, NominatimResult } from '../types/location.types';
import { TYPE_ADRESSE_LABELS }         from '../types/location.types';
import type { LocationPickerValue }    from './LocationPicker';

interface AddressFormProps {
  initial?:    Partial<ClientAddress>;
  onSave:      (data: Omit<ClientAddress, 'id' | 'creeLe' | 'misAJourLe'>) => Promise<void>;
  onCancel?:   () => void;
  loading?:    boolean;
}

const TYPE_OPTIONS: TypeAdresse[] = ['domicile', 'bureau', 'boutique', 'entrepot', 'relais', 'autre'];

const EMPTY: Omit<ClientAddress, 'id' | 'creeLe' | 'misAJourLe'> = {
  typeAdresse:  'domicile',
  libelle:      '',
  rue:          '',
  quartier:     '',
  commune:      '',
  ville:        '',
  prefecture:   '',
  region:       '',
  pays:         'GN',
  codePostal:   '',
  latitude:     null,
  longitude:    null,
  instructions: '',
  telephone:    '',
  estDefaut:    false,
};

export default function AddressForm({ initial, onSave, onCancel, loading = false }: AddressFormProps) {
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    if (initial) setForm({ ...EMPTY, ...initial });
  }, [initial]);

  const set = (key: keyof typeof EMPTY, val: unknown) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handlePickerChange = (val: LocationPickerValue) => {
    const { coordinates, address } = val;
    const upd: Partial<typeof EMPTY> = {
      latitude:  coordinates.latitude,
      longitude: coordinates.longitude,
    };
    if (address) {
      if (address.adresse)    upd.rue       = address.adresse;
      if (address.quartier)   upd.quartier  = address.quartier;
      if (address.commune)    upd.commune   = address.commune;
      if (address.ville)      upd.ville     = address.ville;
      if (address.region)     upd.region    = address.region;
      if (address.pays)       upd.pays      = address.pays;
      if (address.codePostal) upd.codePostal = address.codePostal;
    }
    setForm(prev => ({ ...prev, ...upd }));
  };

  const handleSubmit = async () => {
    if (!form.ville.trim()) { setError('La ville est obligatoire.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const pickerValue: LocationPickerValue | null = form.latitude && form.longitude
    ? { coordinates: { latitude: form.latitude, longitude: form.longitude }, address: null }
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Carte interactive */}
      <LocationPicker
        value={pickerValue}
        onChange={handlePickerChange}
        height="280px"
        placeholder="Rechercher une adresse sur la carte…"
      />

      {/* Champs texte */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Type d'adresse */}
        <div className="field-group" style={{ gridColumn: '1 / -1' }}>
          <div className="field-label">Type d'adresse</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TYPE_OPTIONS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set('typeAdresse', t)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 13,
                  border: `1.5px solid ${form.typeAdresse === t ? 'var(--blue)' : 'var(--border,#e5e7eb)'}`,
                  background: form.typeAdresse === t ? 'var(--blue)' : 'transparent',
                  color: form.typeAdresse === t ? '#fff' : 'var(--t2)',
                  cursor: 'pointer', fontWeight: form.typeAdresse === t ? 700 : 400,
                }}
              >
                {TYPE_ADRESSE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Libellé */}
        <div className="field-group" style={{ gridColumn: '1 / -1' }}>
          <label className="field-label">Libellé (ex : "Maison", "Bureau")</label>
          <input className="field-input" value={form.libelle ?? ''} onChange={e => set('libelle', e.target.value)} placeholder="Libellé optionnel" />
        </div>

        {/* Rue */}
        <div className="field-group" style={{ gridColumn: '1 / -1' }}>
          <label className="field-label">Rue / Adresse</label>
          <input className="field-input" value={form.rue ?? ''} onChange={e => set('rue', e.target.value)} placeholder="Numéro et rue" />
        </div>

        {/* Quartier */}
        <div className="field-group">
          <label className="field-label">Quartier</label>
          <input className="field-input" value={form.quartier ?? ''} onChange={e => set('quartier', e.target.value)} placeholder="Quartier" />
        </div>

        {/* Commune */}
        <div className="field-group">
          <label className="field-label">Commune</label>
          <input className="field-input" value={form.commune ?? ''} onChange={e => set('commune', e.target.value)} placeholder="Commune" />
        </div>

        {/* Ville */}
        <div className="field-group">
          <label className="field-label">Ville <span style={{ color: 'var(--rose)' }}>*</span></label>
          <input className="field-input" value={form.ville} onChange={e => set('ville', e.target.value)} placeholder="Conakry" />
        </div>

        {/* Région */}
        <div className="field-group">
          <label className="field-label">Région</label>
          <input className="field-input" value={form.region ?? ''} onChange={e => set('region', e.target.value)} placeholder="Conakry" />
        </div>

        {/* Code postal */}
        <div className="field-group">
          <label className="field-label">Code postal</label>
          <input className="field-input" value={form.codePostal ?? ''} onChange={e => set('codePostal', e.target.value)} placeholder="224" />
        </div>

        {/* Téléphone */}
        <div className="field-group">
          <label className="field-label">Téléphone de contact</label>
          <input className="field-input" value={form.telephone ?? ''} onChange={e => set('telephone', e.target.value)} placeholder="+224 6xx xxx xxx" />
        </div>

        {/* Instructions */}
        <div className="field-group" style={{ gridColumn: '1 / -1' }}>
          <label className="field-label">Instructions de livraison</label>
          <textarea
            className="field-input"
            value={form.instructions ?? ''}
            onChange={e => set('instructions', e.target.value)}
            placeholder="Ex : Sonner à l'interphone, code porte 1234…"
            rows={2}
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Par défaut */}
        <div className="field-group" style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={form.estDefaut} onChange={e => set('estDefaut', e.target.checked)} style={{ width: 16, height: 16 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Définir comme adresse par défaut</span>
          </label>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div style={{ color: 'var(--rose, red)', fontSize: 12.5, padding: '8px 12px', background: '#fff0f0', borderRadius: 8 }}>
          <i className="fas fa-circle-exclamation" style={{ marginRight: 6 }} />{error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        {onCancel && (
          <button type="button" onClick={onCancel} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 14 }}>
            Annuler
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || loading}
          style={{ padding: '9px 24px', borderRadius: 10, background: 'var(--blue, #1A4FC4)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, opacity: (saving || loading) ? .6 : 1 }}
        >
          {saving ? <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</> : '✓ Enregistrer'}
        </button>
      </div>
    </div>
  );
}
