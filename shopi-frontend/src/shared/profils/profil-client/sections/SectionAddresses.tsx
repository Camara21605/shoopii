/* ================================================================
 * FICHIER : profil-client/sections/SectionAddresses.tsx
 *
 * RÔLE : Onglet "Adresses" du profil client.
 *        Gestion complète : liste, ajout, modification, suppression,
 *        définir par défaut — avec carte interactive Leaflet.
 *        Utilisé par Paramètres > Adresses et par la page « Mes adresses ».
 *
 * 2e passe « Paramètres client » — BUGS CORRIGÉS :
 *   - écran entièrement en français codé en dur alors que l'interface est
 *     proposée en 5 langues → tous les textes passent par i18n
 *     (settingsPage.adresses.*) ;
 *   - un échec de chargement affichait « Aucune adresse » (et invitait à en
 *     ajouter une) → état d'erreur avec « Réessayer » ;
 *   - coordonnées reçues en texte : le formulaire plantait (toFixed) et
 *     renvoyait du texte au serveur → converties en nombres ;
 *   - aucune vérification avant l'envoi (téléphone, longueur des
 *     instructions) → erreurs affichées sous les champs ;
 *   - l'adresse par défaut ne pouvait pas être supprimée (même seule) et
 *     pouvait être « décochée » sans en choisir une autre → le serveur
 *     transfère désormais le défaut, l'écran l'explique ;
 *   - liste déroulante de recherche blanche sur le thème sombre.
 * ================================================================ */

import { useState, useEffect, lazy, Suspense, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Polyline }  from 'react-leaflet';
import { apiFetch }  from '../../../../shared/services/apiFetch';
import AddressCard   from '../../../../shared/location/components/AddressCard';
import '../../../../shared/location/styles/location.css';
import type { ClientAddress, Coordinates } from '../../../../shared/location/types/location.types';
import type { LocationPickerValue } from '../../../../shared/location/components/LocationPicker';
import { getTypeAdresseLabels } from '../../../../shared/location/types/location.types';
import { searchActor } from '../../../../shared/location/services/routingApi';
import type { ActorSearchResult } from '../../../../shared/location/services/routingApi';
import { distanceKm, formatDistance } from '../../../../shared/location/utils/geoUtils';
/* La commande exige que la position GPS du client soit autorisée
 * (voir CommandePage.tsx du panier, qui bloque le paiement si le
 * navigateur refuse la géolocalisation). Cette carte "Ma position
 * actuelle" est affichée en PERMANENCE ici (pas seulement pendant
 * l'ajout/édition d'une adresse) pour que le client :
 *   1. Voie tout de suite si sa position est autorisée ou non,
 *   2. Puisse relancer la demande de permission (bouton "Réessayer")
 *      directement depuis son profil, avant même d'arriver au panier. */
import { useGeolocation }  from '../../../../shared/location/hooks/useGeolocation';
import LocationMap         from '../../../../shared/location/components/LocationMap';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';

const LocationPicker = lazy(() => import('../../../../shared/location/components/LocationPicker'));

interface Props {
  onToast: (msg: string, type?: string) => void;
}

type Mode = 'list' | 'create' | 'edit';

const TYPE_OPTIONS = ['domicile', 'bureau', 'boutique', 'entrepot', 'relais', 'autre'] as const;

/** Mêmes limites que le serveur (client-address.dto.ts / client-address.service.ts). */
const MAX_ADDRESSES    = 20;
const INSTRUCTIONS_MAX = 500;
const PHONE_RE         = /^\+?[\d\s().-]{8,20}$/;

/* Emoji/couleur d'affichage par type d'acteur trouvé via la recherche. */
const ROLE_META: Record<ActorSearchResult['role'], { emoji: string; color: 'green' | 'blue' | 'orange' }> = {
  vendor:        { emoji: '🏪', color: 'green'  },
  delivery:      { emoji: '🛵', color: 'blue'   },
  correspondent: { emoji: '📦', color: 'orange' },
};

