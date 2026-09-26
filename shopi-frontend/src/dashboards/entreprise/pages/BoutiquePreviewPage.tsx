/* ============================================================
 * FICHIER : BoutiquePreviewPage.tsx
 *
 * "Voir ma boutique" — deux onglets :
 *   - Aperçu       : la boutique telle que les clients la voient
 *   - Localisation : adresse + position exacte de la boutique
 *
 * Onglet Localisation — ce qui a été corrigé :
 *   - UN seul appel d'enregistrement (PATCH /parametres/localisation)
 *     au lieu de deux (/contact puis /location/company/:id) : plus
 *     d'enregistrement partiel, plus de 403 pour un collaborateur avec
 *     boutique.edit, quartier/repère/coordonnées toujours envoyés
 *     ensemble (voir BoutiqueParametresService.updateLocalisation).
 *   - Le formulaire se recharge depuis la réponse du serveur : ce qui
 *     est affiché après "Enregistrer" est ce qui est réellement stocké.
 *   - Modifications non enregistrées suivies (bouton actif seulement
 *     s'il y a quelque chose à enregistrer, "Annuler", avertissement
 *     avant de quitter la page).
 *   - Une position GPS / placée à la main n'est plus écrasée par le
 *     centre du quartier quand on change la commune ou le quartier
 *     ensuite (seul un changement de ville/pays la déplace).
 *   - Une valeur enregistrée absente des listes (ancien nom de
 *     quartier…) reste visible et sélectionnée au lieu d'apparaître
 *     comme "— Choisir —" (et d'être perdue au prochain enregistrement).
 *   - Géocodage : les réponses arrivées dans le désordre sont ignorées,
 *     une erreur réseau n'est plus une promesse rejetée non gérée.
 * ============================================================ */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { MapContainer, Marker, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from '../../../shared/location/leafletSetup';
import type { ParametresData } from '../hooks/useParametres';
import { getBestGpsFix, type GpsFixError } from '../../../shared/location/utils/bestGpsFix';
import { useTeamPermissions } from '../hooks/useTeamPermissions';
import { apiFetch } from '../../../shared/services/apiFetch';
import { useToast } from '../../../shared/context/ToastContext';
import type { EntreprisePage } from '../types';
/* BUG CORRIGÉ — l'aperçu était une <iframe> pointant vers
 * /boutique/:id?preview=1 : à chaque ouverture/actualisation, tout le
 * navigateur redémarrait l'application depuis zéro À L'INTÉRIEUR de
 * l'iframe (nouveau bundle JS, nouvelle vérification de session…),
 * plusieurs secondes pendant lesquelles l'en-tête générique du site
 * restait visible avant que le contenu boutique ne s'installe. On monte
 * maintenant BoutiquePage directement dans l'arbre React du dashboard
 * (un seul <BrowserRouter> pour toute l'app, voir router.tsx) — plus de
 * redémarrage, ni de synchronisation manuelle du thème sombre entre deux
 * documents séparés (BoutiquePage lit directement le data-theme déjà
 * posé sur ce même document par ThemeRouteSync). */
import BoutiquePage from '../../../modules/home/components/boutique/pages/BoutiquePage';
/* BUG CORRIGÉ — cliquer un produit depuis cet aperçu appelait navigate()
 * (via CardProduitBoutique), qui — même raison que ci-dessus, un seul
 * <BrowserRouter> pour toute l'app — faisait quitter TOUT le dashboard
 * entreprise pour la page produit PUBLIQUE (celle des clients), sans
 * retour possible. Même traitement que BoutiquePage : ProduitPage est
 * monté directement ici (productIdOverride/previewOverride/onBackOverride)
 * à la place de BoutiquePage quand un produit est sélectionné — jamais de
 * navigation, jamais de nouvel onglet, voir previewProductId ci-dessous. */
import ProduitPage from '../../../modules/home/components/produit/pages/ProduitPage';
import {
  VILLES_SORTED, getCommunesByVille, getQuartiersByCommune, findVille,
} from '../../../shared/location/data/geo-guinee';
import { searchAddress } from '../../../shared/location/utils/nominatim';
import BaseTiles from '../../../shared/location/components/BaseTiles';
/* Mêmes calques que la carte de l'accueil (ActorMapExplorer) : rues tracées en
 * couleur selon leur type + noms des quartiers — pour placer le repère sans hésiter. */
import RoadNetwork from '../../../shared/location/components/RoadNetwork';
import PlaceLabels from '../../../shared/location/components/PlaceLabels';
import '../../../shared/location/styles/actor-map.css';
import styles from '../styles/BoutiquePreviewPage.module.css';
import { confirmDialog } from '../../../shared/components/ui/ConfirmDialog';

/* Marqueur boutique */
const SHOP_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:36px;height:36px;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    background:var(--t2);border:3px solid #fff;
    box-shadow:0 3px 10px rgba(128,128,128,.5);
    display:flex;align-items:center;justify-content:center;">
    <span style="transform:rotate(45deg);font-size:16px">🏪</span>
  </div>`,
  iconSize:    [36, 36],
  iconAnchor:  [18, 36],
  popupAnchor: [0, -38],
});

interface Props { onNavigate: (page: EntreprisePage) => void; }
type Tab = 'apercu' | 'localisation';

/** D'où vient la position actuelle du repère — pilote le libellé de
 *  précision affiché ET si un changement de commune/quartier a le droit
 *  de déplacer le repère (jamais s'il a été placé précisément). */
type PinSource = 'saved' | 'gps' | 'manual' | 'approx' | 'none';

interface LocForm {
  pays: string; ville: string; commune: string; quartier: string;
  adresse: string; repere: string; lat: number; lng: number;
}
type FieldErrors = Partial<Record<'ville' | 'commune' | 'quartier', string>>;

function getPaysList(t: TFunction) {
  return [
    { code: 'GN', nom: t('boutiquePreview.pays_list.GN'), emoji: '🇬🇳' },
    { code: 'SN', nom: t('boutiquePreview.pays_list.SN'), emoji: '🇸🇳' },
    { code: 'ML', nom: t('boutiquePreview.pays_list.ML'), emoji: '🇲🇱' },
    { code: 'CI', nom: t('boutiquePreview.pays_list.CI'), emoji: '🇨🇮' },
    { code: 'GW', nom: t('boutiquePreview.pays_list.GW'), emoji: '🇬🇼' },
    { code: 'LR', nom: t('boutiquePreview.pays_list.LR'), emoji: '🇱🇷' },
    { code: 'SL', nom: t('boutiquePreview.pays_list.SL'), emoji: '🇸🇱' },
    { code: 'FR', nom: t('boutiquePreview.pays_list.FR'), emoji: '🇫🇷' },
  ];
}

const DEFAULT_LAT = 9.5370;
const DEFAULT_LNG = -13.6773;

/** Formulaire initial depuis ce que le serveur a réellement enregistré. */
function formFromData(d: ParametresData): { form: LocForm; source: PinSource } {
  const quartier = (d as ParametresData & { quartier?: string | null }).quartier ?? '';
  const lat = d.latitude  != null ? Number(d.latitude)  : NaN;
  const lng = d.longitude != null ? Number(d.longitude) : NaN;
  const base = {
    pays: d.pays || 'GN', ville: d.ville ?? '', commune: d.commune ?? '', quartier,
    adresse: d.adresse ?? '', repere: d.repere ?? '',
  };
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { form: { ...base, lat, lng }, source: 'saved' };
  }
  /* Pas encore de coordonnées : centre de la ville enregistrée plutôt que
   * Conakry par défaut — sinon "Enregistrer" épinglait une boutique de
   * Kindia… à Conakry. */
  const v = base.ville ? findVille(base.ville) : undefined;
  if (v) return { form: { ...base, lat: v.lat, lng: v.lng }, source: 'approx' };
  return { form: { ...base, lat: DEFAULT_LAT, lng: DEFAULT_LNG }, source: 'none' };
}

/** Empreinte comparable (coordonnées arrondies comme en base : 6 décimales). */
function signature(f: LocForm): string {
  return JSON.stringify([
    f.pays, f.ville.trim(), f.commune.trim(), f.quartier.trim(),
    f.adresse.trim(), f.repere.trim(), f.lat.toFixed(6), f.lng.toFixed(6),
  ]);
}

/** Options d'un <select> + la valeur actuelle si elle n'y figure pas
 *  (valeur enregistrée avec un ancien libellé) — elle reste visible. */
function withCurrent(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [current, ...options] : options;
}

/* ── Sous-composant : vol vers coordonnées ──
 * `n` = numéro de demande : chaque nouvelle demande (même vers le même
 * point, ex. bouton "Recentrer") déclenche un vol ; un simple re-rendu non. */
interface FlyRequest { lat: number; lng: number; zoom: number; n: number }
function FlyTo({ target }: { target: FlyRequest }) {
  const map = useMap();
  const { lat, lng, zoom, n } = target;
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, map]);
  return null;
}

/* ── Sous-composant : clic sur carte ── */
function ClickHandler({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMove(e.latlng.lat, e.latlng.lng); } });
  return null;
}

/* ── Marqueur draggable ── */
function DraggableMarker({ lat, lng, onDragEnd }: { lat: number; lng: number; onDragEnd: (lt: number, ln: number) => void }) {
  const markerRef = useRef<L.Marker | null>(null);
  return (
    <Marker
      draggable
      position={[lat, lng]}
      icon={SHOP_ICON}
      ref={markerRef}
      eventHandlers={{ dragend() {
        const m = markerRef.current;
        if (m) { const p = m.getLatLng(); onDragEnd(p.lat, p.lng); }
      }}}
    />
  );
}

/* ══════════════════════════════════════════════════════════════ */

export default function BoutiquePreviewPage({ onNavigate }: Props) {
  const { t } = useTranslation();
  const { pop } = useToast();
  const PAYS_LIST = useMemo(() => getPaysList(t), [t]);
  /* Chargement dédié (gardé par boutique.view, pas settings.view) : un
   * collaborateur avec boutique.view mais sans settings.view restait
   * sinon bloqué sur un chargement infini. */
  const [data,       setData]       = useState<ParametresData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const { can, isOwner, loading: permLoading } = useTeamPermissions();
  const canEditBoutique = isOwner || can('boutique', 'edit');
  /* Remonte BoutiquePage à neuf (bouton "Rafraîchir", et après un
   * enregistrement de la localisation pour que l'aperçu la reflète). */
  const [previewKey, setPreviewKey]  = useState(0);
  const [activeTab,  setActiveTab]  = useState<Tab>('apercu');
  /* Produit affiché DANS le panneau d'aperçu — null = liste (BoutiquePage),
   * sinon fiche produit (ProduitPage), toujours sans navigation. */
  const [previewProductId, setPreviewProductId] = useState<string | null>(null);

  /* ── Formulaire de localisation ── */
  const [form,       setForm]       = useState<LocForm>({ pays: 'GN', ville: '', commune: '', quartier: '', adresse: '', repere: '', lat: DEFAULT_LAT, lng: DEFAULT_LNG });
  const [savedSig,   setSavedSig]   = useState('');
  const [pinSource,  setPinSource]  = useState<PinSource>('none');
  const [flyTarget,  setFlyTarget]  = useState<FlyRequest>({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, zoom: 15, n: 0 });
  const flyTo = useCallback((lat: number, lng: number, zoom: number) => {
    setFlyTarget(prev => ({ lat, lng, zoom, n: prev.n + 1 }));
  }, []);
  const [geocoding,  setGeocoding]  = useState(false);
  const geocodeSeq = useRef(0);
  const [locating,   setLocating]   = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isDark, setIsDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ||
        document.documentElement.getAttribute('data-theme') === 'dark'
      : false
  );

  /** (Ré)initialise le formulaire depuis l'état serveur. */
  const applyFromData = useCallback((d: ParametresData) => {
    const { form: f, source } = formFromData(d);
    geocodeSeq.current++;            // ignore tout géocodage encore en vol
    setForm(f);
    setSavedSig(signature(f));
    setPinSource(source);
    flyTo(f.lat, f.lng, source === 'saved' ? 17 : 13);
    setGpsAccuracy(null);
    setGeocoding(false);
    setFieldErrors({});
    setError(null);
  }, [flyTo]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<ParametresData>('/dashboard/entreprise/parametres/apercu')
      .then(d => { if (!cancelled) { setData(d); applyFromData(d); setLoadError(null); } })
      .catch((e: unknown) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : t('boutiquePreview.loadError')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = !!data && signature(form) !== savedSig;

  /* Fermeture/rechargement de l'onglet avec des modifications en cours. */
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onMQ = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', onMQ);
    const obs = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme');
      if (theme === 'dark') setIsDark(true);
      else if (theme === 'light') setIsDark(false);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq.removeEventListener('change', onMQ); obs.disconnect(); };
  }, []);

  const estGuinee = form.pays === 'GN';
  const communes  = useMemo(() => estGuinee ? getCommunesByVille(form.ville).map(c => c.nom) : [], [form.ville, estGuinee]);
  const quartiers = useMemo(() => estGuinee && form.commune ? getQuartiersByCommune(form.ville, form.commune) : [], [form.ville, form.commune, estGuinee]);
  const villeOptions    = useMemo(() => withCurrent(VILLES_SORTED.map(v => v.nom), form.ville), [form.ville]);
  const communeOptions  = useMemo(() => withCurrent(communes, form.commune), [communes, form.commune]);
  const quartierOptions = useMemo(() => withCurrent(quartiers, form.quartier), [quartiers, form.quartier]);

  const patch = (p: Partial<LocForm>) => setForm(f => ({ ...f, ...p }));
  const moveMarker = (lat: number, lng: number, source: PinSource, zoom: number) => {
    patch({ lat, lng });
    setPinSource(source);
    flyTo(lat, lng, zoom);
  };

  /* ── Géocodage d'une sélection → déplace le repère (approximatif) ──
   * `force` : changement de ville/pays — le repère DOIT suivre, même s'il
   * avait été placé précisément (il serait sinon dans une autre ville).
   * Sans `force` (commune/quartier), un repère GPS / placé à la main ne
   * bouge plus : c'est la position exacte de la boutique. */
  const geocodeSelection = async (v: string, com: string, qrt: string, p: string, force: boolean) => {
    if (!v.trim()) return;
    if (!force && (pinSource === 'gps' || pinSource === 'manual')) return;
    const seq = ++geocodeSeq.current;

    const vd = p === 'GN' ? findVille(v) : undefined;
    if (vd) moveMarker(vd.lat, vd.lng, 'approx', 13);

    const paysNom = PAYS_LIST.find(x => x.code === p)?.nom ?? '';
    const query = [qrt, com, v, paysNom].filter(Boolean).join(', ');
    setGeocoding(true);
    try {
      const results = await searchAddress(query, 1);
      if (seq !== geocodeSeq.current) return;          // une sélection plus récente a pris le relais
      if (results.length > 0) moveMarker(results[0].latitude, results[0].longitude, 'approx', qrt ? 16 : com ? 15 : 13);
    } catch {
      /* Géocodage indisponible : le centre de ville (ci-dessus) reste, le
       * gérant peut toujours placer le repère à la main ou via le GPS. */
    } finally {
      if (seq === geocodeSeq.current) setGeocoding(false);
    }
  };

  const clearFieldError = (k: keyof FieldErrors) => setFieldErrors(fe => (fe[k] ? { ...fe, [k]: undefined } : fe));

  const handlePaysChange = (p: string) => {
    patch({ pays: p, ville: '', commune: '', quartier: '' });
    setGpsAccuracy(null);
    setFieldErrors({});
    geocodeSeq.current++;
    setGeocoding(false);
    if (p === 'GN') moveMarker(DEFAULT_LAT, DEFAULT_LNG, 'none', 12);
    else setPinSource('none');
  };
  const handleVilleChange = (v: string) => {
    patch({ ville: v, commune: '', quartier: '' });
    setGpsAccuracy(null);
    clearFieldError('ville');
    geocodeSelection(v, '', '', form.pays, true);
  };
  const handleCommuneChange = (c: string) => {
    patch({ commune: c, quartier: '' });
    clearFieldError('commune');
    geocodeSelection(form.ville, c, '', form.pays, false);
  };
  const handleQuartierChange = (q: string) => {
    patch({ quartier: q });
    clearFieldError('quartier');
    geocodeSelection(form.ville, form.commune, q, form.pays, false);
  };
  const handleMapMove = (lt: number, ln: number) => {
    patch({ lat: lt, lng: ln });
    setPinSource('manual');
    setGpsAccuracy(null);
  };

  /* ── Position réelle de la boutique (GPS haute précision, sur place) ── */
  const locateShop = () => {
    setLocating(true); setError(null);
    getBestGpsFix({ goodAccuracyM: 30, maxMs: 20_000, onProgress: f => setGpsAccuracy(Math.round(f.accuracy)) }).promise
      .then(({ latitude: lt, longitude: ln, accuracy }) => {
        geocodeSeq.current++;
        setGeocoding(false);
        moveMarker(lt, ln, 'gps', 17);
        setGpsAccuracy(Math.round(accuracy));
      })
      .catch((err: GpsFixError) => {
        setGpsAccuracy(null);
        setError(err === 'denied' ? t('boutiquePreview.gpsRefuse') : t('boutiquePreview.gpsIndisponible'));
      })
      .finally(() => setLocating(false));
  };

  /* ── Validation + enregistrement (un seul appel) ── */
  const validate = (): FieldErrors => {
    const fe: FieldErrors = {};
    if (!form.ville.trim()) fe.ville = t('boutiquePreview.villeObligatoire');
    if (estGuinee && communes.length > 0 && !form.commune)   fe.commune  = t('boutiquePreview.loc.communeObligatoire');
    if (estGuinee && quartiers.length > 0 && !form.quartier) fe.quartier = t('boutiquePreview.loc.quartierObligatoire');
    return fe;
  };

  const handleSave = async () => {
    if (!data || saving) return;
    const fe = validate();
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) { setError(t('boutiquePreview.loc.formIncomplet')); return; }
    setSaving(true); setError(null);
    try {
      const updated = await apiFetch<ParametresData>('/dashboard/entreprise/parametres/localisation', {
        method: 'PATCH',
        body: {
          pays: form.pays, ville: form.ville, commune: form.commune, quartier: form.quartier,
          adresse: form.adresse, repere: form.repere,
          latitude: Number(form.lat.toFixed(6)), longitude: Number(form.lng.toFixed(6)),
        },
      });
      const next = { ...data, ...updated };
      setData(next);
      applyFromData(next);           // le formulaire affiche exactement ce qui est stocké
      setPreviewKey(k => k + 1);     // l'aperçu reflète la nouvelle adresse
      pop(t('boutiquePreview.localisationEnregistree'), 's');
    } catch (e: unknown) {
      setError(e instanceof Error && e.message ? e.message : t('boutiquePreview.errorSauvegarde'));
    } finally { setSaving(false); }
  };

  const handleReset = () => { if (data) applyFromData(data); };

  const handleBack = async () => {
    if (dirty && !(await confirmDialog({ message: t('boutiquePreview.loc.quitterConfirm'), icon: 'fa-floppy-disk' }))) return;
    onNavigate('profil');
  };

  /* Un collaborateur sans boutique.view ne doit jamais voir cette page. */
  if (!permLoading && !isOwner && !can('boutique', 'view')) return (
    <div className={styles.state}>
      <div>
        <i className={`fas fa-lock ${styles.stateIcon}`} />
        <strong>{t('boutiquePreview.accessDenied.title')}</strong>
        <div className={styles.stateMsg}>{t('boutiquePreview.accessDenied.message')}</div>
      </div>
    </div>
  );

  if (!loading && loadError) return (
    <div className={styles.state}>
      <div>
        <i className={`fas fa-triangle-exclamation ${styles.stateIcon}`} />
        {loadError}
      </div>
    </div>
  );

  if (loading || !data) return (
    <div className={styles.state}>
      <div>
        <i className={`fas fa-spinner fa-spin ${styles.stateIcon}`} />
        {t('boutiquePreview.loading')}
      </div>
    </div>
  );

  /* Repli sur l'aperçu si boutique.edit est révoqué pendant que le
   * collaborateur est sur l'onglet Localisation (dérivé, pas d'effet). */
  const tab: Tab = canEditBoutique ? activeTab : 'apercu';
  const paysInfo = PAYS_LIST.find(p => p.code === form.pays) ?? PAYS_LIST[0];
  const savedQuartier = (data as ParametresData & { quartier?: string | null }).quartier;
  const savedSummary = [savedQuartier, data.commune, data.ville].filter(Boolean).join(' · ');

  /* Libellé de précision de la position actuelle du repère */
  const precision = (() => {
    switch (pinSource) {
      case 'gps':    return { cls: styles.precOk,    icon: 'fa-location-crosshairs', text: gpsAccuracy != null ? t('boutiquePreview.loc.precGps', { m: gpsAccuracy }) : t('boutiquePreview.loc.precGpsSimple') };
      case 'manual': return { cls: styles.precOk,    icon: 'fa-hand-pointer',        text: t('boutiquePreview.loc.precManuelle') };
      case 'saved':  return { cls: styles.precOk,    icon: 'fa-circle-check',        text: t('boutiquePreview.loc.precEnregistree') };
      case 'approx': return { cls: styles.precWarn,  icon: 'fa-circle-info',         text: t('boutiquePreview.loc.precApprox') };
      default:       return { cls: styles.precMuted, icon: 'fa-circle-question',     text: t('boutiquePreview.loc.precAucune') };
    }
  })();

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'apercu',       label: t('boutiquePreview.tabs.apercu'),       icon: 'fa-eye' },
    { key: 'localisation', label: t('boutiquePreview.tabs.localisation'), icon: 'fa-map-location-dot' },
  ];

  return (
    <div className={styles.root}>

      {/* ═══════════════ BANDEAU ═══════════════ */}
      <div className={styles.bandeau}>

        <div className={styles.bandeauLeft}>
          <button type="button" className={styles.backBtn} onClick={handleBack}>
            <i className="fas fa-arrow-left" /> <span className={styles.bandeauBackLabel}>{t('boutiquePreview.back')}</span>
          </button>
          <div className={styles.bandeauSep} />
          <div className={styles.bandeauNames}>
            <div className={styles.bandeauName}>{data.companyName}</div>
            <div className={styles.bandeauSub}>
              {tab === 'apercu' ? t('boutiquePreview.subtitleApercu') : t('boutiquePreview.subtitleLocalisation')}
            </div>
          </div>
        </div>

        {/* Onglets — masqués sans boutique.edit ("Localisation" EST l'onglet
         * de modification : un collaborateur en lecture seule reste sur l'aperçu). */}
        {canEditBoutique && (
          <div className={styles.bandeauTabs} role="tablist">
            {TABS.map(tabItem => (
              <button
                key={tabItem.key}
                type="button"
                role="tab"
                aria-selected={tab === tabItem.key}
                className={`${styles.tabBtn} ${tab === tabItem.key ? styles.tabBtnOn : ''}`}
                onClick={() => setActiveTab(tabItem.key)}
              >
                <i className={`fas ${tabItem.icon}`} />{tabItem.label}
                {tabItem.key === 'localisation' && dirty && <span className={styles.tabDot} aria-hidden />}
              </button>
            ))}
          </div>
        )}

        <div className={styles.bandeauActions}>
          {tab === 'apercu' ? (
            <>
              <button type="button" className={styles.iconBtn} title={t('boutiquePreview.loc.rafraichir')}
                onClick={() => { setPreviewProductId(null); setPreviewKey(k => k + 1); }}>
                <i className="fas fa-rotate-right" />
              </button>
              <button type="button" className={styles.primaryBtnSm}
                onClick={() => window.open(previewProductId ? `/produit/${previewProductId}` : `/boutique/${data.id}`, '_blank')}>
                <i className="fas fa-arrow-up-right-from-square" /> {t('boutiquePreview.ouvrir')}
              </button>
            </>
          ) : (
            <span className={`${styles.statusChip} ${dirty ? styles.statusDirty : styles.statusOk}`}>
              <i className={`fas ${dirty ? 'fa-pen' : 'fa-check'}`} />
              {dirty ? t('boutiquePreview.loc.nonEnregistre') : t('boutiquePreview.loc.aJour')}
            </span>
          )}
        </div>
      </div>

      {/* ═══════════════ APERÇU ═══════════════ */}
      {tab === 'apercu' && (
        <div className={styles.previewScroll}>
          {previewProductId ? (
            <ProduitPage
              key={previewProductId}
              productIdOverride={previewProductId}
              previewOverride
              onBackOverride={() => setPreviewProductId(null)}
            />
          ) : (
            <BoutiquePage
              key={previewKey}
              companyIdOverride={data.id}
              previewOverride
              onOpenProduct={setPreviewProductId}
            />
          )}
        </div>
      )}

      {/* ═══════════════ LOCALISATION ═══════════════ */}
      {tab === 'localisation' && canEditBoutique && (
        <div className={styles.localisationWrap}>

          {/* ── FORMULAIRE (au-dessus de la carte ≤860px) ── */}
          <form className={styles.localisationForm} onSubmit={e => { e.preventDefault(); handleSave(); }} noValidate>

            <div className={styles.formBody}>

              {/* Adresse actuellement enregistrée */}
              <div className={styles.currentBox}>
                <div className={styles.currentIcon}><i className="fas fa-store" /></div>
                <div className={styles.currentText}>
                  <div className={styles.currentLabel}>{t('boutiquePreview.loc.adresseActuelle')}</div>
                  <div className={styles.currentValue}>{savedSummary || t('boutiquePreview.loc.aucuneAdresse')}</div>
                </div>
              </div>

              {/* ── Section Adresse ── */}
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <div className={styles.sectionTitle}>{t('boutiquePreview.loc.sectionAdresse')}</div>
                  <div className={styles.sectionSub}>{t('boutiquePreview.loc.sectionAdresseSub')}</div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="loc-pays">{t('boutiquePreview.pays')}</label>
                  <div className={styles.selectWrap}>
                    <span className={styles.flag}>{paysInfo.emoji}</span>
                    <select id="loc-pays" className={`${styles.control} ${styles.select} ${styles.withFlag}`} value={form.pays} onChange={e => handlePaysChange(e.target.value)}>
                      {PAYS_LIST.map(p => <option key={p.code} value={p.code}>{p.nom}</option>)}
                    </select>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="loc-ville">{t('boutiquePreview.ville')} <span className={styles.req}>*</span></label>
                  {estGuinee ? (
                    <select id="loc-ville" className={`${styles.control} ${styles.select} ${fieldErrors.ville ? styles.controlErr : ''}`}
                      value={form.ville} onChange={e => handleVilleChange(e.target.value)}>
                      <option value="">{t('boutiquePreview.choisirVille')}</option>
                      {villeOptions.map(v => {
                        const vd = VILLES_SORTED.find(x => x.nom === v);
                        return <option key={v} value={v}>{vd ? `${vd.nom} (${vd.region})` : v}</option>;
                      })}
                    </select>
                  ) : (
                    <input id="loc-ville" className={`${styles.control} ${fieldErrors.ville ? styles.controlErr : ''}`}
                      value={form.ville} placeholder={t('boutiquePreview.villePlaceholder')}
                      onChange={e => { patch({ ville: e.target.value }); clearFieldError('ville'); }}
                      onBlur={() => geocodeSelection(form.ville, '', '', form.pays, pinSource === 'none' || pinSource === 'approx')} />
                  )}
                  {fieldErrors.ville && <div className={styles.fieldErr}>{fieldErrors.ville}</div>}
                </div>

                {estGuinee && communeOptions.length > 0 && (
                  <div className={styles.row2}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="loc-commune">{t('boutiquePreview.commune')} <span className={styles.req}>*</span></label>
                      <select id="loc-commune" className={`${styles.control} ${styles.select} ${fieldErrors.commune ? styles.controlErr : ''}`}
                        value={form.commune} onChange={e => handleCommuneChange(e.target.value)}>
                        <option value="">{t('boutiquePreview.choisirCommune')}</option>
                        {communeOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {fieldErrors.commune && <div className={styles.fieldErr}>{fieldErrors.commune}</div>}
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="loc-quartier">{t('boutiquePreview.quartier')} {quartierOptions.length > 0 && <span className={styles.req}>*</span>}</label>
                      <select id="loc-quartier" className={`${styles.control} ${styles.select} ${fieldErrors.quartier ? styles.controlErr : ''}`}
                        value={form.quartier} onChange={e => handleQuartierChange(e.target.value)}
                        disabled={!form.commune || quartierOptions.length === 0}>
                        <option value="">{t('boutiquePreview.choisirQuartier')}</option>
                        {quartierOptions.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                      {fieldErrors.quartier && <div className={styles.fieldErr}>{fieldErrors.quartier}</div>}
                    </div>
                  </div>
                )}

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="loc-adresse">{t('boutiquePreview.adresse')} <span className={styles.opt}>{t('boutiquePreview.optionnel')}</span></label>
                  <input id="loc-adresse" className={styles.control} maxLength={500} value={form.adresse}
                    onChange={e => patch({ adresse: e.target.value })} placeholder={t('boutiquePreview.adressePlaceholder')} />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="loc-repere">{t('boutiquePreview.repere')} <span className={styles.opt}>{t('boutiquePreview.optionnel')}</span></label>
                  <input id="loc-repere" className={styles.control} maxLength={500} value={form.repere}
                    onChange={e => patch({ repere: e.target.value })} placeholder={t('boutiquePreview.reperePlaceholder')} />
                  <div className={styles.hint}>{t('boutiquePreview.loc.repereAide')}</div>
                </div>
              </section>

              {/* ── Section Position ── */}
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <div className={styles.sectionTitle}>{t('boutiquePreview.loc.sectionPosition')}</div>
                  <div className={styles.sectionSub}>{t('boutiquePreview.loc.sectionPositionSub')}</div>
                </div>

                <div className={`${styles.precision} ${precision.cls}`}>
                  {geocoding
                    ? <><i className="fas fa-circle-notch fa-spin" /> {t('boutiquePreview.localisationEnCours')}</>
                    : <><i className={`fas ${precision.icon}`} /> {precision.text}</>}
                </div>

                <button type="button" className={styles.gpsBtn} onClick={locateShop} disabled={locating}>
                  {locating
                    ? <><i className="fas fa-circle-notch fa-spin" /> {gpsAccuracy != null ? t('boutiquePreview.loc.gpsEnCoursM', { m: gpsAccuracy }) : t('boutiquePreview.gpsEnCours')}</>
                    : <><i className="fas fa-location-crosshairs" /> {t('boutiquePreview.gpsUtiliser')}</>}
                </button>
                <div className={styles.hint}>{t('boutiquePreview.gpsAide')}</div>

                <div className={styles.coords}>
                  <span>{t('boutiquePreview.latitude')} <strong>{form.lat.toFixed(5)}</strong></span>
                  <span>{t('boutiquePreview.longitude')} <strong>{form.lng.toFixed(5)}</strong></span>
                </div>
              </section>

              {error && (
                <div className={styles.errorBox} role="alert">
                  <i className="fas fa-circle-exclamation" /> {error}
                </div>
              )}
            </div>

            {/* ── Pied collant : état + actions ── */}
            <div className={styles.footer}>
              {dirty && (
                <button type="button" className={styles.ghostBtn} onClick={handleReset} disabled={saving}>
                  {t('boutiquePreview.loc.annuler')}
                </button>
              )}
              <button type="submit" className={styles.primaryBtn} disabled={saving || !dirty}>
                {saving
                  ? <><i className="fas fa-circle-notch fa-spin" /> {t('boutiquePreview.enregistrement')}</>
                  : dirty
                    ? <><i className="fas fa-floppy-disk" /> {t('boutiquePreview.enregistrerLocalisation')}</>
                    : <><i className="fas fa-check" /> {t('boutiquePreview.loc.aJour')}</>}
              </button>
            </div>
          </form>

          {/* ── CARTE (sous le formulaire ≤860px) ── */}
          <div className={styles.localisationMap}>
            {geocoding && (
              <div className={styles.mapBadge}>
                <i className="fas fa-circle-notch fa-spin" /> {t('boutiquePreview.recherchePosition')}
              </div>
            )}

            <MapContainer
              center={[form.lat, form.lng]}
              zoom={pinSource === 'saved' ? 17 : 13}
              scrollWheelZoom
              zoomControl={false}
              className={styles.mapCanvas}
            >
              {/* Fond commun du site : routes principales de loin, toutes les rues de près */}
              <BaseTiles dark={isDark} />
              <RoadNetwork tone={isDark ? 'dark' : 'light'} />
              <PlaceLabels tone={isDark ? 'dark' : 'light'} skipOsm={false} active={form.quartier || null} />
              <ZoomControl position="bottomright" />
              <FlyTo target={flyTarget} />
              <ClickHandler onMove={handleMapMove} />
              <DraggableMarker lat={form.lat} lng={form.lng} onDragEnd={handleMapMove} />
            </MapContainer>

            <button type="button" className={styles.recenterBtn} title={t('boutiquePreview.loc.recentrer')}
              onClick={() => flyTo(form.lat, form.lng, 17)}>
              <i className="fas fa-crosshairs" />
            </button>

            <div className={styles.mapHint}>
              <i className="fas fa-hand-pointer" /> {t('boutiquePreview.hintCarte')}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
