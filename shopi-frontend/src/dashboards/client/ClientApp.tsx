/* ============================================================
 * FICHIER : src/dashboards/client/ClientApp.tsx
 *
 * RÔLE :
 *   Application principale du dashboard client.
 *   Contient :
 *     ① NotificationProvider + NotificationToastStack
 *        → gestion des notifications temps réel (Phase 5)
 *     ② ClientSupportWidget (nouveau, Phase 5)
 *        → accès rapide aux tickets de support du client
 *     ③ PortefeuilleStandalone
 *        → portefeuille/solde du client
 * ============================================================ */

import React, { useEffect, useState } from 'react';
import PortefeuilleStandalone from '../../shared/components/portefeuille/PortefeuilleStandalone';
import { NotificationProvider }   from '../../shared/notifications/NotificationContext';
import NotificationToastStack     from '../../shared/notifications/NotificationToastStack';
import { apiFetch }               from '../../shared/services/apiFetch';

// ─────────────────────────────────────────────────────────────
// 1. Types
// ─────────────────────────────────────────────────────────────

/** Résumé d'un ticket affiché dans le widget */
interface TicketSummary {
  id:        string;
  reference: string;
  subject:   string;
  status:    string;
  unreadByUser: number;
}

// ─────────────────────────────────────────────────────────────
// 2. Styles inline (dashboard client n'a pas encore de CSS Module)
// ─────────────────────────────────────────────────────────────

const styles = {
  wrap: {
    padding: '24px 20px 80px',
    maxWidth: 820,
    margin: '0 auto',
    fontFamily: 'DM Sans, sans-serif',
  } as React.CSSProperties,

  /* Widget Support */
  supportCard: {
    background: '#fff',
    border: '1px solid #E5EBF5',
    borderRadius: 16,
    padding: '20px 24px',
    marginBottom: 24,
  } as React.CSSProperties,

  supportHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  } as React.CSSProperties,

  supportTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#0B1F3A',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,

  linkBtn: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1A4FC4',
    textDecoration: 'none',
    background: '#EEF2FF',
    border: '1px solid #C7D7F8',
    borderRadius: 8,
    padding: '7px 14px',
  } as React.CSSProperties,

  ticketRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: '#F8FAFF',
    borderRadius: 10,
    marginBottom: 8,
    cursor: 'pointer',
    textDecoration: 'none',
    color: 'inherit',
  } as React.CSSProperties,

  ref: {
    fontSize: 12,
    fontWeight: 700,
    color: '#1A4FC4',
    fontFamily: 'monospace',
  } as React.CSSProperties,

  subject: {
    fontSize: 13,
    color: '#2A3A5A',
    marginTop: 2,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 300,
  } as React.CSSProperties,

  unreadDot: {
    width: 8, height: 8,
    borderRadius: '50%',
    background: '#E53E3E',
    flexShrink: 0,
  } as React.CSSProperties,

  emptyTxt: {
    fontSize: 13,
    color: '#9AAACB',
    textAlign: 'center' as const,
    padding: '16px 0',
  } as React.CSSProperties,

  newBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
    padding: '10px 20px',
    background: '#1A4FC4',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
  } as React.CSSProperties,
};

// ─────────────────────────────────────────────────────────────
// 3. Widget Support
// ─────────────────────────────────────────────────────────────

/**
 * Petit widget affiché dans le dashboard client.
 * Affiche les 3 derniers tickets ouverts, avec un badge rouge
 * si le ticket a des messages non lus.
 */
function ClientSupportWidget() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Charge uniquement les tickets actifs (open + in_progress + waiting_user)
    apiFetch<{ data: TicketSummary[] }>('/support/client/tickets?page=1&limit=3')
      .then(res => setTickets(res.data ?? []))
      .catch(() => {/* silencieux — widget facultatif */})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={styles.supportCard}>
      <div style={styles.supportHeader}>
        <div style={styles.supportTitle}>
          🎫 Mes tickets de support
        </div>
        <a href="/support" style={styles.linkBtn}>Voir tout</a>
      </div>

      {/* État chargement */}
      {loading && (
        <div style={styles.emptyTxt}>Chargement…</div>
      )}

      {/* Aucun ticket */}
      {!loading && tickets.length === 0 && (
        <div style={styles.emptyTxt}>
          Aucun ticket ouvert — besoin d'aide ?
        </div>
      )}

      {/* Liste des tickets */}
      {tickets.map(t => (
        <a key={t.id} href={`/support/tickets/${t.id}`} style={styles.ticketRow}>
          <div>
            <div style={styles.ref}>{t.reference}</div>
            <div style={styles.subject}>{t.subject}</div>
          </div>
          {/* Point rouge si l'agent a répondu et le client n'a pas encore lu */}
          {t.unreadByUser > 0 && <div style={styles.unreadDot} />}
        </a>
      ))}

      {/* Bouton créer un nouveau ticket */}
      <a href="/support/nouveau" style={styles.newBtn}>
        + Nouveau ticket
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Composant principal
// ─────────────────────────────────────────────────────────────

export default function ClientApp() {
  return (
    /*
     * NotificationProvider :
     *   Fournit le contexte de notifications temps réel à tous les
     *   composants enfants. Écoute le WebSocket / SSE et affiche
     *   les toasts via NotificationToastStack.
     */
    <NotificationProvider>
      <NotificationToastStack />

      <div style={styles.wrap}>
        {/* En-tête : titre + accès rapide au Centre d'aide */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0B1F3A', margin: 0 }}>
            Mon espace
          </h1>
          <a
            href="/aide"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 18px',
              background: '#EEF2FF', border: '1.5px solid #C7D7F8', borderRadius: 10,
              color: '#1A4FC4', fontWeight: 700, fontSize: 13,
              textDecoration: 'none', whiteSpace: 'nowrap',
              transition: 'background .15s, border-color .15s',
            }}
            title="Accéder au Centre d'aide Shopi"
          >
            <i className="fas fa-circle-question" style={{ fontSize: 14 }} />
            Centre d'aide
          </a>
        </div>

        {/* Widget de support — affiché avant le portefeuille */}
        <ClientSupportWidget />

        {/* Portefeuille / solde du compte */}
        <PortefeuilleStandalone />
      </div>
    </NotificationProvider>
  );
}