/** Centre + zoom couvrant à la fois la position du client et l'acteur trouvé. */
function computeSearchView(client: Coordinates, actor: ActorSearchResult): { center: Coordinates; zoom: number } {
  const center = { latitude: (client.latitude + actor.lat) / 2, longitude: (client.longitude + actor.lng) / 2 };
  const spread = Math.max(Math.abs(client.latitude - actor.lat), Math.abs(client.longitude - actor.lng));
  const zoom = spread < 0.02 ? 15 : spread < 0.05 ? 14 : spread < 0.15 ? 12 : spread < 0.5 ? 10 : spread < 2 ? 8 : 6;
  return { center, zoom };
}

/** Coordonnée reçue du serveur (nombre, texte ou null) → nombre fini ou null. */
const toCoord = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

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
type FormKey = keyof typeof EMPTY_FORM;

const inputStyle = (err?: boolean): CSSProperties => ({
  width: '100%', padding: '9px 12px', border: `1.5px solid ${err ? 'var(--red, #DC2626)' : 'var(--bdr2)'}`,
  borderRadius: 9, fontSize: 13, outline: 'none', boxSizing: 'border-box',
});
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 5 };
const errStyle: CSSProperties = { fontSize: 11.5, color: 'var(--red, #DC2626)', marginTop: 4, display: 'block' };

