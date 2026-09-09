/**
 * src/shared/messagerie/components/WallpaperPicker.tsx
 *
 * Sélecteur de fond d'écran de la messagerie (façon Telegram) — galerie
 * FERMÉE de motifs préconçus par le système : l'utilisateur choisit
 * parmi cette liste, pas d'import d'image personnelle. Préférence
 * globale par utilisateur (voir useWallpaper), pas par conversation.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WALLPAPER_PRESETS, presetKey, resolveSwatchStyle, DEFAULT_WALLPAPER_STYLE } from '../utils/wallpaperPresets';
import s from '../styles/WallpaperPicker.module.css';

interface Props {
  current:  string | null;
  saving:   boolean;
  onChoose: (value: string | null) => Promise<void>;
  onClose:  () => void;
  onToast:  (msg: string, type?: string) => void;
}

export default function WallpaperPicker({ current, saving, onChoose, onClose, onToast }: Props) {
  const { t } = useTranslation();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function handleChoose(value: string | null, key: string) {
    if (saving) return;
    setBusyKey(key);
    try {
      await onChoose(value);
    } catch {
      onToast(t('messagerie.wallpaper.echecEnregistrement'), 'e');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={e => e.stopPropagation()}>
        <div className={s.header}>
          <div className={s.title}><i className="fas fa-image" /> {t('messagerie.wallpaper.titre')}</div>
          <button className={s.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>

        <div className={s.body}>
          <div className={s.grid}>
            {/* Défaut — noir + tête de lion, comme les autres motifs (voir DEFAULT_WALLPAPER_STYLE) */}
            <button
              className={`${s.swatch} ${!current ? s.swatchActive : ''}`}
              style={DEFAULT_WALLPAPER_STYLE}
              onClick={() => handleChoose(null, 'none')}
              disabled={busyKey !== null}
              title={t('messagerie.wallpaper.aucun')}
            >
              {!current && <span className={s.swatchCheck}><i className="fas fa-check" /></span>}
              {busyKey === 'none' ? <i className="fas fa-spinner fa-spin" /> : <span className={s.swatchLabel}>{t('messagerie.wallpaper.aucun')}</span>}
            </button>

            {WALLPAPER_PRESETS.map(preset => {
              const value = presetKey(preset.key);
              const active = current === value;
              return (
                <button
                  key={preset.key}
                  className={`${s.swatch} ${active ? s.swatchActive : ''}`}
                  style={resolveSwatchStyle(preset)}
                  onClick={() => handleChoose(value, preset.key)}
                  disabled={busyKey !== null}
                  title={preset.label}
                >
                  {active && <span className={s.swatchCheck}><i className="fas fa-check" /></span>}
                  {busyKey === preset.key
                    ? <i className="fas fa-spinner fa-spin" />
                    : <span className={s.swatchLabel}>{preset.label}</span>}
                </button>
              );
            })}
          </div>

          <p className={s.hint}>
            <i className="fas fa-circle-info" />
            {t('messagerie.wallpaper.hint')}
          </p>
        </div>
      </div>
    </div>
  );
}
