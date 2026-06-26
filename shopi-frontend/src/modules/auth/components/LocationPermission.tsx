/* ============================================================
 * FICHIER : src/modules/auth/components/LocationPermission.tsx
 *
 * RÔLE : Étape "Localisation" du formulaire d'inscription.
 *        Demande la permission GPS, géocode l'adresse automatiquement,
 *        ou propose une carte interactive si l'utilisateur refuse.
 *
 * FLUX :
 *   idle → [Clic GPS] → loading → granted (carte auto)
 *                     → denied  (carte manuelle)
 *   idle → [Choisir sur carte] → manual (carte manuelle)
 *   idle → [Ignorer] → emit null
 *
 * UTILISÉ dans RegisterForm pour : company, delivery, partner, correspondent
 * ============================================================ */

import { useState, useCallback, lazy, Suspense } from 'react';
import { reverseGeocode }           from '../../../shared/location/utils/nominatim';
import '../../../shared/location/styles/location.css';
import type { RegistrationLocation } from '../types';
import type { LocationPickerValue }  from '../../../shared/location/components/LocationPicker';

const LocationPicker = lazy(() => import('../../../shared/location/components/LocationPicker'));

type PermState = 'idle' | 'loading' | 'granted' | 'denied' | 'manual' | 'done';

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

  /* ── Demande de permission GPS ──────────────────────────── */
  const requestGps = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setErrorMsg('La géolocalisation n\'est pas disponible sur cet appareil.');
      setState('manual');
      return;
    }

    setState('loading');
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude, accuracy } = pos.coords;

        // Reverse geocoding via Nominatim
        const geo = await reverseGeocode(latitude, longitude);

        const result: RegistrationLocation = {
          latitude,
          longitude,
          locationAccuracy: accuracy,
          gpsEnabled:       true,
          address:    geo?.adresse    ?? geo?.displayName ?? undefined,
          city:       geo?.ville      ?? undefined,
          district:   geo?.commune    ?? geo?.quartier    ?? undefined,
          region:     geo?.region     ?? undefined,
          country:    geo?.pays       ?? undefined,
          postalCode: geo?.codePostal ?? undefined,
        };

        setDetectedAddr(result);
        setPickerValue({
          coordinates: { latitude, longitude },
          address:     geo,
        });
        setState('granted');
      },
      err => {
        const messages: Record<number, string> = {
          1: 'Permission refusée. Choisissez votre position manuellement.',
          2: 'Position indisponible. Choisissez votre position manuellement.',
          3: 'Délai expiré. Choisissez votre position manuellement.',
        };
        setErrorMsg(messages[err.code] ?? 'Erreur GPS.');
        setState('denied');
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  }, []);

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
        district:    pickerValue.address?.commune   ?? pickerValue.address?.quartier ?? undefined,
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
        district:  val.address?.commune  ?? val.address?.quartier ?? prev.district,
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
            Ajoutez votre localisation
          </div>
          <div style={{ fontSize:12.5, color:'var(--t2)', marginTop:3, lineHeight:1.5 }}>
            {defaultCountryName
              ? `Pays détecté : ${defaultCountryName}. Précisez votre position pour être trouvé facilement.`
              : 'Précisez votre position pour apparaître dans les recherches locales.'}
          </div>
        </div>
      </div>

      {/* Bouton GPS principal */}
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
          marginBottom: 10,
          boxShadow:    '0 3px 10px rgba(26,79,196,.3)',
        }}
      >
        <i className="fas fa-location-crosshairs" />
        Utiliser ma position GPS
      </button>

      {/* Actions secondaires */}
      <div style={{ display:'flex', gap:8 }}>
        <button
          type="button"
          onClick={() => setState('manual')}
          style={{
            flex:1, padding:'9px 12px', borderRadius:9,
            border:'1.5px solid var(--blue)', background:'transparent',
            color:'var(--blue)', fontSize:12.5, fontWeight:600,
            cursor:'pointer',
          }}
        >
          <i className="fas fa-map-location-dot" style={{ marginRight:5 }} />
          Choisir sur la carte
        </button>
        <button
          type="button"
          onClick={() => onComplete(null)}
          style={{
            flex:1, padding:'9px 12px', borderRadius:9,
            border:'1.5px solid var(--border, #e5e7eb)', background:'transparent',
            color:'var(--t2)', fontSize:12.5, fontWeight:500,
            cursor:'pointer',
          }}
        >
          Ignorer pour l'instant
        </button>
      </div>
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
      <div style={{ fontWeight:700, fontSize:14, color:'var(--navy)' }}>Localisation en cours…</div>
      <div style={{ fontSize:12, color:'var(--t2)', marginTop:4 }}>Veuillez autoriser l'accès dans votre navigateur.</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  /* ── États granted / denied / manual — affiche la carte ─── */
  const showMap = state === 'granted' || state === 'denied' || state === 'manual';
  if (showMap) return (
    <div style={{ marginBottom: 4 }}>

      {/* Message contextuel */}
      {state === 'granted' && detectedAddr && (
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          padding:'10px 14px', background:'#ecfdf5',
          border:'1.5px solid #a7f3d0', borderRadius:10, marginBottom:10,
          fontSize:12.5,
        }}>
          <i className="fas fa-circle-check" style={{ color:'#047857', fontSize:14 }} />
          <div>
            <strong style={{ color:'#065f46' }}>Position détectée</strong>
            {detectedAddr.city && (
              <span style={{ color:'#047857', marginLeft:6 }}>
                {[detectedAddr.district, detectedAddr.city, detectedAddr.region].filter(Boolean).join(', ')}
              </span>
            )}
            <div style={{ color:'var(--t3)', fontSize:11, marginTop:2 }}>
              Déplacez le marqueur si nécessaire.
            </div>
          </div>
        </div>
      )}

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
          onClick={() => onComplete(null)}
          style={{
            padding:'9px 14px', borderRadius:9,
            border:'1.5px solid var(--border,#e5e7eb)', background:'transparent',
            color:'var(--t2)', fontSize:12.5, cursor:'pointer',
          }}
        >
          Ignorer
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
