/* ================================================================
 * FICHIER : src/dashboards/entreprise/components/BackgroundRemover.tsx
 *
 * Fenêtre « Retirer le fond » d'une photo produit (page Ajouter un
 * produit). Tout se passe dans le navigateur, sans IA ni service payant
 * — voir shared/utils/backgroundRemoval.ts pour l'algorithme.
 *
 *   - Suppression automatique à l'ouverture, aperçu Avant / Après ;
 *   - curseur « Sensibilité » (plus haut = efface plus de nuances du fond) ;
 *   - toucher une zone restante du fond dans « Après » l'efface aussi
 *     (ex. intérieur d'une anse) — « Annuler » retire la dernière ;
 *   - résultat sur fond blanc (recommandé pour une boutique) ou transparent ;
 *   - « Appliquer » rend l'image (Blob) au parent, qui l'envoie et
 *     remplace la photo d'origine dans la fiche.
 * ================================================================ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackDismiss } from '../../../shared/hooks/useBackDismiss';
import {
  estimateBackground, floodFromBorders, floodFromPoint, backgroundRatio, composeResult,
} from '../../../shared/utils/backgroundRemoval';
import s from '../styles/BackgroundRemover.module.css';

/** Taille max traitée (le serveur ramène de toute façon les photos produit à 800 px). */
const MAX_SIDE = 1000;
const DEFAULT_TOL = 22;

interface Props {
  /** URL de la photo (blob: locale ou Cloudinary — CORS autorisé). */
  src:     string;
  onClose: () => void;
  /** Reçoit l'image finale ; la fenêtre se ferme quand la promesse aboutit. */
  onApply: (file: File) => Promise<void>;
}

type Phase = 'loading' | 'ready' | 'error';

