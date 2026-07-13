/* ================================================================
 * FICHIER : pages/parametres/SanteSection.tsx
 * Section 16 — Tableau de santé du système.
 * API, DB, emails, paiements, GPS, notifications, CDN.
 * ================================================================ */

import { useState } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps, ServiceHealth, HealthStatus } from './types';

/* Services de santé (en prod : GET /admin/health) */
const SERVICES: ServiceHealth[] = [
  { id: 'api',     nom: 'API Backend',       icon: 'fa-server',                pct: 99.8, statut: 'ok',   check: 'Vérifié il y a 1 min' },
  { id: 'db',      nom: 'Base de données',   icon: 'fa-database',              pct: 99.9, statut: 'ok',   check: 'Vérifié il y a 1 min' },
  { id: 'email',   nom: 'Serveur e-mail',    icon: 'fa-envelope',              pct: 98.5, statut: 'ok',   check: 'Vérifié il y a 2 min' },
  { id: 'sms',     nom: 'Passerelle SMS',    icon: 'fa-comment-sms',           pct: 97.2, statut: 'ok',   check: 'Vérifié il y a 2 min' },
  { id: 'pay',     nom: 'Paiements (Orange)',icon: 'fa-mobile-screen-button',  pct: 94.1, statut: 'warn', check: 'Latence élevée détectée' },
  { id: 'gps',     nom: 'Géolocalisation',   icon: 'fa-location-dot',          pct: 99.1, statut: 'ok',   check: 'Vérifié il y a 3 min' },
  { id: 'notif',   nom: 'Notifications Push',icon: 'fa-bell',                  pct: 88.0, statut: 'warn', check: 'Taux de livraison faible' },
  { id: 'cdn',     nom: 'CDN / Médias',      icon: 'fa-cloud',                 pct: 100,  statut: 'ok',   check: 'Vérifié il y a 1 min' },
  { id: 'auth',    nom: 'Authentification',  icon: 'fa-shield-halved',         pct: 100,  statut: 'ok',   check: 'Vérifié il y a 1 min' },
  { id: 'search',  nom: 'Recherche',         icon: 'fa-magnifying-glass',      pct: 99.5, statut: 'ok',   check: 'Vérifié il y a 2 min' },
  { id: 'storage', nom: 'Stockage fichiers', icon: 'fa-hard-drive',            pct: 72.0, statut: 'warn', check: 'Espace disque à 72%' },
  { id: 'queue',   nom: 'File de tâches',    icon: 'fa-list-check',            pct: 99.3, statut: 'ok',   check: 'Vérifié il y a 1 min' },
];

/* Classes CSS selon le statut */
const CARD_CLS: Record<HealthStatus, string>  = { ok: 'hCardOk', warn: 'hCardWarn', err: 'hCardErr' };
const IC_CLS:   Record<HealthStatus, string>  = { ok: 'hIcOk',   warn: 'hIcWarn',   err: 'hIcErr' };
const FILL_CLS: Record<HealthStatus, string>  = { ok: 'pEmerald', warn: 'pAmber',    err: 'pRed' };
const STATUT_LABEL: Record<HealthStatus, string> = { ok: 'Opérationnel', warn: 'Dégradé', err: 'Hors service' };
const BADGE_CLS: Record<HealthStatus, string>  = { ok: 'bdgGreen', warn: 'bdgAmber', err: 'bdgRed' };

/* Calcul de l'état global */
function globalStatus(services: ServiceHealth[]): HealthStatus {
  if (services.some(s => s.statut === 'err'))  return 'err';
  if (services.some(s => s.statut === 'warn')) return 'warn';
  return 'ok';
}

export default function SanteSection({ onToast }: SectionProps) {
  const [services, setServices] = useState<ServiceHealth[]>(SERVICES);
  const [lastCheck, setLastCheck] = useState('Il y a 1 minute');

  const uptime = services.filter(s => s.statut === 'ok').length;
  const global = globalStatus(services);

  const refresh = () => {
    setLastCheck('À l\'instant');
    setServices(ss => ss.map(s => ({ ...s, check: 'Vérifié à l\'instant' })));
    onToast('Vérification de santé relancée', 'i');
  };

  return (
    <div className={styles.secBody}>

      {/* ── Statut global ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-heart-pulse" /> Statut global</div>
            <div className={styles.cardSub}>Dernière vérification : {lastCheck}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className={`${styles.bdg} ${styles[BADGE_CLS[global] as keyof typeof styles]}`}>
              <i className="fas fa-circle" /> {STATUT_LABEL[global]}
            </span>
            <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={refresh}>
              <i className="fas fa-rotate" /> Actualiser
            </button>
          </div>
        </div>
        <div className={styles.cardBody}>
          {/* KPIs globaux */}
          <div className={styles.miniKpis}>
            <div className={styles.mkpi}>
              <div className={styles.mkpiStripe} style={{ background: 'var(--emerald)' }} />
              <i className="fas fa-circle-check" style={{ color: 'var(--emerald)', fontSize: 13 }} />
              <div className={styles.mkpiV}>{uptime}</div>
              <div className={styles.mkpiL}>Services OK</div>
            </div>
            <div className={styles.mkpi}>
              <div className={styles.mkpiStripe} style={{ background: 'var(--amber)' }} />
              <i className="fas fa-triangle-exclamation" style={{ color: 'var(--amber)', fontSize: 13 }} />
              <div className={styles.mkpiV}>{services.filter(s => s.statut === 'warn').length}</div>
              <div className={styles.mkpiL}>Dégradés</div>
            </div>
            <div className={styles.mkpi}>
              <div className={styles.mkpiStripe} style={{ background: '#ef4444' }} />
              <i className="fas fa-circle-xmark" style={{ color: '#ef4444', fontSize: 13 }} />
              <div className={styles.mkpiV}>{services.filter(s => s.statut === 'err').length}</div>
              <div className={styles.mkpiL}>Hors service</div>
            </div>
            <div className={styles.mkpi}>
              <div className={styles.mkpiStripe} style={{ background: 'var(--blue)' }} />
              <i className="fas fa-server" style={{ color: 'var(--blue)', fontSize: 13 }} />
              <div className={styles.mkpiV}>{services.length}</div>
              <div className={styles.mkpiL}>Services total</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Grille des services ── */}
      <div className={styles.healthGrid}>
        {services.map(s => (
          <div key={s.id} className={`${styles.hCard} ${styles[CARD_CLS[s.statut] as keyof typeof styles]}`}>
            <div className={styles.hTop}>
              <div className={`${styles.hIc} ${styles[IC_CLS[s.statut] as keyof typeof styles]}`}>
                <i className={`fas ${s.icon}`} />
              </div>
              <span className={`${styles.bdg} ${styles[BADGE_CLS[s.statut] as keyof typeof styles]}`}
                style={{ fontSize: 9, padding: '2px 7px' }}>
                {STATUT_LABEL[s.statut]}
              </span>
            </div>
            <div className={styles.hName}>{s.nom}</div>
            <div className={styles.hPct}>{s.pct}%</div>
            <div className={styles.progressBar} style={{ marginTop: 6 }}>
              <div className={`${styles.progressFill} ${styles[FILL_CLS[s.statut] as keyof typeof styles]}`}
                style={{ width: `${s.pct}%` }} />
            </div>
            <div className={styles.hCheck}>{s.check}</div>
          </div>
        ))}
      </div>

    </div>
  );
}
