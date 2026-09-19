/* ============================================================
 * FICHIER : src/modules/auth/components/LocationPermission.tsx
 *
 * RÔLE : Étape "Localisation" du formulaire d'inscription.
 *        Demande la permission GPS, géocode l'adresse automatiquement,
 *        ou propose une carte interactive si l'utilisateur refuse.
 *
 * FLUX :
 *   idle → [Clic GPS] → loading → granted (carte auto, marqueur ajustable)
 *                     → denied  (carte manuelle — UNIQUEMENT en repli GPS)
 *
 * BUG CORRIGÉ — les boutons "Ignorer" (idle ET carte) permettaient de
 * finaliser l'inscription sans aucune localisation, alors que
 * needsLocation/STEP_FIELDS la traitent comme obligatoire. Retirés :
 * il faut confirmer une position (GPS ou pointage manuel) pour avancer.
 *
 * BUG CORRIGÉ (2026-09-13) — l'écran initial proposait AUSSI "Choisir sur
 * la carte" comme option équivalente au GPS : pour un particulier
 * (client/livreur/correspondant/partenaire), sa position EST sa position
 * actuelle, il n'y a pas de raison de lui laisser sciemment l'éviter dès
 * le départ. Seule l'action GPS est proposée désormais ; la carte
 * manuelle ne réapparaît que si le GPS échoue vraiment (refusé,
 * indisponible, délai dépassé) — un repli, plus un choix.
 *
 * UTILISÉ dans RegisterForm pour : client, delivery, partner, correspondent
 * (company utilise CompanyLocationSelect — sélection manuelle dans le
 * référentiel géo, une entreprise n'étant pas forcément à l'endroit où
 * son propriétaire s'inscrit).
 * ============================================================ */

import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { reverseGeocode }           from '../../../shared/location/utils/nominatim';
import '../../../shared/location/styles/location.css';
import type { RegistrationLocation } from '../types';
import type { LocationPickerValue }  from '../../../shared/location/components/LocationPicker';

const LocationPicker = lazy(() => import('../../../shared/location/components/LocationPicker'));

type PermState = 'idle' | 'loading' | 'granted' | 'denied' | 'manual' | 'done';

/* BUG CORRIGÉ (précision GPS) — un seul getCurrentPosition() acceptait la
 * TOUTE PREMIÈRE position renvoyée par le navigateur, souvent la plus
 * grossière (triangulation Wi-Fi/IP quasi instantanée) avant qu'un
 * meilleur relevé (Wi-Fi affiné, voire GPS matériel sur mobile) n'ait le
 * temps d'arriver — d'où une position "réelle" mais très imprécise.
 * watchPosition() écoute plusieurs relevés successifs et ne retient que
 * le MEILLEUR (accuracy la plus faible), jusqu'à ce que la précision soit
 * bonne (≤ GOOD_ACCURACY_M) ou que MAX_WATCH_MS soit écoulé — la
 * géolocalisation à un instant T est un extremum en amélioration, pas une
 * valeur figée, sur la plupart des puces GPS/Wi-Fi. */
const GOOD_ACCURACY_M = 50;
const MAX_WATCH_MS     = 15_000;

interface Props {
  /** Pays par défaut pré-sélectionné (depuis indicatif téléphonique) */
  defaultCountryName?: string;
  /** Appelé quand l'utilisateur confirme sa position (ou null si ignoré) */
  onComplete: (result: RegistrationLocation | null) => void;
}

