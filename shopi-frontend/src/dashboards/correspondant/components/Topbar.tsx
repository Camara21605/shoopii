// components/Topbar.tsx
import React from 'react';
import s from '../styles/Topbar.module.css';
import { pop } from './Toast';
import type { PageId } from '../data/correspondantData';

const TITLES: Record<PageId, { title: string; sub: string }> = {
  overview:   { title: "Vue d'ensemble",        sub: 'Tableau de bord · Région Conakry' },
  colis:      { title: 'Colis en dépôt',        sub: '14 colis en stock · 2 urgences'  },
  transferts: { title: 'Transferts actifs',     sub: '3 transferts en cours'            },
  retours:    { title: 'Retours & Litiges',     sub: '2 dossiers en attente'            },
  boutiques:  { title: 'Boutiques partenaires', sub: '4 boutiques actives'             },
  livreurs:   { title: 'Livreurs locaux',       sub: '7 livreurs · 4 en ligne'         },
  clients:    { title: 'Clients zone',          sub: '5 clients actifs ce mois'        },
  revenus:    { title: 'Mes revenus',           sub: '730 000 GNF ce mois'             },
  portefeuille: { title: 'Portefeuille',        sub: 'Solde, retraits et transactions' },
  zone:       { title: 'Ma zone',               sub: 'Couverture Conakry · Régional'   },
  evaluation: { title: 'Mon évaluation',        sub: 'Note moyenne : ★ 4.9 / 5'        },
  parametres: { title: 'Paramètres',            sub: 'Profil et configuration'          },
};

interface Props {
  page:      PageId;
  onMenu:    () => void;
  onPage:    (p: PageId) => void;
  /* ✅ Nouvelles props pour le panneau notifications */
  onNotif:   () => void;
  notifOpen: boolean;
}

export default function Topbar({ page, onMenu, onPage, onNotif, notifOpen }: Props) {
  const { title, sub } = TITLES[page];

  return (
    <header className={s.topbar}>
      {/* Hamburger mobile */}
      <button className={s.hamburger} onClick={onMenu}>
        <i className="fas fa-bars" />
      </button>

      {/* Titre page */}
      <div className={s.info}>
        <div className={s.title}>{title}</div>
        <div className={s.sub}>{sub}</div>
      </div>

      {/* Actions droite */}
      <div className={s.acts}>
        <div className={s.regionPill}>
          <i className="fas fa-map-pin" /> Conakry · Régional
        </div>
        <div className={s.sep} />

        {/* Bouton messagerie */}
        <button className={s.ic} onClick={() => pop('💬 5 messages non lus', 'i')}>
          <i className="fas fa-comment-dots" />
          <div className={s.dot} />
        </button>

        {/* ✅ Bouton notifications — ouvre/ferme le panneau */}
        <button
          className={`${s.ic} ${notifOpen ? s.icActive : ''}`}
          onClick={onNotif}
          aria-label="Notifications"
          aria-expanded={notifOpen}
        >
          <i className="fas fa-bell" />
          {/* Point rouge non-lu */}
          <div className={s.dot} />
        </button>

        <div className={s.sep} />

        {/* Avatar → paramètres */}
        <div className={s.ava} onClick={() => onPage('parametres')}>AB</div>
      </div>
    </header>
  );
}