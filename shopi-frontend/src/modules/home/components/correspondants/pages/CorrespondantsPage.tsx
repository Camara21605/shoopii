/* ================================================================
 * FICHIER : src/modules/home/components/correspondants/pages/CorrespondantsPage.tsx
 *
 * RÔLE : Page liste publique des correspondants (route /correspondants).
 *        Utilise le MÊME Header que le reste du site.
 *
 *   Hero + Toolbar (recherche/filtres/tri/vue) + Sidebar filtres + grille.
 *
 * DONNÉES : GET /suivis/correspondants via useCorrespondants().
 *   Le filtrage/tri/recherche se fait côté client sur la liste chargée.
 *
 * AUTONOME : aucune prop. Toasts via 'shopi-toast'.
 * ================================================================ */

import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import Header from '../../layout/Header';
import LivreurViewerBanner from '../../../../../shared/components/LivreurViewerBanner';
import { useCorrespondants } from '../hooks/useCorrespondants';

import HeroCorrespondants    from '../sections/HeroCorrespondants';
import ToolbarCorrespondants from '../sections/ToolbarCorrespondants';
import SidebarCorrespondants from '../sections/SidebarCorrespondants';
import CardCorrespondant     from '../components/CardCorrespondant';
import ListItemCorrespondant from '../components/ListItemCorrespondant';

import type {
  Correspondant, CorrType, FiltreRapide, VueMode, TriOption,
} from '../data/types';
import styles from '../styles/Correspondants.module.css';

