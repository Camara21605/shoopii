/* ============================================================
 * FICHIER : src/dashboards/entreprise/components/CompanyLocationPrompt.tsx
 *
 * RÔLE : Demander à l'entreprise la position EXACTE de sa boutique.
 *
 *   - S'affiche à l'ouverture du tableau de bord (donc à chaque connexion)
 *     tant que la boutique n'a pas de position enregistrée.
 *   - Une fois la position enregistrée, plus jamais : l'entreprise ne le fait
 *     qu'une seule fois (elle peut toujours la corriger dans « Ma boutique »).
 *   - « Plus tard » : masquée jusqu'à la prochaine connexion (session).
 *   - Réservée au propriétaire : seul lui peut modifier la position
 *     (PATCH /location/company/:id vérifie company.userId).
 *
 * POURQUOI : sans position, la distance montrée aux clients part du centre de
 * la ville de l'entreprise (≈), et les livreurs ne trouvent pas la boutique.
 * ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../shared/services/apiFetch';
import { useBackDismiss } from '../../../shared/hooks/useBackDismiss';
import { getBestGpsFix, type GpsFix, type GpsFixError } from '../../../shared/location/utils/bestGpsFix';
import { reverseGeocode } from '../../../shared/location/utils/nominatim';
import s from '../styles/CompanyLocationPrompt.module.css';

/** Clé de session : « Plus tard » ne vaut que pour la connexion en cours (effacée à la déconnexion). */
export const LOCATION_PROMPT_LATER_KEY = 'shoneya_loc_prompt_later';
/** Émis quand la position est enregistrée (masque les rappels ailleurs, ex. aperçu). */
export const COMPANY_LOCATION_SET_EVENT = 'company-location-set';

/** Au-delà, la position risque de ne pas être celle de la boutique : on le signale. */
const IMPRECISE_M = 100;

type Step = 'intro' | 'locating' | 'found' | 'saving' | 'saved' | 'error';

interface Props {
  /** Ouvre la page « Ma boutique » pour placer le repère sur la carte. */
  onPlaceOnMap: () => void;
}

