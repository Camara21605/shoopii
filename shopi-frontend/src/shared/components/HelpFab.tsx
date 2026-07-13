/* ============================================================
 * FICHIER : src/shared/components/HelpFab.tsx
 *
 * RÔLE :
 *   Bouton flottant "?" (Floating Action Button) visible sur les
 *   pages publiques. Offre un accès rapide au Help Center et au
 *   formulaire de contact.
 *
 * AFFICHAGE :
 *   Le FAB s'affiche partout SAUF sur les routes suivantes
 *   (car elles ont déjà leur propre navigation d'aide) :
 *     - /dashboard/*  (tableaux de bord)
 *     - /support/*    (tickets, stats)
 *     - /aide/*       (articles Help Center)
 *     - /login        (page de connexion)
 *     - /register     (page d'inscription)
 *
 * COMPORTEMENT :
 *   - Clic sur "?" → ouvre un petit menu flottant
 *   - Menu items : "Centre d'aide", "Nous contacter", "Créer un ticket"
 *   - Clic sur "×" ou en dehors → ferme le menu
 *
 * INTÉGRATION :
 *   Ajouter <HelpFab /> dans AppRouter, à l'intérieur de
 *   <BrowserRouter> mais à la racine du arbre de rendu,
 *   APRÈS la balise <Routes>.
 * ============================================================ */

import React, { useState, useEffect, useRef } from 'react';
import { useLocation }  from 'react-router-dom';
import s from './HelpFab.module.css';

// ─────────────────────────────────────────────────────────────
// 1. Liste des routes où le FAB doit être caché
// ─────────────────────────────────────────────────────────────

/**
 * Retourne true si la route courante doit cacher le FAB.
 * Préférer les préfixes pour capturer toutes les sous-routes.
 */
function shouldHide(pathname: string): boolean {
  const HIDDEN_PREFIXES = [
    '/dashboard/',  // tous les dashboards
    '/support',     // tickets + stats support
    '/aide',        // articles du Help Center
    '/login',
    '/register',
    '/messagerie',  // messagerie in-app
  ];
  return HIDDEN_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

// ─────────────────────────────────────────────────────────────
// 2. Items du menu
// ─────────────────────────────────────────────────────────────

interface MenuItem {
  icon:  string;
  label: string;
  href:  string;
  color: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    icon:  '📚',
    label: 'Centre d\'aide',
    href:  '/aide',
    color: '#EEF2FF',
  },
  {
    icon:  '✉️',
    label: 'Nous contacter',
    href:  '/contact',
    color: '#F0FDF4',
  },
  {
    icon:  '🎫',
    label: 'Créer un ticket',
    href:  '/support/nouveau',
    color: '#FFF7ED',
  },
];

// ─────────────────────────────────────────────────────────────
// 3. Composant
// ─────────────────────────────────────────────────────────────

export default function HelpFab() {
  const location          = useLocation();
  const [open, setOpen]   = useState(false);
  const fabRef            = useRef<HTMLDivElement>(null);

  // Cacher le FAB sur les routes exclues
  const hidden = shouldHide(location.pathname);

  // Fermer le menu si on clique en dehors du FAB
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // Fermer le menu si la route change (navigation)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Ne rien rendre si la route est exclue
  if (hidden) return null;

  return (
    <div className={s.fab} ref={fabRef}>

      {/* ── Menu rapide (visible quand ouvert) ── */}
      {open && (
        <div className={s.menu}>
          {MENU_ITEMS.map(item => (
            <a
              key={item.href}
              href={item.href}
              className={s.item}
              onClick={() => setOpen(false)}
            >
              <span
                className={s.itemIcon}
                style={{ background: item.color }}
              >
                {item.icon}
              </span>
              {item.label}
            </a>
          ))}
        </div>
      )}

      {/* ── Bouton principal ── */}
      <button
        className={s.btn}
        onClick={() => setOpen(prev => !prev)}
        aria-label={open ? 'Fermer le menu d\'aide' : 'Ouvrir le menu d\'aide'}
        aria-expanded={open}
      >
        {/* Alterne entre "?" (fermé) et "×" (ouvert) */}
        {open ? '✕' : '?'}
      </button>

    </div>
  );
}
