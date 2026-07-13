/* ================================================================
 * FICHIER : pages/parametres/CommunicationSection.tsx
 * Section 10 — Communication automatisée.
 * Templates email/SMS, réponse automatique, signature.
 * ================================================================ */

import { useState } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps } from './types';

const TEMPLATES_INIT = [
  { id: 'welcome',  type: 'email', label: 'Bienvenue',               objet: 'Bienvenue sur Shopi !', corps: 'Bonjour {{prenom}}, votre compte a été créé avec succès. Bonne découverte !' },
  { id: 'valid',    type: 'email', label: 'Validation confirmée',    objet: 'Votre compte est validé', corps: 'Félicitations {{prenom}} ! Votre dossier a été approuvé.' },
  { id: 'suspend',  type: 'sms',   label: 'Suspension de compte',   objet: '',                        corps: 'Votre compte Shopi a été suspendu. Contactez-nous au +224 XXX.' },
  { id: 'rappel',   type: 'sms',   label: 'Rappel commande',        objet: '',                        corps: 'Rappel : la commande #{{ref}} est en attente de votre action.' },
];

export default function CommunicationSection({ onToast }: SectionProps) {
  const [templates, setTemplates] = useState(TEMPLATES_INIT);
  const [selected, setSelected]   = useState(TEMPLATES_INIT[0].id);
  const [autoReply, setAutoReply] = useState(true);
  const [signature, setSignature] = useState('Cordialement,\nAïssatou Condé\nAdministratrice Zone Conakry\nShopi Guinée');

  const tpl = templates.find(t => t.id === selected)!;
  const update = (key: 'objet' | 'corps', val: string) =>
    setTemplates(ts => ts.map(t => t.id === selected ? { ...t, [key]: val } : t));

  return (
    <div className={styles.secBody}>

      {/* ── Éditeur de templates ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-envelope-open-text" /> Templates de messages</div>
            <div className={styles.cardSub}>Personnalisez les messages automatiques envoyés aux acteurs</div>
          </div>
          <button className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`}
            onClick={() => onToast('Template enregistré', 's')}>
            <i className="fas fa-check" /> Sauvegarder
          </button>
        </div>
        <div className={styles.cardBody}>
          {/* Sélection du template */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {templates.map(t => (
              <button key={t.id}
                className={`${styles.btn} ${selected === t.id ? styles.btnPrimary : styles.btnSecondary} ${styles.btnSm}`}
                onClick={() => setSelected(t.id)}>
                <i className={`fas ${t.type === 'email' ? 'fa-envelope' : 'fa-comment-sms'}`} />
                {t.label}
              </button>
            ))}
          </div>

          <span className={`${styles.bdg} ${tpl.type === 'email' ? styles.bdgBlue : styles.bdgAmber}`} style={{ marginBottom: 14, display: 'inline-flex' }}>
            <i className={`fas ${tpl.type === 'email' ? 'fa-envelope' : 'fa-comment-sms'}`} />
            {tpl.type === 'email' ? 'E-mail' : 'SMS'}
          </span>

          {tpl.type === 'email' && (
            <div className={styles.fld} style={{ marginBottom: 12 }}>
              <label className={styles.fldL}>Objet de l&apos;e-mail</label>
              <input className={styles.fldIn} value={tpl.objet}
                onChange={e => update('objet', e.target.value)} />
            </div>
          )}

          <div className={styles.fld}>
            <label className={styles.fldL}>Corps du message</label>
            <textarea className={styles.fldArea} rows={4} value={tpl.corps}
              onChange={e => update('corps', e.target.value)} />
            <span className={styles.fldHint}>
              Variables disponibles : {'{{prenom}}'} {'{{nom}}'} {'{{ref}}'} {'{{zone}'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Réponse automatique ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-reply" /> Réponse automatique</div>
            <div className={styles.cardSub}>Répondre automatiquement aux messages entrants</div>
          </div>
          <div className={`${styles.sw} ${autoReply ? styles.swOn : ''}`}
            onClick={() => { setAutoReply(v => !v); onToast(`Réponse auto ${autoReply ? 'désactivée' : 'activée'}`, 's'); }} />
        </div>
        {autoReply && (
          <div className={styles.cardBody}>
            <div className={styles.fld}>
              <textarea className={styles.fldArea} rows={3}
                defaultValue="Bonjour, votre message a bien été reçu. Notre équipe vous répondra dans les 24 heures." />
              <span className={styles.fldHint}>Envoyé automatiquement lors d&apos;un message entrant en dehors des heures de bureau.</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Signature e-mail ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-signature" /> Signature e-mail</div>
            <div className={styles.cardSub}>Ajoutée en bas de chaque e-mail envoyé depuis votre compte</div>
          </div>
          <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
            onClick={() => onToast('Signature enregistrée', 's')}>
            <i className="fas fa-check" /> Enregistrer
          </button>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.fld}>
            <textarea className={styles.fldArea} rows={4} value={signature}
              onChange={e => setSignature(e.target.value)} />
            <span className={styles.fldHint}>Texte brut. Environ 3-4 lignes recommandées.</span>
          </div>
        </div>
      </div>

    </div>
  );
}