export default function BackgroundRemover({ src, onClose, onApply }: Props) {
  const { t } = useTranslation();
  useBackDismiss(true, onClose);

  const [phase,      setPhase]      = useState<Phase>('loading');
  const [tolerance,  setTolerance]  = useState(DEFAULT_TOL);
  const [background, setBackground] = useState<'white' | 'transparent'>('white');
  const [clicks,     setClicks]     = useState<{ x: number; y: number }[]>([]);
  const [ratio,      setRatio]      = useState(0);
  const [applying,   setApplying]   = useState(false);

  const srcRef    = useRef<ImageData | null>(null);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef  = useRef<HTMLCanvasElement>(null);

  /* ── Chargement de la photo dans un canvas (réduite à MAX_SIDE) ── */
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';          // Cloudinary autorise la relecture (CORS *)
    img.onload = () => {
      if (cancelled) return;
      const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k));
      const h = Math.max(1, Math.round(img.naturalHeight * k));
      const c = beforeRef.current;
      if (!c) return;
      c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) { setPhase('error'); return; }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        srcRef.current = ctx.getImageData(0, 0, w, h);
        setPhase('ready');
      } catch {
        setPhase('error');                   // image non relisible (CORS)
      }
    };
    img.onerror = () => { if (!cancelled) setPhase('error'); };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);

  /* ── Calcul du résultat à chaque réglage ── */
  useEffect(() => {
    const data = srcRef.current;
    const out  = afterRef.current;
    if (phase !== 'ready' || !data || !out) return;
    const frame = requestAnimationFrame(() => {
      const { width: w, height: h } = data;
      const bg   = estimateBackground(data.data, w, h);
      const mask = floodFromBorders(data.data, w, h, bg, tolerance);
      for (const c of clicks) floodFromPoint(data.data, w, h, mask, c.x, c.y, tolerance);
      setRatio(backgroundRatio(mask));
      out.width = w; out.height = h;
      out.getContext('2d')?.putImageData(composeResult(data, mask, background), 0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [phase, tolerance, background, clicks]);

  /* ── Toucher « Après » : effacer la zone touchée ── */
  const onAfterClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = afterRef.current;
    if (!c || phase !== 'ready') return;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width)  * c.width;
    const y = ((e.clientY - r.top)  / r.height) * c.height;
    setClicks(prev => [...prev, { x, y }]);
  }, [phase]);

  const apply = async () => {
    const c = afterRef.current;
    if (!c || applying) return;
    setApplying(true);
    try {
      const type = background === 'white' ? 'image/jpeg' : 'image/png';
      const blob = await new Promise<Blob | null>(res => c.toBlob(res, type, 0.92));
      if (!blob) throw new Error('toBlob');
      const file = new File([blob], `produit-sans-fond.${type === 'image/png' ? 'png' : 'jpg'}`, { type });
      await onApply(file);
    } catch {
      /* L'erreur d'envoi est affichée par le parent ; on reste ouvert pour réessayer. */
    } finally {
      setApplying(false);
    }
  };

  /* Avertissements utiles : fond non uni (presque rien retiré) ou objet effacé. */
  const warning = phase === 'ready'
    ? ratio < 0.05 ? t('ajouter.bgRemover.warnNothing')
      : ratio > 0.93 ? t('ajouter.bgRemover.warnTooMuch')
      : null
    : null;

  return (
    <div className={s.backdrop} role="dialog" aria-modal="true" aria-labelledby="bgr-title" onClick={e => { if (e.target === e.currentTarget && !applying) onClose(); }}>
      <div className={s.dialog}>
        <div className={s.head}>
          <div>
            <h2 id="bgr-title" className={s.title}><i className="fas fa-wand-magic-sparkles" /> {t('ajouter.bgRemover.title')}</h2>
            <p className={s.sub}>{t('ajouter.bgRemover.sub')}</p>
          </div>
          <button type="button" className={s.close} onClick={onClose} disabled={applying} aria-label={t('ajouter.bgRemover.close')}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {phase === 'error' ? (
          <div className={s.error}><i className="fas fa-triangle-exclamation" /> {t('ajouter.bgRemover.loadError')}</div>
        ) : (
          <>
            <div className={s.panes}>
              <figure className={s.pane}>
                <figcaption>{t('ajouter.bgRemover.before')}</figcaption>
                <div className={s.frame}>
                  <canvas ref={beforeRef} className={s.canvas} />
                  {phase === 'loading' && <div className={s.loading}><i className="fas fa-circle-notch fa-spin" /></div>}
                </div>
              </figure>
              <figure className={s.pane}>
                <figcaption>{t('ajouter.bgRemover.after')}</figcaption>
                <div className={`${s.frame} ${background === 'transparent' ? s.checker : s.whiteBg}`}>
                  <canvas ref={afterRef} className={`${s.canvas} ${s.clickable}`} onClick={onAfterClick}
                    title={t('ajouter.bgRemover.tapHint')} />
                </div>
              </figure>
            </div>

            <p className={s.hint}><i className="fas fa-hand-pointer" /> {t('ajouter.bgRemover.tapHint')}</p>
            {warning && <p className={s.warn}><i className="fas fa-circle-info" /> {warning}</p>}

            <div className={s.controls}>
              <label className={s.slider}>
                <span>{t('ajouter.bgRemover.sensitivity')} <b>{tolerance}</b></span>
                <input type="range" min={4} max={60} value={tolerance} disabled={phase !== 'ready'}
                  onChange={e => setTolerance(Number(e.target.value))} />
                <small>{t('ajouter.bgRemover.sensitivityHelp')}</small>
              </label>

              <div className={s.seg} role="radiogroup" aria-label={t('ajouter.bgRemover.resultBg')}>
                <button type="button" role="radio" aria-checked={background === 'white'}
                  className={background === 'white' ? s.segOn : ''} onClick={() => setBackground('white')}>
                  <i className="fas fa-square" /> {t('ajouter.bgRemover.white')}
                </button>
                <button type="button" role="radio" aria-checked={background === 'transparent'}
                  className={background === 'transparent' ? s.segOn : ''} onClick={() => setBackground('transparent')}>
                  <i className="fas fa-chess-board" /> {t('ajouter.bgRemover.transparent')}
                </button>
              </div>
            </div>
          </>
        )}

        <div className={s.footer}>
          <div className={s.footLeft}>
            <button type="button" className={s.secondary} onClick={() => setClicks(c => c.slice(0, -1))} disabled={!clicks.length || applying}>
              <i className="fas fa-rotate-left" /> {t('ajouter.bgRemover.undo')}
            </button>
            <button type="button" className={s.secondary} onClick={() => { setClicks([]); setTolerance(DEFAULT_TOL); }} disabled={applying || (clicks.length === 0 && tolerance === DEFAULT_TOL)}>
              {t('ajouter.bgRemover.reset')}
            </button>
          </div>
          <button type="button" className={s.primary} onClick={apply} disabled={phase !== 'ready' || applying}>
            {applying
              ? <><i className="fas fa-circle-notch fa-spin" /> {t('ajouter.bgRemover.applying')}</>
              : <><i className="fas fa-check" /> {t('ajouter.bgRemover.apply')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
