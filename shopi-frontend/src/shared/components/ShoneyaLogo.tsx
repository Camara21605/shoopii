/* ============================================================
 * FICHIER : src/shared/components/ShoneyaLogo.tsx
 * MODULE  : Shared
 * ROLE    : Logo Shoneya — image statique (src/assets/shoneya-logo.png),
 *           réutilisable partout. Fond transparent, ratio préservé
 *           (le PNG source n'est pas carré : hauteur > largeur).
 * AUTEUR  : Shopi03
 * DERNIERE MISE A JOUR : 2026-08-25
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
      style={{ display: 'block', width: size, height: 'auto' }}
    />
  );
}
