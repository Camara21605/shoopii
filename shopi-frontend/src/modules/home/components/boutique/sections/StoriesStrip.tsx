/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/StoriesStrip.tsx
 *
 * RÔLE    : Bande horizontale de stories produits scrollable.
 *           Données chargées depuis GET /public/boutiques/:id/stories.
 *
 * PROPS   : companyId, companyName, companyLogo, onToast
 * ============================================================
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch }    from '../../../../../shared/services/apiFetch';
import styles from '../styles/StoriesStrip.module.css';

// ─── Palette de couleurs pour les rings (assignée par index) ───
const COLORS = ['#1A4FC4', '#7C3AED', '#0D9488', '#B45309', '#DC2626', '#059669', '#D97706', '#6366F1'];

// ─── Types ─────────────────────────────────────────────────────

interface ApiStory {
  id:        string;
  productId: string;
  produit:   string;
  prix:      string;
  prixBarre: string | null;
  badge:     'promo' | 'new' | null;
  emoji:     string;
  img:       string;
  caption:   string | null;
  duree:     number;
  createdAt: string;
}

interface Story extends ApiStory {
  couleur: string;
  lu:      boolean;
}

interface Props {
  companyId:   string;
  companyName: string;
  companyLogo?: string | null;
  onToast:     (m: string) => void;
}

// ─── Badge configs ──────────────────────────────────────────────
const BADGE_CFG: Record<string, { label: string; bg: string; c: string }> = {
  promo: { label: '🔥 Promo',     bg: '#FF3B3B', c: '#fff' },
  new:   { label: '✨ Nouveau',   bg: '#1A4FC4', c: '#fff' },
  top:   { label: '⭐ Top Vente', bg: '#B45309', c: '#fff' },
  flash: { label: '⚡ Flash',     bg: '#7C3AED', c: '#fff' },
};

