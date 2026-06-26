/* ================================================================
 * src/modules/home/components/settings/components/SecurityScoreBanner.tsx
 * DYNAMIQUE — calcule le vrai score depuis GET /client/parametres/securite
 * ================================================================ */

import React, { useEffect, useState } from 'react';
import s from '../styles/SettingsPage.module.css';
import type { PanelId } from './SettingsSidebar';
import { settingsApi, type SecuriteData } from '../../api/settings.api';

interface Props {
  onSwitch: (id: PanelId) => void;
}

/* ── Calcul du score ── */
function calcScore(sec: SecuriteData): {
  score: number;
  niveau: string;
  color: string;
  items: { label: string; ok: boolean }[];
} {
  const items = [
    { label: 'Mot de passe fort',          ok: true                         }, // 20 pts
    { label: 'Email vérifié',              ok: sec.emailVerified            }, // 20 pts
    { label: 'Téléphone vérifié',          ok: sec.phoneVerified            }, // 15 pts
    { label: '2FA activé',                 ok: sec.twoFaEnabled             }, // 25 pts
    { label: 'Questions de sécurité',      ok: sec.questionsConfigurees >= 2 }, // 10 pts
    { label: 'Codes de secours générés',   ok: sec.codesSecours > 0         }, // 10 pts
  ];
  const weights = [20, 20, 15, 25, 10, 10];
  const score   = items.reduce((sum, it, i) => sum + (it.ok ? weights[i] : 0), 0);

  let niveau: string;
  let color:  string;
  if (score >= 90) { niveau = 'Excellent'; color = '#34D399'; }
  else if (score >= 70) { niveau = 'Bien';     color = '#FCD34D'; }
  else if (score >= 50) { niveau = 'Moyen';    color = '#FB923C'; }
  else                  { niveau = 'Faible';   color = '#F87171'; }

  return { score, niveau, color, items };
}

export default function SecurityScoreBanner({ onSwitch }: Props) {
  const [securite, setSecurite] = useState<SecuriteData | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    settingsApi.getSecurite()
      .then(setSecurite)
      .finally(() => setLoading(false));
  }, []);

  /* Valeurs par défaut pendant le chargement */
  const { score, niveau, color, items } = securite
    ? calcScore(securite)
    : { score: 0, niveau: '…', color: '#94a3b8', items: [] };

  const r      = 34;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className={s.secBanner}>
      {/* ── Jauge SVG ── */}
      <div className={s.secGauge}>
        <svg viewBox="0 0 80 80" width="80" height="80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={loading ? 'rgba(255,255,255,.15)' : color}
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
          Score de sécurité —{' '}
          <em style={{ fontStyle:'italic', color: loading ? 'rgba(255,255,255,.4)' : color }}>
            {niveau}
          </em>
        </div>
        <div className={s.secDesc}>
          {loading
            ? 'Chargement du score de sécurité…'
            : score >= 90
              ? 'Votre compte est parfaitement sécurisé. Continuez comme ça !'
              : score >= 70
                ? 'Votre compte est bien protégé. Quelques améliorations restent possibles.'
                : 'Renforcez votre sécurité en complétant les actions ci-dessous.'
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
          <i className="fas fa-shield-halved" /> Améliorer
        </button>
      )}
      {!loading && score === 100 && (
        <div style={{ fontSize:28, flexShrink:0 }}>🏆</div>
      )}
    </div>
  );
}