/* ============================================================
 * FICHIER : src/shared/location/components/AddressCard.tsx
 * RÔLE    : Carte d'affichage d'une adresse client.
 *           Boutons : modifier, supprimer, définir par défaut.
 * ============================================================ */

import React from 'react';
import '../styles/location.css';
import type { ClientAddress } from '../types/location.types';
import { TYPE_ADRESSE_ICONS, TYPE_ADRESSE_LABELS } from '../types/location.types';

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
  const icon  = TYPE_ADRESSE_ICONS[address.typeAdresse] ?? '📌';
  const label = TYPE_ADRESSE_LABELS[address.typeAdresse] ?? address.typeAdresse;

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
            <span className="loc-address-card__badge">Par défaut</span>
          )}
        </div>
        <div className="loc-address-card__text">
          <div>{formatted || 'Adresse incomplète'}</div>
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
              title="Définir par défaut"
              onClick={() => onSetDefault(address.id)}
            >
              <i className="fas fa-star" />
            </button>
          )}
          {onEdit && (
            <button
              className="loc-address-card__btn"
              title="Modifier"
              onClick={() => onEdit(address)}
            >
              <i className="fas fa-pen" />
            </button>
          )}
          {onDelete && !address.estDefaut && (
            <button
              className="loc-address-card__btn delete"
              title="Supprimer"
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
