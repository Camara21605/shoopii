/* ============================================================
 * FICHIER : src/shared/components/ShoneyaLogo.tsx
 * MODULE  : Shared
 * ROLE    : Logo Shoneya — image statique (public/shoneya-logo.webp),
 *           réutilisable partout. Icône carrée, fond noir plein (même
 *           image que favicon/icônes PWA), coins légèrement arrondis.
 * AUTEUR  : Shopi03
 * DERNIERE MISE A JOUR : 2026-10-12 — WebP 256 px, 2 Ko (au lieu
 *           d'un PNG 1080 px / 42 Ko pour un affichage à 128 px max),
 *           servi depuis public/ et mis en cache par le service worker.
 * ============================================================ */

const logoSrc = '/shoneya-logo.webp';

interface ShoneyaLogoProps {
  size?: number;
}

export default function ShoneyaLogo({ size = 120 }: ShoneyaLogoProps) {
  return (
    <img
      src={logoSrc}
      alt="Shoneya"
      width={size}
      height={size}
      style={{ display: 'block', width: size, height: size, borderRadius: size * 0.18 }}
    />
  );
}
