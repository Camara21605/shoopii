/* ============================================================
 * FICHIER            : src/modules/support/pages/NewTicketPage.tsx
 * RÔLE               : Formulaire de création d'un nouveau ticket de support.
 * RESPONSABILITES    : Guider l'utilisateur en 3 étapes pour ouvrir un ticket :
 *                        1. Sélection du type de demande (cartes cliquables)
 *                        2. Saisie du sujet + suggestions d'articles en temps réel
 *                        3. Description détaillée du problème
 *                      Soumettre la demande via supportApi.createTicket()
 *                      et rediriger vers le ticket créé.
 * DEPENDANCES        : supportApi (createTicket + suggest), react-router-dom,
 *                      NewTicketPage.module.css
 * AUTEUR             : Shopi03
 * DERNIERE MISE A JOUR: 2026-07-03
 *
 * SECURITE :
 *   - Les appels de suggestions utilisent supportApi (apiFetch) qui
 *     respecte VITE_API_URL et gère les erreurs sans exposer de stack trace.
 *   - maxLength HTML = défense en profondeur (la validation réelle est backend).
 *   - Validation frontend pour UX uniquement — le backend valide toujours.
 * ============================================================ */
import React, { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './NewTicketPage.module.css';
import { supportApi } from '../services/support.api';
import { useForceDarkTheme } from '../../../shared/context/ThemeContext';

/** Types MIME autorisés pour les pièces jointes.
 *  Validation de surface côté client — le backend reste l'autorité réelle. */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4',  'video/webm',
]);

/** Taille maximale d'une pièce jointe : 10 MB (cohérent avec le backend). */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Nom lisible du type MIME pour l'attribut accept du file input. */
const FILE_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,video/mp4,video/webm';

