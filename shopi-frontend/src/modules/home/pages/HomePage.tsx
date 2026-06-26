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

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { shuffleArray }         from '../data/mockData';
import { getRoleFromToken }     from '../../../shared/services/authUtils';

/* ── Layout ── */
import Header  from '../components/layout/Header';
import Footer  from '../components/layout/Footer';

/* ── Sections ── */
import HeroSection            from '../components/sections/HeroSection';
import TrustSection           from '../components/sections/TrustSection';
import TypeEntrepriseSection  from '../components/sections/TypeEntrepriseSection';
import CategoriesSection      from '../components/sections/CategoriesSection';
import EcosystemeSection      from '../components/sections/EcosystemeSection';
import PromotionsSection      from '../components/sections/PromotionsSection';
import HomeStoriesStrip       from '../components/sections/HomeStoriesStrip';
import RandomBloc, { type BlocKind } from '../components/sections/RandomBloc';

/* ── UI ── */
import Toast, { type ToastType } from '../components/ui/Toast';

import styles from './HomePage.module.css';

export default function HomePage() {
  const navigate = useNavigate();

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

  /* ── Blocs aléatoires pondérés ── */
  const blocsAleatoires = useMemo<BlocKind[]>(() => {
    const source: BlocKind[] = [
      'produits',
      'produits',
      'entreprises',
      'produits',
      'partenaires',
      'produits',
      'correspondants',
      'produits',
      'livreurs',
    ];
    return shuffleArray(source);
  }, []);

  /* ── Navigation ── */
  const handleLogin    = () => navigate('/login');
  const handleRegister = () => navigate('/register');
  const handleExplore  = () => document.querySelector('#blocs')?.scrollIntoView({ behavior: 'smooth' });

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

        {/* 1 — Hero */}
        <HeroSection
          onToast={showToast}
          onExplore={handleExplore}
          onRegister={handleRegister}
        />

        {/* 2 — Piliers de confiance */}
        <TrustSection onToast={showToast} />

        {/* 3 — Types d'entreprises */}
        <TypeEntrepriseSection onToast={showToast} />

        {/* 4 — Catégories populaires */}
        <CategoriesSection onToast={showToast} />

        {/* 5 — Écosystème */}
        <EcosystemeSection onToast={showToast} onRegister={handleRegister} />

        {/* 6 — Flash sale + promotions */}
        <PromotionsSection onToast={showToast} />

        {/* 6.5 — Stories des boutiques */}
        <HomeStoriesStrip onToast={showToast} />

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