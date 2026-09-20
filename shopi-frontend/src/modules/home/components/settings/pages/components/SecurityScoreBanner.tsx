/* ================================================================
 * src/modules/home/components/settings/components/SecurityScoreBanner.tsx
 * DYNAMIQUE — calcule le vrai score depuis GET /client/parametres/securite
 *
 * Affiché UNIQUEMENT dans l'onglet Profil (voir SettingsPage.tsx).
 *
 *  - Chaque action du score est un bouton : e-mail → lance la vérification
 *    dans le panneau Coordonnées ; 2FA / questions / codes → ouvre
 *    « Confidentialité & sécurité ».
 *  - Points affichés par action (+25, +40…) et « prochaine étape » = l'action
 *    manquante la plus rentable.
 *  - Erreur de chargement explicite avec « Réessayer » (avant : score à 0
 *    « Faible » affiché comme s'il était réel).
 *  - Se met à jour sans rechargement (événement `security-updated`).
 *
 * Pondération (total 100) : e-mail vérifié 25 · 2FA 40 · questions (≥ 2) 15 ·
 * codes de secours 20. « Mot de passe fort » a été retiré : le mot de passe est
 * haché, sa force en clair n'est jamais connue. « Téléphone vérifié » reste
 * affiché à titre informatif mais hors calcul : aucun flux SMS n'existe encore.
 * ================================================================ */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import s from '../styles/SettingsPage.module.css';
import type { PanelId } from './panels';
import { settingsApi, type SecuriteData } from '../../api/settings.api';

interface Props {
  onSwitch: (id: PanelId) => void;
}

type Target = 'email' | 'securite';
interface ScoreItem { key: string; label: string; ok: boolean; pts: number; target: Target }

function calcScore(sec: SecuriteData, t: TFunction) {
  const items: ScoreItem[] = [
    { key: 'email',     label: t('settingsPage.securityBanner.items.emailVerifie'),      ok: sec.emailVerified,             pts: 25, target: 'email'    },
    { key: '2fa',       label: t('settingsPage.securityBanner.items.twoFaActive'),       ok: sec.twoFaEnabled,              pts: 40, target: 'securite' },
    { key: 'questions', label: t('settingsPage.securityBanner.items.questionsSecurite'), ok: sec.questionsConfigurees >= 2, pts: 15, target: 'securite' },
    { key: 'codes',     label: t('settingsPage.securityBanner.items.codesSecours'),      ok: sec.codesSecours > 0,          pts: 20, target: 'securite' },
  ];
  const score = items.reduce((sum, it) => sum + (it.ok ? it.pts : 0), 0);
  /* Action manquante la plus rentable en premier */
  const next  = items.filter(i => !i.ok).sort((a, b) => b.pts - a.pts)[0] ?? null;

  let niveau: string;
  let color:  string;
  if (score >= 90)      { niveau = t('settingsPage.securityBanner.niveaux.excellent'); color = '#34D399'; }
  else if (score >= 70) { niveau = t('settingsPage.securityBanner.niveaux.bien');      color = '#FCD34D'; }
  else if (score >= 50) { niveau = t('settingsPage.securityBanner.niveaux.moyen');     color = '#FB923C'; }
  else                  { niveau = t('settingsPage.securityBanner.niveaux.faible');    color = '#F87171'; }

  const indisponibles = [{ label: t('settingsPage.securityBanner.items.telephoneVerifie') }];
  return { score, niveau, color, items, next, indisponibles };
}

