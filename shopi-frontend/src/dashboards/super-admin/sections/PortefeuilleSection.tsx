// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/sections/PortefeuilleSection.tsx
// ─────────────────────────────────────────────────────────────

import PortefeuilleStandalone from '../../../shared/components/portefeuille/PortefeuilleStandalone';

interface Props {
  isActive: boolean;
}

export default function PortefeuilleSection({ isActive }: Props) {
  if (!isActive) return null;

  return (
    <div className="section active">
      <PortefeuilleStandalone />
    </div>
  );
}
