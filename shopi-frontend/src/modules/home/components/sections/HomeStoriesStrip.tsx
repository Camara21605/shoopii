/*
 * ============================================================
 * FICHIER : src/modules/home/components/sections/HomeStoriesStrip.tsx
 *
 * RÔLE    : Stories multi-produits de la page d'accueil.
 *           Données réelles depuis GET /public/stories.
 *           Chaque PRODUIT = 1 bulle indépendante → ses propres
 *           images dans le viewer. Les stories de deux produits
 *           différents ne sont jamais mélangées dans la même bulle,
 *           même s'ils appartiennent à la même boutique — le titre
 *           affiché est celui du produit, pas celui de la boutique.
 * ============================================================
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch }         from '../../../../shared/services/apiFetch';
import { getRoleFromToken } from '../../../../shared/services/authUtils';
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

interface StorySlide {
  id:        string;
  productId: string;
  produit:   string;
  prix:      string;
  prixBarre: string | null;
  emoji:     string;
  img:       string;
  badge:     'promo' | 'new' | null;
  tag:       string | null;
  duree:     number;
}

// ── Types internes ────────────────────────────────────────────
// Une bulle = UN produit. Ses images/stories lui sont propres —
// jamais partagées ni mélangées avec celles d'un autre produit.
interface ProductStoryBubble {
  productId: string;
  produit:   string;
  companyId: string;
  shopNom:   string;
  shopLogo:  string | null;
  couleur1:  string;
  couleur2:  string;
  online:    boolean;
  hasPromo:  boolean;
  lu:        boolean;
  slides:    StorySlide[];
}

// ── API response (miroir du backend) ─────────────────────────
interface ApiStory {
  productId: string;
  produit:   string;
  companyId: string;
  shopNom:   string;
  shopLogo:  string | null;
  online:    boolean;
  hasPromo:  boolean;
  images:    StorySlide[];
}

// ── Skeleton ──────────────────────────────────────────────────
function StorySkeleton() {
  return (
    <div style={{
      width:108, height:180, borderRadius:16, flexShrink:0,
      background:'linear-gradient(90deg,var(--g100)25%,var(--g50)50%,var(--g100)75%)',
      backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite',
    }} />
  );
}

// ═════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═════════════════════════════════════════════════════════════
interface Props {
  onToast: (m: string) => void;
  /**
   * Fourni par la page boutique : filtre le flux sur CETTE seule boutique
   * (`GET /public/boutiques/:id/stories`, même forme de réponse que
   * `GET /public/stories`) — même carte, même viewer partout, jamais une
   * implémentation séparée pour la page boutique.
   */
  companyId?: string;
}