// ─── Skeleton unique ───────────────────────────────────────────
function StorySkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, width: 72 }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'linear-gradient(90deg, var(--g100) 25%, var(--g50) 50%, var(--g100) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }} />
      <div style={{ width: 56, height: 9, borderRadius: 4, background: 'var(--g100)', animation: 'shimmer 1.4s infinite' }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function StoriesStrip({ companyId, companyName, companyLogo, onToast }: Props) {
  const [stories,  setStories]  = useState<Story[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [openIdx,  setOpenIdx]  = useState<number | null>(null);
  const stripRef   = useRef<HTMLDivElement>(null);

  // ── Fetch stories ─────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    apiFetch<ApiStory[]>(`/public/boutiques/${companyId}/stories`, { public: true })
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setStories(list.map((s, i) => ({
          ...s,
          couleur: COLORS[i % COLORS.length],
          lu:      false,
        })));
      })
      .catch(() => setStories([]))
      .finally(() => setLoading(false));
  }, [companyId]);

  // ── Drag-to-scroll ────────────────────────────────────────────
  const isDragging = useRef(false);
  const startX     = useRef(0);
  const scrollLeft = useRef(0);
  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current     = e.pageX - (stripRef.current?.offsetLeft ?? 0);
    scrollLeft.current = stripRef.current?.scrollLeft ?? 0;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !stripRef.current) return;
    e.preventDefault();
    stripRef.current.scrollLeft = scrollLeft.current - (e.pageX - stripRef.current.offsetLeft - startX.current) * 1.2;
  };
  const onMouseUp = () => { isDragging.current = false; };

  // ── Navigation viewer ─────────────────────────────────────────
  const openStory = (idx: number) => {
    setStories(prev => prev.map((s, i) => i === idx ? { ...s, lu: true } : s));
    setOpenIdx(idx);
  };

  const goNext = useCallback(() => {
    setOpenIdx(prev => {
      if (prev === null) return null;
      if (prev < stories.length - 1) {
        setStories(s => s.map((x, i) => i === prev + 1 ? { ...x, lu: true } : x));
        return prev + 1;
      }
      return null;
    });
  }, [stories.length]);

  const goPrev     = useCallback(() => setOpenIdx(p => (p === null || p === 0) ? p : p - 1), []);
  const closeViewer = useCallback(() => setOpenIdx(null), []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     closeViewer();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft')  goPrev();
    };
    if (openIdx !== null) document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [openIdx, closeViewer, goNext, goPrev]);

  // ── Pas de stories et chargement terminé → ne rien afficher ──
  if (!loading && stories.length === 0) return null;

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* ══ BANDE STORIES ══ */}
      <div className={styles.strip}>
        <div
          className={styles.scroller}
          ref={stripRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* Skeletons pendant le chargement */}
          {loading && Array.from({ length: 5 }).map((_, i) => <StorySkeleton key={i} />)}

          {/* Stories réelles */}
          {!loading && stories.map((s, i) => (
            <button
              key={s.id}
              className={`${styles.storyBtn} ${s.lu ? styles.storyLu : ''}`}
              onClick={() => openStory(i)}
              title={s.produit}
            >
              <div
                className={styles.storyRing}
                style={{
                  background: s.lu ? 'var(--g300)' : `conic-gradient(${s.couleur} 0%, ${s.couleur} 100%)`,
                  padding:    s.lu ? '2px' : '2.5px',
                }}
              >
                <div className={styles.storyCircle} style={{ background: `${s.couleur}15` }}>
                  <img src={s.img} alt={s.produit} className={styles.storyImg}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  {s.badge && (
                    <div className={styles.storyBadge} style={{ background: BADGE_CFG[s.badge]?.bg, color: BADGE_CFG[s.badge]?.c }}>
                      {BADGE_CFG[s.badge]?.label}
                    </div>
                  )}
                </div>
              </div>
              <span className={styles.storyLabel}>{s.produit}</span>
              <span className={styles.storyPrice}>{s.prix}</span>
            </button>
          ))}
        </div>

        {/* Flèches desktop */}
        <button className={`${styles.navArrow} ${styles.navLeft}`}
          onClick={() => stripRef.current?.scrollBy({ left: -320, behavior: 'smooth' })} aria-label="Précédent">
          <i className="fas fa-chevron-left" />
        </button>
        <button className={`${styles.navArrow} ${styles.navRight}`}
          onClick={() => stripRef.current?.scrollBy({ left: 320, behavior: 'smooth' })} aria-label="Suivant">
          <i className="fas fa-chevron-right" />
        </button>
      </div>

      {/* ══ VIEWER ══ */}
      {openIdx !== null && (
        <StoryViewer
          stories={stories}
          currentIdx={openIdx}
          companyName={companyName}
          companyLogo={companyLogo}
          onNext={goNext}
          onPrev={goPrev}
          onClose={closeViewer}
          onToast={onToast}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// STORY VIEWER — modal plein écran
// ═══════════════════════════════════════════════════════════════
interface ViewerProps {
  stories:     Story[];
  currentIdx:  number;
  companyName: string;
  companyLogo?: string | null;
  onNext:      () => void;
  onPrev:      () => void;
  onClose:     () => void;
  onToast:     (m: string) => void;
}

function StoryViewer({ stories, currentIdx, companyName, companyLogo, onNext, onPrev, onClose, onToast }: ViewerProps) {
  const navigate = useNavigate();
  const story    = stories[currentIdx];
  const [progress, setProgress] = useState(0);
  const animRef   = useRef<number | null>(null);
  const startRef  = useRef<number | null>(null);

  // ── Temps depuis la création ───────────────────────────────
  const tempsDepuis = (() => {
    const diff = Date.now() - new Date(story.createdAt).getTime();
    const h    = Math.floor(diff / 3_600_000);
    const m    = Math.floor((diff % 3_600_000) / 60_000);
    if (h >= 24) return 'il y a 1j';
    if (h > 0)   return `il y a ${h}h`;
    if (m > 0)   return `il y a ${m}min`;
    return 'à l\'instant';
  })();

  // ── Barre de progression ──────────────────────────────────
  useEffect(() => {
    setProgress(0);
    startRef.current = null;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const pct = Math.min(100, ((now - startRef.current) / story.duree) * 100);
      setProgress(pct);
      if (pct < 100) animRef.current = requestAnimationFrame(tick);
      else onNext();
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [currentIdx, story.duree]);

  // ── Swipe tactile ─────────────────────────────────────────
  const touchStart = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? onNext() : onPrev();
  };

  const badge = story.badge ? BADGE_CFG[story.badge] : null;

  return (
    <div className={styles.viewer} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClick={onClose}>

      {/* Fond flouté */}
      <div className={styles.viewerBg}
        style={{ background: `radial-gradient(ellipse at center, ${story.couleur}33 0%, #0B1F3A 70%)` }} />

      {/* Carte centrée */}
      <div className={styles.viewerCard} style={{ borderColor: `${story.couleur}44` }} onClick={e => e.stopPropagation()}>

        {/* Barres de progression */}
        <div className={styles.progBars}>
          {stories.map((_, i) => (
            <div key={i} className={styles.progBar}>
              <div className={styles.progFill} style={{
                width:      i < currentIdx ? '100%' : i === currentIdx ? `${progress}%` : '0%',
                background: story.couleur,
                transition: i === currentIdx ? 'none' : undefined,
              }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className={styles.viewerHd}>
          <div className={styles.viewerAvatar} style={{ borderColor: story.couleur }}>
            {companyLogo
              ? <img src={companyLogo} alt={companyName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : <span style={{ fontSize: 18 }}>🏪</span>
            }
          </div>
          <div>
            <div className={styles.viewerShop}>{companyName}</div>
            <div className={styles.viewerTime}>{tempsDepuis}</div>
          </div>
          <button className={styles.viewerClose} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Visuel produit */}
        <div className={styles.viewerVisual} style={{ background: `${story.couleur}18` }}>
          <img src={story.img} alt={story.produit} className={styles.viewerImg}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <div className={styles.viewerRing} style={{ borderColor: `${story.couleur}55` }} />

          {/* ── Prix en overlay sur l'image ── */}
          {story.prix && (
            <div className={styles.viewerPrixTag} style={{ background: story.couleur }}>
              <span className={styles.viewerPrixTagVal}>{story.prix}</span>
              {story.prixBarre && (
                <span className={styles.viewerPrixTagBarre}>{story.prixBarre}</span>
              )}
            </div>
          )}

          {/* Badge promo en overlay haut-gauche */}
          {badge && (
            <div className={styles.viewerBadgeOverlay} style={{ background: badge.bg, color: badge.c }}>
              {badge.label}
            </div>
          )}
        </div>

        {/* Infos produit */}
        <div className={styles.viewerInfo}>
          <div className={styles.viewerProduit}>{story.produit}</div>
          {story.caption && (
            <div className={styles.viewerTag}>
              <i className="fas fa-quote-left" /> {story.caption}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={styles.viewerActions}>
          <button
            className={styles.vaBtn}
            onClick={() => { onClose(); navigate(`/produit/${story.productId}`); }}
          >
            <i className="fas fa-eye" /> Voir le produit
          </button>
          <button
            className={styles.vaBtn2}
            onClick={() => onToast(`🛒 Ajouté au panier : ${story.produit}`)}
          >
            <i className="fas fa-bag-shopping" /> Ajouter au panier
          </button>
          <button
            className={styles.vaShare}
            onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/produit/${story.productId}`); onToast('🔗 Lien copié !'); }}
            title="Partager"
          >
            <i className="fas fa-share-nodes" />
          </button>
        </div>
      </div>

      {/* Flèche gauche */}
      {currentIdx > 0 && (
        <button className={`${styles.vNav} ${styles.vNavL}`} onClick={e => { e.stopPropagation(); onPrev(); }} aria-label="Précédente">
          <i className="fas fa-chevron-left" />
        </button>
      )}

      {/* Flèche droite */}
      {currentIdx < stories.length - 1 && (
        <button className={`${styles.vNav} ${styles.vNavR}`} onClick={e => { e.stopPropagation(); onNext(); }} aria-label="Suivante">
          <i className="fas fa-chevron-right" />
        </button>
      )}
    </div>
  );
}
