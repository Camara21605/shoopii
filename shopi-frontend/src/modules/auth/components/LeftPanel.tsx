/* ============================================================
 * FICHIER : src/modules/auth/components/LeftPanel.tsx
 * RÔLE    : Panneau gauche de la page Login — branding Shoneya,
 *           statistiques, chips de rôles, cartes flottantes
 * ============================================================ */

import React, { useEffect, useState } from 'react';
import ShoneyaLogo from '../../../shared/components/ShoneyaLogo';
import { apiFetch } from '../../../shared/services/apiFetch';

interface LandingStats {
  stats: {
    activeClients: number;
    boutiques: number;
    livreurs: number;
    satisfactionPct: number | null;
  };
  activity: Array<{ type: string; icon: string; title: string; sub: string }>;
}

/** 120000 → {main:'120', suffix:'K+'} ; 640 → {main:'640', suffix:'+'} ; 0 → {main:'0', suffix:''}. */
function formatCount(n: number): { main: string; suffix: string } {
  if (n <= 0) return { main: '0', suffix: '' };
  if (n >= 1000) return { main: String(Math.floor(n / 1000)), suffix: 'K+' };
  return { main: String(n), suffix: '+' };
}

/**
 * LeftPanel
 * Zone de branding visible uniquement sur desktop (>900px).
 * Contient le logo, le tagline, les chips de rôles,
 * les statistiques et les cartes flottantes animées.
 *
 * BUG CORRIGÉ — stats ("120K+ clients"…) et fil d'activité ("Commande
 * livrée"…) étaient 100% codés en dur, aucun rapport avec la réalité de
 * la plateforme. Chargés maintenant depuis GET /public/landing-stats
 * (voir PublicService.getLandingStats côté backend). Échec silencieux :
 * une panne réseau garde simplement les valeurs par défaut ci-dessous
 * plutôt que de casser l'affichage de la page de connexion.
 */
export const LeftPanel: React.FC = () => {
  const [data, setData] = useState<LandingStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<LandingStats>('/public/landing-stats', { public: true })
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { /* silencieux — voir commentaire ci-dessus */ });
    return () => { cancelled = true; };
  }, []);

  const stats = data?.stats;
  const activity = data?.activity ?? [];

  return (
    <div className="left-panel">
      {/* ── Logo ── */}
      <div className="logo rv">
        <ShoneyaLogo size={38} />
        <div className="logo-word">
          Sho<b>neya</b>
        </div>
      </div>

      {/* ── Contenu central ── */}
      <div className="left-content">
        {/* Badge eyebrow */}
        <div className="left-eyebrow rv">
          <span className="left-dot" />
          La Marketplace de Référence
        </div>

        {/* Titre principal */}
        <h1 className="left-h1 rv d1">
          Bienvenue<br />
          sur <em>Shoneya</em>.<br />
          Connectez-vous.
        </h1>

        {/* Description */}
        <p className="left-p rv d2">
          Achetez, vendez, livrez ou administrez. Shoneya réunit six univers
          en une seule plateforme moderne, sécurisée et pensée pour l'Afrique.
        </p>

        {/* Chips des rôles */}
        <div className="role-chips rv d2">
          {[
            { icon: '🛍️', label: 'Client' },
            { icon: '🏪', label: 'Entreprise' },
            { icon: '🛵', label: 'Livreur' },
            { icon: '🤝', label: 'Partenaire' },
            { icon: '📍', label: 'Correspondant' },
            { icon: '🔑', label: 'Administrateur' },
          ].map(({ icon, label }) => (
            <div key={label} className="role-chip">
              {icon} {label}
            </div>
          ))}
        </div>

        {/* Statistiques */}
        <div className="left-stats rv d3">
          <div className="ls">
            <div className="ls-v">{formatCount(stats?.activeClients ?? 0).main}<span>{formatCount(stats?.activeClients ?? 0).suffix}</span></div>
            <div className="ls-l">Clients actifs</div>
          </div>
          <div className="ls">
            <div className="ls-v">{formatCount(stats?.boutiques ?? 0).main}<span>{formatCount(stats?.boutiques ?? 0).suffix}</span></div>
            <div className="ls-l">Boutiques</div>
          </div>
          <div className="ls">
            <div className="ls-v">{formatCount(stats?.livreurs ?? 0).main}<span>{formatCount(stats?.livreurs ?? 0).suffix}</span></div>
            <div className="ls-l">Livreurs</div>
          </div>
          {/* satisfactionPct est null tant qu'aucun avis n'existe sur la
              plateforme — masqué plutôt que d'afficher un faux "0%". */}
          {stats?.satisfactionPct != null && (
            <div className="ls">
              <div className="ls-v">{stats.satisfactionPct}<span>%</span></div>
              <div className="ls-l">Satisfaction</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Cartes flottantes animées — uniquement des événements réels,
          voir GET /public/landing-stats. Un emplacement sans événement
          disponible est simplement omis (jamais un exemple inventé). ── */}
      {activity.length > 0 && (
      <div className="float-cards">
        {activity.map((a, i) => (
        <div className="fc" key={a.type + i}>
          <div className={`fc-icon fc-${i + 1}`}>{a.icon}</div>
          <div>
            <div className="fc-title">{a.title}</div>
            <div className="fc-sub">{a.sub}</div>
          </div>
        </div>
        ))}
      </div>
      )}
      {/* ── Liens de pied de page ── */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }} className="rv">
        {['À propos de Shoneya', 'Aide & Support', 'Confidentialité'].map(link => (
          <a
            key={link}
            href="#"
            style={{
              fontSize: '12px',
              color: 'rgba(200,217,248,.4)',
              transition: 'color .2s',
            }}
            onMouseOver={e => ((e.target as HTMLAnchorElement).style.color = 'rgba(200,217,248,.8)')}
            onMouseOut={e => ((e.target as HTMLAnchorElement).style.color = 'rgba(200,217,248,.4)')}
          >
            {link}
          </a>
        ))}
        <span style={{ fontSize: '12px', color: 'rgba(200,217,248,.25)' }}>
          © {new Date().getFullYear()} Shoneya
        </span>
      </div>
    </div>
  );
};