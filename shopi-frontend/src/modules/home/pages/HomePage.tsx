/* ================================================================
 * src/modules/home/pages/HomePage.tsx
 *
 * PRINCIPES D'ACCÈS :
 *
 *   👤 Non connecté  → peut naviguer/rechercher librement
 *   ✅ Client         → accès complet
 *   🏢 Non-client     → navigation libre, fonctionnalités client
 *                       bloquées par le Header (modal)
 *
 * AMÉLIORATIONS :
 *   - showToast accepte un type (s | e | w | i)
 *   - paddingBottom pour la bottom nav mobile
 *   - handleClientAction pour les actions protégées depuis la page
 * ================================================================ */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { shuffleArray }         from '../data/mockData';
import { getRoleFromToken }     from '../../../shared/services/authUtils';

/* ── Layout ── */
import Header  from '../components/layout/Header';
import Footer  from '../components/layout/Footer';

/* ── Sections ── */
import TypeEntrepriseSection  from '../components/sections/TypeEntrepriseSection';
import CategoriesSection      from '../components/sections/CategoriesSection';
import PromotionsSection      from '../components/sections/PromotionsSection';
import HomeStoriesStrip       from '../components/sections/HomeStoriesStrip';
import RandomBloc, { type BlocKind } from '../components/sections/RandomBloc';

/* ── UI ── */
import Toast, { type ToastType } from '../components/ui/Toast';

import styles from './HomePage.module.css';

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();

  /* ── État auth ── */
  const role       = getRoleFromToken();
  const isClient   = role === 'client';
  const isAnonymous = !role;

  /* ── Toast — supporte les types (success, error, warning, info) ── */
  const [toastMsg,     setToastMsg]     = useState('');
  const [toastType,    setToastType]    = useState<ToastType>('s');
  const [toastVisible, setToastVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: ToastType = 's') => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToastVisible(false), 2800);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  /* Scroll différé demandé depuis une autre page (ex. clic sur "Explorer"
   * dans le Header depuis /boutiques, /livreurs...) — voir Header.tsx,
   * qui navigue ici avec state.scrollTo au lieu de scroller directement
   * un élément qui n'existe que sur cette page. */
  useEffect(() => {
    const target = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (!target) return;
    navigate(location.pathname, { replace: true, state: {} });

    /* Les sections au-dessus (Stories, Catégories, Promotions) chargent
     * leurs données en async et décalent #blocs vers le bas une fois
     * rendues — un seul scrollIntoView() différé arrivait donc trop tôt,
     * avant que ce décalage n'ait eu lieu. On réessaie sur quelques
     * instants pour suivre la position finale, borné pour ne pas boucler
     * indéfiniment si l'élément n'apparaît jamais. */
    const delays = [60, 400, 900, 1600];
    const timers = delays.map(ms => setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
    }, ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Blocs aléatoires pondérés ── */
  const [blocsAleatoires] = useState<BlocKind[]>(() => shuffleArray([
    'produits',
    'produits',
    'entreprises',
    'produits',
    'produits-gros',
    'correspondants',
    'produits',
    'livreurs',
  ]));

  /* ── Navigation ── */
  const handleLogin    = () => navigate('/login');
  const handleRegister = () => navigate('/register');

  return (
    <>
      <Header
        onToast={showToast}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />

      <main className={styles.main} style={{
        paddingTop:    66,
        /* Espace pour la bottom nav mobile (62px) */
        paddingBottom: 0,
      }}>

        {/* 1 — Stories des boutiques */}
        <HomeStoriesStrip onToast={showToast} />

        {/* 3 — Types d'entreprises */}
        <TypeEntrepriseSection />

        {/* 4 — Catégories populaires */}
        <CategoriesSection />

        {/* 6 — Flash sale + promotions */}
        <PromotionsSection />

        {/* 7 — Blocs aléatoires */}
        <div id="blocs">
          {blocsAleatoires.map((kind, index) => (
            <RandomBloc
              key={`${kind}-${index}`}
              kind={kind}
              index={index}
              onToast={showToast}
            />
          ))}
        </div>
      </main>

      <Footer onToast={showToast} />

      {/* Toast global — supporte les types */}
      <Toast
        message={toastMsg}
        visible={toastVisible}
        type={toastType}
      />
    </>
  );
}