export default function SectionAddresses({ onToast }: Props) {
  const { t } = useTranslation();
  const ta = (key: string, opts?: Record<string, unknown>): string => String(t(`settingsPage.adresses.${key}`, (opts ?? {}) as Record<string, string>));
  const typeLabels = getTypeAdresseLabels(t);
  const roleLabel = (r: ActorSearchResult['role']) => ta(`roles.${r}`);

  const [addresses,  setAddresses]  = useState<ClientAddress[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(false);
  const [mode,       setMode]       = useState<Mode>('list');
  const [editTarget, setEditTarget] = useState<ClientAddress | null>(null);
  const [form,       setForm]       = useState({ ...EMPTY_FORM });
  const [errors,     setErrors]     = useState<Partial<Record<FormKey, string>>>({});
  const [pickerVal,  setPickerVal]  = useState<LocationPickerValue | null>(null);
  const [saving,     setSaving]     = useState(false);

  /* Position GPS live du client — demandée dès l'arrivée sur cette page
   * (watch:true = suivi continu, pas un simple instantané) car c'est ici
   * que le client doit accorder la permission AVANT d'essayer de
   * commander (le panier refuse la commande si elle n'est pas accordée). */
  const geo = useGeolocation({ watch: true });

  /* ── Recherche d'une boutique / d'un livreur / d'un correspondant ──
   * Débounce simple (400ms) pour ne pas spammer l'API à chaque frappe. */
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<ActorSearchResult[]>([]);
  const [searching,     setSearching]     = useState(false);
  const [showResults,   setShowResults]   = useState(false);
  const [foundActor,    setFoundActor]    = useState<ActorSearchResult | null>(null);

  useEffect(() => {
    if (foundActor || searchQuery.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      searchActor(searchQuery.trim())
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, foundActor]);

  const selectActor = (a: ActorSearchResult) => {
    setFoundActor(a);
    setSearchQuery(a.name);
    setShowResults(false);
  };

  const clearActorSearch = () => {
    setFoundActor(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const foundDistance = foundActor && geo.position
    ? distanceKm(geo.position, { latitude: foundActor.lat, longitude: foundActor.lng })
    : null;

  /* ── Chargement ─────────────────────────────────────────── */
  const normalize = (list: ClientAddress[]) => list.map(a => ({ ...a, latitude: toCoord(a.latitude), longitude: toCoord(a.longitude) }) as ClientAddress);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await apiFetch<ClientAddress[]>('/location/addresses');
      setAddresses(Array.isArray(data) ? normalize(data) : []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Formulaire ─────────────────────────────────────────── */
  const set = (key: FormKey, val: unknown) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const openCreate = () => {
    if (addresses.length >= MAX_ADDRESSES) { onToast(ta('maxAtteint', { max: MAX_ADDRESSES }), 'w'); return; }
    setForm({ ...EMPTY_FORM });
    setErrors({});
    setPickerVal(null);
    setEditTarget(null);
    setMode('create');
  };

  const openEdit = (addr: ClientAddress) => {
    const lat = toCoord(addr.latitude), lng = toCoord(addr.longitude);
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
      latitude:     lat,
      longitude:    lng,
      instructions: addr.instructions ?? '',
      telephone:    addr.telephone    ?? '',
      estDefaut:    addr.estDefaut,
    });
    setErrors({});
    setPickerVal(lat !== null && lng !== null ? { coordinates: { latitude: lat, longitude: lng }, address: null } : null);
    setEditTarget(addr);
    setMode('edit');
  };

  const closeForm = () => { setMode('list'); setEditTarget(null); setErrors({}); };

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

  const validate = () => {
    const e: Partial<Record<FormKey, string>> = {};
    if (!form.ville.trim()) e.ville = ta('errors.villeRequise');
    if (form.telephone.trim() && !PHONE_RE.test(form.telephone.trim())) e.telephone = ta('errors.telephone');
    if (form.instructions.length > INSTRUCTIONS_MAX) e.instructions = ta('errors.instructions', { max: INSTRUCTIONS_MAX });
    return e;
  };

  /* ── Sauvegarder ─────────────────────────────────────────── */
  const handleSave = async () => {
    const e = validate();
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    setSaving(true);
    try {
      const body = {
        typeAdresse:  form.typeAdresse,
        libelle:      form.libelle.trim()      || null,
        rue:          form.rue.trim()          || null,
        quartier:     form.quartier.trim()     || null,
        commune:      form.commune.trim()      || null,
        ville:        form.ville.trim(),
        region:       form.region.trim()       || null,
        pays:         form.pays                || 'GN',
        codePostal:   form.codePostal.trim()   || null,
        latitude:     form.latitude,
        longitude:    form.longitude,
        instructions: form.instructions.trim() || null,
        telephone:    form.telephone.trim()    || null,
        estDefaut:    form.estDefaut,
      };

      if (mode === 'create') {
        await apiFetch('/location/addresses', { method: 'POST', body });
        onToast(ta('toastAjoutee'), 's');
      } else {
        await apiFetch(`/location/addresses/${editTarget!.id}`, { method: 'PATCH', body });
        onToast(ta('toastModifiee'), 's');
      }
      closeForm();
      await load();
    } catch (err: unknown) {
      onToast(`❌ ${(err as Error)?.message ?? ta('toastErreur')}`, 'e');
    } finally {
      setSaving(false);
    }
  };

  /* ── Supprimer ───────────────────────────────────────────── */
  const handleDelete = async (id: string) => {
    const target = addresses.find(a => a.id === id);
    const message = target?.estDefaut && addresses.length > 1 ? ta('confirmSupprimerDefaut') : ta('confirmSupprimer');
    if (!(await confirmDialog({ message, danger: true, icon: 'fa-trash' }))) return;
    try {
      await apiFetch(`/location/addresses/${id}`, { method: 'DELETE' });
      onToast(ta('toastSupprimee'), 'i');
      await load();                        // le serveur a pu transférer l'adresse par défaut
    } catch (err: unknown) { onToast(`❌ ${(err as Error)?.message ?? ta('toastErreur')}`, 'e'); }
  };

  /* ── Définir par défaut ──────────────────────────────────── */
  const handleSetDefault = async (id: string) => {
    try {
      const updated = await apiFetch<ClientAddress[]>(`/location/addresses/${id}/default`, { method: 'PATCH' });
      if (Array.isArray(updated)) setAddresses(normalize(updated));
      onToast(ta('toastDefaut'), 's');
    } catch (err: unknown) { onToast(`❌ ${(err as Error)?.message ?? ta('toastErreur')}`, 'e'); }
  };

  /* ── Bloc "Ma position actuelle" — affiché en PERMANENCE, quel que
   * soit le mode (liste, ajout, édition). Sert à la fois de rappel
   * visuel ("votre position est bien partagée") et de point d'entrée
   * pour ré-autoriser la géolocalisation si elle a été refusée. */
  const positionStatus = (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--t2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <i className="fas fa-location-crosshairs" style={{ color: 'var(--b2)' }} />
        {ta('positionTitre')}
        <span style={{ fontWeight: 400, color: 'var(--t3)' }}>— {ta('positionRequise')}</span>
      </div>

      {geo.error ? (
        /* Permission refusée / GPS indisponible : pas de carte à afficher,
         * juste l'explication + un bouton pour redemander l'autorisation. */
        <div role="alert" style={{
          padding: '14px 16px', background: 'rgba(220,38,38,.07)', border: '1.5px solid rgba(220,38,38,.25)',
          borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <i className="fas fa-location-crosshairs" style={{ color: '#DC2626', fontSize: 18 }} />
          <div style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: 'var(--t2)' }}>
            {ta('positionRefusee')}
          </div>
          <button
            type="button"
            onClick={geo.refresh}
            style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            <i className="fas fa-rotate-right" /> {ta('reessayer')}
          </button>
        </div>
      ) : (
        <>
          {/* Recherche d'une boutique / d'un livreur / d'un correspondant —
           * une fois trouvé, une ligne bleu clair relie la position du
           * client à l'acteur trouvé, avec la distance affichée. */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <i className="fas fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', fontSize: 12 }} />
                <input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setShowResults(true); if (foundActor) setFoundActor(null); }}
                  onFocus={() => setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 150) /* délai pour laisser le clic sur un résultat s'exécuter */}
                  placeholder={ta('rechercheActeur')}
                  aria-label={ta('rechercheActeur')}
                  style={{ ...inputStyle(), padding: '9px 12px 9px 32px', fontSize: 12.5 }}
                />
              </div>
              {(searchQuery || foundActor) && (
                <button
                  type="button"
                  onClick={clearActorSearch}
                  title={ta('effacer')}
                  aria-label={ta('effacer')}
                  style={{ background: 'var(--g100)', border: 'none', borderRadius: 9, padding: '0 12px', cursor: 'pointer', color: 'var(--t3)' }}
                >
                  <i className="fas fa-xmark" />
                </button>
              )}
            </div>

            {/* Liste des résultats — couleurs du thème (elle était blanche sur le thème sombre) */}
            {showResults && !foundActor && searchQuery.trim().length >= 2 && (
              <div role="listbox" style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1000,
                background: 'var(--white, #fff)', color: 'var(--t1, inherit)', border: '1.5px solid var(--bdr2)', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,.25)', maxHeight: 220, overflowY: 'auto',
              }}>
                {searching ? (
                  <div style={{ padding: 14, textAlign: 'center', color: 'var(--t3)', fontSize: 12.5 }}>
                    <i className="fas fa-circle-notch fa-spin" /> {ta('rechercheEnCours')}
                  </div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: 14, textAlign: 'center', color: 'var(--t3)', fontSize: 12.5 }}>
                    {ta('aucunResultat', { q: searchQuery })}
                  </div>
                ) : (
                  searchResults.map(r => (
                    <div
                      key={`${r.role}-${r.id}`}
                      role="option"
                      aria-selected={false}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => selectActor(r)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--bdr)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--g100)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                    >
                      <span style={{ fontSize: 18 }}>{ROLE_META[r.role].emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--n)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                          {roleLabel(r.role)}{r.address ? ` · ${r.address}` : ''}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Acteur trouvé + distance depuis la position du client */}
          {foundActor && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 10,
              background: 'rgba(37,99,235,.06)', border: '1.5px solid rgba(37,99,235,.2)', borderRadius: 9, fontSize: 12.5,
            }}>
              <span style={{ fontSize: 16 }}>{ROLE_META[foundActor.role].emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ color: 'var(--n)' }}>{foundActor.name}</strong>
                <span style={{ color: 'var(--t3)' }}> — {roleLabel(foundActor.role)}</span>
              </div>
              {foundDistance != null && (
                <span style={{ fontWeight: 700, color: '#2563EB', flexShrink: 0 }}>
                  <i className="fas fa-ruler" /> {formatDistance(foundDistance)}
                </span>
              )}
            </div>
          )}

          <LocationMap
            center={
              foundActor && geo.position
                ? computeSearchView(geo.position, foundActor).center
                : geo.position ?? { latitude: 9.6412, longitude: -13.5784 } /* Conakry par défaut, le temps que le GPS réponde */
            }
            zoom={foundActor && geo.position ? computeSearchView(geo.position, foundActor).zoom : 15}
            height="200px"
            showGpsMarker={geo.position}
            markers={foundActor ? [{
              id:       foundActor.id,
              position: { latitude: foundActor.lat, longitude: foundActor.lng },
              color:    ROLE_META[foundActor.role].color,
              emoji:    ROLE_META[foundActor.role].emoji,
              popupContent: (
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                  {foundActor.name}
                  {foundDistance != null && (
                    <div style={{ fontWeight: 400, color: '#64748B', marginTop: 2 }}>
                      {ta('distanceDeVous', { d: formatDistance(foundDistance) })}
                    </div>
                  )}
                </div>
              ),
            }] : []}
          >
            {/* Ligne bleu clair entre le client et l'acteur trouvé */}
            {foundActor && geo.position && (
              <Polyline
                positions={[
                  [geo.position.latitude, geo.position.longitude],
                  [foundActor.lat, foundActor.lng],
                ]}
                pathOptions={{ color: '#60A5FA', weight: 4, opacity: 0.85, dashArray: '8, 6' }}
              />
            )}
          </LocationMap>
        </>
      )}
    </div>
  );

  /* ── Vue formulaire (create / edit) ─────────────────────── */
  if (mode !== 'list') {
    const isFirst      = mode === 'create' && addresses.length === 0;
    const editsDefault = mode === 'edit' && !!editTarget?.estDefaut;
    const field = (key: FormKey, label: string, opts: { full?: boolean; placeholder?: string; required?: boolean; type?: string; autoComplete?: string; maxLength?: number } = {}) => (
      <div style={opts.full ? { gridColumn: '1 / -1' } : undefined}>
        <label htmlFor={`adr-${key}`} style={labelStyle}>
          {label} {opts.required && <span style={{ color: 'var(--err, #DC2626)' }}>*</span>}
        </label>
        <input
          id={`adr-${key}`}
          type={opts.type ?? 'text'}
          autoComplete={opts.autoComplete}
          maxLength={opts.maxLength ?? 100}
          aria-invalid={!!errors[key]}
          style={inputStyle(!!errors[key])}
          value={String(form[key] ?? '')}
          onChange={e => set(key, e.target.value)}
          placeholder={opts.placeholder}
        />
        {errors[key] && <span role="alert" style={errStyle}><i className="fas fa-circle-exclamation" /> {errors[key]}</span>}
      </div>
    );

    return (
      <div style={{ paddingTop: 8 }}>

        {positionStatus}

        {/* En-tête */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <button
            type="button"
            onClick={closeForm}
            aria-label={ta('retour')}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--b2)', padding:4 }}
          >
            <i className="fas fa-arrow-left" />
          </button>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'var(--n)' }}>
            {mode === 'create' ? ta('nouvelle') : ta('modifier')}
          </h3>
        </div>

        {/* Carte interactive */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12.5, fontWeight:600, color:'var(--t2)', marginBottom:8, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            <i className="fas fa-map-location-dot" style={{ color:'var(--b2)' }} />
            {ta('epingler')}
            <span style={{ fontWeight:400, color:'var(--t3)' }}>— {ta('epinglerAide')}</span>
          </div>
          <Suspense fallback={
            <div style={{ height:300, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--g100)', borderRadius:12 }}>
              <i className="fas fa-circle-notch fa-spin" style={{ fontSize:24, color:'var(--b2)' }} />
            </div>
          }>
            <LocationPicker
              value={pickerVal}
              onChange={handlePickerChange}
              height="300px"
              placeholder={ta('rechercherAdresse')}
            />
          </Suspense>
          {form.latitude === null && (
            <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--t3)' }}>
              <i className="fas fa-circle-info" /> {ta('sansPosition')}
            </div>
          )}
        </div>

        {/* Champs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>

          {/* Type */}
          <div style={{ gridColumn:'1 / -1' }}>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--t2)', marginBottom:6 }} id="adr-type-label">{ta('type')}</div>
            <div role="radiogroup" aria-labelledby="adr-type-label" style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={form.typeAdresse === opt}
                  onClick={() => set('typeAdresse', opt)}
                  style={{
                    padding:'6px 14px', borderRadius:20, fontSize:12.5,
                    border:`1.5px solid ${form.typeAdresse === opt ? 'var(--b2)' : 'var(--bdr2)'}`,
                    background: form.typeAdresse === opt ? 'var(--b2)' : 'transparent',
                    color: form.typeAdresse === opt ? '#fff' : 'var(--t2)',
                    cursor:'pointer', fontWeight: form.typeAdresse === opt ? 700 : 400,
                  }}
                >
                  {typeLabels[opt]}
                </button>
              ))}
            </div>
          </div>

          {field('libelle',   ta('libelle'),   { full: true, placeholder: ta('libellePlaceholder') })}
          {field('rue',       ta('rue'),       { full: true, placeholder: ta('ruePlaceholder'), autoComplete: 'street-address', maxLength: 255 })}
          {field('quartier',  ta('quartier'),  { placeholder: ta('quartier') })}
          {field('commune',   ta('commune'),   { placeholder: ta('commune') })}
          {field('ville',     ta('ville'),     { required: true, placeholder: 'Conakry', autoComplete: 'address-level2' })}
          {field('region',    ta('region'),    { placeholder: ta('region'), autoComplete: 'address-level1' })}
          {field('telephone', ta('telephone'), { type: 'tel', placeholder: '+224 6xx xxx xxx', autoComplete: 'tel', maxLength: 20 })}
          {field('codePostal', ta('codePostal'), { placeholder: '—', autoComplete: 'postal-code', maxLength: 20 })}

          {/* Instructions */}
          <div style={{ gridColumn:'1 / -1' }}>
            <label htmlFor="adr-instructions" style={labelStyle}>{ta('instructions')}</label>
            <textarea
              id="adr-instructions"
              aria-invalid={!!errors.instructions}
              style={{ ...inputStyle(!!errors.instructions), resize:'vertical', fontFamily:'inherit' }}
              value={form.instructions}
              maxLength={INSTRUCTIONS_MAX}
              onChange={e => set('instructions', e.target.value)}
              placeholder={ta('instructionsPlaceholder')}
              rows={2}
            />
            {errors.instructions
              ? <span role="alert" style={errStyle}>{errors.instructions}</span>
              : <span style={{ fontSize: 11, color: 'var(--t3)' }}>{form.instructions.length}/{INSTRUCTIONS_MAX}</span>}
          </div>

          {/* Par défaut */}
          <div style={{ gridColumn:'1 / -1', fontSize: 13 }}>
            {isFirst || editsDefault ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--t2)' }}>
                <i className="fas fa-star" style={{ color: 'var(--amber, #B45309)' }} />
                {isFirst ? ta('premiereParDefaut') : ta('estParDefaut')}
              </div>
            ) : (
              <label style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer', userSelect:'none' }}>
                <input
                  type="checkbox"
                  checked={form.estDefaut}
                  onChange={e => set('estDefaut', e.target.checked)}
                  style={{ width:15, height:15 }}
                />
                <span style={{ fontWeight:600 }}>{ta('definirParDefaut')}</span>
              </label>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20, flexWrap:'wrap' }}>
          <button
            type="button"
            onClick={closeForm}
            style={{ padding:'9px 20px', borderRadius:9, border:'1.5px solid var(--bdr2)', background:'transparent', color:'var(--t2)', cursor:'pointer', fontSize:13 }}
          >
            {ta('annuler')}
          </button>
          <button
            type="button"
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
              ? <><i className="fas fa-circle-notch fa-spin" /> {ta('enregistrement')}</>
              : <><i className="fas fa-floppy-disk" /> {ta('enregistrer')}</>
            }
          </button>
        </div>
      </div>
    );
  }

  /* ── Vue liste ───────────────────────────────────────────── */
  const plein = addresses.length >= MAX_ADDRESSES;
  return (
    <div style={{ paddingTop: 8 }}>

      {positionStatus}

      {/* En-tête */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <div>
          <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:'var(--n)' }}>{ta('mesAdresses')}</h3>
          {!loading && !loadError && (
            <p style={{ margin:'3px 0 0', fontSize:12, color:'var(--t3)' }}>
              {ta('compte', { count: addresses.length })}{plein ? ` · ${ta('maxAtteint', { max: MAX_ADDRESSES })}` : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={loading || loadError || plein}
          style={{
            display:'flex', alignItems:'center', gap:7,
            padding:'8px 16px', borderRadius:9,
            background:'var(--b2, #1A4FC4)', color:'#fff',
            border:'none', fontSize:12.5, fontWeight:700,
            cursor: loading || loadError || plein ? 'not-allowed' : 'pointer', opacity: loading || loadError || plein ? .55 : 1,
          }}
        >
          <i className="fas fa-plus" /> {ta('ajouter')}
        </button>
      </div>

      {/* Chargement */}
      {loading && (
        <div style={{ textAlign:'center', padding:'36px 0', color:'var(--t3)' }} aria-busy="true">
          <i className="fas fa-circle-notch fa-spin" style={{ fontSize:22 }} />
        </div>
      )}

      {/* Erreur de chargement — surtout pas « Aucune adresse » */}
      {!loading && loadError && (
        <div role="alert" style={{
          textAlign:'center', padding:'28px 20px', borderRadius:14,
          background:'rgba(220,38,38,.06)', border:'1.5px solid rgba(220,38,38,.2)',
        }}>
          <div style={{ fontWeight:700, fontSize:13.5, marginBottom:6, color:'var(--n)' }}>
            <i className="fas fa-triangle-exclamation" style={{ color:'#DC2626' }} /> {ta('erreurChargement')}
          </div>
          <button type="button" onClick={load}
            style={{ marginTop:8, padding:'8px 18px', borderRadius:9, background:'var(--b2)', color:'#fff', border:'none', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
            <i className="fas fa-rotate-right" /> {ta('reessayer')}
          </button>
        </div>
      )}

      {/* Liste vide */}
      {!loading && !loadError && addresses.length === 0 && (
        <div style={{
          textAlign:'center', padding:'40px 24px',
          background:'var(--g50, #f5f8ff)', borderRadius:14,
          border:'1.5px dashed var(--bdr2)',
        }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📍</div>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:5, color:'var(--n)' }}>{ta('aucune')}</div>
          <div style={{ fontSize:12.5, color:'var(--t3)', marginBottom:18 }}>
            {ta('aucuneAide')}
          </div>
          <button
            type="button"
            onClick={openCreate}
            style={{
              padding:'9px 22px', borderRadius:9,
              background:'var(--b2)', color:'#fff',
              border:'none', fontSize:13, fontWeight:700, cursor:'pointer',
              display:'inline-flex', alignItems:'center', gap:7,
            }}
          >
            <i className="fas fa-plus" /> {ta('ajouterPremiere')}
          </button>
        </div>
      )}

      {/* Cartes */}
      {!loading && !loadError && addresses.length > 0 && (
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
