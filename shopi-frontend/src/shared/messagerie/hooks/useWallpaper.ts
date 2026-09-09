/* ================================================================
 * FICHIER : src/shared/messagerie/hooks/useWallpaper.ts
 *
 * Fond d'écran de la messagerie — préférence globale par utilisateur
 * (façon Telegram : un seul fond, appliqué à toutes les conversations).
 * Galerie FERMÉE fournie par le système — pas d'import d'image
 * personnelle (voir wallpaperPresets.ts pour la liste des motifs).
 *
 * API :
 *   GET    /messagerie/wallpaper   → { wallpaper }
 *   PATCH  /messagerie/wallpaper   → { wallpaper } (body: { wallpaper })
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/apiFetch';

export function useWallpaper() {
  const [wallpaper, setWallpaperState] = useState<string | null>(null);
  const [loading,   setLoading]        = useState(true);
  const [saving,    setSaving]         = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ wallpaper: string | null }>('/messagerie/wallpaper')
      .then(res => { if (!cancelled) setWallpaperState(res.wallpaper); })
      .catch(() => { /* fond par défaut conservé en cas d'échec */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /** Choisit un motif de la galerie ("preset:xxx") ou revient au défaut (null). */
  const chooseWallpaper = useCallback(async (value: string | null) => {
    const previous = wallpaper;
    setWallpaperState(value); // optimiste
    setSaving(true);
    try {
      await apiFetch('/messagerie/wallpaper', { method: 'PATCH', body: { wallpaper: value } });
    } catch (err) {
      setWallpaperState(previous);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [wallpaper]);

  return { wallpaper, loading, saving, chooseWallpaper };
}
