/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/StoriesStrip.tsx
 *
 * RÔLE    : Bande horizontale de stories produits scrollable.
 *           Données chargées depuis GET /public/boutiques/:id/stories.
 *           Chaque PRODUIT = 1 bulle rectangle indépendante (même
 *           format que la home page) → ses propres images dans le
 *           viewer. Les stories de deux produits différents ne sont
 *           jamais mélangées dans la même bulle.
 *
 * PROPS   : companyId, companyName, companyLogo, onToast
 * ============================================================
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { apiFetch }    from '../../../../../shared/services/apiFetch';
import styles from '../styles/StoriesStrip.module.css';

// ─── Palette de couleurs pour les rings (assignée par index) ───
const COLORS = ['#1A4FC4', '#7C3AED', '#0D9488', '#B45309', '#DC2626', '#059669', '#D97706', '#6366F1'];

// ─── Types ─────────────────────────────────────────────────────

interface StorySlide {
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

interface ApiStory {
  productId: string;
  produit:   string;
  images:    StorySlide[];
}

// Une bulle = UN produit. Ses images/stories lui sont propres —
// jamais partagées ni mélangées avec celles d'un autre produit.
interface ProductStoryBubble {
  productId: string;
  produit:   string;
  couleur:   string;
  lu:        boolean;
  slides:    StorySlide[];
}

interface Props {
  companyId:   string;
  companyName: string;
  companyLogo?: string | null;
  onToast:     (m: string) => void;
}

// ─── Badge configs ──────────────────────────────────────────────
function getBadgeCfg(t: TFunction): Record<string, { label: string; bg: string; c: string }> {
  return {
    promo: { label: t('boutiqueDetail.stories.badges.promo'), bg: '#FF3B3B', c: '#fff' },
    new:   { label: t('boutiqueDetail.stories.badges.new'),   bg: '#1A4FC4', c: '#fff' },
    top:   { label: t('boutiqueDetail.stories.badges.top'),   bg: '#B45309', c: '#fff' },
    flash: { label: t('boutiqueDetail.stories.badges.flash'), bg: '#7C3AED', c: '#fff' },
  };
}

// ─── Skeleton unique ───────────────────────────────────────────
function StorySkeleton() {
  return (
    <div style={{
      width: 108, height: 180, borderRadius: 16, flexShrink: 0,
      background: 'linear-gradient(90deg, var(--g100) 25%, var(--g50) 50%, var(--g100) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function StoriesStrip({ companyId, companyName, companyLogo, onToast }: Props) {
  const { t } = useTranslation();
  const [bubbles,  setBubbles]  = useState<ProductStoryBubble[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [openIdx,  setOpenIdx]  = useState<number | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const stripRef   = useRef<HTMLDivElement>(null);

  // ── Fetch stories (déjà groupées par produit côté backend) ────
  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    apiFetch<ApiStory[]>(`/public/boutiques/${companyId}/stories`, { public: true })
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setBubbles(list.map((s, i) => ({
          productId: s.productId,
          produit:   s.produit,
          couleur:   COLORS[i % COLORS.length],
          lu:        false,
          slides:    s.images,
        })));
      })
      .catch(() => setBubbles([]))
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

  // ── Navigation viewer (2 niveaux : bulle produit → image) ─────
  const openStory = (idx: number) => {
    setBubbles(prev => prev.map((b, i) => i === idx ? { ...b, lu: true } : b));
    setOpenIdx(idx);
    setSlideIdx(0);
  };

  const currentBubble = openIdx !== null ? bubbles[openIdx] : null;
  const totalSlides   = currentBubble?.slides.length ?? 0;

  const goNext = useCallback(() => {
    if (slideIdx < totalSlides - 1) {
      setSlideIdx(s => s + 1);
    } else if (openIdx !== null && openIdx < bubbles.length - 1) {
      setBubbles(prev => prev.map((b, i) => i === openIdx + 1 ? { ...b, lu: true } : b));
      setOpenIdx(openIdx + 1);
      setSlideIdx(0);
    } else {
      setOpenIdx(null);
    }
  }, [slideIdx, totalSlides, openIdx, bubbles.length]);

  const goPrev = useCallback(() => {
    if (slideIdx > 0) {
      setSlideIdx(s => s - 1);
    } else if (openIdx !== null && openIdx > 0) {
      const prev = bubbles[openIdx - 1];
      setOpenIdx(openIdx - 1);
      setSlideIdx(prev.slides.length - 1);
    }
  }, [slideIdx, openIdx, bubbles]);

  const closeViewer = useCallback(() => { setOpenIdx(null); setSlideIdx(0); }, []);

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
  if (!loading && bubbles.length === 0) return null;

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* ══ BANDE STORIES — bulles rectangle, une par produit ══ */}
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

          {/* Bulles produits réelles */}
          {!loading && bubbles.map((b, i) => {
            const cover   = b.slides[0]?.img || null;
            const hasPromo = b.slides.some(sl => sl.badge === 'promo');
            return (
              <button
                key={b.productId}
                className={`${styles.storyBtn} ${b.lu ? styles.storyLu : ''}`}
                onClick={() => openStory(i)}
                title={b.produit}
              >
                <div
                  className={styles.storyRingRect}
                  style={{
                    background: b.lu ? 'var(--g300,#D1D5DB)' : `linear-gradient(135deg,${b.couleur},${b.couleur}88)`,
                  }}
                >
                  <div className={styles.storyCard} style={{ background: cover ? '#111' : `linear-gradient(160deg,${b.couleur},${b.couleur}66)` }}>
                    {cover
                      ? <img src={cover} alt="" className={styles.storyCardImg}
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      : <span className={styles.storyCardEmoji}>{b.slides[0]?.emoji ?? '📦'}</span>
                    }
                    <div className={styles.storyCardScrim} />
                    {hasPromo && <div className={styles.storyBadgeDot}>🔥</div>}
                    <span className={styles.storyCardLabel}>{b.produit}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Flèches desktop */}
        <button className={`${styles.navArrow} ${styles.navLeft}`}
          onClick={() => stripRef.current?.scrollBy({ left: -320, behavior: 'smooth' })} aria-label={t('boutiqueDetail.stories.precedent')}>
          <i className="fas fa-chevron-left" />
        </button>
        <button className={`${styles.navArrow} ${styles.navRight}`}
          onClick={() => stripRef.current?.scrollBy({ left: 320, behavior: 'smooth' })} aria-label={t('boutiqueDetail.stories.suivant')}>
          <i className="fas fa-chevron-right" />
        </button>
      </div>

      {/* ══ VIEWER ══ */}
      {openIdx !== null && currentBubble && (
        <StoryViewer
          bubble={currentBubble}
          slideIdx={slideIdx}
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
// STORY VIEWER — modal plein écran, toujours scopé à UN produit
// (passer au produit suivant/précédent change complètement de bulle)
// ═══════════════════════════════════════════════════════════════
interface ViewerProps {
  bubble:      ProductStoryBubble;
  slideIdx:    number;
  companyName: string;
  companyLogo?: string | null;
  onNext:      () => void;
  onPrev:      () => void;
  onClose:     () => void;
  onToast:     (m: string) => void;
}

function StoryViewer({ bubble, slideIdx, companyName, companyLogo, onNext, onPrev, onClose, onToast }: ViewerProps) {
  const { t } = useTranslation();
  const BADGE_CFG = getBadgeCfg(t);
  const navigate = useNavigate();
  const slide    = bubble.slides[slideIdx];
  const [progress, setProgress] = useState(0);
  const animRef   = useRef<number | null>(null);
  const startRef  = useRef<number | null>(null);

  // ── Temps depuis la création ───────────────────────────────
  const tempsDepuis = (() => {
    const diff = Date.now() - new Date(slide.createdAt).getTime();
    const h    = Math.floor(diff / 3_600_000);
    const m    = Math.floor((diff % 3_600_000) / 60_000);
    if (h >= 24) return t('boutiqueDetail.stories.ilYA1j');
    if (h > 0)   return t('boutiqueDetail.stories.ilYAHeures', { h });
    if (m > 0)   return t('boutiqueDetail.stories.ilYAMinutes', { m });
    return t('boutiqueDetail.stories.aLInstant');
  })();

  // ── Barre de progression ──────────────────────────────────
  useEffect(() => {
    setProgress(0);
    startRef.current = null;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const pct = Math.min(100, ((now - startRef.current) / slide.duree) * 100);
      setProgress(pct);
      if (pct < 100) animRef.current = requestAnimationFrame(tick);
      else onNext();
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [bubble.productId, slideIdx, slide.duree, onNext]);

  // ── Swipe tactile ─────────────────────────────────────────
  const touchStart = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? onNext() : onPrev();
  };

  const badge = slide.badge ? BADGE_CFG[slide.badge] : null;

  return (
    <div className={styles.viewer} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClick={onClose}>

      {/* Fond flouté */}
      <div className={styles.viewerBg}
        style={{ background: `radial-gradient(ellipse at center, ${bubble.couleur}33 0%, #0B1F3A 70%)` }} />

      {/* Carte centrée */}
      <div className={styles.viewerCard} style={{ borderColor: `${bubble.couleur}44` }} onClick={e => e.stopPropagation()}>

        {/* Barres de progression — une par image de CE produit */}
        <div className={styles.progBars}>
          {bubble.slides.map((_, i) => (
            <div key={i} className={styles.progBar}>
              <div className={styles.progFill} style={{
                width:      i < slideIdx ? '100%' : i === slideIdx ? `${progress}%` : '0%',
                background: bubble.couleur,
                transition: i === slideIdx ? 'none' : undefined,
              }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className={styles.viewerHd}>
          <div className={styles.viewerAvatar} style={{ borderColor: bubble.couleur }}>
            {companyLogo
              ? <img src={companyLogo} alt={companyName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : <span style={{ fontSize: 18 }}>🏪</span>
            }
          </div>
          <div>
            <div className={styles.viewerShop}>{companyName}</div>
            <div className={styles.viewerTime}>{tempsDepuis} · {slideIdx + 1}/{bubble.slides.length}</div>
          </div>
          <button className={styles.viewerClose} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Visuel produit */}
        <div className={styles.viewerVisual} style={{ background: `${bubble.couleur}18` }}>
          <img src={slide.img} alt={slide.produit} className={styles.viewerImg}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <div className={styles.viewerRing} style={{ borderColor: `${bubble.couleur}55` }} />

          {/* ── Prix en overlay sur l'image ── */}
          {slide.prix && (
            <div className={styles.viewerPrixTag} style={{ background: bubble.couleur }}>
              <span className={styles.viewerPrixTagVal}>{slide.prix}</span>
              {slide.prixBarre && (
                <span className={styles.viewerPrixTagBarre}>{slide.prixBarre}</span>
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
          <div className={styles.viewerProduit}>{slide.produit}</div>
          {slide.caption && (
            <div className={styles.viewerTag}>
              <i className="fas fa-quote-left" /> {slide.caption}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={styles.viewerActions}>
          <button
            className={styles.vaBtn}
            onClick={() => { onClose(); navigate(`/produit/${slide.productId}`); }}
          >
            <i className="fas fa-eye" /> {t('boutiqueDetail.stories.voirLeProduit')}
          </button>
          <button
            className={styles.vaBtn2}
            onClick={() => onToast(t('boutiqueDetail.stories.ajouteAuPanierToast', { produit: slide.produit }))}
          >
            <i className="fas fa-bag-shopping" /> {t('boutiqueDetail.stories.ajouterPanier')}
          </button>
          <button
            className={styles.vaShare}
            onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/produit/${slide.productId}`); onToast(t('boutiqueDetail.stories.lienCopieToast')); }}
            title={t('boutiqueDetail.stories.partager')}
          >
            <i className="fas fa-share-nodes" />
          </button>
        </div>
      </div>

      {/* Flèche gauche */}
      {slideIdx > 0 && (
        <button className={`${styles.vNav} ${styles.vNavL}`} onClick={e => { e.stopPropagation(); onPrev(); }} aria-label={t('boutiqueDetail.stories.precedente')}>
          <i className="fas fa-chevron-left" />
        </button>
      )}

      {/* Flèche droite */}
      {slideIdx < bubble.slides.length - 1 && (
        <button className={`${styles.vNav} ${styles.vNavR}`} onClick={e => { e.stopPropagation(); onNext(); }} aria-label={t('boutiqueDetail.stories.suivante')}>
          <i className="fas fa-chevron-right" />
        </button>
      )}
    </div>
  );
}