export default function SecurityScoreBanner({ onSwitch }: Props) {
  const { t } = useTranslation();
  const [securite, setSecurite] = useState<SecuriteData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  const load = useCallback(() => {
    setError(false);
    return settingsApi.getSecurite()
      .then(setSecurite)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    /* Suit les actions faites ailleurs dans la page (e-mail vérifié, 2FA, codes…) sans recharger */
    const refresh = () => { settingsApi.getSecurite().then(d => { setSecurite(d); setError(false); }).catch(() => {}); };
    window.addEventListener('security-updated', refresh);
    return () => window.removeEventListener('security-updated', refresh);
  }, [load]);

  const go = (target: Target) => {
    if (target === 'email') window.dispatchEvent(new CustomEvent('verify-email-request'));
    else onSwitch('confidentialiteSecurite');
  };

  const data = securite ? calcScore(securite, t) : null;
  const score  = data?.score ?? 0;
  const color  = data?.color ?? '#94a3b8';
  const niveau = data?.niveau ?? '…';

  const r      = 34;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const idle   = loading || (error && !securite);

  return (
    <div className={s.secBanner}>
      {/* ── Jauge SVG ── */}
      <div className={s.secGauge} role="img" aria-label={`${t('settingsPage.securityBanner.titre')} : ${idle ? '…' : score} / 100`}>
        <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--bdr2)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={idle ? 'var(--bdr2)' : color}
            strokeWidth="6"
            strokeDasharray={circ}
            strokeDashoffset={idle ? circ : offset}
            strokeLinecap="round"
            style={{
              transform: 'rotate(-90deg)', transformOrigin: '50% 50%',
              transition: 'stroke-dashoffset .8s ease, stroke .4s',
            }}
          />
        </svg>
        <div className={s.secGaugeVal}>
          {idle ? (error ? '!' : '…') : score}
          <span>/ 100</span>
        </div>
      </div>

      {/* ── Infos ── */}
      <div className={s.secInfo}>
        <div className={s.secTitle}>
          {t('settingsPage.securityBanner.titre')}
          {!idle && <> — <em style={{ fontStyle: 'italic', color }}>{niveau}</em></>}
        </div>

        {error && !securite ? (
          <div className={s.secDesc}>
            {t('settingsPage.securityBanner.erreur')}{' '}
            <button type="button" className={s.secRetry} onClick={() => { setLoading(true); load(); }}>
              <i className="fas fa-rotate-right" /> {t('settingsPage.securityBanner.reessayer')}
            </button>
          </div>
        ) : (
          <>
            <div className={s.secDesc}>
              {loading
                ? t('settingsPage.securityBanner.chargementDesc')
                : score >= 90
                  ? t('settingsPage.securityBanner.descExcellent')
                  : score >= 70
                    ? t('settingsPage.securityBanner.descBien')
                    : t('settingsPage.securityBanner.descFaible')
              }
              {data?.next && !loading && (
                <> {t('settingsPage.securityBanner.prochaineEtape', { action: data.next.label, pts: data.next.pts })}</>
              )}
            </div>
            <div className={s.secItems}>
              {data?.items.map(it => (
                <button
                  key={it.key}
                  type="button"
                  className={`${s.secItem} ${s.secItemBtn} ${it.ok ? s.ok : s.warn}`}
                  onClick={() => (it.ok ? undefined : go(it.target))}
                  disabled={it.ok}
                  title={it.ok ? undefined : t('settingsPage.securityBanner.completer', { pts: it.pts })}
                >
                  <i className={`fas ${it.ok ? 'fa-check' : 'fa-triangle-exclamation'}`} />
                  {' '}{it.label}
                  {!it.ok && <span className={s.secPts}>+{it.pts}</span>}
                </button>
              ))}
              {data?.indisponibles.map(it => (
                <span key={it.label} className={`${s.secItem} ${s.neutral}`} title={t('settingsPage.securityBanner.bientotDisponible')}>
                  <i className="fas fa-lock" />
                  {' '}{it.label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Bouton : mène à la prochaine action ── */}
      {!idle && data && data.score < 100 && data.next && (
        <button className={s.secBannerBtn} onClick={() => go(data.next!.target)}>
          <i className="fas fa-shield-halved" /> {t('settingsPage.securityBanner.ameliorer')}
        </button>
      )}
      {!idle && data && data.score === 100 && (
        <div style={{ fontSize: 28, flexShrink: 0 }} aria-hidden="true">🏆</div>
      )}
    </div>
  );
}
