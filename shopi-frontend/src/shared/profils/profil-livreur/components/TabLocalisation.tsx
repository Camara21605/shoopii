/* ================================================================
 * FICHIER : TabLocalisation.tsx
 *
 * Onglet localisation du profil livreur.
 * Affiche la position GPS en temps réel via Socket.IO /location.
 * Si le livreur ne partage pas sa position, un état vide explicatif.
 * ================================================================ */
import { lazy, Suspense } from 'react';
import { useTrackDelivery } from '../../../../shared/location/hooks/useLocationSocket';
import type { LivreurProfile }  from '../types';
import styles from '../styles/ProfilLivreur.module.css';
import '../../../../shared/location/styles/location.css';

const DeliveryTrackingMap = lazy(
  () => import('../../../../shared/location/components/DeliveryTrackingMap'),
);

interface Props {
  profile: LivreurProfile;
}

export default function TabLocalisation({ profile }: Props) {
  const { position, sharing } = useTrackDelivery(profile.id);

  return (
    <div className={styles.card}>

      {/* En-tête */}
      <div className={styles.ch}>
        <div className={styles.ct}>
          <i className="fas fa-location-dot" />
          Position en temps réel
        </div>

        {/* Badge statut partage */}
        <div style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          6,
          padding:      '4px 12px',
          borderRadius: 20,
          fontSize:     11,
          fontWeight:   700,
          background:   sharing ? '#D1FAE5' : '#F1F5F9',
          color:        sharing ? '#065F46' : '#94A3B8',
          border:       `1.5px solid ${sharing ? '#A7F3D0' : '#E2E8F0'}`,
        }}>
          <span style={{
            width:        7, height: 7, borderRadius: '50%',
            background:   sharing ? '#10B981' : '#CBD5E1',
            display:      'inline-block',
            animation:    sharing ? 'locPulse 2s ease infinite' : 'none',
          }} />
          {sharing ? 'Partage actif' : 'Hors ligne'}
        </div>
      </div>

      <div className={styles.cb} style={{ padding: 0 }}>

        {/* Carte */}
        <Suspense fallback={
          <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFF', borderRadius: 12 }}>
            <i className="fas fa-circle-notch fa-spin" style={{ color: '#047857', fontSize: 24 }} />
          </div>
        }>
          <DeliveryTrackingMap
            deliveryId={profile.id}
            deliveryName={profile.fullName}
            height="340px"
          />
        </Suspense>

        {/* Notice si non partagé */}
        {!sharing && !position && (
          <div style={{
            display:      'flex',
            alignItems:   'flex-start',
            gap:          12,
            padding:      '16px 18px',
            background:   '#FFFBEB',
            borderTop:    '1px solid #FDE68A',
          }}>
            <i className="fas fa-circle-info" style={{ color: '#D97706', marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 12.5, color: '#92400E', lineHeight: 1.6 }}>
              <strong>{profile.fullName}</strong> ne partage pas sa position pour le moment.
              La position s'affiche automatiquement lorsqu'une livraison est en cours.
            </div>
          </div>
        )}

        {/* Coordonnées si disponibles */}
        {position && (
          <div style={{
            display:        'flex',
            gap:            24,
            padding:        '12px 18px',
            borderTop:      '1px solid #F1F5F9',
            fontSize:       12,
            color:          '#5A7A9E',
            background:     '#F8FAFF',
          }}>
            <span><i className="fas fa-arrows-up-down" style={{ marginRight: 5, color: '#047857' }} />
              Lat : {position.latitude.toFixed(5)}
            </span>
            <span><i className="fas fa-arrows-left-right" style={{ marginRight: 5, color: '#047857' }} />
              Lng : {position.longitude.toFixed(5)}
            </span>
            {position.vitesseKmh && (
              <span><i className="fas fa-gauge-high" style={{ marginRight: 5, color: '#047857' }} />
                {position.vitesseKmh.toFixed(0)} km/h
              </span>
            )}
          </div>
        )}
      </div>

      {/* Injection CSS pour l'animation du point */}
      <style>{`
        @keyframes locPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,.5); }
          50%       { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
        }
      `}</style>
    </div>
  );
}
