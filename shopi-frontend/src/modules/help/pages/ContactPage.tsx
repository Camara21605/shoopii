/* ============================================================
 * FICHIER : src/modules/help/pages/ContactPage.tsx
 *
 * RÔLE    : Formulaire de contact public Shopi.
 *           Route : /contact
 *
 * FONCTIONNALITÉS :
 *   - Sélection du type de demande par cartes cliquables (6 types)
 *   - Validation en temps réel avec retour visuel par champ (rouge/vert)
 *   - Compteur de caractères sur le textarea (avertissement à 2700/3000)
 *   - Soumission vers contactApi.submit() → POST /contact
 *   - Écran de succès avec référence de ticket
 *   - Sidebar avec canaux de contact alternatifs + délais de réponse
 *
 * SÉCURITÉ :
 *   - Rate-limited côté backend (3 soumissions/heure par IP via ThrottlerGuard)
 *   - Validation front pour UX uniquement — la validation réelle est en backend
 * ============================================================ */
import React, { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import styles from './ContactPage.module.css';
import { contactApi } from '../../contact/services/contact.api';

const TYPES = [
  { value: 'general',     label: 'Question générale', icon: 'fa-circle-question',  desc: 'Toute autre demande' },
  { value: 'billing',     label: 'Facturation',        icon: 'fa-credit-card',      desc: 'Paiements, factures' },
  { value: 'security',    label: 'Sécurité',           icon: 'fa-shield-halved',    desc: 'Fraude, compte compromis' },
  { value: 'partnership', label: 'Partenariat',        icon: 'fa-handshake',        desc: 'Collaboration, B2B' },
  { value: 'press',       label: 'Presse',             icon: 'fa-newspaper',        desc: 'Médias, relations presse' },
  { value: 'other',       label: 'Autre',              icon: 'fa-ellipsis',         desc: 'Autre demande' },
];

const CONTACTS = [
  { icon: 'fa-envelope',   label: 'Email support',     value: 'support@shopi.gn',    href: 'mailto:support@shopi.gn' },
  { icon: 'fa-headset',    label: 'Ticket de support', value: 'Réponse en 24h',       href: '/support/nouveau' },
  { icon: 'fa-book-open',  label: 'Centre d\'aide',    value: 'Base de connaissances',href: '/aide' },
];

export default function ContactPage() {
  const [form, setForm]       = useState({ name: '', email: '', subject: '', body: '', type: 'general' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [touched, setTouched] = useState<Partial<Record<keyof typeof form, boolean>>>({});

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [k]: e.target.value }));
    setTouched(prev => ({ ...prev, [k]: true }));
  };

  const blur = (k: keyof typeof form) => () => setTouched(prev => ({ ...prev, [k]: true }));

  const validName    = form.name.trim().length >= 2;
  const validEmail   = /\S+@\S+\.\S+/.test(form.email);
  const validSubject = form.subject.trim().length >= 5;
  const validBody    = form.body.trim().length >= 20;
  const canSubmit    = validName && validEmail && validSubject && validBody;

  const fieldErr = (k: keyof typeof form, valid: boolean, msg: string) =>
    touched[k] && !valid ? <span className={styles.fieldErr}>{msg}</span> : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, subject: true, body: true });
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await contactApi.submit({ ...form });
      setSuccess(res.reference);
      setForm({ name: '', email: '', subject: '', body: '', type: 'general' });
      setTouched({});
    } catch (e: any) {
      setError(e.message ?? "Erreur lors de l'envoi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>

        {/* Breadcrumb */}
        <nav className={styles.breadcrumb}>
          <Link to="/aide">Centre d'aide</Link>
          <span>/</span>
          <span>Contact</span>
        </nav>

        <div className={styles.layout}>

          {/* ── Sidebar infos ── */}
          <aside className={styles.sidebar}>
            <div className={styles.sideHeader}>
              <div className={styles.sideIcon}><i className="fas fa-headset" /></div>
              <h2 className={styles.sideTitle}>Nous contacter</h2>
              <p className={styles.sideSub}>Notre équipe vous répond dans les 24-48h ouvrées.</p>
            </div>

            <div className={styles.channels}>
              {CONTACTS.map(c => (
                <a key={c.href} href={c.href} className={styles.channel}>
                  <div className={styles.chanIcon}><i className={`fas ${c.icon}`} /></div>
                  <div>
                    <div className={styles.chanLabel}>{c.label}</div>
                    <div className={styles.chanValue}>{c.value}</div>
                  </div>
                  <i className="fas fa-chevron-right" style={{ color: '#C5D0E8', marginLeft: 'auto', fontSize: '11px' }} />
                </a>
              ))}
            </div>

            <div className={styles.notice}>
              <i className="fas fa-info-circle" />
              <p>Pour les demandes urgentes (fraude, sécurité), utilisez le formulaire de <Link to="/support/nouveau">ticket de support</Link> pour un traitement prioritaire.</p>
            </div>

            <div className={styles.slaInfo}>
              <div className={styles.slaItem}>
                <i className="fas fa-clock" />
                <div>
                  <div className={styles.slaLabel}>Temps de réponse</div>
                  <div className={styles.slaValue}>24-48h ouvrées</div>
                </div>
              </div>
              <div className={styles.slaItem}>
                <i className="fas fa-shield-halved" />
                <div>
                  <div className={styles.slaLabel}>Sécurité / Fraude</div>
                  <div className={styles.slaValue} style={{ color: '#E53E3E' }}>Priorité haute — 4h</div>
                </div>
              </div>
            </div>
          </aside>

          {/* ── Form ── */}
          <div className={styles.formWrap}>
            {success ? (
              <div className={styles.successBox}>
                <div className={styles.successIcon}><i className="fas fa-check-circle" /></div>
                <h2 className={styles.successTitle}>Message envoyé !</h2>
                <p className={styles.successRef}>Référence : <strong>{success}</strong></p>
                <p className={styles.successText}>
                  Nous avons bien reçu votre message. Un email de confirmation vous a été envoyé.
                  Notre équipe vous répondra dans les <strong>48 heures ouvrées</strong>.
                </p>
                <div className={styles.successActions}>
                  <button className={styles.newBtn} onClick={() => setSuccess(null)}>Envoyer un autre message</button>
                  <Link to="/aide" className={styles.helpBtn}>Centre d'aide</Link>
                </div>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit} noValidate>
                <h2 className={styles.formTitle}>Formulaire de contact</h2>

                {/* ── Type de demande (cards) ── */}
                <div className={styles.field}>
                  <label className={styles.label}>Type de demande</label>
                  <div className={styles.typeGrid}>
                    {TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        className={`${styles.typeCard} ${form.type === t.value ? styles.typeCardActive : ''}`}
                        onClick={() => setForm(prev => ({ ...prev, type: t.value }))}
                        title={t.desc}
                      >
                        <i className={`fas ${t.icon}`} />
                        <span className={styles.typeLabel}>{t.label}</span>
                        {form.type === t.value && <i className="fas fa-circle-check" style={{ position: 'absolute', top: 6, right: 6, fontSize: 11, color: '#1A4FC4' }} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Nom + Email ── */}
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label}>Nom <span className={styles.req}>*</span></label>
                    <input
                      className={`${styles.input} ${touched.name && !validName ? styles.inputErr : touched.name && validName ? styles.inputOk : ''}`}
                      type="text" placeholder="Votre nom" value={form.name}
                      onChange={set('name')} onBlur={blur('name')} maxLength={255}
                    />
                    {fieldErr('name', validName, 'Minimum 2 caractères')}
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Email <span className={styles.req}>*</span></label>
                    <input
                      className={`${styles.input} ${touched.email && !validEmail ? styles.inputErr : touched.email && validEmail ? styles.inputOk : ''}`}
                      type="email" placeholder="votre@email.com" value={form.email}
                      onChange={set('email')} onBlur={blur('email')} maxLength={255}
                    />
                    {fieldErr('email', validEmail, 'Adresse email invalide')}
                  </div>
                </div>

                {/* ── Sujet ── */}
                <div className={styles.field}>
                  <label className={styles.label}>Sujet <span className={styles.req}>*</span></label>
                  <input
                    className={`${styles.input} ${touched.subject && !validSubject ? styles.inputErr : touched.subject && validSubject ? styles.inputOk : ''}`}
                    type="text" placeholder="Sujet de votre message" value={form.subject}
                    onChange={set('subject')} onBlur={blur('subject')} maxLength={500}
                  />
                  {fieldErr('subject', validSubject, 'Minimum 5 caractères')}
                </div>

                {/* ── Message ── */}
                <div className={styles.field}>
                  <label className={styles.label}>Message <span className={styles.req}>*</span></label>
                  <textarea
                    className={`${styles.textarea} ${touched.body && !validBody ? styles.inputErr : touched.body && validBody ? styles.inputOk : ''}`}
                    placeholder="Décrivez votre demande en détail (min. 20 caractères)"
                    value={form.body}
                    onChange={set('body')} onBlur={blur('body')}
                    rows={6} maxLength={3000}
                  />
                  <div className={styles.counterRow}>
                    {fieldErr('body', validBody, `Encore ${Math.max(0, 20 - form.body.length)} caractères nécessaires`)}
                    <span className={`${styles.counter} ${form.body.length > 2700 ? styles.counterWarn : ''}`}>
                      {form.body.length}/3000
                    </span>
                  </div>
                </div>

                {error && <div className={styles.err}><i className="fas fa-exclamation-triangle" /> {error}</div>}

                <button type="submit" className={styles.submit} disabled={loading}>
                  {loading
                    ? <><i className="fas fa-circle-notch fa-spin" /> Envoi en cours…</>
                    : <><i className="fas fa-paper-plane" /> Envoyer le message</>}
                </button>

                <p className={styles.formNote}>
                  <i className="fas fa-lock" /> Vos données sont traitées de manière confidentielle conformément à notre politique de confidentialité.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
