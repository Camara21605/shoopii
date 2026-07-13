/* ============================================================
 * FICHIER : src/modules/support/pages/SupportPage.tsx
 *
 * RÔLE    : Liste des tickets de support de l'utilisateur connecté.
 *           Route : /support
 *
 * FONCTIONNALITÉS :
 *   - Filtres de statut en pills (Tous / Ouverts / En cours /
 *     En attente / Résolus / Fermés)
 *   - Chaque carte de ticket affiche :
 *     · Bande de priorité colorée (gauche) — bleu/orange/rouge
 *     · Référence, statut, badge "non-lu" si nouveaux messages
 *     · Sujet, type de demande, compteur de messages, date
 *     · Indicateur de priorité haute/critique en bas
 *     · Animation pulsante sur les tickets en attente de réponse
 *   - État vide avec message adapté au filtre actif
 *
 * DONNÉES :
 *   useSupportList(statusFilter) → tickets + total
 *   (via GET /support/client/tickets?status=&page=)
 * ============================================================ */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './SupportPage.module.css';
import { useSupportList } from '../hooks/useSupport';

const STATUS_LABELS: Record<string, string> = {
  open:          'Ouvert',
  in_progress:   'En cours',
  waiting_user:  'Votre réponse attendue',
  resolved:      'Résolu',
  closed:        'Fermé',
};

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  open:         { bg: '#EEF2FF', color: '#1A4FC4' },
  in_progress:  { bg: '#FFF7ED', color: '#C05621' },
  waiting_user: { bg: '#FFFBEB', color: '#92400E' },
  resolved:     { bg: '#F0FDF4', color: '#065F46' },
  closed:       { bg: '#F1F5F9', color: '#475569' },
};

const PRIORITY_STRIPE: Record<string, string> = {
  low:      '#94A3B8',
  normal:   '#1A4FC4',
  high:     '#D97706',
  critical: '#E53E3E',
};

const TYPE_LABELS: Record<string, string> = {
  general:        'Question générale',
  billing:        'Facturation',
  order_platform: 'Commande',
  account:        'Compte',
  fraud:          'Fraude / Sécurité',
  technical:      'Technique',
  feedback:       'Suggestion',
};

const FILTERS = [
  { label: 'Tous',              value: '' },
  { label: 'Ouverts',           value: 'open' },
  { label: 'En cours',          value: 'in_progress' },
  { label: 'En attente',        value: 'waiting_user' },
  { label: 'Résolus',           value: 'resolved' },
  { label: 'Fermés',            value: 'closed' },
];

export default function SupportPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { tickets, total, loading, error } = useSupportList(statusFilter);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>

        {/* Breadcrumb */}
        <nav className={styles.breadcrumb}>
          <Link to="/aide">Centre d'aide</Link>
          <span>/</span>
          <span>Mes tickets</span>
        </nav>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Mes demandes de support</h1>
            <p className={styles.sub}>{total} ticket{total !== 1 ? 's' : ''} au total</p>
          </div>
          <Link to="/support/nouveau" className={styles.newBtn}>
            <i className="fas fa-plus" /> Nouveau ticket
          </Link>
        </div>

        {/* Filtres statut */}
        <div className={styles.filters}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              className={`${styles.filterBtn} ${statusFilter === f.value ? styles.filterBtnActive : ''}`}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* États */}
        {loading && (
          <div className={styles.state}>
            <i className="fas fa-circle-notch fa-spin" /> Chargement…
          </div>
        )}

        {!loading && error && (
          <div className={styles.stateErr}>
            <i className="fas fa-exclamation-triangle" /> {error}
          </div>
        )}

        {!loading && !error && tickets.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}><i className="fas fa-inbox" /></div>
            <div className={styles.emptyTitle}>
              {statusFilter ? `Aucun ticket « ${STATUS_LABELS[statusFilter] ?? statusFilter} »` : 'Aucun ticket'}
            </div>
            <p className={styles.emptySub}>
              {statusFilter
                ? 'Essayez un autre filtre ou créez un nouveau ticket.'
                : 'Vous n\'avez pas encore de demande de support.'}
            </p>
            <Link to="/support/nouveau" className={styles.emptyBtn}>
              <i className="fas fa-plus" /> Créer un ticket
            </Link>
          </div>
        )}

        {/* Liste */}
        {!loading && tickets.length > 0 && (
          <div className={styles.list}>
            {tickets.map(t => {
              const statusColor  = STATUS_COLOR[t.status]   ?? STATUS_COLOR.open;
              const stripeColor  = PRIORITY_STRIPE[t.priority] ?? PRIORITY_STRIPE.normal;
              const isWaiting    = t.status === 'waiting_user';
              const hasUnread    = t.unreadByUser > 0;

              return (
                <Link key={t.id} to={`/support/tickets/${t.id}`} className={`${styles.card} ${isWaiting ? styles.cardWaiting : ''}`}>
                  {/* Priority stripe */}
                  <div className={styles.stripe} style={{ background: stripeColor }} />

                  <div className={styles.cardInner}>
                    <div className={styles.cardTop}>
                      <code className={styles.ref}>{t.reference}</code>
                      <span
                        className={styles.badge}
                        style={{ background: statusColor.bg, color: statusColor.color }}
                      >
                        {isWaiting && <span className={styles.pulse} />}
                        {STATUS_LABELS[t.status] ?? t.status}
                      </span>
                      {hasUnread && (
                        <span className={styles.unreadBadge}>
                          {t.unreadByUser} nouveau{t.unreadByUser > 1 ? 'x' : ''}
                        </span>
                      )}
                    </div>

                    <div className={styles.subject}>{t.subject}</div>

                    <div className={styles.cardMeta}>
                      <span className={styles.typeTag}>
                        <i className="fas fa-tag" />
                        {TYPE_LABELS[t.type] ?? t.type.replace(/_/g, ' ')}
                      </span>
                      <span><i className="fas fa-comments" /> {t.messageCount} msg</span>
                      <span className={styles.metaDate}>
                        <i className="fas fa-clock" />
                        {fmtDate(t.updatedAt)}
                      </span>
                      {(t.priority === 'high' || t.priority === 'critical') && (
                        <span style={{ color: PRIORITY_STRIPE[t.priority], fontWeight: 700, fontSize: '11px' }}>
                          <i className={`fas ${t.priority === 'critical' ? 'fa-circle-exclamation' : 'fa-circle-arrow-up'}`} />
                          {t.priority === 'critical' ? ' Critique' : ' Haute priorité'}
                        </span>
                      )}
                    </div>
                  </div>

                  <i className="fas fa-chevron-right" style={{ color: '#C5D0E8', fontSize: '12px', marginLeft: 'auto', flexShrink: 0 }} />
                </Link>
              );
            })}
          </div>
        )}

        {/* Help link */}
        <div className={styles.helpLink}>
          <i className="fas fa-book-open" />
          <span>Avant d'ouvrir un ticket, consultez notre</span>
          <Link to="/aide">Centre d'aide</Link>
        </div>

      </div>
    </div>
  );
}
