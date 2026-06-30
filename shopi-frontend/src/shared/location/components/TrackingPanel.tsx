/* ============================================================
 * FICHIER : src/shared/location/components/TrackingPanel.tsx
 *
 * RÔLE : Panneau d'informations du suivi d'une commande.
 *        Affiche : distance, durée, ETA, statuts des acteurs.
 * ============================================================ */

import type { ActorPosition, RouteResult } from '../services/routingApi';
import type { DeliveryPosition }           from '../types/location.types';
import '../styles/location.css';

interface Props {
  actors:       ActorPosition[];
  route:        RouteResult | null;
  livePosition: DeliveryPosition | null;
  numero:       string;
  status:       string;
  deliveryLive: boolean;
}

const ROLE_META = {
  vendor:   { icon: 'fa-store',          color: '#047857', label: 'Boutique',  bg: '#D1FAE5' },
  delivery: { icon: 'fa-motorcycle',     color: '#1A4FC4', label: 'Livreur',   bg: '#DBEAFE' },
  client:   { icon: 'fa-house',          color: '#7C3AED', label: 'Destination', bg: '#EDE9FE' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:            { label: 'En attente',      color: '#94A3B8' },
  PAID:               { label: 'Payée',           color: '#0EA5E9' },
  IN_PROGRESS:        { label: 'En cours',        color: '#F59E0B' },
  AWAITING_CLIENT:    { label: 'Livraison proche', color: '#10B981' },
  DELIVERED:          { label: 'Livrée',          color: '#047857' },
  CANCELLED:          { label: 'Annulée',         color: '#EF4444' },
};

function etaTime(durationS: number): string {
  const d = new Date();
  d.setSeconds(d.getSeconds() + durationS);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function TrackingPanel({
  actors, route, livePosition, numero, status, deliveryLive,
}: Props) {
  const statusInfo = STATUS_LABELS[status] ?? { label: status, color: '#94A3B8' };

  return (
    <div style={{
      background:   '#fff',
      borderRadius: 16,
      boxShadow:    '0 4px 24px rgba(11,31,58,.10)',
      overflow:     'hidden',
      fontFamily:   'var(--fb, "DM Sans", sans-serif)',
    }}>

      {/* ── En-tête commande ─────────────────────────────────── */}
      <div style={{
        padding:      '14px 18px',
        background:   'linear-gradient(135deg, #0B1F3A, #1A3A6B)',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'rgba(200,217,248,.6)', letterSpacing: '.5px', textTransform: 'uppercase' }}>
            Suivi commande
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 2 }}>
            {numero || '—'}
          </div>
        </div>
        <div style={{
          padding:      '4px 12px',
          borderRadius: 20,
          background:   'rgba(255,255,255,.12)',
          border:       '1px solid rgba(255,255,255,.18)',
          fontSize:     11,
          fontWeight:   700,
          color:        '#fff',
        }}>
          <span style={{ color: statusInfo.color, marginRight: 5 }}>●</span>
          {statusInfo.label}
        </div>
      </div>

      {/* ── Acteurs ──────────────────────────────────────────── */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid #F1F5F9' }}>
        {actors.map(actor => {
          const meta = ROLE_META[actor.role];
          const isDeliveryLive = actor.role === 'delivery' && deliveryLive;
          return (
            <div key={actor.id} style={{
              display:     'flex',
              alignItems:  'center',
              gap:         10,
              padding:     '8px 0',
              borderBottom: '1px solid #F8FAFF',
            }}>
              <div style={{
                width:           36, height: 36, borderRadius: '50%',
                background:      meta.bg,
                display:         'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink:      0,
              }}>
                <i className={`fas ${meta.icon}`} style={{ color: meta.color, fontSize: 14 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0B1F3A' }}>
                    {actor.name}
                  </span>
                  {isDeliveryLive && (
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: '2px 7px',
                      borderRadius: 20, background: '#D1FAE5', color: '#065F46',
                    }}>
                      EN DIRECT
                    </span>
                  )}
                </div>
                {actor.address && (
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {actor.address}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#CBD5E1', flexShrink: 0 }}>
                {meta.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Métriques de route ───────────────────────────────── */}
      {route && (
        <div style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>
            Itinéraire {route.provider === 'straight-line-fallback' ? '(estimation)' : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>

            {/* Distance */}
            <div style={metricCard}>
              <i className="fas fa-road" style={{ color: '#1A4FC4', fontSize: 16, marginBottom: 5 }} />
              <div style={metricVal}>{route.totalDistanceTxt}</div>
              <div style={metricLbl}>Distance</div>
            </div>

            {/* Durée */}
            <div style={metricCard}>
              <i className="fas fa-clock" style={{ color: '#047857', fontSize: 16, marginBottom: 5 }} />
              <div style={metricVal}>{route.totalDurationTxt}</div>
              <div style={metricLbl}>Durée</div>
            </div>

            {/* ETA */}
            <div style={metricCard}>
              <i className="fas fa-flag-checkered" style={{ color: '#7C3AED', fontSize: 16, marginBottom: 5 }} />
              <div style={metricVal}>{etaTime(route.totalDurationS)}</div>
              <div style={metricLbl}>Arrivée estimée</div>
            </div>
          </div>

          {/* Vitesse actuelle */}
          {livePosition?.vitesseKmh != null && livePosition.vitesseKmh > 0 && (
            <div style={{
              marginTop:    10,
              padding:      '8px 14px',
              background:   '#F0F9FF',
              borderRadius: 10,
              border:       '1px solid #BAE6FD',
              display:      'flex',
              alignItems:   'center',
              gap:          8,
              fontSize:     12.5,
            }}>
              <i className="fas fa-gauge-high" style={{ color: '#0284C7' }} />
              <span style={{ color: '#0284C7', fontWeight: 700 }}>
                {livePosition.vitesseKmh.toFixed(0)} km/h
              </span>
              <span style={{ color: '#94A3B8' }}>· Vitesse actuelle du livreur</span>
            </div>
          )}
        </div>
      )}

      {/* État vide — pas de route */}
      {!route && actors.length > 0 && (
        <div style={{ padding: '16px 18px', textAlign: 'center', color: '#94A3B8', fontSize: 12.5 }}>
          <i className="fas fa-map-location-dot" style={{ fontSize: 20, marginBottom: 6, display: 'block', color: '#CBD5E1' }} />
          Les positions GPS ne sont pas encore disponibles.
        </div>
      )}
    </div>
  );
}

/* ── Styles constants ── */
const metricCard: React.CSSProperties = {
  background:   '#F8FAFF',
  border:       '1px solid #E2E8F0',
  borderRadius: 12,
  padding:      '12px 8px',
  textAlign:    'center',
};
const metricVal: React.CSSProperties = {
  fontSize:   15,
  fontWeight: 800,
  color:      '#0B1F3A',
  fontFamily: 'var(--fd, "Fraunces", serif)',
};
const metricLbl: React.CSSProperties = {
  fontSize:      10,
  color:         '#94A3B8',
  marginTop:     3,
  textTransform: 'uppercase',
  letterSpacing: '.5px',
};
