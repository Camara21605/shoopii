/* ============================================================
 * FICHIER : src/shared/location/components/AddressCard.tsx
 * RÔLE    : Carte d'affichage d'une adresse client.
 *           Boutons : modifier, supprimer, définir par défaut.
 * ============================================================ */

import { useTranslation } from 'react-i18next';
import '../styles/location.css';
import type { ClientAddress } from '../types/location.types';
import { TYPE_ADRESSE_ICONS, getTypeAdresseLabels } from '../types/location.types';

interface AddressCardProps {
  address:       ClientAddress;
  onEdit?:       (address: ClientAddress) => void;
  onDelete?:     (id: string) => void;
  onSetDefault?: (id: string) => void;
  selected?:     boolean;
  onClick?:      (address: ClientAddress) => void;
}

export default function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  selected,
  onClick,
}: AddressCardProps) {
  const { t } = useTranslation();
  const icon  = TYPE_ADRESSE_ICONS[address.typeAdresse] ?? '📌';
  const label = getTypeAdresseLabels(t)[address.typeAdresse] ?? address.typeAdresse;

  const formatted = [
    address.rue,
    address.quartier,
    address.commune,
    address.ville,
    address.region,
    address.pays !== 'GN' ? address.pays : null,
  ].filter(Boolean).join(', ');

  return (
    <div
      className={`loc-address-card${address.estDefaut ? ' default' : ''}${selected ? ' default' : ''}`}
      onClick={() => onClick?.(address)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Icône */}
      <div className="loc-address-card__icon">{icon}</div>

      {/* Corps */}
      <div className="loc-address-card__body">
        <div className="loc-address-card__title">
          <span>{address.libelle || label}</span>
          {address.estDefaut && (
            <span className="loc-address-card__badge">{t('clientDashboard.addressCard.parDefaut')}</span>
          )}
        </div>
        <div className="loc-address-card__text">
          <div>{formatted || t('clientDashboard.addressCard.adresseIncomplete')}</div>
          {address.instructions && (
            <div style={{ marginTop: 3, fontStyle: 'italic', opacity: .8 }}>
              {address.instructions}
            </div>
          )}
          {address.telephone && (
            <div style={{ marginTop: 3 }}>
              <i className="fas fa-phone" style={{ marginRight: 4 }} />
              {address.telephone}
            </div>
          )}
          {address.latitude && address.longitude && (
            <div style={{ marginTop: 3, color: 'var(--blue)', fontSize: 11 }}>
              <i className="fas fa-map-pin" style={{ marginRight: 4 }} />
              {address.latitude.toFixed(4)}, {address.longitude.toFixed(4)}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {(onEdit || onDelete || onSetDefault) && (
        <div className="loc-address-card__actions" onClick={e => e.stopPropagation()}>
          {!address.estDefaut && onSetDefault && (
            <button
              className="loc-address-card__btn"
              title={t('clientDashboard.addressCard.definirParDefautTitle')}
              onClick={() => onSetDefault(address.id)}
            >
              <i className="fas fa-star" />
            </button>
          )}
          {onEdit && (
            <button
              className="loc-address-card__btn"
              title={t('clientDashboard.addressCard.modifierTitle')}
              onClick={() => onEdit(address)}
            >
              <i className="fas fa-pen" />
            </button>
          )}
          {onDelete && !address.estDefaut && (
            <button
              className="loc-address-card__btn delete"
              title={t('clientDashboard.addressCard.supprimerTitle')}
              onClick={() => onDelete(address.id)}
            >
              <i className="fas fa-trash" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
