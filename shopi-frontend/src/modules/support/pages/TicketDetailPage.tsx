/* ============================================================
 * FICHIER  : src/modules/support/pages/TicketDetailPage.tsx
 * MODULE   : Support
 * ROLE     : Affichage et gestion d'un ticket de support.
 *            Route : /support/tickets/:id
 *
 * RESPONSABILITES :
 *   - Afficher le header du ticket (statut, priorité, type, méta).
 *   - Rendre le thread de messages style chat (bulles gauche/droite).
 *   - Afficher les pièces jointes associées à chaque message.
 *   - Permettre l'upload d'une pièce jointe lors d'une réponse.
 *   - Widget CSAT avec notation étoilée (1–5).
 *   - Formulaire de réponse avec compteur de caractères (5000 max).
 *   - Bannière ticket fermé avec lien vers nouveau ticket.
 *
 * FLUX D'UPLOAD (deux étapes séquentielles) :
 *   1. POST /reply → obtient le messageId du message créé
 *   2. Si un fichier était sélectionné :
 *      POST /messages/:msgId/attachments (multipart/form-data)
 *   3. refresh() → recharge les messages avec leurs pièces jointes
 *
 *   Si l'étape 1 échoue → rien n'est envoyé.
 *   Si l'étape 2 échoue → le message est envoyé mais la PJ non jointe
 *   → message d'erreur spécifique sans masquer le succès du message.
 *
 * VALIDATIONS CLIENT-SIDE (pièces jointes) :
 *   - Types autorisés : PDF, JPG, PNG, WebP, MP4, WebM
 *   - Taille max : 10 MB
 *   - Validation de surface uniquement — le backend fait la validation réelle
 *     (magic bytes + liste blanche MIME — OWASP A05:2021)
 *
 * DEPENDANCES :
 *   - useTicketDetail  (hook)
 *   - supportApi       (reply, rate, uploadAttachment)
 *   - SupportMessage, SupportAttachment (types)
 *
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-03
 * ============================================================ */

import React, {
  useState, FormEvent, useRef, useEffect, useCallback,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import styles from './TicketDetailPage.module.css';
import { useTicketDetail }  from '../hooks/useSupport';
import { supportApi }       from '../services/support.api';
import type { SupportAttachment } from '../services/support.api';

/* ════════════════════════════════════════════════════════════════
 * CONSTANTES MÉTIER
 * ════════════════════════════════════════════════════════════════ */

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

const PRIORITY_COLOR: Record<string, { icon: string; color: string }> = {
  low:      { icon: 'fa-circle-arrow-down',  color: '#64748B' },
  normal:   { icon: 'fa-circle',             color: '#1A4FC4' },
  high:     { icon: 'fa-circle-arrow-up',    color: '#D97706' },
  critical: { icon: 'fa-circle-exclamation', color: '#E53E3E' },
};

const TYPE_LABELS: Record<string, string> = {
  general:        'Question générale',
  billing:        'Facturation',
  order_platform: 'Commande / Livraison',
  account:        'Compte / Accès',
  fraud:          'Fraude / Sécurité',
  technical:      'Problème technique',
  feedback:       'Suggestion / Avis',
};

/** Types MIME autorisés pour les pièces jointes.
 *  Validation de surface côté client — le backend reste l'autorité réelle. */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4',  'video/webm',
]);

/** Taille maximale d'une pièce jointe : 10 MB (cohérent avec le backend). */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/* ════════════════════════════════════════════════════════════════
 * HELPERS PURES (pas de state)
 * ════════════════════════════════════════════════════════════════ */

/** Timestamp relatif humain lisible (ex: "il y a 5 min"). */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'hier';
  if (days < 7)  return `il y a ${days} jours`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Date + heure complète pour le tooltip au survol des timestamps. */
function fullDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Formattage compact de la taille fichier (ex: "2.3 MB", "450 KB").
 * Utilisé dans les cartes de pièces jointes.
 */