export default function CorrespondantsPage() {
  const navigate = useNavigate();
  const { correspondants, loading, error, toggleSuivi } = useCorrespondants();

  /* ── États de filtrage/affichage (côté client) ── */
  const [recherche, setRecherche] = useState('');
  const [filtre,    setFiltre]    = useState<FiltreRapide>('all');
  const [tri,       setTri]       = useState<TriOption>('pertinence');
  const [vue,       setVue]       = useState<VueMode>('grid');
  const [typeActif, setTypeActif] = useState<CorrType | 'all'>('all');
  const [commune,   setCommune]   = useState('all');
  const [noteMin,   setNoteMin]   = useState(0);
  const [statut,    setStatut]    = useState<'all' | 'online' | 'offline'>('all');

  /* Toast global */
  const onToast = useCallback((msg: string) => {
    window.dispatchEvent(new CustomEvent('shopi-toast', { detail: msg }));
  }, []);

  /* Suivi avec toast */
  const handleToggle = useCallback((id: string) => {
    const c = correspondants.find(x => x.id === id);
    toggleSuivi(id);
    if (c) onToast(c.suivi ? `👋 Désabonné de ${c.nom}` : `✅ Abonné à ${c.nom}`);
  }, [correspondants, toggleSuivi, onToast]);

  const handleView = useCallback((id: string) => {
    navigate(`/correspondants/${id}`);
  }, [navigate]);

  /* ── Communes disponibles (calculées depuis la liste) ── */
  const communes = useMemo(() => {
    const map = new Map<string, number>();
    correspondants.forEach(c => {
      const key = c.commune || 'autre';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    const list = [{ id: 'all', label: 'Toutes', count: correspondants.length }];
    map.forEach((count, id) => {
      list.push({ id, label: id.charAt(0).toUpperCase() + id.slice(1), count });
    });
    return list;
  }, [correspondants]);

  /* Compteur par type */
  const countType = useCallback(
    (t: CorrType) => correspondants.filter(c => c.type === t).length,
    [correspondants],
  );

  /* ── Liste filtrée + triée ── */
  const visibles = useMemo(() => {
    let list = [...correspondants];

    /* Recherche */
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      list = list.filter(c =>
        c.nom.toLowerCase().includes(q) ||
        c.zone.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q),
      );
    }

    /* Filtre rapide (toolbar) */
    if (filtre === 'available') list = list.filter(c => c.enLigne);
    else if (filtre === 'followed') list = list.filter(c => c.suivi);
    else if (filtre === 'regional' || filtre === 'zonal' || filtre === 'national') {
      list = list.filter(c => c.type === filtre);
    }

    /* Filtre type (sidebar) */
    if (typeActif !== 'all') list = list.filter(c => c.type === typeActif);

    /* Filtre commune */
    if (commune !== 'all') list = list.filter(c => c.commune === commune);

    /* Filtre note */
    if (noteMin > 0) list = list.filter(c => c.note >= noteMin);

    /* Filtre statut */
    if (statut === 'online')  list = list.filter(c => c.enLigne);
    if (statut === 'offline') list = list.filter(c => !c.enLigne);

    /* Tri */
    if (tri === 'note')      list.sort((a, b) => b.note - a.note);
    else if (tri === 'missions') list.sort((a, b) => b.missions - a.missions);
    else if (tri === 'nom')  list.sort((a, b) => a.nom.localeCompare(b.nom));

    return list;
  }, [correspondants, recherche, filtre, typeActif, commune, noteMin, statut, tri]);

  /* ── Stats du hero ── */
  const stats = useMemo(() => {
    const total = correspondants.length;
    const noteMoy = total
      ? (correspondants.reduce((s, c) => s + c.note, 0) / total).toFixed(1)
      : '0';
    const missionsTot = correspondants.reduce((s, c) => s + c.missions, 0);
    const missionsLabel = missionsTot >= 1000
      ? `${(missionsTot / 1000).toFixed(1)}k+`
      : String(missionsTot);
    const communesCount = new Set(correspondants.map(c => c.commune)).size;
    return { total, noteMoy, missions: missionsLabel, communes: communesCount };
  }, [correspondants]);

  /* 2 vedettes : les mieux notés en ligne */
  const vedettes = useMemo(
    () => [...correspondants].filter(c => c.enLigne).sort((a, b) => b.note - a.note).slice(0, 2),
    [correspondants],
  );

  const header = (
    <Header
      onToast={onToast}
      onLogin={() => navigate('/login')}
      onRegister={() => navigate('/register')}
    />
  );

  /* ── Chargement ── */
  if (loading) {
    return (
      <>
        {header}
        <LivreurViewerBanner cible="correspondants" />
        <div className={styles.page}>
          <div className={styles.state}>
            <i className="fas fa-spinner fa-spin" /> Chargement des correspondants…
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <LivreurViewerBanner cible="correspondants" />
      <div className={styles.page}>

        {/* Hero */}
        <HeroCorrespondants
          total={stats.total}
          noteMoy={stats.noteMoy}
          missions={stats.missions}
          communes={stats.communes}
          vedettes={vedettes}
          onToggle={handleToggle}
        />

        {/* Toolbar */}
        <ToolbarCorrespondants
          recherche={recherche} filtre={filtre} tri={tri} vue={vue}
          count={visibles.length}
          onRecherche={setRecherche} onFiltre={setFiltre} onTri={setTri} onVue={setVue}
        />

        {/* Corps : sidebar + grille */}
        <div className={styles.bodyWrap}>
          <SidebarCorrespondants
            typeActif={typeActif} onType={setTypeActif}
            communeActive={commune} communes={communes} onCommune={setCommune}
            noteMin={noteMin} onNote={setNoteMin}
            statut={statut} onStatut={setStatut}
            onReset={() => { setTypeActif('all'); setCommune('all'); setNoteMin(0); setStatut('all'); setFiltre('all'); }}
            countType={countType}
          />

          <main>
            <div className={styles.secH}>
              <div>
                <div className={styles.secTtl}>Correspondants disponibles</div>
                <div className={styles.secSub}>{visibles.length} résultat{visibles.length > 1 ? 's' : ''}</div>
              </div>
            </div>

            {/* État erreur (non bloquant : mock affiché) */}
            {error && (
              <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, fontSize: 12.5, color: '#991B1B' }}>
                <i className="fas fa-triangle-exclamation" /> {error} — données de démonstration affichées.
              </div>
            )}

            {/* Liste vide */}
            {visibles.length === 0 ? (
              <div className={styles.state}>
                <i className="fas fa-user-slash" />
                Aucun correspondant ne correspond à vos filtres.
              </div>
            ) : vue === 'grid' ? (
              <div className={styles.grid}>
                {visibles.map(c => (
                  <CardCorrespondant key={c.id} c={c} onToggle={handleToggle} onView={handleView} />
                ))}
              </div>
            ) : (
              <div>
                {visibles.map(c => (
                  <ListItemCorrespondant key={c.id} c={c} onToggle={handleToggle} onView={handleView} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}