/* ================================================================
 * FICHIER : profil-client/sections/SectionAddresses.tsx
 *
 * RÔLE : Onglet "Adresses" du profil client.
 *        Gestion complète : liste, ajout, modification, suppression,
 *        définir par défaut — avec carte interactive Leaflet.
 * ================================================================ */

import { useState, useEffect, lazy, Suspense } from 'react';
import { apiFetch }  from '../../../../shared/services/apiFetch';
import AddressCard   from '../../../../shared/location/components/AddressCard';
import '../../../../shared/location/styles/location.css';
import styles        from '../styles/ProfilClient.module.css';
import type { ClientAddress } from '../../../../shared/location/types/location.types';
import type { LocationPickerValue } from '../../../../shared/location/components/LocationPicker';
import { TYPE_ADRESSE_LABELS } from '../../../../shared/location/types/location.types';

const LocationPicker = lazy(() => import('../../../../shared/location/components/LocationPicker'));

interface Props {
  onToast: (msg: string, type?: string) => void;
}

type Mode = 'list' | 'create' | 'edit';

const TYPE_OPTIONS = ['domicile', 'bureau', 'boutique', 'entrepot', 'relais', 'autre'] as const;

const EMPTY_FORM = {
  typeAdresse:  'domicile' as ClientAddress['typeAdresse'],
  libelle:      '',
  rue:          '',
  quartier:     '',
  commune:      '',
  ville:        '',
  region:       '',
  pays:         'GN',
  codePostal:   '',
  latitude:     null as number | null,
  longitude:    null as number | null,
  instructions: '',
  telephone:    '',
  estDefaut:    false,
};