function fmtBytes(bytes: number): string {
  if (bytes < 1_024)       return `${bytes} B`;
  if (bytes < 1_048_576)   return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/**
 * Retourne l'icône Font Awesome et la couleur adaptée au type MIME.
 * Les icônes sont choisies pour être reconnaissables immédiatement.
 */
function mimeIcon(mimeType: string): { icon: string; color: string } {
  if (mimeType === 'application/pdf')    return { icon: 'fa-file-pdf',   color: '#E53E3E' };
  if (mimeType.startsWith('image/'))     return { icon: 'fa-file-image', color: '#3182CE' };
  if (mimeType.startsWith('video/'))     return { icon: 'fa-file-video', color: '#9F7AEA' };
  return { icon: 'fa-file', color: '#718096' };
}

/** Nom lisible du type MIME pour l'attribut accept du file input. */
const FILE_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,video/mp4,video/webm';

/* ════════════════════════════════════════════════════════════════
 * SOUS-COMPOSANTS
 * ════════════════════════════════════════════════════════════════ */

/**
 * AttachmentCard — carte cliquable pour une pièce jointe.
 *
 * Pour les images : affiche une miniature Cloudinary (60 px de hauteur).
 * Pour les autres types : icône colorée + nom + taille.
 * La carte entière est un lien vers le fichier Cloudinary (onglet séparé).
 */
function AttachmentCard({ att }: { att: SupportAttachment }) {
  const { icon, color } = mimeIcon(att.mimeType);
  const isImage = att.mimeType.startsWith('image/');

  return (
    <a
      href={att.secureUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.attCard}
      title={`Ouvrir ${att.originalFilename}`}
      aria-label={`Pièce jointe : ${att.originalFilename} (${fmtBytes(att.sizeBytes)})`}
    >
      {isImage ? (
        /* Miniature inline pour les images — src Cloudinary déjà sécurisé (HTTPS). */
        <img
          src={att.secureUrl}
          alt={att.originalFilename}
          className={styles.attThumb}
          loading="lazy"
        />
      ) : (
        <span className={styles.attIconWrap} style={{ background: `${color}18` }}>
          <i className={`fas ${icon}`} style={{ color }} aria-hidden="true" />
        </span>
      )}

      <span className={styles.attBody}>
        {/* Nom du fichier tronqué si trop long via CSS text-overflow */}
        <span className={styles.attName}>{att.originalFilename}</span>
        <span className={styles.attMeta}>
          {att.extension.toUpperCase()} · {fmtBytes(att.sizeBytes)}
        </span>
      </span>

      {/* Icône d'ouverture externe — feedback visuel sur le lien */}
      <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" style={{ fontSize: 11, color: '#9AAACB' }} />
    </a>
  );
}

/**
 * StarRating — composant de notation étoilée pour le CSAT.
 * Accessible clavier + survol avec label contextuel.
 */
function StarRating({ onRate }: { onRate: (score: number) => void }) {
  const [hover, setHover] = useState(0);
  const labels = ['Très mauvais', 'Mauvais', 'Correct', 'Bien', 'Excellent'];

  return (
    <div className={styles.starWrap} role="group" aria-label="Notez votre satisfaction de 1 à 5">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          className={`${styles.star} ${s <= hover ? styles.starHover : ''}`}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onRate(s)}
          aria-label={labels[s - 1]}
        >
          <i className="fas fa-star" aria-hidden="true" />
        </button>
      ))}
      {hover > 0 && (
        <span className={styles.starLabel} aria-live="polite">{labels[hover - 1]}</span>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 * COMPOSANT PRINCIPAL
 * ════════════════════════════════════════════════════════════════ */

export default function TicketDetailPage() {
  const { id }                              = useParams<{ id: string }>();
  const { detail, loading, error, refresh } = useTicketDetail(id);

  /* ── État formulaire de réponse ───────────────────────────── */
  const [reply,    setReply]    = useState('');
  const [sending,  setSending]  = useState(false);
  const [sendErr,  setSendErr]  = useState<string | null>(null);

  /* ── État pièce jointe ────────────────────────────────────── */
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [uploadErr,  setUploadErr]  = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── État CSAT ────────────────────────────────────────────── */
  const [rated,  setRated]  = useState(false);

  /* ── Scroll automatique vers le dernier message ───────────── */
  const messagesEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages.length]);

  const ticket   = detail?.ticket;
  const messages = detail?.messages ?? [];
  const isClosed = ticket?.status === 'closed';
  const canRate  = (ticket?.status === 'resolved' || ticket?.status === 'closed')
                && !ticket?.satisfactionScore && !rated;

  /* ── Sélection d'un fichier ────────────────────────────────
   * Validation de surface côté client.
   * Le backend reste l'autorité réelle (magic bytes, liste blanche).
   * ─────────────────────────────────────────────────────────── */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      /* Reset de l'input pour permettre re-sélection du même fichier. */
      e.target.value = '';
      if (!file) return;

      /* ── Validation type ─────────────────────────────────── */
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        setUploadErr(
          'Format non autorisé. Formats acceptés : PDF, PNG, JPG, WebP, MP4, WebM.',
        );
        return;
      }

      /* ── Validation taille ───────────────────────────────── */
      if (file.size > MAX_FILE_SIZE) {
        setUploadErr(
          `Fichier trop lourd (${fmtBytes(file.size)}). Taille maximale : 10 MB.`,
        );
        return;
      }

      setUploadErr(null);
      setAttachFile(file);
    },
    [],
  );

  /* ── Envoi réponse + upload pièce jointe ───────────────────
   *
   * Séquence :
   *   1. POST /reply       → envoie le texte, récupère le messageId
   *   2. (si fichier)
   *      POST /attachments → upload multipart avec le messageId
   *   3. refresh()         → recharge les messages avec les PJ
   *
   * Si l'étape 1 échoue : sendErr est affiché, rien d'autre.
   * Si l'étape 2 échoue : le message est déjà envoyé, uploadErr
   *   informe spécifiquement sans masquer le succès du message.
   * ─────────────────────────────────────────────────────────── */
  const handleReply = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!id || !reply.trim()) return;

      setSending(true);
      setSendErr(null);
      setUploadErr(null);

      try {
        /* Étape 1 : envoi du texte. */
        const msg = await supportApi.reply(id, reply.trim());
        setReply('');

        /* Étape 2 : upload de la pièce jointe si sélectionnée.
         * On garde le file en local pour le cas où refresh() est trop lent. */
        if (attachFile) {
          setUploading(true);
          try {
            await supportApi.uploadAttachment(id, msg.id, attachFile);
            setAttachFile(null);
          } catch (uploadE: any) {
            /* Le message est envoyé — on signale uniquement l'échec de la PJ.
             * L'utilisateur peut répondre à nouveau pour réessayer l'upload. */
            setUploadErr(
              'Votre message a bien été envoyé, mais la pièce jointe n\'a pas pu être jointe. ' +
              'Vous pouvez la joindre lors de votre prochain message.',
            );
          } finally {
            setUploading(false);
          }
        }

        /* Étape 3 : rechargement pour afficher le nouveau message + PJ. */
        await refresh();
      } catch (e: any) {
        setSendErr(e.message ?? 'Erreur lors de l\'envoi.');
      } finally {
        setSending(false);
      }
    },
    [id, reply, attachFile, refresh],
  );

  const handleRate = useCallback(async (score: number) => {
    if (!id) return;
    try {
      await supportApi.rate(id, score);
      setRated(true);
    } catch {
      /* CSAT échoué silencieusement — ne pas bloquer l'utilisateur. */
    }
  }, [id]);

  /* ════════════════════════════════════════════════════════════
   * ÉTATS DE CHARGEMENT / ERREUR
   * ════════════════════════════════════════════════════════════ */

  if (loading) return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.skeletonHeader} aria-hidden="true" />
        <div className={styles.skeletonThread} aria-hidden="true">
          {[1, 2, 3].map(i => (
            <div key={i} className={`${styles.skeletonBubble} ${i % 2 === 0 ? styles.skeletonBubbleRight : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.stateErr} role="alert">
          <i className="fas fa-exclamation-triangle" aria-hidden="true" />
          {error}
        </div>
      </div>
    </div>
  );

  if (!ticket) return null;

  const statusStyle = STATUS_COLOR[ticket.status] ?? STATUS_COLOR.open;
  const priority    = PRIORITY_COLOR[ticket.priority] ?? PRIORITY_COLOR.normal;
  const isProcessing = sending || uploading;

  /* ════════════════════════════════════════════════════════════
   * RENDU PRINCIPAL
   * ════════════════════════════════════════════════════════════ */

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>

        {/* ── Breadcrumb ── */}
        <nav className={styles.breadcrumb} aria-label="Navigation">
          <Link to="/aide">Centre d'aide</Link>
          <span aria-hidden="true">/</span>
          <Link to="/support">Mes tickets</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{ticket.reference}</span>
        </nav>

        {/* ── En-tête du ticket ── */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <code className={styles.ref}>{ticket.reference}</code>
            <span
              className={styles.badge}
              style={{ background: statusStyle.bg, color: statusStyle.color }}
            >
              {STATUS_LABELS[ticket.status] ?? ticket.status}
            </span>
            <span className={styles.priorityBadge}>
              <i
                className={`fas ${priority.icon}`}
                style={{ color: priority.color }}
                aria-hidden="true"
              />
              {ticket.priority}
            </span>
          </div>

          <h1 className={styles.title}>{ticket.subject}</h1>

          <div className={styles.meta}>
            <span>
              <i className="fas fa-tag" aria-hidden="true" />
              {TYPE_LABELS[ticket.type] ?? ticket.type.replace(/_/g, ' ')}
            </span>
            <span>
              <i className="fas fa-calendar" aria-hidden="true" />
              Ouvert le {fullDate(ticket.createdAt)}
            </span>
            <span>
              <i className="fas fa-comment" aria-hidden="true" />
              {ticket.messageCount} message{ticket.messageCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ── Thread de messages ── */}
        <div className={styles.thread} role="log" aria-label="Messages du ticket" aria-live="polite">
          {messages.map((msg, idx) => {
            const isUser   = msg.senderType === 'user';
            const isSystem = msg.senderType === 'system';

            /* Afficher un séparateur de date au premier message du jour. */
            const showDate = idx === 0 ||
              new Date(messages[idx - 1].createdAt).toDateString() !==
              new Date(msg.createdAt).toDateString();

            return (
              <React.Fragment key={msg.id}>

                {/* ── Séparateur de date ── */}
                {showDate && (
                  <div className={styles.dateDivider} role="separator" aria-label={
                    new Date(msg.createdAt).toLocaleDateString('fr-FR', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })
                  }>
                    <span>
                      {new Date(msg.createdAt).toLocaleDateString('fr-FR', {
                        weekday: 'long', day: 'numeric', month: 'long',
                      })}
                    </span>
                  </div>
                )}

                {/* ── Message système (centré, italique) ── */}
                {isSystem ? (
                  <div className={styles.systemMsg}>
                    <i className="fas fa-circle-info" aria-hidden="true" />
                    <span>{msg.content}</span>
                    <time
                      className={styles.systemTime}
                      dateTime={msg.createdAt}
                      title={fullDate(msg.createdAt)}
                    >
                      {relativeTime(msg.createdAt)}
                    </time>
                  </div>
                ) : (
                  /* ── Message user / agent (bulles) ── */
                  <div className={`${styles.msgRow} ${isUser ? styles.msgRowRight : styles.msgRowLeft}`}>

                    {/* Avatar agent (gauche) */}
                    {!isUser && (
                      <div className={styles.avatar} title={msg.senderName} aria-hidden="true">
                        <i className="fas fa-headset" />
                      </div>
                    )}

                    <div className={styles.msgGroup}>
                      {/* Méta : nom expéditeur + temps */}
                      <div className={styles.msgMeta}>
                        {!isUser && (
                          <>
                            <span className={styles.msgSender}>{msg.senderName}</span>
                            <span className={styles.msgTeam}>Équipe support</span>
                          </>
                        )}
                        {isUser && <span className={styles.msgSender}>Vous</span>}
                        <time
                          className={styles.msgTime}
                          dateTime={msg.createdAt}
                          title={fullDate(msg.createdAt)}
                        >
                          {relativeTime(msg.createdAt)}
                        </time>
                      </div>

                      {/* Bulle du message */}
                      <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAgent}`}>
                        <div className={styles.bubbleContent}>{msg.content}</div>

                        {/* ── Pièces jointes du message ────────────────────
                         * Affichées sous le contenu texte, dans la même bulle.
                         * Chaque carte est un lien externe vers Cloudinary.
                         * ─────────────────────────────────────────────── */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div
                            className={styles.attList}
                            aria-label={`${msg.attachments.length} pièce${msg.attachments.length > 1 ? 's' : ''} jointe${msg.attachments.length > 1 ? 's' : ''}`}
                          >
                            {msg.attachments.map(att => (
                              <AttachmentCard key={att.id} att={att} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Avatar utilisateur (droite) */}
                    {isUser && (
                      <div className={`${styles.avatar} ${styles.avatarUser}`} title="Vous" aria-hidden="true">
                        <i className="fas fa-user" />
                      </div>
                    )}

                  </div>
                )}

              </React.Fragment>
            );
          })}

          {/* Ancre de scroll automatique vers le bas */}
          <div ref={messagesEnd} />
        </div>

        {/* ── Widget CSAT ── */}
        {canRate && (
          <div className={styles.csat} role="region" aria-label="Évaluation du ticket">
            <div className={styles.csatIcon} aria-hidden="true">
              <i className="fas fa-star-half-stroke" />
            </div>
            <p className={styles.csatTitle}>Votre ticket a été résolu</p>
            <p className={styles.csatSub}>Êtes-vous satisfait de la réponse apportée ?</p>
            <StarRating onRate={handleRate} />
          </div>
        )}

        {rated && (
          <div className={styles.ratedBox} role="status" aria-live="polite">
            <i className="fas fa-circle-check" aria-hidden="true" />
            <div>
              <div className={styles.ratedTitle}>Merci pour votre évaluation !</div>
              <div className={styles.ratedSub}>Votre retour nous aide à améliorer notre service.</div>
            </div>
          </div>
        )}

        {/* ── Formulaire de réponse ── */}
        {!isClosed ? (
          <form className={styles.replyForm} onSubmit={handleReply} noValidate>
            <div className={styles.replyHeader}>
              <i className="fas fa-reply" aria-hidden="true" /> Votre réponse
            </div>

            {/* Zone de texte */}
            <textarea
              className={styles.replyInput}
              placeholder="Décrivez votre question ou apportez des informations complémentaires…"
              value={reply}
              onChange={e => setReply(e.target.value)}
              rows={4}
              disabled={isProcessing}
              maxLength={5000}
              aria-label="Votre message"
              aria-describedby={sendErr ? 'send-error' : undefined}
            />

            {/* ── Zone pièce jointe ────────────────────────────────
             * Input file caché — déclenché par le bouton "Joindre".
             * accept= fournit une première ligne de filtrage côté navigateur.
             * La validation réelle se fait dans handleFileSelect et sur le backend.
             * ───────────────────────────────────────────────────── */}
            <input
              ref={fileInputRef}
              type="file"
              accept={FILE_ACCEPT}
              onChange={handleFileSelect}
              className={styles.fileInputHidden}
              aria-hidden="true"
              tabIndex={-1}
              disabled={isProcessing}
            />

            {/* Zone de contrôle pièce jointe */}
            <div className={styles.attachZone}>
              <button
                type="button"
                className={styles.attachBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                aria-label="Joindre un fichier (PDF, image ou vidéo)"
                title="Joindre un fichier · PDF, JPG, PNG, WebP, MP4, WebM · max 10 MB"
              >
                <i className="fas fa-paperclip" aria-hidden="true" />
                {attachFile ? 'Changer le fichier' : 'Joindre un fichier'}
              </button>

              {/* Chip du fichier sélectionné */}
              {attachFile && !uploading && (
                <div className={styles.fileChip} role="status" aria-label={`Fichier sélectionné : ${attachFile.name}`}>
                  <i
                    className={`fas ${mimeIcon(attachFile.type).icon}`}
                    style={{ color: mimeIcon(attachFile.type).color }}
                    aria-hidden="true"
                  />
                  <span className={styles.fileChipName}>{attachFile.name}</span>
                  <span className={styles.fileChipSize}>{fmtBytes(attachFile.size)}</span>
                  <button
                    type="button"
                    className={styles.fileChipRemove}
                    onClick={() => { setAttachFile(null); setUploadErr(null); }}
                    aria-label={`Retirer le fichier ${attachFile.name}`}
                  >
                    <i className="fas fa-times" aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* Indicateur d'upload en cours */}
              {uploading && (
                <div className={styles.uploadingBadge} role="status" aria-live="polite">
                  <i className="fas fa-circle-notch fa-spin" aria-hidden="true" />
                  Envoi de la pièce jointe…
                </div>
              )}
            </div>

            {/* Formats acceptés (hint discret) */}
            <p className={styles.attachHint} aria-hidden="true">
              <i className="fas fa-circle-info" /> PDF, PNG, JPG, WebP, MP4, WebM · max 10 MB
            </p>

            {/* Erreur envoi texte */}
            {sendErr && (
              <div id="send-error" className={styles.sendErr} role="alert">
                <i className="fas fa-exclamation-triangle" aria-hidden="true" /> {sendErr}
              </div>
            )}

            {/* Erreur upload pièce jointe (message envoyé mais PJ échouée) */}
            {uploadErr && (
              <div className={styles.uploadErrMsg} role="alert">
                <i className="fas fa-triangle-exclamation" aria-hidden="true" /> {uploadErr}
              </div>
            )}

            {/* Actions : compteur + bouton d'envoi */}
            <div className={styles.replyActions}>
              <span className={styles.charCount} aria-label={`${reply.length} caractères sur 5000 maximum`}>
                {reply.length}/5000
              </span>
              <button
                type="submit"
                className={styles.replyBtn}
                disabled={!reply.trim() || isProcessing}
                aria-busy={isProcessing}
              >
                {sending && !uploading ? (
                  <><i className="fas fa-circle-notch fa-spin" aria-hidden="true" /> Envoi…</>
                ) : uploading ? (
                  <><i className="fas fa-circle-notch fa-spin" aria-hidden="true" /> Pièce jointe…</>
                ) : (
                  <>
                    <i className="fas fa-paper-plane" aria-hidden="true" />
                    {attachFile ? 'Envoyer avec pièce jointe' : 'Envoyer'}
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* ── Bannière ticket fermé ── */
          <div className={styles.closedBanner} role="status">
            <i className="fas fa-lock" aria-hidden="true" />
            <div>
              <div className={styles.closedTitle}>Ce ticket est fermé</div>
              <div className={styles.closedSub}>Vous ne pouvez plus y répondre.</div>
            </div>
            <Link to="/support/nouveau" className={styles.closedBtn}>
              <i className="fas fa-plus" aria-hidden="true" /> Nouveau ticket
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
