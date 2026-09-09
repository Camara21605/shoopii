/**
 * src/shared/messagerie/components/MediaViewer.tsx
 *
 * Visionneuse plein écran IN-APP pour les images/vidéos/audios partagés en
 * messagerie — remplace `window.open(url, '_blank')` qui faisait quitter
 * Shoneya vers un nouvel onglet/l'URL Cloudinary brute (voir MessageBubble.
 * tsx et InfoPanel.tsx). Le média reste affiché AU-DESSUS de la messagerie,
 * pas sur une autre page ni un autre site.
 *
 * Navigation ← → : quand plusieurs médias sont ouverts ensemble (ex. depuis
 * "Médias partagés" dans InfoPanel), des flèches permettent de les parcourir
 * sans refermer la visionneuse — l'index courant est un état interne, remis
 * à `initialIndex` à chaque nouvelle ouverture (voir l'effet ci-dessous).
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cldChatImage } from '../utils/chatUtils';
import VoicePlayer from './VoicePlayer';
import s from '../styles/MediaViewer.module.css';

export interface MediaViewerItem {
  url:  string;
  type: 'image' | 'video' | 'audio';
  name?: string;
  date?: string;
}

interface Props {
  /** Liste des médias navigables ensemble (un seul élément = pas de flèches). */
  items:        MediaViewerItem[];
  /** Index de départ dans `items` — celui sur lequel l'utilisateur a cliqué. */
  initialIndex: number;
  onClose:      () => void;
}

export default function MediaViewer({ items, initialIndex, onClose }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(initialIndex);

  /* Ré-aligne l'index affiché à chaque nouvelle ouverture (nouveau clic
   * pendant que la visionneuse est déjà montée, ou remontage). */
  useEffect(() => { setIndex(initialIndex); }, [initialIndex]);

  const item    = items[index] ?? null;
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  const goPrev = useCallback(() => setIndex(i => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIndex(i => Math.min(items.length - 1, i + 1)), [items.length]);

  /* Échap pour fermer, ← → pour naviguer — comportement attendu de toute
   * visionneuse plein écran avec plusieurs médias. */
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')          onClose();
      else if (e.key === 'ArrowLeft')  goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose, goPrev, goNext]);

  if (!item) return null;

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.hd} onClick={e => e.stopPropagation()}>
        <div className={s.hdInfo}>
          {item.name && <div className={s.hdName}>{item.name}</div>}
          {item.date && <div className={s.hdDate}>{item.date}</div>}
          {items.length > 1 && (
            <div className={s.hdCount}>{index + 1} / {items.length}</div>
          )}
        </div>
        <div className={s.hdActs}>
          <a
            className={s.hdBtn}
            href={item.url}
            download={item.name ?? true}
            target="_blank" rel="noopener noreferrer"
            title={t('messagerie.mediaViewer.telecharger')}
            onClick={e => e.stopPropagation()}
          >
            <i className="fas fa-download" />
          </a>
          <button className={s.hdBtn} onClick={onClose} title={t('messagerie.mediaViewer.fermer')}>
            <i className="fas fa-xmark" />
          </button>
        </div>
      </div>

      {/* ── Flèches de navigation — visibles seulement s'il y a plusieurs médias ── */}
      {hasPrev && (
        <button
          className={`${s.navBtn} ${s.navPrev}`}
          onClick={e => { e.stopPropagation(); goPrev(); }}
          title={t('messagerie.mediaViewer.precedent')}
          aria-label={t('messagerie.mediaViewer.precedent')}
        >
          <i className="fas fa-chevron-left" />
        </button>
      )}
      {hasNext && (
        <button
          className={`${s.navBtn} ${s.navNext}`}
          onClick={e => { e.stopPropagation(); goNext(); }}
          title={t('messagerie.mediaViewer.suivant')}
          aria-label={t('messagerie.mediaViewer.suivant')}
        >
          <i className="fas fa-chevron-right" />
        </button>
      )}

      <div className={s.body}>
        {item.type === 'image' && (
          <img
            key={item.url}
            src={cldChatImage(item.url, 1600)!}
            alt={item.name ?? ''}
            className={s.mediaEl}
            onClick={e => e.stopPropagation()}
          />
        )}
        {item.type === 'video' && (
          <video
            key={item.url}
            src={item.url}
            controls
            autoPlay
            className={s.mediaEl}
            onClick={e => e.stopPropagation()}
          />
        )}
        {item.type === 'audio' && (
          <div key={item.url} className={s.audioWrap} onClick={e => e.stopPropagation()}>
            <VoicePlayer url={item.url} isMe={false} />
          </div>
        )}
      </div>
    </div>
  );
}
