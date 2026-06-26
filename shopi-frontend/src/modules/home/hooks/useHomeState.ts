/*
 * ════════════════════════════════════════════════════════
 * FICHIER : src/modules/home/hooks/useHomeState.ts
 * ORDRE   : 4 — Importé par HomePage.tsx
 * RÔLE    : Centralise l'état local de la page d'accueil :
 *           - toast (message flottant bas de page)
 *           - notifOpen (panneau notifications)
 *           - shareOpen (modal partage)
 *           - activeCategory (filtre catégorie actif)
 *           - activeFilter (filtre produit actif)
 *           - countdown (timer flash sale)
 *           - scrolled (header shadow)
 * ════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export function useHomeState() {
  /* ── Toast ── */
  const [toastMsg, setToastMsg]   = useState('');
  const [toastShow, setToastShow] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pop = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastShow(false);
    // rAF double pour reset la transition
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setToastShow(true);
      toastTimer.current = setTimeout(() => setToastShow(false), 2700);
    }));
  }, []);

  /* ── Panels ── */
  const [notifOpen, setNotifOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  /* ── Filtres ── */
  const [activeCategory, setActiveCategory] = useState('Tout');
  const [activeFilter, setActiveFilter]     = useState('Tout');

  /* ── Header scroll ── */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  /* ── Countdown flash sale (8h 42m 17s) ── */
  const [countdown, setCountdown] = useState(8 * 3600 + 42 * 60 + 17);
  useEffect(() => {
    const id = setInterval(() => setCountdown(c => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');
  const cdH = pad(Math.floor(countdown / 3600));
  const cdM = pad(Math.floor((countdown % 3600) / 60));
  const cdS = pad(countdown % 60);

  /* ── Favoris (Set de noms produits) ── */
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const toggleFav = useCallback((nm: string) => {
    setFavs(prev => {
      const next = new Set(prev);
      if (next.has(nm)) { next.delete(nm); pop('🤍 Retiré des favoris'); }
      else               { next.add(nm);    pop('❤️ Ajouté aux favoris'); }
      return next;
    });
  }, [pop]);

  /* ── Abonnés (entreprises / partenaires / livreurs) ── */
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const toggleFollow = useCallback((name: string) => {
    setFollowed(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else { next.add(name); pop('✅ Abonné à ' + name); }
      return next;
    });
  }, [pop]);

  return {
    toastMsg, toastShow,
    pop,
    notifOpen, setNotifOpen,
    shareOpen, setShareOpen,
    activeCategory, setActiveCategory,
    activeFilter, setActiveFilter,
    scrolled,
    cdH, cdM, cdS,
    favs, toggleFav,
    followed, toggleFollow,
  };
}