/** Formattage compact de la taille fichier (ex: "2.3 MB", "450 KB"). */
function fmtBytes(bytes: number): string {
  if (bytes < 1_024)       return `${bytes} B`;
  if (bytes < 1_048_576)   return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/** Icône Font Awesome + couleur adaptée au type MIME. */
function mimeIcon(mimeType: string): { icon: string; color: string } {
  if (mimeType === 'application/pdf')    return { icon: 'fa-file-pdf',   color: '#E53E3E' };
  if (mimeType.startsWith('image/'))     return { icon: 'fa-file-image', color: '#3182CE' };
  if (mimeType.startsWith('video/'))     return { icon: 'fa-file-video', color: '#9F7AEA' };
  return { icon: 'fa-file', color: '#718096' };
}

/* ── Types de demande avec icône ET description ── */
const TICKET_TYPES = [
  {
    value: 'general',
    label: 'Question générale',
    icon:  'fa-circle-question',
    desc:  'Toute question sur Shoneya',
  },
  {
    value: 'billing',
    label: 'Facturation',
    icon:  'fa-credit-card',
    desc:  'Paiements, factures, remboursements',
  },
  {
    value: 'order_platform',
    label: 'Commande',
    icon:  'fa-box',
    desc:  'Suivi, livraison, retour colis',
  },
  {
    value: 'account',
    label: 'Compte / Accès',
    icon:  'fa-user-shield',
    desc:  'Connexion, vérification, sécurité',
  },
  {
    value: 'fraud',
    label: 'Fraude / Sécurité',
    icon:  'fa-shield-halved',
    desc:  'Signalement fraude, compte compromis',
  },
  {
    value: 'technical',
    label: 'Problème technique',
    icon:  'fa-wrench',
    desc:  'Bug, erreur, fonctionnalité défaillante',
  },
  {
    value: 'feedback',
    label: 'Suggestion',
    icon:  'fa-lightbulb',
    desc:  'Amélioration ou retour d\'expérience',
  },
] as const;

/** Nombre minimum de caractères dans le message */
const MIN_MSG = 20;
/** Délai debounce suggestions (ms) */
const SUGGEST_DEBOUNCE = 500;

export default function NewTicketPage() {
  // ✅ Cette page n'a plus de mode clair — voir useForceDarkTheme.
  useForceDarkTheme();

  const navigate = useNavigate();

  /* ── État formulaire ── */
  const [ticketType, setTicketType] = useState('');
  const [subject, setSubject]       = useState('');
  const [message, setMessage]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr]   = useState<string | null>(null);

  /* ── État pièce jointe (optionnelle, jointe au 1er message) ── */
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachErr, setAttachErr]   = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── État suggestions ── */
  const [suggestions, setSuggestions]   = useState<{ slug: string; title: string; excerpt: string }[]>([]);
  const [suggesting, setSuggesting]     = useState(false);
  const [dismissed, setDismissed]       = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Logique de suggestions avec debounce ──
   * On utilise supportApi.suggest (apiFetch) au lieu de fetch brut
   * pour respecter VITE_API_URL et bénéficier de la gestion d'erreurs. */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (subject.trim().length < 5) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (dismissed) return;
      setSuggesting(true);
      try {
        const res = await supportApi.suggest(subject.trim());
        setSuggestions(res);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggesting(false);
      }
    }, SUGGEST_DEBOUNCE);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [subject, dismissed]);

  /* ── Réinitialise dismissed à chaque frappe ── */
  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSubject(e.target.value);
    setDismissed(false);
  };

  /* ── Validation ── */
  const canSubmit =
    !!ticketType &&
    subject.trim().length >= 5 &&
    message.trim().length >= MIN_MSG;

  /* ── Calcul de l'étape active pour le stepper ── */
  const activeStep = !ticketType ? 1 : subject.trim().length < 5 ? 2 : 3;

  /* ── Sélection d'un fichier ──
   * Validation de surface côté client. Le backend reste l'autorité réelle
   * (magic bytes, liste blanche). Voir TicketDetailPage.tsx pour le même flux. */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        setAttachErr('Format non autorisé. Formats acceptés : PDF, PNG, JPG, WebP, MP4, WebM.');
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setAttachErr(`Fichier trop lourd (${fmtBytes(file.size)}). Taille maximale : 10 MB.`);
        return;
      }

      setAttachErr(null);
      setAttachFile(file);
    },
    [],
  );

  /* ── Soumission ──
   * 1. Création du ticket (renvoie aussi l'id du 1er message).
   * 2. Si une pièce jointe a été choisie, upload sur ce message.
   *    Un échec d'upload n'empêche pas la redirection : le ticket
   *    existe déjà, l'utilisateur peut rejoindre la PJ dans le thread. */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const { ticket, firstMessageId } = await supportApi.createTicket({
        type:         ticketType,
        subject:      subject.trim(),
        firstMessage: message.trim(),
      });

      if (attachFile) {
        setUploading(true);
        try {
          await supportApi.uploadAttachment(ticket.id, firstMessageId, attachFile);
        } catch {
          /* Le ticket est créé — on ne bloque pas la redirection pour un échec de PJ. */
        } finally {
          setUploading(false);
        }
      }

      navigate(`/support/tickets/${ticket.id}`, { replace: true });
    } catch (err: any) {
      setSubmitErr(err.message ?? 'Erreur lors de la création du ticket');
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>

        {/* ── Fil d'Ariane ── */}
        <nav className={styles.breadcrumb}>
          <Link to="/aide">Centre d'aide</Link>
          <span>/</span>
          <Link to="/support">Mes tickets</Link>
          <span>/</span>
          <span>Nouveau ticket</span>
        </nav>

        {/* ── En-tête ── */}
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <i className="fas fa-ticket" aria-hidden="true" />
          </div>
          <div>
            <h1 className={styles.title}>Nouveau ticket de support</h1>
            <p className={styles.sub}>Notre équipe vous répond dans les 24 heures ouvrées.</p>
          </div>
        </div>

        {/* ── Stepper — progression en 3 étapes ── */}
        <div className={styles.stepper} aria-label="Étapes du formulaire">
          {(['Type', 'Sujet', 'Description'] as const).map((label, idx) => {
            const n = idx + 1;
            const done    = activeStep > n;
            const current = activeStep === n;
            return (
              <div
                key={label}
                className={`${styles.step} ${done ? styles.stepDone : ''} ${current ? styles.stepActive : ''}`}
              >
                <div className={styles.stepNum} aria-hidden="true">
                  {done ? <i className="fas fa-check" /> : n}
                </div>
                <span className={styles.stepLabel}>{label}</span>
                {idx < 2 && <div className={`${styles.stepLine} ${done ? styles.stepLineDone : ''}`} />}
              </div>
            );
          })}
        </div>

        {/* ── Rappel Centre d'aide ── */}
        <div className={styles.tip}>
          <i className="fas fa-book-open" aria-hidden="true" />
          <span>Avant d'ouvrir un ticket, consultez notre{' '}</span>
          <Link to="/aide">Centre d'aide</Link>
          <span>{' '}— votre réponse s'y trouve peut-être déjà.</span>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>

          {/* ── Étape 1 : Type de demande (cartes) ── */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>1</span>
              <label className={styles.sectionLabel}>
                Type de demande <span className={styles.req}>*</span>
              </label>
            </div>
            <div className={styles.typeGrid}>
              {TICKET_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  className={`${styles.typeCard} ${ticketType === t.value ? styles.typeCardActive : ''}`}
                  onClick={() => setTicketType(t.value)}
                  aria-pressed={ticketType === t.value}
                >
                  <div className={styles.typeCardIcon}>
                    <i className={`fas ${t.icon}`} aria-hidden="true" />
                  </div>
                  <div className={styles.typeCardBody}>
                    <div className={styles.typeCardLabel}>{t.label}</div>
                    <div className={styles.typeCardDesc}>{t.desc}</div>
                  </div>
                  {ticketType === t.value && (
                    <i
                      className={`fas fa-circle-check ${styles.typeCardCheck}`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* ── Étape 2 : Sujet + suggestions ── */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>2</span>
              <label className={styles.sectionLabel} htmlFor="subject">
                Sujet <span className={styles.req}>*</span>
              </label>
            </div>
            <div className={styles.inputWrap}>
              <input
                id="subject"
                className={`${styles.input} ${subject.length > 0 && subject.trim().length < 5 ? styles.inputErr : subject.trim().length >= 5 ? styles.inputOk : ''}`}
                type="text"
                placeholder="Résumez votre problème en une phrase"
                value={subject}
                onChange={handleSubjectChange}
                maxLength={500}
                autoComplete="off"
              />
              {suggesting && (
                <span className={styles.suggestSpinner} aria-hidden="true">
                  <i className="fas fa-circle-notch fa-spin" />
                </span>
              )}
            </div>
            <div className={styles.inputMeta}>
              {subject.length > 0 && subject.trim().length < 5 && (
                <span className={styles.errHint}>Minimum 5 caractères</span>
              )}
              <span className={styles.counter}>{subject.length}/500</span>
            </div>

            {/* Bloc de suggestions d'articles */}
            {suggestions.length > 0 && !dismissed && (
              <div className={styles.suggestions}>
                <div className={styles.suggestHeader}>
                  <i className="fas fa-lightbulb" aria-hidden="true" />
                  <span>Ces articles pourraient répondre à votre question :</span>
                  <button
                    type="button"
                    className={styles.suggestClose}
                    onClick={() => setDismissed(true)}
                    aria-label="Fermer les suggestions"
                  >
                    <i className="fas fa-xmark" aria-hidden="true" />
                  </button>
                </div>
                <div className={styles.suggestList}>
                  {suggestions.map(art => (
                    <a
                      key={art.slug}
                      href={`/aide/articles/${art.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.suggestItem}
                    >
                      <div className={styles.suggestItemIcon}>
                        <i className="fas fa-file-alt" aria-hidden="true" />
                      </div>
                      <div>
                        <div className={styles.suggestItemTitle}>{art.title}</div>
                        {art.excerpt && (
                          <div className={styles.suggestItemExcerpt}>
                            {art.excerpt.slice(0, 120)}{art.excerpt.length > 120 ? '…' : ''}
                          </div>
                        )}
                      </div>
                      <i className="fas fa-external-link-alt" aria-hidden="true" style={{ color: '#9AAACB', flexShrink: 0 }} />
                    </a>
                  ))}
                </div>
                <p className={styles.suggestFooter}>
                  Aucun article ne répond à votre question ? Continuez ci-dessous.
                </p>
              </div>
            )}
          </section>

          {/* ── Étape 3 : Description ── */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>3</span>
              <label className={styles.sectionLabel} htmlFor="message">
                Description <span className={styles.req}>*</span>
              </label>
            </div>
            <textarea
              id="message"
              className={`${styles.textarea} ${message.length > 0 && message.trim().length < MIN_MSG ? styles.inputErr : message.trim().length >= MIN_MSG ? styles.inputOk : ''}`}
              placeholder={`Décrivez votre problème avec le maximum de détails :\n• Que s'est-il passé ?\n• Quand cela s'est-il produit ?\n• Avez-vous un message d'erreur ?`}
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={8}
              maxLength={5000}
            />
            <div className={styles.inputMeta}>
              {message.length > 0 && message.trim().length < MIN_MSG && (
                <span className={styles.errHint}>
                  Encore {MIN_MSG - message.trim().length} caractère{MIN_MSG - message.trim().length > 1 ? 's' : ''} minimum
                </span>
              )}
              <span className={`${styles.counter} ${message.length > 4500 ? styles.counterWarn : ''}`}>
                {message.length}/5000
              </span>
            </div>

            {/* ── Pièce jointe (optionnelle) ── */}
            <input
              ref={fileInputRef}
              type="file"
              accept={FILE_ACCEPT}
              onChange={handleFileSelect}
              className={styles.fileInputHidden}
              aria-hidden="true"
              tabIndex={-1}
              disabled={submitting}
            />
            <div className={styles.attachZone}>
              <button
                type="button"
                className={styles.attachBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                aria-label="Joindre un fichier (PDF, image ou vidéo)"
                title="Joindre un fichier · PDF, JPG, PNG, WebP, MP4, WebM · max 10 MB"
              >
                <i className="fas fa-paperclip" aria-hidden="true" />
                {attachFile ? 'Changer le fichier' : 'Joindre un fichier (optionnel)'}
              </button>

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
                    onClick={() => { setAttachFile(null); setAttachErr(null); }}
                    aria-label={`Retirer le fichier ${attachFile.name}`}
                  >
                    <i className="fas fa-times" aria-hidden="true" />
                  </button>
                </div>
              )}

              {uploading && (
                <div className={styles.uploadingBadge} role="status" aria-live="polite">
                  <i className="fas fa-circle-notch fa-spin" aria-hidden="true" />
                  Envoi de la pièce jointe…
                </div>
              )}
            </div>
            <p className={styles.attachHint} aria-hidden="true">
              <i className="fas fa-circle-info" /> PDF, PNG, JPG, WebP, MP4, WebM · max 10 MB
            </p>
            {attachErr && (
              <div className={styles.attachErrMsg} role="alert">
                <i className="fas fa-triangle-exclamation" aria-hidden="true" /> {attachErr}
              </div>
            )}
          </section>

          {/* ── Erreur de soumission ── */}
          {submitErr && (
            <div className={styles.submitError} role="alert">
              <i className="fas fa-exclamation-triangle" aria-hidden="true" />
              {submitErr}
            </div>
          )}

          {/* ── Actions ── */}
          <div className={styles.actions}>
            <Link to="/support" className={styles.cancelBtn}>
              Annuler
            </Link>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!canSubmit || submitting}
              aria-disabled={!canSubmit || submitting}
            >
              {uploading
                ? <><i className="fas fa-circle-notch fa-spin" aria-hidden="true" /> Pièce jointe…</>
                : submitting
                ? <><i className="fas fa-circle-notch fa-spin" aria-hidden="true" /> Envoi…</>
                : <><i className="fas fa-paper-plane" aria-hidden="true" /> Envoyer ma demande</>
              }
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
