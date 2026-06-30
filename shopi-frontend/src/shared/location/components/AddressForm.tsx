/* ============================================================
 * FICHIER : src/shared/location/components/AddressForm.tsx
 *
 * RÔLE : Formulaire de saisie d'adresse avec listes déroulantes.
 *        - Pays : pré-rempli depuis l'inscription (non modifiable)
 *        - Ville : liste déroulante des villes guinéennes
 *        - Commune : list déroulante selon la ville choisie
 *        - Quartier : liste déroulante selon la commune choisie
 *        - Champs libres : rue, instructions, téléphone
 * ============================================================ */

import { useState, useEffect, useMemo } from 'react';
import '../styles/location.css';
import type { ClientAddress, TypeAdresse } from '../types/location.types';
import { TYPE_ADRESSE_LABELS }             from '../types/location.types';
import {
  VILLES_SORTED, getCommunesByVille, getQuartiersByCommune,
} from '../data/geo-guinee';

/* ── Pays supportés (extensible) ────────────────────────── */
interface PaysInfo { code: string; nom: string; emoji: string; }
const PAYS_SUPPORTES: PaysInfo[] = [
  { code: 'GN', nom: 'Guinée',          emoji: '🇬🇳' },
  { code: 'SN', nom: 'Sénégal',         emoji: '🇸🇳' },
  { code: 'ML', nom: 'Mali',             emoji: '🇲🇱' },
  { code: 'CI', nom: "Côte d'Ivoire",   emoji: '🇨🇮' },
  { code: 'GW', nom: 'Guinée-Bissau',   emoji: '🇬🇼' },
  { code: 'MR', nom: 'Mauritanie',      emoji: '🇲🇷' },
  { code: 'LR', nom: 'Libéria',         emoji: '🇱🇷' },
  { code: 'SL', nom: 'Sierra Leone',    emoji: '🇸🇱' },
  { code: 'FR', nom: 'France',           emoji: '🇫🇷' },
  { code: 'OTHER', nom: 'Autre pays',   emoji: '🌍' },
];

/* ── Props ───────────────────────────────────────────────── */
interface AddressFormProps {
  initial?:         Partial<ClientAddress>;
  countryCodeUser?: string;   // pays de l'utilisateur (depuis inscription)
  countryNameUser?: string;
  onSave:           (data: Omit<ClientAddress, 'id' | 'creeLe' | 'misAJourLe'>) => Promise<void>;
  onCancel?:        () => void;
  loading?:         boolean;
}

const TYPE_OPTIONS: TypeAdresse[] = [
  'domicile', 'bureau', 'boutique', 'entrepot', 'relais', 'autre',
];

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

/* ── Styles partagés ─────────────────────────────────────── */
const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
const fieldLabel: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: 'var(--navy, #0B1F3A)' };
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  border: '1.5px solid var(--bdr2, #CBD5E1)',
  borderRadius: 10, background: 'var(--white, #fff)',
  color: 'var(--navy, #0B1F3A)', fontSize: 13,
  fontFamily: 'var(--fb, "DM Sans", sans-serif)',
  outline: 'none', cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 36,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  border: '1.5px solid var(--bdr2, #CBD5E1)',
  borderRadius: 10, background: 'var(--white, #fff)',
  color: 'var(--navy, #0B1F3A)', fontSize: 13,
  fontFamily: 'var(--fb, "DM Sans", sans-serif)',
  outline: 'none', boxSizing: 'border-box',
};
const disabledStyle: React.CSSProperties = {
  ...selectStyle,
  background: 'var(--g100, #F1F5F9)',
  color: 'var(--t2, #475569)',
  cursor: 'not-allowed',
  opacity: 0.8,
};

/* ═══════════════════════════════════════════════════════════ */

