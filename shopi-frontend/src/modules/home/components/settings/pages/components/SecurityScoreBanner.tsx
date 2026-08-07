/* ================================================================
 * src/modules/home/components/settings/components/SecurityScoreBanner.tsx
 * DYNAMIQUE — calcule le vrai score depuis GET /client/parametres/securite
 * ================================================================ */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import s from '../styles/SettingsPage.module.css';
import type { PanelId } from './SettingsSidebar';
import { settingsApi, type SecuriteData } from '../../api/settings.api';

interface Props {
  onSwitch: (id: PanelId) => void;
}

/* ── Calcul du score ── */
function calcScore(sec: SecuriteData, t: TFunction): {
  score: number;
  niveau: string;
  color: string;
  items: { label: string; ok: boolean }[];
} {
  const items = [
    { label: t('settingsPage.securityBanner.items.motDePasseFort'),        ok: true                         }, // 20 pts
    { label: t('settingsPage.securityBanner.items.emailVerifie'),          ok: sec.emailVerified            }, // 20 pts
    { label: t('settingsPage.securityBanner.items.telephoneVerifie'),      ok: sec.phoneVerified            }, // 15 pts
    { label: t('settingsPage.securityBanner.items.twoFaActive'),           ok: sec.twoFaEnabled             }, // 25 pts
    { label: t('settingsPage.securityBanner.items.questionsSecurite'),     ok: sec.questionsConfigurees >= 2 }, // 10 pts
    { label: t('settingsPage.securityBanner.items.codesSecours'),          ok: sec.codesSecours > 0         }, // 10 pts
  ];
  const weights = [20, 20, 15, 25, 10, 10];
  const score   = items.reduce((sum, it, i) => sum + (it.ok ? weights[i] : 0), 0);

  let niveau: string;
  let color:  string;
  if (score >= 90) { niveau = t('settingsPage.securityBanner.niveaux.excellent'); color = '#34D399'; }
  else if (score >= 70) { niveau = t('settingsPage.securityBanner.niveaux.bien');  color = '#FCD34D'; }
  else if (score >= 50) { niveau = t('settingsPage.securityBanner.niveaux.moyen'); color = '#FB923C'; }
  else                  { niveau = t('settingsPage.securityBanner.niveaux.faible'); color = '#F87171'; }

  return { score, niveau, color, items };
}

export default function SecurityScoreBanner({ onSwitch }: Props) {
  const { t } = useTranslation();
  const [securite, setSecurite] = useState<SecuriteData | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    settingsApi.getSecurite()
      .then(setSecurite)
      .finally(() => setLoading(false));
  }, []);

  /* Valeurs par défaut pendant le chargement */
  const { score, niveau, color, items } = securite
    ? calcScore(securite, t)
    : { score: 0, niveau: '…', color: '#94a3b8', items: [] };

  const r      = 34;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className={s.secBanner}>
      {/* ── Jauge SVG ── */}
      <div className={s.secGauge}>
        <svg viewBox="0 0 80 80" width="80" height="80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--bdr2)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={loading ? 'var(--bdr2)' : color}
            strokeWidth="6"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transform: 'rotate(-90deg)', transformOrigin: '50% 50%',
              transition: 'stroke-dashoffset .8s ease, stroke .4s',
            }}
          />
        </svg>
        <div className={s.secGaugeVal}>
          {loading ? '…' : score}
          <span>/ 100</span>
        </div>
      </div>

      {/* ── Infos ── */}
      <div className={s.secInfo}>
        <div className={s.secTitle}>
          {t('settingsPage.securityBanner.titre')} —{' '}
          <em style={{ fontStyle:'italic', color: loading ? 'var(--t3)' : color }}>
            {niveau}
          </em>
        </div>
        <div className={s.secDesc}>
          {loading
            ? t('settingsPage.securityBanner.chargementDesc')
            : score >= 90
              ? t('settingsPage.securityBanner.descExcellent')
              : score >= 70
                ? t('settingsPage.securityBanner.descBien')
                : t('settingsPage.securityBanner.descFaible')
          }
        </div>
        <div className={s.secItems}>
          {items.map(it => (
            <span key={it.label} className={`${s.secItem} ${it.ok ? s.ok : s.warn}`}>
              <i className={`fas ${it.ok ? 'fa-check' : 'fa-triangle-exclamation'}`} />
              {' '}{it.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Bouton ── */}
      {!loading && score < 100 && (
        <button className={s.secBannerBtn} onClick={() => onSwitch('securite')}>
          <i className="fas fa-shield-halved" /> {t('settingsPage.securityBanner.ameliorer')}
        </button>
      )}
      {!loading && score === 100 && (
        <div style={{ fontSize:28, flexShrink:0 }}>🏆</div>
      )}
    </div>
  );
}