export default function SectionAddresses({ onToast }: Props) {
  const [addresses,  setAddresses]  = useState<ClientAddress[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [mode,       setMode]       = useState<Mode>('list');
  const [editTarget, setEditTarget] = useState<ClientAddress | null>(null);
  const [form,       setForm]       = useState({ ...EMPTY_FORM });
  const [pickerVal,  setPickerVal]  = useState<LocationPickerValue | null>(null);
  const [saving,     setSaving]     = useState(false);

  /* ── Chargement ─────────────────────────────────────────── */
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

  /* ── Formulaire ─────────────────────────────────────────── */
  const set = (key: keyof typeof EMPTY_FORM, val: unknown) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setPickerVal(null);
    setEditTarget(null);
    setMode('create');
  };

  const openEdit = (addr: ClientAddress) => {
    setForm({
      typeAdresse:  addr.typeAdresse,
      libelle:      addr.libelle      ?? '',
      rue:          addr.rue          ?? '',
      quartier:     addr.quartier     ?? '',
      commune:      addr.commune      ?? '',
      ville:        addr.ville        ?? '',
      region:       addr.region       ?? '',
      pays:         addr.pays         ?? 'GN',
      codePostal:   addr.codePostal   ?? '',
      latitude:     addr.latitude     ?? null,
      longitude:    addr.longitude    ?? null,
      instructions: addr.instructions ?? '',
      telephone:    addr.telephone    ?? '',
      estDefaut:    addr.estDefaut,
    });
    setPickerVal(addr.latitude && addr.longitude ? {
      coordinates: { latitude: Number(addr.latitude), longitude: Number(addr.longitude) },
      address: null,
    } : null);
    setEditTarget(addr);
    setMode('edit');
  };

  const handlePickerChange = (val: LocationPickerValue) => {
    setPickerVal(val);
    set('latitude',  val.coordinates.latitude);
    set('longitude', val.coordinates.longitude);
    if (val.address) {
      if (val.address.adresse    && !form.rue)      set('rue',      val.address.adresse);
      if (val.address.quartier   && !form.quartier) set('quartier', val.address.quartier);
      if (val.address.commune    && !form.commune)  set('commune',  val.address.commune);
      if (val.address.ville      && !form.ville)    set('ville',    val.address.ville);
      if (val.address.region     && !form.region)   set('region',   val.address.region);
      if (val.address.codePostal && !form.codePostal) set('codePostal', val.address.codePostal);
    }
  };

  /* ── Sauvegarder ─────────────────────────────────────────── */
  const handleSave = async () => {
    if (!form.ville.trim()) { onToast('La ville est obligatoire.', 'w'); return; }
    setSaving(true);
    try {
      const body = {
        typeAdresse:  form.typeAdresse,
        libelle:      form.libelle      || null,
        rue:          form.rue          || null,
        quartier:     form.quartier     || null,
        commune:      form.commune      || null,
        ville:        form.ville,
        region:       form.region       || null,
        pays:         form.pays         || 'GN',
        codePostal:   form.codePostal   || null,
        latitude:     form.latitude,
        longitude:    form.longitude,
        instructions: form.instructions || null,
        telephone:    form.telephone    || null,
        estDefaut:    form.estDefaut,
      };

      if (mode === 'create') {
        await apiFetch('/location/addresses', { method: 'POST', body });
        onToast('✅ Adresse ajoutée !', 's');
      } else {
        await apiFetch(`/location/addresses/${editTarget!.id}`, { method: 'PATCH', body });
        onToast('✅ Adresse mise à jour.', 's');
      }
      setMode('list');
      await load();
    } catch (e: any) {
      onToast(`❌ ${e.message}`, 'e');
    } finally {
      setSaving(false);
    }
  };

  /* ── Supprimer ───────────────────────────────────────────── */
  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette adresse ?')) return;
    try {
      await apiFetch(`/location/addresses/${id}`, { method: 'DELETE' });
      onToast('🗑️ Adresse supprimée.', 'i');
      setAddresses(prev => prev.filter(a => a.id !== id));
    } catch (e: any) { onToast(`❌ ${e.message}`, 'e'); }
  };

  /* ── Définir par défaut ──────────────────────────────────── */
  const handleSetDefault = async (id: string) => {
    try {
      const updated = await apiFetch<ClientAddress[]>(`/location/addresses/${id}/default`, { method: 'PATCH' });
      if (Array.isArray(updated)) setAddresses(updated);
      onToast('⭐ Adresse par défaut mise à jour.', 's');
    } catch (e: any) { onToast(`❌ ${e.message}`, 'e'); }
  };

  /* ── Vue formulaire (create / edit) ─────────────────────── */
  if (mode !== 'list') {
    return (
      <div style={{ paddingTop: 8 }}>

        {/* En-tête */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <button
            onClick={() => { setMode('list'); setEditTarget(null); }}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--b2)', padding:4 }}
          >
            <i className="fas fa-arrow-left" />
          </button>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'var(--n)' }}>
            {mode === 'create' ? '+ Nouvelle adresse' : 'Modifier l\'adresse'}
          </h3>
        </div>

        {/* Carte interactive */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12.5, fontWeight:600, color:'var(--t2)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
            <i className="fas fa-map-location-dot" style={{ color:'var(--b2)' }} />
            Épinglez votre adresse sur la carte
            <span style={{ fontWeight:400, color:'var(--t3)' }}>— cliquez ou glissez le marqueur</span>
          </div>
          <Suspense fallback={
            <div style={{ height:300, display:'flex', alignItems:'center', justifyContent:'center', background:'#f0f4ff', borderRadius:12 }}>
              <i className="fas fa-circle-notch fa-spin" style={{ fontSize:24, color:'var(--b2)' }} />
            </div>
          }>
            <LocationPicker
              value={pickerVal}
              onChange={handlePickerChange}
              height="300px"
              placeholder="Rechercher votre adresse…"
            />
          </Suspense>
        </div>

        {/* Champs */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

          {/* Type */}
          <div style={{ gridColumn:'1 / -1' }}>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--t2)', marginBottom:6 }}>Type d'adresse</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {TYPE_OPTIONS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('typeAdresse', t)}
                  style={{
                    padding:'6px 14px', borderRadius:20, fontSize:12.5,
                    border:`1.5px solid ${form.typeAdresse === t ? 'var(--b2)' : 'var(--bdr2)'}`,
                    background: form.typeAdresse === t ? 'var(--b2)' : 'transparent',
                    color: form.typeAdresse === t ? '#fff' : 'var(--t2)',
                    cursor:'pointer', fontWeight: form.typeAdresse === t ? 700 : 400,
                  }}
                >
                  {TYPE_ADRESSE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Libellé */}
          <div style={{ gridColumn:'1 / -1' }}>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:5 }}>Libellé (ex : "Maison", "Bureau")</label>
            <input
              style={{ width:'100%', padding:'9px 12px', border:'1.5px solid var(--bdr2)', borderRadius:9, fontSize:13, outline:'none', boxSizing:'border-box' }}
              value={form.libelle}
              onChange={e => set('libelle', e.target.value)}
              placeholder="Nom de l'adresse"
            />
          </div>

          {/* Rue */}
          <div style={{ gridColumn:'1 / -1' }}>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:5 }}>Rue / Adresse</label>
            <input
              style={{ width:'100%', padding:'9px 12px', border:'1.5px solid var(--bdr2)', borderRadius:9, fontSize:13, outline:'none', boxSizing:'border-box' }}
              value={form.rue}
              onChange={e => set('rue', e.target.value)}
              placeholder="Numéro et rue"
            />
          </div>

          {/* Quartier */}
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:5 }}>Quartier</label>
            <input
              style={{ width:'100%', padding:'9px 12px', border:'1.5px solid var(--bdr2)', borderRadius:9, fontSize:13, outline:'none', boxSizing:'border-box' }}
              value={form.quartier}
              onChange={e => set('quartier', e.target.value)}
              placeholder="Quartier"
            />
          </div>

          {/* Commune */}
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:5 }}>Commune</label>
            <input
              style={{ width:'100%', padding:'9px 12px', border:'1.5px solid var(--bdr2)', borderRadius:9, fontSize:13, outline:'none', boxSizing:'border-box' }}
              value={form.commune}
              onChange={e => set('commune', e.target.value)}
              placeholder="Commune"
            />
          </div>

          {/* Ville */}
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:5 }}>
              Ville <span style={{ color:'var(--err)' }}>*</span>
            </label>
            <input
              style={{ width:'100%', padding:'9px 12px', border:'1.5px solid var(--bdr2)', borderRadius:9, fontSize:13, outline:'none', boxSizing:'border-box' }}
              value={form.ville}
              onChange={e => set('ville', e.target.value)}
              placeholder="Conakry"
            />
          </div>

          {/* Région */}
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:5 }}>Région</label>
            <input
              style={{ width:'100%', padding:'9px 12px', border:'1.5px solid var(--bdr2)', borderRadius:9, fontSize:13, outline:'none', boxSizing:'border-box' }}
              value={form.region}
              onChange={e => set('region', e.target.value)}
              placeholder="Région"
            />
          </div>

          {/* Téléphone */}
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:5 }}>Téléphone de contact</label>
            <input
              style={{ width:'100%', padding:'9px 12px', border:'1.5px solid var(--bdr2)', borderRadius:9, fontSize:13, outline:'none', boxSizing:'border-box' }}
              value={form.telephone}
              onChange={e => set('telephone', e.target.value)}
              placeholder="+224 6xx xxx xxx"
            />
          </div>

          {/* Code postal */}
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:5 }}>Code postal</label>
            <input
              style={{ width:'100%', padding:'9px 12px', border:'1.5px solid var(--bdr2)', borderRadius:9, fontSize:13, outline:'none', boxSizing:'border-box' }}
              value={form.codePostal}
              onChange={e => set('codePostal', e.target.value)}
              placeholder="224"
            />
          </div>

          {/* Instructions */}
          <div style={{ gridColumn:'1 / -1' }}>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:5 }}>Instructions de livraison</label>
            <textarea
              style={{ width:'100%', padding:'9px 12px', border:'1.5px solid var(--bdr2)', borderRadius:9, fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }}
              value={form.instructions}
              onChange={e => set('instructions', e.target.value)}
              placeholder="Ex : Sonner à l'interphone, code 1234…"
              rows={2}
            />
          </div>

          {/* Par défaut */}
          <div style={{ gridColumn:'1 / -1' }}>
            <label style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer', userSelect:'none', fontSize:13 }}>
              <input
                type="checkbox"
                checked={form.estDefaut}
                onChange={e => set('estDefaut', e.target.checked)}
                style={{ width:15, height:15 }}
              />
              <span style={{ fontWeight:600 }}>Définir comme adresse par défaut</span>
            </label>
          </div>
        </div>

        {/* Coordonnées GPS */}
        {form.latitude && form.longitude && (
          <div style={{ marginTop:10, padding:'8px 12px', background:'#f0f4ff', borderRadius:8, fontSize:11.5, color:'var(--t3)', display:'flex', gap:16 }}>
            <span><i className="fas fa-map-pin" style={{ marginRight:5, color:'var(--b2)' }} />Lat : {form.latitude.toFixed(6)}</span>
            <span>Lng : {form.longitude.toFixed(6)}</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
          <button
            onClick={() => { setMode('list'); setEditTarget(null); }}
            style={{ padding:'9px 20px', borderRadius:9, border:'1.5px solid var(--bdr2)', background:'transparent', cursor:'pointer', fontSize:13 }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding:'9px 24px', borderRadius:9,
              background:'var(--b2, #1A4FC4)', color:'#fff',
              border:'none', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize:13, fontWeight:700, opacity: saving ? .7 : 1,
              display:'flex', alignItems:'center', gap:7,
            }}
          >
            {saving
              ? <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</>
              : <><i className="fas fa-floppy-disk" /> Enregistrer</>
            }
          </button>
        </div>
      </div>
    );
  }

  /* ── Vue liste ───────────────────────────────────────────── */
  return (
    <div style={{ paddingTop: 8 }}>

      {/* En-tête */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:'var(--n)' }}>Mes adresses</h3>
          <p style={{ margin:'3px 0 0', fontSize:12, color:'var(--t3)' }}>
            {addresses.length} adresse{addresses.length !== 1 ? 's' : ''} enregistrée{addresses.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            display:'flex', alignItems:'center', gap:7,
            padding:'8px 16px', borderRadius:9,
            background:'var(--b2, #1A4FC4)', color:'#fff',
            border:'none', fontSize:12.5, fontWeight:700, cursor:'pointer',
          }}
        >
          <i className="fas fa-plus" /> Ajouter
        </button>
      </div>

      {/* Chargement */}
      {loading && (
        <div style={{ textAlign:'center', padding:'36px 0', color:'var(--t3)' }}>
          <i className="fas fa-circle-notch fa-spin" style={{ fontSize:22 }} />
        </div>
      )}

      {/* Liste vide */}
      {!loading && addresses.length === 0 && (
        <div style={{
          textAlign:'center', padding:'40px 24px',
          background:'var(--g50, #f5f8ff)', borderRadius:14,
          border:'1.5px dashed var(--bdr2)',
        }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📍</div>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:5, color:'var(--n)' }}>Aucune adresse</div>
          <div style={{ fontSize:12.5, color:'var(--t3)', marginBottom:18 }}>
            Ajoutez vos adresses de livraison pour passer vos commandes rapidement.
          </div>
          <button
            onClick={openCreate}
            style={{
              padding:'9px 22px', borderRadius:9,
              background:'var(--b2)', color:'#fff',
              border:'none', fontSize:13, fontWeight:700, cursor:'pointer',
              display:'inline-flex', alignItems:'center', gap:7,
            }}
          >
            <i className="fas fa-plus" /> Ajouter ma première adresse
          </button>
        </div>
      )}

      {/* Cartes */}
      {!loading && addresses.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {addresses.map(addr => (
            <AddressCard
              key={addr.id}
              address={addr}
              onEdit={openEdit}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
            />
          ))}
        </div>
      )}
    </div>
  );
}