export default function HomeStoriesStrip({ onToast, companyId }: Props) {
  const { t } = useTranslation();
  const [bubbles,  setBubbles]  = useState<ProductStoryBubble[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [openIdx,  setOpenIdx]  = useState<number | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

  // ── Fetch (filtré sur companyId depuis la page boutique) ────
  useEffect(() => {
    const url = companyId ? `/public/boutiques/${companyId}/stories` : '/public/stories';
    apiFetch<ApiStory[]>(url, { public: true })
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setBubbles(list.map((s, i) => {
          const pair = COLOR_PAIRS[i % COLOR_PAIRS.length];
          return {
            productId: s.productId,
            produit:   s.produit,
            companyId: s.companyId,
            shopNom:   s.shopNom,
            shopLogo:  s.shopLogo,
            couleur1:  pair.c1,
            couleur2:  pair.c2,
            online:    s.online,
            hasPromo:  s.hasPromo,
            lu:        false,
            // Durée d'affichage fixe (30s), quel que soit ce que renvoie le backend —
            // l'utilisateur garde la main pour passer la story via flèches/swipe/clavier.
            slides:    s.images.map(sl => ({ ...sl, duree: 30000 })),
          };
        }));
      })
      .catch(() => setBubbles([]))
      .finally(() => setLoading(false));
  }, [companyId]);

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
    setBubbles(prev => prev.map((b, i) => i === idx ? { ...b, lu: true } : b));
    setOpenIdx(idx);
    setSlideIdx(0);
  };

  const currentBubble = openIdx !== null ? bubbles[openIdx] : null;
  const totalSlides    = currentBubble?.slides.length ?? 0;

  const goNextSlide = useCallback(() => {
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

  const goPrevSlide = useCallback(() => {
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
      if (openIdx === null) return;
      if (e.key === 'Escape')     closeViewer();
      if (e.key === 'ArrowRight') goNextSlide();
      if (e.key === 'ArrowLeft')  goPrevSlide();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [openIdx, closeViewer, goNextSlide, goPrevSlide]);

  // ── Ne rien afficher si chargement terminé et aucune story ─
  if (!loading && bubbles.length === 0) return null;

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      <section className={styles.section}>

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

            {/* Bulles produits (format rectangle façon Facebook) — 1 bulle = 1 produit */}
            {!loading && bubbles.map((bubble, i) => {
              const cover = bubble.slides[0]?.img || null;
              return (
                <button
                  key={bubble.productId}
                  className={`${styles.storyBtn} ${bubble.lu ? styles.storyLu : ''}`}
                  onClick={() => openStory(i)}
                  title={t('home.storiesStrip.storiesDe', { nom: bubble.produit })}
                >
                  <div
                    className={styles.storyRingRect}
                    style={{
                      background: bubble.lu
                        ? 'var(--g300,#D1D5DB)'
                        : `linear-gradient(135deg,${bubble.couleur1},${bubble.couleur2})`,
                    }}
                  >
                    <div className={styles.storyCard} style={{
                      background: cover ? '#111' : `linear-gradient(160deg,${bubble.couleur1},${bubble.couleur2})`,
                    }}>
                      {cover
                        ? <img src={cover} alt="" className={styles.storyCardImg}
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
                          />
                        : <span className={styles.storyCardEmoji}>📦</span>
                      }
                      <div className={styles.storyCardScrim} />

                      {/* Badge promo */}
                      {bubble.hasPromo && (
                        <div className={styles.storyBadge} style={{ background:'#FF3B3B' }}>🔥</div>
                      )}

                      {/* Avatar boutique — identifie la boutique propriétaire, le nom affiché reste celui du produit */}
                      <div className={styles.storyAvatarWrap}>
                        <div className={styles.storyAvatar} style={{ background: `${bubble.couleur1}12` }}>
                          {bubble.shopLogo
                            ? <img src={bubble.shopLogo} alt={bubble.shopNom}
                                style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}
                                onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
                              />
                            : <span className={styles.shopEmoji}>🏪</span>
                          }
                        </div>
                        {bubble.online && <div className={styles.onlineDot} />}
                      </div>

                      <span className={styles.shopLabel}>{bubble.produit}</span>
                    </div>
                  </div>
                </button>
              );
            })}
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
      {openIdx !== null && currentBubble && (
        <HomeStoryViewer
          bubble={currentBubble}
          allBubbles={bubbles}
          bubbleIdx={openIdx}
          slideIdx={slideIdx}
          onNextSlide={goNextSlide}
          onPrevSlide={goPrevSlide}
          onClose={closeViewer}
          onToast={onToast}
          hideBoutiqueLink={!!companyId}
        />
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════════
// VIEWER PLEIN ÉCRAN — toujours scopé à UN SEUL produit : passer
// au produit suivant/précédent change complètement de bulle, les
// images ne sont jamais mélangées entre deux produits différents.
// ═════════════════════════════════════════════════════════════
interface ViewerProps {
  bubble:      ProductStoryBubble;
  allBubbles:  ProductStoryBubble[];
  bubbleIdx:   number;
  slideIdx:    number;
  onNextSlide: () => void;
  onPrevSlide: () => void;
  onClose:     () => void;
  onToast:     (m: string) => void;
  /** true depuis la page boutique elle-même — le bouton "La boutique" y serait redondant. */
  hideBoutiqueLink?: boolean;
}

function HomeStoryViewer({
  bubble, allBubbles, bubbleIdx, slideIdx,
  onNextSlide, onPrevSlide, onClose, onToast, hideBoutiqueLink,
}: ViewerProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const slide    = bubble.slides[slideIdx];
  const [prog,   setProg]   = useState(0);
  const [liked,  setLiked]  = useState<Set<string>>(new Set());
  const animRef  = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const viewersOpenRef = useRef(false);
  const pauseStartRef  = useRef<number | null>(null);

  // Le viewer plein écran masque les widgets flottants globaux (ex: bouton d'aide "?")
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('fullscreen-overlay-toggle', { detail: { open: true } }));
    return () => { window.dispatchEvent(new CustomEvent('fullscreen-overlay-toggle', { detail: { open: false } })); };
  }, []);

  // Clé = id de la STORY (l'image précise), pas du produit — sinon aimer
  // une image marquerait comme "aimées" toutes les autres images du même produit.
  const isLiked = liked.has(slide.id);
  const toggleLike = () => {
    const wasLiked = isLiked;
    // Optimiste : le cœur réagit tout de suite, sans attendre le serveur.
    setLiked(prev => {
      const next = new Set(prev);
      wasLiked ? next.delete(slide.id) : next.add(slide.id);
      return next;
    });
    apiFetch<{ liked: boolean; likesCount: number }>(`/public/stories/${slide.id}/like`, { method: 'POST' })
      .then(res => {
        setLiked(prev => {
          const next = new Set(prev);
          res.liked ? next.add(slide.id) : next.delete(slide.id);
          return next;
        });
      })
      .catch((err: any) => {
        // Échec (pas connecté, réseau…) → on annule l'effet optimiste.
        setLiked(prev => {
          const next = new Set(prev);
          wasLiked ? next.add(slide.id) : next.delete(slide.id);
          return next;
        });
        onToast(err?.message || t('home.storiesStrip.jaimeEchec'));
      });
  };

  // ── "Qui a vu cette story" — réservé aux entreprises (propriétaire vérifié côté backend) ──
  const isCompanyRole = getRoleFromToken() === 'company';
  const [viewersOpen,    setViewersOpen]    = useState(false);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [viewers, setViewers] = useState<{ id: string; name: string; avatar: string | null; viewedAt: string; liked: boolean }[]>([]);

  const openViewers = () => {
    setViewersOpen(true);
    setViewersLoading(true);
    apiFetch<typeof viewers>(`/public/stories/${slide.id}/viewers`)
      .then(setViewers)
      .catch(() => {
        onToast(t('home.storiesStrip.vuesEchec'));
        setViewersOpen(false);
      })
      .finally(() => setViewersLoading(false));
  };

  useEffect(() => { viewersOpenRef.current = viewersOpen; }, [viewersOpen]);

  // ── Barre de progression (mise en pause tant que le panneau des vues est ouvert) ──
  useEffect(() => {
    setProg(0);
    setViewersOpen(false);
    startRef.current = null;
    pauseStartRef.current = null;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;

      if (viewersOpenRef.current) {
        if (pauseStartRef.current === null) pauseStartRef.current = now;
        animRef.current = requestAnimationFrame(tick);
        return;
      }
      if (pauseStartRef.current !== null) {
        startRef.current += now - pauseStartRef.current;
        pauseStartRef.current = null;
      }

      const pct = Math.min(100, ((now - startRef.current) / slide.duree) * 100);
      setProg(pct);
      if (pct < 100) animRef.current = requestAnimationFrame(tick);
      else           onNextSlide();
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [bubbleIdx, slideIdx]);

  // ── Enregistre la vue (visiteur connecté uniquement, no-op sinon) ──
  useEffect(() => {
    apiFetch(`/public/stories/${slide.id}/view`, { method: 'POST' }).catch(() => {});
  }, [slide.id]);

  // ── Swipe ────────────────────────────────────────────────
  const touchStart = useRef(0);

  const BADGE_CFG: Record<string, { label: string; bg: string }> = {
    promo: { label: t('home.storiesStrip.badgePromo'),   bg:'#FF3B3B' },
    new:   { label: t('home.storiesStrip.badgeNouveau'), bg:'#1A4FC4' },
    flash: { label: t('home.storiesStrip.badgeFlash'),   bg:'#7C3AED' },
    top:   { label: t('home.storiesStrip.badgeTop'),     bg:'#B45309' },
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
        style={{ background:`radial-gradient(ellipse at center,${bubble.couleur1}33,#0B1F3A 65%)` }} />

      {/* Carte — l'image de la story sert de fond, tous les contrôles flottent dessus */}
      <div className={styles.viewerCard} onClick={e => e.stopPropagation()}>

        {/* Visuel produit — plein cadre */}
        <div className={styles.viewerVisual} style={{ background:`${bubble.couleur1}18` }}>
          {slide.img
            ? <img src={slide.img} alt={slide.produit} className={styles.viewerImg}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
              />
            : <span className={styles.viewerEmoji}>{slide.emoji}</span>
          }
          <div className={styles.viewerRing} style={{ borderColor:`${bubble.couleur1}55` }} />
        </div>

        {/* Dégradés pour la lisibilité des contrôles sur l'image */}
        <div className={styles.viewerTopScrim} />
        <div className={styles.viewerBottomScrim} />

        {/* Barre du haut : progression (une par image de CE produit) + en-tête */}
        <div className={styles.viewerTopBar}>
          <div className={styles.progBars}>
            {bubble.slides.map((_, i) => (
              <div key={i} className={styles.progBar}>
                <div className={styles.progFill} style={{
                  width:      i < slideIdx ? '100%' : i === slideIdx ? `${prog}%` : '0%',
                  background: bubble.couleur1,
                }} />
              </div>
            ))}
          </div>

          <div className={styles.viewerHd}>
            {/* Miniatures des produits voisins (image de couverture de chaque produit) */}
            <div className={styles.shopRow}>
              {allBubbles.slice(
                Math.max(0, bubbleIdx - 2),
                Math.min(allBubbles.length, bubbleIdx + 3),
              ).map((b, i) => {
                const realIdx  = Math.max(0, bubbleIdx - 2) + i;
                const isActive = realIdx === bubbleIdx;
                const thumb    = b.slides[0]?.img;
                return (
                  <div key={b.productId}
                    className={`${styles.shopMini} ${isActive ? styles.shopMiniActive : ''}`}
                    style={{ borderColor: isActive ? bubble.couleur1 : 'transparent' }}
                  >
                    {thumb
                      ? <img src={thumb} alt={b.produit}
                          style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
                        />
                      : <span>📦</span>
                    }
                  </div>
                );
              })}
            </div>

            {/* Infos produit — le titre est celui du PRODUIT, pas de la boutique */}
            <div className={styles.viewerShopInfo}>
              <div className={styles.viewerShopNom}>{bubble.produit}</div>
              <div className={styles.viewerShopSub}>
                <span className={styles.viewerDot}
                  style={{ background: bubble.online ? '#10B981' : '#9CA3AF' }} />
                {bubble.shopNom}
                <span className={styles.viewerSep}>·</span>
                {slideIdx + 1}/{bubble.slides.length}
              </div>
            </div>

            {isCompanyRole && (
              <button className={styles.viewerViewersBtn} onClick={openViewers}
                title={t('home.storiesStrip.quiAVu')} aria-label={t('home.storiesStrip.quiAVu')}>
                <i className="fas fa-eye" />
              </button>
            )}

            <button className={styles.viewerClose} onClick={onClose}>
              <i className="fas fa-xmark" />
            </button>
          </div>
        </div>

        {/* Panneau "Qui a vu cette story" */}
        {viewersOpen && (
          <div className={styles.viewersSheet} onClick={() => setViewersOpen(false)}>
            <div className={styles.viewersPanel} onClick={e => e.stopPropagation()}>
              <div className={styles.viewersPanelHd}>
                <span>{t('home.storiesStrip.quiAVu')}</span>
                <button className={styles.viewerClose} onClick={() => setViewersOpen(false)}>
                  <i className="fas fa-xmark" />
                </button>
              </div>
              {viewersLoading ? (
                <div className={styles.viewersEmpty}>{t('home.storiesStrip.chargementVues')}</div>
              ) : viewers.length === 0 ? (
                <div className={styles.viewersEmpty}>{t('home.storiesStrip.aucuneVue')}</div>
              ) : (
                <div className={styles.viewersList}>
                  {viewers.map(v => (
                    <div key={v.id} className={styles.viewerRow}>
                      <div className={styles.viewerAva}>
                        {v.avatar
                          ? <img src={v.avatar} alt={v.name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
                          : <span>{v.name.trim().charAt(0).toUpperCase() || '?'}</span>
                        }
                      </div>
                      <span className={styles.viewerRowName}>{v.name}</span>
                      {v.liked && <i className={`fas fa-heart ${styles.viewerRowLiked}`} title={t('home.storiesStrip.jaime')} />}
                      <span className={styles.viewerRowTime}>
                        {new Date(v.viewedAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Barre du bas : infos produit + actions */}
        <div className={styles.viewerBottomBar}>
          <div className={styles.viewerInfo}>
            {badge && (
              <span className={styles.viewerBadge} style={{ background:badge.bg }}>
                {badge.label}
              </span>
            )}
            <div className={styles.viewerProduit}>{slide.produit}</div>
            <div className={styles.viewerPrixRow}>
              <span className={styles.viewerPrix} style={{ color:bubble.couleur1 }}>{slide.prix}</span>
              {slide.prixBarre && <span className={styles.viewerPrixBarre}>{slide.prixBarre}</span>}
            </div>
            {slide.tag && (
              <div className={styles.viewerTag}>
                <i className="fas fa-bolt" /> {slide.tag}
              </div>
            )}
          </div>

          <div className={styles.viewerActions}>
            <button
              className={styles.vaMain}
              onClick={() => { onClose(); navigate(`/produit/${slide.productId}`); }}
            >
              <i className="fas fa-eye" /> {t('home.storiesStrip.voirProduit')}
            </button>
            {!hideBoutiqueLink && (
              <button
                className={styles.vaSecond}
                onClick={() => { onClose(); navigate(`/boutique/${bubble.companyId}`); }}
              >
                <i className="fas fa-store" /> {t('home.storiesStrip.laBoutique')}
              </button>
            )}
            <button
              className={`${styles.vaLike} ${isLiked ? styles.vaLikeActive : ''}`}
              onClick={toggleLike}
              title={t('home.storiesStrip.jaime')}
              aria-label={t('home.storiesStrip.jaime')}
            >
              <i className={isLiked ? 'fas fa-heart' : 'far fa-heart'} />
            </button>
            <button
              className={styles.vaShare}
              onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/produit/${slide.productId}`);
                onToast(t('home.storiesStrip.lienCopieToast'));
              }}
              title={t('home.storiesStrip.partager')}
            >
              <i className="fas fa-share-nodes" />
            </button>
          </div>
        </div>
      </div>

      {/* Flèches prev / next */}
      {(slideIdx > 0 || bubbleIdx > 0) && (
        <button className={`${styles.vNav} ${styles.vNavL}`}
          onClick={e => { e.stopPropagation(); onPrevSlide(); }}>
          <i className="fas fa-chevron-left" />
        </button>
      )}
      {(slideIdx < bubble.slides.length - 1 || bubbleIdx < allBubbles.length - 1) && (
        <button className={`${styles.vNav} ${styles.vNavR}`}
          onClick={e => { e.stopPropagation(); onNextSlide(); }}>
          <i className="fas fa-chevron-right" />
        </button>
      )}
    </div>
  );
}