export default function LocationPermission({
  defaultCountryName,
  onComplete,
}: Props) {
  const [state,       setState]       = useState<PermState>('idle');
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [pickerValue, setPickerValue] = useState<LocationPickerValue | null>(null);
  const [detectedAddr, setDetectedAddr] = useState<RegistrationLocation | null>(null);
  /* Précision (mètres) du MEILLEUR relevé reçu jusqu'ici pendant l'écoute
   * — affichée en direct pour que l'utilisateur voie réellement la
   * précision s'améliorer, plutôt qu'un simple spinner opaque. */
  const [liveAccuracy, setLiveAccuracy] = useState<number | null>(null);

  const watchIdRef  = useRef<number | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bestFixRef  = useRef<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const settledRef  = useRef(false);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Coupe proprement l'écoute GPS si le composant est démonté en cours de route
  useEffect(() => () => stopWatch(), [stopWatch]);

  /* Fige le meilleur relevé reçu (ou le repli GPS le plus récent en cas de
   * timeout sans repère "bon") et lance le geocoding inverse une seule
   * fois, plutôt qu'à chaque mise à jour de watchPosition. */
  const settleWithBestFix = useCallback(async () => {
    if (settledRef.current) return;
    const fix = bestFixRef.current;
    if (!fix) return; // rien reçu du tout — laissé à l'appelant (timeout → erreur)
    settledRef.current = true;
    stopWatch();

    const { latitude, longitude, accuracy } = fix;
    const geo = await reverseGeocode(latitude, longitude);

    const result: RegistrationLocation = {
      latitude,
      longitude,
      locationAccuracy: accuracy,
      gpsEnabled:       true,
      address:    geo?.adresse    ?? geo?.displayName ?? undefined,
      city:       geo?.ville      ?? undefined,
      district:   geo?.commune    ?? undefined,
      quartier:   geo?.quartier   ?? undefined,
      region:     geo?.region     ?? undefined,
      country:    geo?.pays       ?? undefined,
      postalCode: geo?.codePostal ?? undefined,
    };

    setDetectedAddr(result);
    setPickerValue({ coordinates: { latitude, longitude }, address: geo });
    setState('granted');
  }, [stopWatch]);

  /* ── Demande de permission GPS ──────────────────────────── */
  const requestGps = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setErrorMsg('La géolocalisation n\'est pas disponible sur cet appareil.');
      setState('manual');
      return;
    }

    setState('loading');
    setErrorMsg(null);
    setLiveAccuracy(null);
    bestFixRef.current = null;
    settledRef.current = false;

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        const best = bestFixRef.current;
        /* Ne remplace le meilleur relevé que si celui-ci est vraiment
         * meilleur (accuracy plus faible = plus précis) — un relevé
         * ultérieur peut être PIRE (Wi-Fi qui perd un point d'accès), on
         * ne régresse jamais volontairement. */
        if (!best || accuracy < best.accuracy) {
          bestFixRef.current = { latitude, longitude, accuracy };
          setLiveAccuracy(accuracy);
        }
        if (accuracy <= GOOD_ACCURACY_M) settleWithBestFix();
      },
      err => {
        if (bestFixRef.current) {
          // Une erreur ponctuelle après avoir déjà reçu un relevé exploitable
          // (ex. le capteur se coupe) ne doit pas jeter une position valide.
          settleWithBestFix();
          return;
        }
        const messages: Record<number, string> = {
          1: 'Permission refusée. Choisissez votre position manuellement.',
          2: 'Position indisponible. Choisissez votre position manuellement.',
          3: 'Délai expiré. Choisissez votre position manuellement.',
        };
        stopWatch();
        setErrorMsg(messages[err.code] ?? 'Erreur GPS.');
        setState('denied');
      },
      { enableHighAccuracy: true, timeout: MAX_WATCH_MS, maximumAge: 0 },
    );

    /* Filet de sécurité : au-delà de MAX_WATCH_MS, on se contente du
     * meilleur relevé obtenu jusque-là (même imparfait) plutôt que de
     * laisser l'utilisateur bloqué indéfiniment en attente d'un relevé
     * "parfait" qui n'arrivera peut-être jamais sur cet appareil. */
    timeoutRef.current = setTimeout(() => {
      if (bestFixRef.current) {
        settleWithBestFix();
      } else {
        stopWatch();
        setErrorMsg('Position indisponible. Choisissez votre position manuellement.');
        setState('denied');
      }
    }, MAX_WATCH_MS);
  }, [settleWithBestFix, stopWatch]);

  /* ── Confirmation de la position ────────────────────────── */
  const confirm = useCallback(() => {
    if (state === 'granted' && detectedAddr) {
      onComplete(detectedAddr);
      return;
    }
    if ((state === 'denied' || state === 'manual') && pickerValue) {
      const result: RegistrationLocation = {
        latitude:    pickerValue.coordinates.latitude,
        longitude:   pickerValue.coordinates.longitude,
        gpsEnabled:  false,
        address:     pickerValue.address?.adresse  ?? pickerValue.address?.displayName ?? undefined,
        city:        pickerValue.address?.ville     ?? undefined,
        district:    pickerValue.address?.commune   ?? undefined,
        quartier:    pickerValue.address?.quartier  ?? undefined,
        region:      pickerValue.address?.region    ?? undefined,
        country:     pickerValue.address?.pays      ?? undefined,
        postalCode:  pickerValue.address?.codePostal ?? undefined,
      };
      onComplete(result);
    }
  }, [state, detectedAddr, pickerValue, onComplete]);

  /* ── Mettre à jour la position confirmée (si l'utilisateur déplace le marqueur après GPS) */
  const handlePickerChange = useCallback((val: LocationPickerValue) => {
    setPickerValue(val);
    if (state === 'granted') {
      setDetectedAddr(prev => prev ? {
        ...prev,
        latitude:  val.coordinates.latitude,
        longitude: val.coordinates.longitude,
        address:   val.address?.adresse  ?? val.address?.displayName ?? prev.address,
        city:      val.address?.ville    ?? prev.city,
        district:  val.address?.commune  ?? prev.district,
        quartier:  val.address?.quartier ?? prev.quartier,
        region:    val.address?.region   ?? prev.region,
        country:   val.address?.pays     ?? prev.country,
        postalCode: val.address?.codePostal ?? prev.postalCode,
      } : null);
    }
  }, [state]);

  /* ══════════════════════════════════════════════════════════
     RENDUS
  ══════════════════════════════════════════════════════════ */

  /* ── État idle — proposition initiale ─── */
  if (state === 'idle') return (
    <div style={{
      background:   'var(--sky-2, #f0f4ff)',
      border:       '1.5px solid var(--sky-3, #c7d9f8)',
      borderRadius: 14,
      padding:      '20px 18px',
      marginBottom: 4,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:16 }}>
        <div style={{
          width:46, height:46, borderRadius:'50%',
          background:'linear-gradient(135deg,var(--blue,#1A4FC4),#5b8ef4)',
          display:'flex', alignItems:'center', justifyContent:'center',
          flexShrink:0, boxShadow:'0 4px 12px rgba(26,79,196,.25)',
        }}>
          <i className="fas fa-location-dot" style={{ color:'#fff', fontSize:18 }} />
        </div>
        <div>
          <div style={{ fontWeight:700, fontSize:14.5, color:'var(--navy)' }}>
            Localisez-moi automatiquement
          </div>
          <div style={{ fontSize:12.5, color:'var(--t2)', marginTop:3, lineHeight:1.5 }}>
            {defaultCountryName
              ? `Pays détecté : ${defaultCountryName}. Autorisez la géolocalisation pour être trouvé facilement, sans rien saisir.`
              : 'Autorisez la géolocalisation pour apparaître dans les recherches locales, sans rien saisir.'}
          </div>
        </div>
      </div>

      {/* Seule action proposée — pas de choix "carte manuelle" en
       * alternative : voir BUG CORRIGÉ (2026-09-13) en en-tête de fichier.
       * La carte ne réapparaît qu'en repli si le GPS échoue. */}
      <button
        type="button"
        onClick={requestGps}
        style={{
          width:        '100%',
          padding:      '11px 16px',
          borderRadius: 10,
          background:   'var(--blue, #1A4FC4)',
          color:        '#fff',
          border:       'none',
          fontSize:     13.5,
          fontWeight:   700,
          cursor:       'pointer',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          gap:          8,
          boxShadow:    '0 3px 10px rgba(26,79,196,.3)',
        }}
      >
        <i className="fas fa-location-crosshairs" />
        Autoriser la localisation
      </button>
    </div>
  );

  /* ── État loading ─────────────────────── */
  if (state === 'loading') return (
    <div style={{
      background: 'var(--sky-2, #f0f4ff)',
      border:     '1.5px solid var(--sky-3)',
      borderRadius: 14, padding:'24px 18px',
      textAlign:'center', marginBottom:4,
    }}>
      <i className="fas fa-location-crosshairs"
        style={{ fontSize:28, color:'var(--blue)', marginBottom:10, display:'block', animation:'spin 1.5s linear infinite' }} />
      <div style={{ fontWeight:700, fontSize:14, color:'var(--navy)' }}>
        {liveAccuracy === null ? 'Localisation en cours…' : 'Amélioration de la précision…'}
      </div>
      <div style={{ fontSize:12, color:'var(--t2)', marginTop:4 }}>
        {liveAccuracy === null
          ? "Veuillez autoriser l'accès dans votre navigateur."
          : `Précision actuelle : ± ${Math.round(liveAccuracy)} m — recherche d'un relevé plus précis…`}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  /* ── États granted / denied / manual — affiche la carte ─── */
  const showMap = state === 'granted' || state === 'denied' || state === 'manual';
  if (showMap) return (
    <div style={{ marginBottom: 4 }}>

      {/* Message contextuel */}
      {state === 'granted' && detectedAddr && (() => {
        /* BUG CORRIGÉ — locationAccuracy (mètres, fournie par le
         * navigateur) était capturée mais jamais montrée : sur desktop
         * (sans puce GPS), la position vient du Wi-Fi/IP et peut être
         * approximative de plusieurs km sans que rien ne le signale —
         * l'utilisateur croit alors, à tort, que "sa vraie position"
         * n'a pas été récupérée alors que le point EST réel, juste
         * imprécis. Avertissement explicite au-delà de 3 km, avec
         * invitation claire à corriger sur la carte. */
        const accuracy = detectedAddr.locationAccuracy;
        const isImprecise = typeof accuracy === 'number' && accuracy > 3000;
        return (
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'10px 14px',
            background:   isImprecise ? '#fffbeb' : '#ecfdf5',
            border:       `1.5px solid ${isImprecise ? '#fde68a' : '#a7f3d0'}`,
            borderRadius: 10, marginBottom: 10, fontSize: 12.5,
          }}>
            <i
              className={`fas ${isImprecise ? 'fa-triangle-exclamation' : 'fa-circle-check'}`}
              style={{ color: isImprecise ? '#B45309' : '#047857', fontSize: 14 }}
            />
            <div>
              <strong style={{ color: isImprecise ? '#92400E' : '#065f46' }}>
                {isImprecise ? 'Position approximative' : 'Position détectée'}
              </strong>
              {detectedAddr.city && (
                <span style={{ color: isImprecise ? '#92400E' : '#047857', marginLeft:6 }}>
                  {[detectedAddr.district, detectedAddr.city, detectedAddr.region].filter(Boolean).join(', ')}
                </span>
              )}
              <div style={{ color:'var(--t3)', fontSize:11, marginTop:2 }}>
                {isImprecise
                  ? `Précision faible (± ${Math.round(accuracy! / 1000)} km, courant sur ordinateur sans GPS) — vérifiez et déplacez le marqueur sur votre adresse exacte.`
                  : 'Déplacez le marqueur si nécessaire.'}
              </div>
            </div>
          </div>
        );
      })()}

      {(state === 'denied' || state === 'manual') && (
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          padding:'10px 14px', background:'var(--sky-2,#f0f4ff)',
          border:'1.5px solid var(--sky-3)', borderRadius:10, marginBottom:10,
          fontSize:12.5, color:'var(--t2)',
        }}>
          <i className="fas fa-map-location-dot" style={{ color:'var(--blue)', fontSize:14 }} />
          {errorMsg
            ? <span>{errorMsg}</span>
            : <span>Cliquez sur la carte ou glissez le marqueur pour choisir votre position.</span>
          }
        </div>
      )}

      {/* Carte */}
      <Suspense fallback={
        <div style={{ height:280, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--sky-2,#f0f4ff)', borderRadius:12 }}>
          <i className="fas fa-circle-notch fa-spin" style={{ color:'var(--blue)', fontSize:22 }} />
        </div>
      }>
        <LocationPicker
          value={pickerValue}
          onChange={handlePickerChange}
          height="280px"
          placeholder="Rechercher votre adresse…"
          showGpsButton={state !== 'granted'}
        />
      </Suspense>

      {/* Adresse résolue */}
      {pickerValue?.address?.displayName && (
        <div style={{
          marginTop:8, padding:'8px 12px',
          background:'#fff', border:'1px solid var(--border,#e5e7eb)',
          borderRadius:8, fontSize:11.5, color:'var(--t2)',
          display:'flex', alignItems:'center', gap:7,
        }}>
          <i className="fas fa-location-dot" style={{ color:'var(--blue)', fontSize:11 }} />
          <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {pickerValue.address.displayName}
          </span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button
          type="button"
          onClick={() => { setState('idle'); setPickerValue(null); setDetectedAddr(null); }}
          style={{
            padding:'9px 14px', borderRadius:9,
            border:'1.5px solid var(--border,#e5e7eb)', background:'transparent',
            color:'var(--t2)', fontSize:12.5, cursor:'pointer',
          }}
        >
          <i className="fas fa-arrow-left" style={{ marginRight:5 }} />Retour
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={!pickerValue && state !== 'granted'}
          style={{
            flex:1, padding:'9px 16px', borderRadius:9,
            background:'var(--blue, #1A4FC4)', color:'#fff',
            border:'none', fontSize:13, fontWeight:700,
            cursor: (!pickerValue && state !== 'granted') ? 'not-allowed' : 'pointer',
            opacity: (!pickerValue && state !== 'granted') ? .55 : 1,
            display:'flex', alignItems:'center', justifyContent:'center', gap:7,
          }}
        >
          <i className="fas fa-check" />
          Confirmer cette position
        </button>
      </div>
    </div>
  );

  return null;
}
