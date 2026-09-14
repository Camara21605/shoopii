/* ============================================================
 * FICHIER : src/shared/components/ShoneyaLogo.tsx
 * MODULE  : Shared
 * ROLE    : Logo Shoneya — image statique (src/assets/shoneya-logo.png),
 *           réutilisable partout. Icône carrée, fond noir plein (même
 *           image que favicon/icônes PWA), coins légèrement arrondis.
 * AUTEUR  : Shopi03
 * DERNIERE MISE A JOUR : 2026-09-14
 * ============================================================ */

import logoSrc from '../../assets/shoneya-logo.png';

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
