/*
 * ============================================================
 * FICHIER : src/modules/home/components/sections/HomeStoriesStrip.tsx
 *
 * RÔLE    : Stories multi-boutiques de la page d'accueil.
 *           Données réelles depuis GET /public/stories.
 *           Chaque boutique = 1 bulle → 1 à 4 slides dans le viewer.
 * ============================================================
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch }    from '../../../../shared/services/apiFetch';
import styles from '../../styles/HomeStoriesStrip.module.css';

// ── Palette couleurs (couleur dominante / accent) ─────────────
const COLOR_PAIRS = [
  { c1: '#1A4FC4', c2: '#67E8F9' },
  { c1: '#7C3AED', c2: '#F9A8D4' },
  { c1: '#0D9488', c2: '#A7F3D0' },
  { c1: '#B45309', c2: '#FCD34D' },
  { c1: '#DC2626', c2: '#FCA5A5' },
  { c1: '#059669', c2: '#6EE7B7' },
  { c1: '#D97706', c2: '#FDE68A' },
  { c1: '#6366F1', c2: '#C4B5FD' },
];

// ── Types internes ────────────────────────────────────────────
interface BoutiqueStory {
  id:       string;        // = companyId
  shopNom:  string;
  shopLogo: string | null;
  couleur1: string;
  couleur2: string;
  online:   boolean;
  hasPromo: boolean;
  lu:       boolean;
  slides:   {
    productId: string;
    produit:   string;
    prix:      string;
    prixBarre: string | null;
    emoji:     string;
    img:       string;
    badge:     'promo' | 'new' | null;
    tag:       string | null;
    duree:     number;
  }[];
}

// ── API response (miroir du backend) ─────────────────────────
interface ApiStory {
  companyId: string;
  shopNom:   string;
  shopLogo:  string | null;
  online:    boolean;
  hasPromo:  boolean;
  slides: {
    productId: string;
    produit:   string;
    prix:      string;
    prixBarre: string | null;
    emoji:     string;
    img:       string;
    badge:     'promo' | 'new' | null;
    tag:       string | null;
    duree:     number;
  }[];
}

// ── Skeleton ──────────────────────────────────────────────────
function StorySkeleton() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:7, flexShrink:0, width:78 }}>
      <div style={{
        width:76, height:76, borderRadius:'50%',
        background:'linear-gradient(90deg,var(--g100)25%,var(--g50)50%,var(--g100)75%)',
        backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite',
      }} />
      <div style={{ width:60, height:9, borderRadius:4, background:'var(--g100)', animation:'shimmer 1.4s infinite' }} />
      <div style={{ width:44, height:8, borderRadius:4, background:'var(--g50)', animation:'shimmer 1.4s infinite' }} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═════════════════════════════════════════════════════════════
export default function HomeStoriesStrip({ onToast }: { onToast: (m: string) => void }) {
  const [stories,  setStories]  = useState<BoutiqueStory[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [openShop, setOpenShop] = useState<number | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

  // ── Fetch ──────────────────────────────────────────────────
  useEffect(() => {
    apiFetch<ApiStory[]>('/public/stories', { public: true })
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setStories(list.map((s, i) => {
          const pair = COLOR_PAIRS[i % COLOR_PAIRS.length];
          return {
            id:       s.companyId,
            shopNom:  s.shopNom,
            shopLogo: s.shopLogo,
            couleur1: pair.c1,
            couleur2: pair.c2,
            online:   s.online,
            hasPromo: s.hasPromo,
            lu:       false,
            slides:   s.slides,
          };
        }));
      })
      .catch(() => setStories([]))
      .finally(() => setLoading(false));
  }, []);

  // ── Drag-to-scroll ─────────────────────────────────────────
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

  // ── Navigation ─────────────────────────────────────────────
  const openStory = (idx: number) => {
    setStories(prev => prev.map((s, i) => i === idx ? { ...s, lu: true } : s));
    setOpenShop(idx);
    setSlideIdx(0);
  };

  const currentStory = openShop !== null ? stories[openShop] : null;
  const totalSlides  = currentStory?.slides.length ?? 0;

  const goNextSlide = useCallback(() => {
    if (slideIdx < totalSlides - 1) {
      setSlideIdx(s => s + 1);
    } else if (openShop !== null && openShop < stories.length - 1) {
      setStories(prev => prev.map((s, i) => i === openShop + 1 ? { ...s, lu: true } : s));
      setOpenShop(openShop + 1);
      setSlideIdx(0);
    } else {
      setOpenShop(null);
    }
  }, [slideIdx, totalSlides, openShop, stories.length]);

  const goPrevSlide = useCallback(() => {
    if (slideIdx > 0) {
      setSlideIdx(s => s - 1);
    } else if (openShop !== null && openShop > 0) {
      const prev = stories[openShop - 1];
      setOpenShop(openShop - 1);
      setSlideIdx(prev.slides.length - 1);
    }
  }, [slideIdx, openShop, stories]);

  const closeViewer = useCallback(() => { setOpenShop(null); setSlideIdx(0); }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (openShop === null) return;
      if (e.key === 'Escape')     closeViewer();
      if (e.key === 'ArrowRight') goNextSlide();
      if (e.key === 'ArrowLeft')  goPrevSlide();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [openShop, closeViewer, goNextSlide, goPrevSlide]);

  // ── Ne rien afficher si chargement terminé et aucune story ─
  if (!loading && stories.length === 0) return null;

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      <section className={styles.section}>

        {/* En-tête */}
        <div className={styles.secHd}>
          <div className={styles.secLeft}>
            <div className={styles.secIc}>✨</div>
            <div>
              <div className={styles.secTitle}>Stories des boutiques</div>
              <div className={styles.secSub}>Produits phares mis en avant par nos partenaires</div>
            </div>
          </div>
          <button className={styles.secLink} onClick={() => onToast('📖 Toutes les stories')}>
            Voir tout <i className="fas fa-arrow-right" />
          </button>
        </div>

        {/* Bande scrollable */}
        <div className={styles.strip}>
          <div className={styles.fadeLeft} />
          <div
            className={styles.scroller}
            ref={stripRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {/* Skeletons */}
            {loading && Array.from({ length: 6 }).map((_, i) => <StorySkeleton key={i} />)}

            {/* Bulles boutiques */}
            {!loading && stories.map((boutique, i) => (
              <button
                key={boutique.id}
                className={`${styles.storyBtn} ${boutique.lu ? styles.storyLu : ''}`}
                onClick={() => openStory(i)}
                title={`Stories de ${boutique.shopNom}`}
              >
                <div
                  className={styles.storyRing}
                  style={{
                    background: boutique.lu
                      ? 'var(--g300,#D1D5DB)'
                      : `linear-gradient(135deg,${boutique.couleur1},${boutique.couleur2})`,
                    padding: boutique.lu ? '2px' : '2.5px',
                  }}
                >
                  <div className={styles.storyCircle} style={{ background: `${boutique.couleur1}12` }}>
                    {/* Logo ou emoji */}
                    {boutique.shopLogo
                      ? <img src={boutique.shopLogo} alt={boutique.shopNom}
                          style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
                        />
                      : <span className={styles.shopEmoji}>🏪</span>
                    }

                    {/* Badge promo */}
                    {boutique.hasPromo && (
                      <div className={styles.storyBadge} style={{ background:'#FF3B3B' }}>🔥</div>
                    )}

                    {/* Indicateur en ligne */}
                    {boutique.online && <div className={styles.onlineDot} />}
                  </div>
                </div>

                <span className={styles.shopLabel}>{boutique.shopNom}</span>
                <span className={styles.slidesCnt}>
                  {boutique.slides.length} produit{boutique.slides.length > 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>
          <div className={styles.fadeRight} />

          <button className={`${styles.navArrow} ${styles.navLeft}`}
            onClick={() => stripRef.current?.scrollBy({ left:-360, behavior:'smooth' })}>
            <i className="fas fa-chevron-left" />
          </button>
          <button className={`${styles.navArrow} ${styles.navRight}`}
            onClick={() => stripRef.current?.scrollBy({ left:360, behavior:'smooth' })}>
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      </section>

      {/* Viewer */}
      {openShop !== null && currentStory && (
        <HomeStoryViewer
          boutique={currentStory}
          allBoutiques={stories}
          shopIdx={openShop}
          slideIdx={slideIdx}
          onNextSlide={goNextSlide}
          onPrevSlide={goPrevSlide}
          onClose={closeViewer}
          onToast={onToast}
        />
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════════
// VIEWER PLEIN ÉCRAN
// ═════════════════════════════════════════════════════════════
interface ViewerProps {
  boutique:     BoutiqueStory;
  allBoutiques: BoutiqueStory[];
  shopIdx:      number;
  slideIdx:     number;
  onNextSlide:  () => void;
  onPrevSlide:  () => void;
  onClose:      () => void;
  onToast:      (m: string) => void;
}

function HomeStoryViewer({
  boutique, allBoutiques, shopIdx, slideIdx,
  onNextSlide, onPrevSlide, onClose, onToast,
}: ViewerProps) {
  const navigate = useNavigate();
  const slide    = boutique.slides[slideIdx];
  const [prog,   setProg]   = useState(0);
  const animRef  = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  // ── Barre de progression ─────────────────────────────────
  useEffect(() => {
    setProg(0);
    startRef.current = null;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const pct = Math.min(100, ((now - startRef.current) / slide.duree) * 100);
      setProg(pct);
      if (pct < 100) animRef.current = requestAnimationFrame(tick);
      else           onNextSlide();
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [shopIdx, slideIdx]);

  // ── Swipe ────────────────────────────────────────────────
  const touchStart = useRef(0);

  const BADGE_CFG: Record<string, { label: string; bg: string }> = {
    promo: { label:'🔥 Promo',     bg:'#FF3B3B' },
    new:   { label:'✨ Nouveau',   bg:'#1A4FC4' },
    flash: { label:'⚡ Flash',     bg:'#7C3AED' },
    top:   { label:'⭐ Top Vente', bg:'#B45309' },
  };
  const badge = slide.badge ? BADGE_CFG[slide.badge] : null;

  return (
    <div
      className={styles.viewer}
      onClick={onClose}
      onTouchStart={e => { touchStart.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        const diff = touchStart.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) diff > 0 ? onNextSlide() : onPrevSlide();
      }}
    >
      {/* Fond flouté */}
      <div className={styles.viewerBg}
        style={{ background:`radial-gradient(ellipse at center,${boutique.couleur1}33,#0B1F3A 65%)` }} />

      {/* Carte */}
      <div className={styles.viewerCard} onClick={e => e.stopPropagation()}>

        {/* Barres de progression */}
        <div className={styles.progBars}>
          {boutique.slides.map((_, i) => (
            <div key={i} className={styles.progBar}>
              <div className={styles.progFill} style={{
                width:      i < slideIdx ? '100%' : i === slideIdx ? `${prog}%` : '0%',
                background: boutique.couleur1,
              }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className={styles.viewerHd}>
          {/* Miniatures des boutiques voisines */}
          <div className={styles.shopRow}>
            {allBoutiques.slice(
              Math.max(0, shopIdx - 2),
              Math.min(allBoutiques.length, shopIdx + 3),
            ).map((b, i) => {
              const realIdx  = Math.max(0, shopIdx - 2) + i;
              const isActive = realIdx === shopIdx;
              return (
                <div key={b.id}
                  className={`${styles.shopMini} ${isActive ? styles.shopMiniActive : ''}`}
                  style={{ borderColor: isActive ? boutique.couleur1 : 'transparent' }}
                >
                  {b.shopLogo
                    ? <img src={b.shopLogo} alt={b.shopNom}
                        style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
                      />
                    : <span>🏪</span>
                  }
                </div>
              );
            })}
          </div>

          {/* Infos boutique */}
          <div className={styles.viewerShopInfo}>
            <div className={styles.viewerShopNom}>{boutique.shopNom}</div>
            <div className={styles.viewerShopSub}>
              <span className={styles.viewerDot}
                style={{ background: boutique.online ? '#10B981' : '#9CA3AF' }} />
              {boutique.online ? 'En ligne maintenant' : 'Vu récemment'}
              <span className={styles.viewerSep}>·</span>
              {slideIdx + 1}/{boutique.slides.length}
            </div>
          </div>

          <button className={styles.viewerClose} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Visuel produit */}
        <div className={styles.viewerVisual} style={{ background:`${boutique.couleur1}18` }}>
          {slide.img
            ? <img src={slide.img} alt={slide.produit} className={styles.viewerImg}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
              />
            : <span className={styles.viewerEmoji}>{slide.emoji}</span>
          }
          <div className={styles.viewerRing} style={{ borderColor:`${boutique.couleur1}55` }} />
        </div>

        {/* Infos produit */}
        <div className={styles.viewerInfo}>
          {badge && (
            <span className={styles.viewerBadge} style={{ background:badge.bg }}>
              {badge.label}
            </span>
          )}
          <div className={styles.viewerProduit}>{slide.produit}</div>
          <div className={styles.viewerPrixRow}>
            <span className={styles.viewerPrix} style={{ color:boutique.couleur1 }}>{slide.prix}</span>
            {slide.prixBarre && <span className={styles.viewerPrixBarre}>{slide.prixBarre}</span>}
          </div>
          {slide.tag && (
            <div className={styles.viewerTag}>
              <i className="fas fa-bolt" /> {slide.tag}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={styles.viewerActions}>
          <button
            className={styles.vaMain}
            onClick={() => { onClose(); navigate(`/produit/${slide.productId}`); }}
          >
            <i className="fas fa-eye" /> Voir le produit
          </button>
          <button
            className={styles.vaSecond}
            onClick={() => { onClose(); navigate(`/boutique/${boutique.id}`); }}
          >
            <i className="fas fa-store" /> La boutique
          </button>
          <button
            className={styles.vaShare}
            onClick={() => {
              navigator.clipboard?.writeText(`${window.location.origin}/produit/${slide.productId}`);
              onToast('🔗 Lien copié !');
            }}
            title="Partager"
          >
            <i className="fas fa-share-nodes" />
          </button>
        </div>
      </div>

      {/* Flèches prev / next */}
      {(slideIdx > 0 || shopIdx > 0) && (
        <button className={`${styles.vNav} ${styles.vNavL}`}
          onClick={e => { e.stopPropagation(); onPrevSlide(); }}>
          <i className="fas fa-chevron-left" />
        </button>
      )}
      {(slideIdx < boutique.slides.length - 1 || shopIdx < allBoutiques.length - 1) && (
        <button className={`${styles.vNav} ${styles.vNavR}`}
          onClick={e => { e.stopPropagation(); onNextSlide(); }}>
          <i className="fas fa-chevron-right" />
        </button>
      )}
    </div>
  );
}
