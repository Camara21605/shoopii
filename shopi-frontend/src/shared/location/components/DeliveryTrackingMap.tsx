/* ============================================================
 * FICHIER : src/shared/location/components/DeliveryTrackingMap.tsx
 * RÔLE    : Carte de suivi en temps réel d'un livreur.
 *           S'abonne aux événements Socket.IO /location.
 * ============================================================ */

import React, { useState } from 'react';
import { Circle }           from 'react-leaflet';
import LocationMap          from './LocationMap';
import { useTrackDelivery } from '../hooks/useLocationSocket';
import { formatDistance, estimatedDuration } from '../utils/geoUtils';
import type { Coordinates }  from '../types/location.types';

interface DeliveryTrackingMapProps {
  deliveryId:     string;
  deliveryName?:  string;
  destination?:   Coordinates;
  height?:        string;
  darkMode?:      boolean;
}

export default function DeliveryTrackingMap({
  deliveryId,
  deliveryName = 'Livreur',
  destination,
  height   = '400px',
  darkMode = false,
}: DeliveryTrackingMapProps) {
  const { position, sharing } = useTrackDelivery(deliveryId);

  const center = position
    ? { latitude: position.latitude, longitude: position.longitude }
    : destination ?? { latitude: 9.537, longitude: -13.677 };

  const markers = [];

  if (position) {
    markers.push({
      id:       'delivery',
      position: { latitude: position.latitude, longitude: position.longitude },
      color:    'green' as const,
      emoji:    '🛵',
      popupContent: (
        <div>
          <strong>{deliveryName}</strong>
          {position.vitesseKmh && (
            <div style={{ marginTop: 4, fontSize: 12 }}>
              Vitesse : {position.vitesseKmh.toFixed(0)} km/h
            </div>
          )}
          {destination && (
            <div style={{ marginTop: 4, fontSize: 12 }}>
              Distance : {formatDistance(
                require('../utils/geoUtils').distanceKm(
                  { latitude: position.latitude, longitude: position.longitude },
                  destination,
                ),
              )}
            </div>
          )}
        </div>
      ),
    });
  }

  if (destination) {
    markers.push({
      id:       'destination',
      position: destination,
      color:    'red' as const,
      emoji:    '🏠',
      popupContent: <div>Adresse de livraison</div>,
    });
  }

  return (
    <div>
      {/* Statut partage */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        marginBottom: 10,
        fontSize:     13,
        fontWeight:   600,
        color:        sharing ? '#047857' : 'var(--t2)',
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%',
          background: sharing ? '#10b981' : 'var(--t3)',
          display: 'inline-block',
        }} />
        {sharing
          ? `${deliveryName} est en déplacement`
          : `${deliveryName} — position non partagée`}
        {position?.vitesseKmh && sharing && (
          <span style={{ marginLeft: 'auto', fontWeight: 400, color: 'var(--t2)' }}>
            {position.vitesseKmh.toFixed(0)} km/h
          </span>
        )}
      </div>

      <LocationMap
        center={center}
        zoom={15}
        height={height}
        darkMode={darkMode}
        markers={markers}
        showGpsMarker={position ?? undefined}
      />

      {/* Info distance/durée */}
      {position && destination && (
        <div style={{
          marginTop:    10,
          padding:      '10px 14px',
          background:   'var(--sky-2, #f0f4ff)',
          borderRadius: 10,
          display:      'flex',
          gap:          24,
          fontSize:     13,
        }}>
          <div>
            <div style={{ color: 'var(--t2)', fontSize: 11 }}>Distance</div>
            <div style={{ fontWeight: 700 }}>
              {formatDistance(
                require('../utils/geoUtils').distanceKm(
                  { latitude: position.latitude, longitude: position.longitude },
                  destination,
                ),
              )}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--t2)', fontSize: 11 }}>Temps estimé</div>
            <div style={{ fontWeight: 700 }}>
              {estimatedDuration(
                require('../utils/geoUtils').distanceKm(
                  { latitude: position.latitude, longitude: position.longitude },
                  destination,
                ),
              )}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--t2)', fontSize: 11 }}>Dernière MAJ</div>
            <div style={{ fontWeight: 700 }}>
              {position.ts ? new Date(position.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '–'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