export default function AddressForm({
  initial, countryCodeUser = 'GN', countryNameUser = 'Guinée',
  onSave, onCancel, loading = false,
}: AddressFormProps) {

  const [form,   setForm]   = useState<typeof EMPTY>({ ...EMPTY, pays: countryCodeUser, ...initial });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    if (initial) setForm({ ...EMPTY, pays: countryCodeUser, ...initial });
  }, [initial, countryCodeUser]);

  const set = (key: keyof typeof EMPTY, val: unknown) =>
    setForm(prev => ({ ...prev, [key]: val }));

  /* ── Cascades des listes déroulantes ─── */
  const paysInfo     = PAYS_SUPPORTES.find(p => p.code === form.pays) ?? PAYS_SUPPORTES[0];
  const estGuinee    = form.pays === 'GN';

  /* Villes disponibles selon le pays */
  const villes = estGuinee ? VILLES_SORTED : [];

  /* Communes disponibles selon la ville */
  const communes = useMemo(
    () => estGuinee ? getCommunesByVille(form.ville) : [],
    [form.ville, estGuinee],
  );

  /* Quartiers disponibles selon la commune */
  const quartiers = useMemo(
    () => estGuinee && form.commune ? getQuartiersByCommune(form.ville, form.commune) : [],
    [form.ville, form.commune, estGuinee],
  );

  /* Réinitialiser commune + quartier quand la ville change */
  const handleVilleChange = (ville: string) => {
    setForm(prev => ({
      ...prev,
      ville,
      commune:    '',
      quartier:   '',
      region:     VILLES_SORTED.find(v => v.nom === ville)?.region ?? '',
    }));
  };

  /* Réinitialiser quartier quand la commune change */
  const handleCommuneChange = (commune: string) => {
    setForm(prev => ({ ...prev, commune, quartier: '' }));
  };

  /* Réinitialiser ville + commune + quartier quand le pays change */
  const handlePaysChange = (pays: string) => {
    setForm(prev => ({ ...prev, pays, ville: '', commune: '', quartier: '', region: '' }));
  };

  /* ── Soumission ─────────────────────────────────────── */
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

  /* ── RENDER ─────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── TYPE D'ADRESSE ── */}
      <div style={fieldWrap}>
        <span style={fieldLabel}>Type d'adresse</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TYPE_OPTIONS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => set('typeAdresse', t)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12.5,
                border: `1.5px solid ${form.typeAdresse === t ? 'var(--blue, #1A4FC4)' : 'var(--bdr2, #CBD5E1)'}`,
                background: form.typeAdresse === t ? 'var(--blue, #1A4FC4)' : 'transparent',
                color: form.typeAdresse === t ? '#fff' : 'var(--t2, #475569)',
                cursor: 'pointer', fontWeight: 600, transition: 'all .15s',
              }}
            >
              {TYPE_ADRESSE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ── LIBELLÉ ── */}
      <div style={fieldWrap}>
        <label style={fieldLabel}>Libellé <span style={{ color: 'var(--t3)', fontWeight: 400 }}>(ex : "Maison mère", "Bureau")</span></label>
        <input style={inputStyle} value={form.libelle ?? ''} onChange={e => set('libelle', e.target.value)} placeholder="Libellé optionnel" />
      </div>

      {/* ══════════════════════════════════════════════════
          SECTION LOCALISATION — listes déroulantes
          ════════════════════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(135deg, #EFF6FF, #F8FAFC)', borderRadius: 14, padding: 18, border: '1.5px solid var(--sky-3, #C8D9F8)', display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <i className="fas fa-map-location-dot" style={{ color: 'var(--blue, #1A4FC4)', fontSize: 15 }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy, #0B1F3A)' }}>Localisation</span>
        </div>

        {/* ── PAYS ── */}
        <div style={fieldWrap}>
          <label style={fieldLabel}>
            Pays
            {countryCodeUser === form.pays && (
              <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 600, color: 'var(--emerald, #047857)', background: '#D1FAE5', padding: '1px 7px', borderRadius: 999 }}>
                <i className="fas fa-check" /> Depuis votre inscription
              </span>
            )}
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none', zIndex: 1 }}>
              {paysInfo.emoji}
            </div>
            <select
              style={{ ...selectStyle, paddingLeft: 40 }}
              value={form.pays}
              onChange={e => handlePaysChange(e.target.value)}
            >
              {PAYS_SUPPORTES.map(p => (
                <option key={p.code} value={p.code}>{p.emoji} {p.nom}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── VILLE ── */}
        <div style={fieldWrap}>
          <label style={fieldLabel}>
            Ville <span style={{ color: 'var(--rose, #E11D48)' }}>*</span>
          </label>
          {estGuinee ? (
            <select
              style={selectStyle}
              value={form.ville}
              onChange={e => handleVilleChange(e.target.value)}
            >
              <option value="">— Choisir une ville —</option>
              {villes.map(v => (
                <option key={v.slug} value={v.nom}>
                  {v.nom} ({v.region})
                </option>
              ))}
            </select>
          ) : (
            <input
              style={inputStyle}
              value={form.ville}
              onChange={e => set('ville', e.target.value)}
              placeholder="Saisir la ville"
            />
          )}
        </div>

        {/* ── COMMUNE (si Guinée + ville sélectionnée) ── */}
        {estGuinee && communes.length > 0 && (
          <div style={fieldWrap}>
            <label style={fieldLabel}>
              Commune / Arrondissement <span style={{ color: 'var(--rose, #E11D48)' }}>*</span>
            </label>
            <select
              style={selectStyle}
              value={form.commune}
              onChange={e => handleCommuneChange(e.target.value)}
            >
              <option value="">— Choisir une commune —</option>
              {communes.map(c => (
                <option key={c.nom} value={c.nom}>{c.nom}</option>
              ))}
            </select>
          </div>
        )}

        {/* ── QUARTIER (si commune sélectionnée + quartiers dispo) ── */}
        {estGuinee && quartiers.length > 0 && (
          <div style={fieldWrap}>
            <label style={fieldLabel}>
              Quartier <span style={{ color: 'var(--rose, #E11D48)' }}>*</span>
            </label>
            <select
              style={selectStyle}
              value={form.quartier}
              onChange={e => set('quartier', e.target.value)}
            >
              <option value="">— Choisir un quartier —</option>
              {quartiers.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
        )}

        {/* Résumé sélection */}
        {form.ville && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            background: 'rgba(26,79,196,.06)', borderRadius: 9, padding: '6px 12px',
          }}>
            <i className="fas fa-map-pin" style={{ color: 'var(--blue)', fontSize: 11 }} />
            <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>
              {[form.quartier, form.commune, form.ville, paysInfo.nom].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}
      </div>

      {/* ── RUE / ADRESSE PRÉCISE ── */}
      <div style={fieldWrap}>
        <label style={fieldLabel}>
          Rue / Adresse précise <span style={{ color: 'var(--t3)', fontWeight: 400 }}>(optionnel)</span>
        </label>
        <input
          style={inputStyle}
          value={form.rue ?? ''}
          onChange={e => set('rue', e.target.value)}
          placeholder="Numéro, nom de rue, repère…"
        />
      </div>

      {/* ── INSTRUCTIONS DE LIVRAISON ── */}
      <div style={fieldWrap}>
        <label style={fieldLabel}>
          Instructions de livraison <span style={{ color: 'var(--t3)', fontWeight: 400 }}>(optionnel)</span>
        </label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 72, lineHeight: 1.6 } as React.CSSProperties}
          value={form.instructions ?? ''}
          onChange={e => set('instructions', e.target.value)}
          placeholder="Ex : Maison jaune près de la mosquée, sonner à l'entrée…"
          rows={3}
        />
      </div>

      {/* ── TÉLÉPHONE ── */}
      <div style={fieldWrap}>
        <label style={fieldLabel}>
          Téléphone de contact <span style={{ color: 'var(--t3)', fontWeight: 400 }}>(optionnel)</span>
        </label>
        <input
          style={inputStyle}
          value={form.telephone ?? ''}
          onChange={e => set('telephone', e.target.value)}
          placeholder="+224 6xx xx xx xx"
          type="tel"
        />
      </div>

      {/* ── ADRESSE PAR DÉFAUT ── */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', padding: '10px 14px', background: 'var(--g50, #F8FAFC)', borderRadius: 10, border: '1.5px solid var(--bdr, #E2E8F0)' }}>
        <input
          type="checkbox"
          checked={form.estDefaut}
          onChange={e => set('estDefaut', e.target.checked)}
          style={{ width: 17, height: 17, cursor: 'pointer', accentColor: 'var(--blue, #1A4FC4)' }}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
            <i className="fas fa-star" style={{ color: '#F59E0B', marginRight: 6 }} />
            Définir comme adresse par défaut
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>
            Sera pré-sélectionnée lors de vos prochaines commandes
          </div>
        </div>
      </label>

      {/* ── ERREUR ── */}
      {error && (
        <div style={{ color: '#B91C1C', fontSize: 12.5, padding: '10px 14px', background: '#FEF2F2', borderRadius: 9, border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-circle-exclamation" />
          {error}
        </div>
      )}

      {/* ── ACTIONS ── */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '10px 22px', borderRadius: 10, border: '1.5px solid var(--bdr2)', background: 'transparent', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--t2)' }}
          >
            Annuler
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || loading}
          style={{ padding: '10px 26px', borderRadius: 10, background: 'var(--blue, #1A4FC4)', color: '#fff', border: 'none', cursor: (saving || loading) ? 'not-allowed' : 'pointer', fontSize: 13.5, fontWeight: 700, opacity: (saving || loading) ? .6 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {saving
            ? <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</>
            : <><i className="fas fa-check" /> Enregistrer l'adresse</>
          }
        </button>
      </div>
    </div>
  );
}
