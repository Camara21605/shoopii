/* ================================================================
 * FICHIER : pages/parametres/CommunicationSection.tsx
 * Section — Communication de l'administrateur.
 *
 * Réelle via GET/PUT /dashboard/admin/communication :
 *   - message personnalisé + signature insérés dans les emails
 *     d'invitation (voir Paramètres > Codes > Envoyer par email)
 *   - modèles de notification qui remplacent le texte par défaut
 *     envoyé aux acteurs lors d'une validation/refus/suspension/
 *     avertissement/réactivation (voir NotificationEventService)
 *
 * L'ancienne version proposait des templates "Bienvenue" et "Rappel
 * commande" et une "réponse automatique" : aucune de ces trois choses
 * ne correspond à un envoi réellement déclenché par cet admin (compte
 * créé = flux d'inscription, rappel = aucun job existant, réponse
 * auto = admin ne participe à aucune messagerie entrante) — retirées
 * plutôt que de laisser croire qu'elles font quelque chose.
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps } from './types';
import { apiFetch, ApiError } from '../../../../shared/services/apiFetch';

interface NotifTemplates {
  approved?:    string;
  rejected?:    string;
  suspended?:   string;
  warned?:      string;
  reactivated?: string;
}

interface CommunicationSettings {
  invitationMessage: string | null;
  signature:         string | null;
  notifTemplates:    NotifTemplates | null;
}

const NOTIF_EVENTS: { key: keyof NotifTemplates; label: string; icon: string; vars: string[]; defaut: string }[] = [
  { key: 'approved',    label: 'Validation de compte',   icon: 'fa-check',                vars: ['{{acteur}}'],           defaut: "Votre compte a été validé par l'administrateur. Bienvenue sur Shopi !" },
  { key: 'rejected',    label: 'Refus de compte',        icon: 'fa-xmark',                vars: [],                        defaut: "Votre demande de compte n'a pas été acceptée. Contactez le support pour plus d'informations." },
  { key: 'suspended',   label: 'Suspension de compte',   icon: 'fa-ban',                  vars: ['{{acteur}}', '{{motif}}'], defaut: "Votre compte a été suspendu par l'administrateur. Motif : ..." },
  { key: 'warned',      label: 'Avertissement',          icon: 'fa-triangle-exclamation', vars: ['{{acteur}}', '{{motif}}'], defaut: "Vous avez reçu un avertissement de l'administrateur suite à un signalement." },
  { key: 'reactivated', label: 'Réactivation de compte', icon: 'fa-rotate-left',          vars: ['{{acteur}}'],           defaut: "Votre compte a été réactivé par l'administrateur. Vous pouvez de nouveau utiliser Shopi normalement." },
];

export default function CommunicationSection({ onToast }: SectionProps) {
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  const [invitationMessage, setInvitationMessage] = useState('');
  const [signature,         setSignature]         = useState('');
  const [templates,         setTemplates]         = useState<NotifTemplates>({});

  useEffect(() => {
    apiFetch<CommunicationSettings>('/dashboard/admin/communication')
      .then(data => {
        setInvitationMessage(data.invitationMessage ?? '');
        setSignature(data.signature ?? '');
        setTemplates(data.notifTemplates ?? {});
      })
      .catch(() => onToast('Impossible de charger les préférences de communication', 'w'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (patch: Partial<{ invitationMessage: string | null; signature: string | null; notifTemplates: NotifTemplates | null }>, successMsg: string) => {
    setSaving(true);
    try {
      const updated = await apiFetch<CommunicationSettings>('/dashboard/admin/communication', { method: 'PUT', body: patch });
      setInvitationMessage(updated.invitationMessage ?? '');
      setSignature(updated.signature ?? '');
      setTemplates(updated.notifTemplates ?? {});
      onToast(successMsg, 's');
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'Erreur lors de la sauvegarde', 'w');
    } finally {
      setSaving(false);
    }
  }, [onToast]);

  const saveInvitation = () => save({ invitationMessage: invitationMessage.trim() || null, signature: signature.trim() || null }, 'Message et signature enregistrés');
  const saveTemplates  = () => save({ notifTemplates: templates }, 'Modèles de notification enregistrés');

  if (loading) {
    return (
      <div className={styles.secBody}>
        <div className={styles.card}>
          <div className={styles.cardBody} style={{ textAlign: 'center', padding: '2rem', color: 'var(--t3)' }}>
            <i className="fas fa-spinner fa-spin" /> Chargement…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.secBody}>

      {/* ── Message d'invitation personnalisé ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-envelope-open-text" /> Email d&apos;invitation</div>
            <div className={styles.cardSub}>Ajoutés aux emails envoyés depuis Paramètres &gt; Codes &gt; Envoyer par email</div>
          </div>
          <button className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`} onClick={saveInvitation} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> Enregistrement…</> : <><i className="fas fa-check" /> Sauvegarder</>}
          </button>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.fld} style={{ marginBottom: 14 }}>
            <label className={styles.fldL}>Message personnalisé (optionnel)</label>
            <textarea className={styles.fldArea} rows={3} maxLength={2000} value={invitationMessage}
              placeholder="Ex : Bienvenue dans l'équipe Shoneya Conakry, n'hésitez pas à me contacter pour toute question."
              onChange={e => setInvitationMessage(e.target.value)} />
            <span className={styles.fldHint}>Affiché dans l&apos;email, juste après l&apos;introduction — laisser vide pour ne rien ajouter.</span>
          </div>
          <div className={styles.fld}>
            <label className={styles.fldL}>Signature (optionnel)</label>
            <input className={styles.fldIn} maxLength={300} value={signature}
              placeholder="Ex : Aïssatou Condé — Administratrice Zone Conakry"
              onChange={e => setSignature(e.target.value)} />
            <span className={styles.fldHint}>Affichée en bas de l&apos;email.</span>
          </div>
        </div>
      </div>

      {/* ── Modèles de notification ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-bell" /> Modèles de notification</div>
            <div className={styles.cardSub}>Remplacent le texte envoyé à l&apos;acteur pour chaque action — laisser vide pour garder le texte par défaut</div>
          </div>
          <button className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`} onClick={saveTemplates} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> Enregistrement…</> : <><i className="fas fa-check" /> Sauvegarder</>}
          </button>
        </div>
        <div className={styles.cardBody}>
          {NOTIF_EVENTS.map((ev, i) => (
            <div key={ev.key} style={{ marginBottom: i < NOTIF_EVENTS.length - 1 ? 16 : 0 }}>
              <label className={styles.fldL} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className={`fas ${ev.icon}`} /> {ev.label}
              </label>
              <textarea className={styles.fldArea} rows={2} maxLength={1000}
                value={templates[ev.key] ?? ''}
                placeholder={ev.defaut}
                onChange={e => setTemplates(t => ({ ...t, [ev.key]: e.target.value }))} />
              <span className={styles.fldHint}>
                {ev.vars.length > 0 ? `Variables disponibles : ${ev.vars.join(' ')}` : 'Pas de variable disponible pour cet événement.'}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
