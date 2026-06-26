/* ============================================================
 * FICHIER : src/modules/auth/components/LeftPanel.tsx
 * RÔLE    : Panneau gauche de la page Login — branding Shopi,
 *           statistiques, chips de rôles, cartes flottantes
 * ============================================================ */

import React from 'react';

/**
 * LeftPanel
 * Zone de branding visible uniquement sur desktop (>900px).
 * Contient le logo, le tagline, les chips de rôles,
 * les statistiques et les cartes flottantes animées.
 */
export const LeftPanel: React.FC = () => {
  return (
    <div className="left-panel">
      {/* ── Logo ── */}
      <div className="logo rv">
        <div className="logo-mark">Sh</div>
        <div className="logo-word">
          Sho<b>pi</b>
        </div>
      </div>

      {/* ── Contenu central ── */}
      <div className="left-content">
        {/* Badge eyebrow */}
        <div className="left-eyebrow rv">
          <span className="left-dot" />
          La Marketplace Africaine de Référence
        </div>

        {/* Titre principal */}
        <h1 className="left-h1 rv d1">
          Bienvenue<br />
          sur <em>Shopi</em>.<br />
          Connectez-vous.
        </h1>

        {/* Description */}
        <p className="left-p rv d2">
          Achetez, vendez, livrez ou administrez. Shopi réunit six univers
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
            <div className="ls-v">120<span>K+</span></div>
            <div className="ls-l">Clients actifs</div>
          </div>
          <div className="ls">
            <div className="ls-v">4<span>K+</span></div>
            <div className="ls-l">Boutiques</div>
          </div>
          <div className="ls">
            <div className="ls-v">640<span>+</span></div>
            <div className="ls-l">Livreurs</div>
          </div>
          <div className="ls">
            <div className="ls-v">98<span>%</span></div>
            <div className="ls-l">Satisfaction</div>
          </div>
        </div>
      </div>

      {/* ── Cartes flottantes animées ── */}
      <div className="float-cards">
        <div className="fc">
          <div className="fc-icon fc-1">📦</div>
          <div>
            <div className="fc-title">Commande livrée</div>
            <div className="fc-sub">Il y a 2 minutes · Kaloum, Conakry</div>
          </div>
        </div>
        <div className="fc">
          <div className="fc-icon fc-2">🏪</div>
          <div>
            <div className="fc-title">Nouvelle boutique</div>
            <div className="fc-sub">FashionHub GN vient de s'inscrire</div>
          </div>
        </div>
        <div className="fc">
          <div className="fc-icon fc-3">⭐</div>
          <div>
            <div className="fc-title">Avis 5 étoiles</div>
            <div className="fc-sub">TechStore Conakry · 248 avis</div>
          </div>
        </div>
      </div>

      {/* ── Liens de pied de page ── */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }} className="rv">
        {['À propos de Shopi', 'Aide & Support', 'Confidentialité'].map(link => (
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
          © 2025 Shopi Africa
        </span>
      </div>
    </div>
  );
};