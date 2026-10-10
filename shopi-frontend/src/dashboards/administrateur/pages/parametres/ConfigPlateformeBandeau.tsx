/* ================================================================
 * FICHIER : pages/parametres/ConfigPlateformeBandeau.tsx
 *
 * Bandeau des sections Entreprises / Livreurs / Partenaires / Validations.
 *
 * SÉCURITÉ (audit 2026-09) — ces sections modifiaient une configuration
 * UNIQUE pour toute la plateforme (dont les commissions lues par le moteur
 * de paiement) : n'importe quel admin de zone la réécrivait pour toutes les
 * zones. Le serveur réserve désormais la modification au super-admin (PUT
 * @Roles(SUPER_ADMIN)) : l'admin de zone la consulte seulement.
 *
 * `sansEffet` : options enregistrées mais encore lues par aucune partie de
 * Shoneya (validation automatique, règles, bonus…) — annoncées
 * « bientôt disponible » plutôt que de laisser croire qu'elles agissent.
 * ================================================================ */

interface Props {
  sansEffet?: boolean;
}

export default function ConfigPlateformeBandeau({ sansEffet = false }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      background: 'var(--g50, #F5F5F5)', border: '1px solid var(--bdr, #E4E4E7)',
      borderRadius: 10, padding: '10px 16px', margin: '0 0 16px',
      fontSize: 12.5, fontWeight: 600, color: 'var(--t2, #52525B)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <i className="fas fa-lock" style={{ color: 'var(--t3, #71717A)' }} />
        Configuration commune à toute la plateforme, gérée par le super-admin : consultation uniquement.
      </div>
      {sansEffet && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-hourglass-half" style={{ color: 'var(--amber, #F59E0B)' }} />
          Ces options ne sont pas encore appliquées par Shoneya — bientôt disponible.
        </div>
      )}
    </div>
  );
}