export default function CompanyLocationPrompt({ onPlaceOnMap }: Props) {
  const { t } = useTranslation();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [open,      setOpen]      = useState(false);
  const [step,      setStep]      = useState<Step>('intro');
  const [fix,       setFix]       = useState<GpsFix | null>(null);
  const [liveM,     setLiveM]     = useState<number | null>(null);
  const [place,     setPlace]     = useState<string | null>(null);
  const [errorKey,  setErrorKey]  = useState<string>('');
  const cancelRef = useRef<() => void>(() => {});

  /* Position déjà enregistrée ? (une seule lecture à l'ouverture du tableau de bord) */
  useEffect(() => {
    try { if (sessionStorage.getItem(LOCATION_PROMPT_LATER_KEY)) return; } catch { /* stockage indisponible */ }
    let alive = true;
    apiFetch<{ id?: string; latitude?: number | string | null; longitude?: number | string | null }>('/dashboard/entreprise/parametres/apercu')
      .then(d => {
        if (!alive || !d?.id) return;
        if (d.latitude == null || d.longitude == null) { setCompanyId(d.id); setOpen(true); }
      })
      .catch(() => { /* réseau : on redemandera à la prochaine ouverture */ });
    return () => { alive = false; cancelRef.current(); };
  }, []);

  const later = () => {
    cancelRef.current();
    try { sessionStorage.setItem(LOCATION_PROMPT_LATER_KEY, '1'); } catch { /* sans conséquence */ }
    setOpen(false);
  };

  /* Bouton RETOUR du téléphone = « Plus tard » (ne quitte pas le tableau de bord) */
  useBackDismiss(open && step !== 'saved', later);

  const locate = () => {
    setStep('locating'); setLiveM(null); setFix(null); setPlace(null);
    const { promise, cancel } = getBestGpsFix({ goodAccuracyM: 30, maxMs: 20_000, onProgress: f => setLiveM(Math.round(f.accuracy)) });
    cancelRef.current = cancel;
    promise
      .then(f => {
        setFix(f);
        setStep('found');
        /* Adresse lisible pour que l'entreprise reconnaisse l'endroit — facultatif */
        void reverseGeocode(f.latitude, f.longitude)
          .then(r => setPlace(r ? [r.quartier, r.commune, r.ville].filter(Boolean).join(', ') || r.displayName || null : null))
          .catch(() => {});
      })
      .catch((err: GpsFixError) => {
        setErrorKey(err === 'denied' ? 'refusee' : 'indisponible');
        setStep('error');
      });
  };

  const save = async () => {
    if (!fix || !companyId) return;
    setStep('saving');
    try {
      await apiFetch(`/location/company/${companyId}`, {
        method: 'PATCH',
        body:   { latitude: fix.latitude, longitude: fix.longitude },
      });
      window.dispatchEvent(new CustomEvent(COMPANY_LOCATION_SET_EVENT));
      setStep('saved');
      setTimeout(() => setOpen(false), 1800);
    } catch {
      setErrorKey('enregistrement');
      setStep('error');
    }
  };

  if (!open) return null;

  const accuracy  = fix ? Math.round(fix.accuracy) : null;
  const imprecise = accuracy != null && accuracy > IMPRECISE_M;

  return (
    <div className={s.backdrop}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="loc-prompt-title">
        <div className={s.icon} aria-hidden="true"><i className="fas fa-store" /></div>
        <h2 id="loc-prompt-title" className={s.title}>{t('locationPrompt.titre')}</h2>

        {step === 'intro' && (
          <>
            <p className={s.text}>{t('locationPrompt.intro')}</p>
            <p className={s.hint}><i className="fas fa-circle-info" aria-hidden="true" /> {t('locationPrompt.conseil')}</p>
            <button type="button" className={s.primary} onClick={locate}>
              <i className="fas fa-location-crosshairs" aria-hidden="true" /> {t('locationPrompt.localiser')}
            </button>
          </>
        )}

        {step === 'locating' && (
          <>
            <p className={s.text}>
              <i className="fas fa-circle-notch fa-spin" aria-hidden="true" />{' '}
              {liveM != null ? t('locationPrompt.rechercheM', { m: liveM }) : t('locationPrompt.recherche')}
            </p>
            <p className={s.hint}>{t('locationPrompt.rechercheAide')}</p>
          </>
        )}

        {(step === 'found' || step === 'saving') && fix && (
          <>
            <div className={s.result}>
              <strong><i className="fas fa-location-dot" aria-hidden="true" /> {place ?? t('locationPrompt.trouvee')}</strong>
              <span>{t('locationPrompt.precision', { m: accuracy })}</span>
              <span className={s.coords}>{fix.latitude.toFixed(5)}, {fix.longitude.toFixed(5)}</span>
            </div>
            {imprecise && <p className={s.warn}><i className="fas fa-triangle-exclamation" aria-hidden="true" /> {t('locationPrompt.imprecise')}</p>}
            <button type="button" className={s.primary} onClick={save} disabled={step === 'saving'}>
              {step === 'saving'
                ? <><i className="fas fa-circle-notch fa-spin" aria-hidden="true" /> {t('locationPrompt.enregistrement')}</>
                : <><i className="fas fa-check" aria-hidden="true" /> {t('locationPrompt.enregistrer')}</>}
            </button>
            <button type="button" className={s.secondary} onClick={locate} disabled={step === 'saving'}>
              <i className="fas fa-rotate-right" aria-hidden="true" /> {t('locationPrompt.reessayer')}
            </button>
          </>
        )}

        {step === 'saved' && (
          <p className={s.success}><i className="fas fa-circle-check" aria-hidden="true" /> {t('locationPrompt.enregistree')}</p>
        )}

        {step === 'error' && (
          <>
            <p className={s.warn}><i className="fas fa-circle-exclamation" aria-hidden="true" /> {t(`locationPrompt.erreur.${errorKey}`)}</p>
            <button type="button" className={s.primary} onClick={errorKey === 'enregistrement' ? save : locate}>
              <i className="fas fa-rotate-right" aria-hidden="true" /> {t('locationPrompt.reessayer')}
            </button>
          </>
        )}

        {step !== 'saved' && (
          <div className={s.footer}>
            <button type="button" className={s.link} onClick={() => { later(); onPlaceOnMap(); }}>
              <i className="fas fa-map" aria-hidden="true" /> {t('locationPrompt.carte')}
            </button>
            <button type="button" className={s.link} onClick={later}>{t('locationPrompt.plusTard')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
