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
import React, { useState, FormEvent, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './NewTicketPage.module.css';
import { supportApi } from '../services/support.api';

/* ── Types de demande avec icône ET description ── */
const TICKET_TYPES = [
  {
    value: 'general',
    label: 'Question générale',
    icon:  'fa-circle-question',
    desc:  'Toute question sur Shopi',
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
  const navigate = useNavigate();

  /* ── État formulaire ── */
  const [ticketType, setTicketType] = useState('');
  const [subject, setSubject]       = useState('');
  const [message, setMessage]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr]   = useState<string | null>(null);

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

  /* ── Soumission ── */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const ticket = await supportApi.createTicket({
        type:         ticketType,
        subject:      subject.trim(),
        firstMessage: message.trim(),
      });
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
              {submitting
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
