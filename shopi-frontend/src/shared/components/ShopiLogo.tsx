/* ============================================================
 * FICHIER : src/shared/components/ShopiLogo.tsx
 * MODULE  : Shared
 * ROLE    : Logo Shopi en SVG inline — réutilisable partout.
 * AUTEUR  : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-19
 * ============================================================ */

interface ShopiLogoProps {
  size?: number;
}

export default function ShopiLogo({ size = 120 }: ShopiLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="shopiBlueShared" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#42A5F5" />
          <stop offset="100%" stopColor="#1565C0" />
        </linearGradient>
        <clipPath id="logoClipShared">
          <rect width="200" height="200" rx="40" />
        </clipPath>
      </defs>

      {/* Fond bleu arrondi */}
      <rect width="200" height="200" rx="40" fill="url(#shopiBlueShared)" />

      {/* S — arc supérieur : gauche → droite */}
      <path
        d="M 36 105 C 36 55, 90 32, 148 32"
        stroke="white"
        strokeWidth="26"
        strokeLinecap="round"
        fill="none"
      />
      <polygon points="148,16 172,32 148,48" fill="white" />

      {/* S — arc inférieur : droite → gauche */}
      <path
        d="M 164 105 C 164 155, 110 168, 52 168"
        stroke="white"
        strokeWidth="26"
        strokeLinecap="round"
        fill="none"
      />
      <polygon points="52,152 28,168 52,184" fill="white" />

      {/* Icône caddie */}
      <g transform="translate(54, 46)" stroke="#1565C0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="0,6 6,6 10,26 32,26 35,14 10,14" fill="none" />
        <circle cx="14" cy="31" r="3.5" fill="#1565C0" stroke="none" />
        <circle cx="28" cy="31" r="3.5" fill="#1565C0" stroke="none" />
        <line x1="17" y1="14" x2="17" y2="24" strokeWidth="3" />
        <line x1="23" y1="14" x2="23" y2="24" strokeWidth="3" />
        <line x1="29" y1="14" x2="29" y2="24" strokeWidth="3" />
      </g>

      {/* Icône globe */}
      <g transform="translate(120, 112)" stroke="#1565C0" strokeWidth="3" fill="none">
        <circle cx="22" cy="22" r="20" />
        <ellipse cx="22" cy="22" rx="11" ry="20" />
        <line x1="2" y1="16" x2="42" y2="16" />
        <line x1="2" y1="28" x2="42" y2="28" />
      </g>

      {/* Signe dollar */}
      <text
        x="92"
        y="126"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Arial Black', Arial, sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="#1565C0"
      >
        $
      </text>

      {/* Texte SHOPI */}
      <text
        x="100"
        y="191"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Arial Black', 'Arial Bold', Arial, sans-serif"
        fontSize="25"
        fontWeight="900"
        fill="white"
        letterSpacing="4"
      >
        SHOPI
      </text>
    </svg>
  );
}
