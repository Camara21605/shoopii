/* ============================================================
 * FICHIER : src/shared/components/BrandingLoader.tsx
 *
 * RÔLE : Applique l'identité de marque configurée par le super-admin
 * (Paramètres Plateforme > Général/Apparence) au site public — jusqu'ici
 * ces réglages se sauvegardaient en base sans jamais être lus par le
 * frontend public, qui affichait des valeurs codées en dur ("Shoneya",
 * couleur/logo statiques) quel que soit ce que le super-admin
 * configurait.
 *
 * Ne rend rien à l'écran — un seul GET /public/branding au montage,
 * puis effets de bord DOM directs (titre, favicon, variable CSS).
 * Échec silencieux : une panne réseau ne doit jamais bloquer le
 * rendu de l'app, les valeurs par défaut du index.html restent actives.
 * ============================================================ */

import { useEffect } from 'react';
import { apiFetch } from '../services/apiFetch';

interface BrandingResponse {
  platformName:    string;
  platformTagline: string | null;
  primaryColor:    string | null;
  logoUrl:         string | null;
  faviconUrl:      string | null;
}

export default function BrandingLoader() {
  useEffect(() => {
    let cancelled = false;

    apiFetch<BrandingResponse>('/public/branding')
      .then(branding => {
        if (cancelled) return;

        if (branding.platformName) {
          document.title = branding.platformTagline
            ? `${branding.platformName} — ${branding.platformTagline}`
            : branding.platformName;
        }

        if (branding.primaryColor) {
          document.documentElement.style.setProperty('--brand-primary', branding.primaryColor);
        }

        if (branding.faviconUrl) {
          let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = branding.faviconUrl;
        }
      })
      .catch(() => {
        // Silencieux — le site public reste fonctionnel avec les valeurs
        // par défaut de index.html (voir en-tête du fichier).
      });

    return () => { cancelled = true; };
  }, []);

  return null;
}
