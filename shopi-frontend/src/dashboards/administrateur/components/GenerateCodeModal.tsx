/* ================================================================
 * FICHIER : src/dashboards/administrateur/components/GenerateCodeModal.tsx
 *
 * Modale de génération de code en 2 étapes.
 * Spécificité admin : le type PARTENAIRE est disponible
 * (préfixe PAR), en plus de ENT / LVR / COR.
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/GenerateCodeModal.module.css';
import type { ActeurType } from '../data/types';
import { apiFetch } from '../../../shared/services/apiFetch';

interface GenerateCodeModalProps {
  onClose:    () => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

/* L'admin peut créer tous les types — partenaire par défaut */
const TYPES: { id: ActeurType; icon: string; label: string }[] = [
  { id: 'par', icon: 'fa-handshake',  label: 'Partenaire' },
  { id: 'ent', icon: 'fa-store',      label: 'Entreprise' },
  { id: 'lvr', icon: 'fa-motorcycle', label: 'Livreur' },
  { id: 'cor', icon: 'fa-map-pin',    label: 'Correspondant' },
];

/* ActeurType (court, frontend) → targetRole attendu par le backend */
const TYPE_TO_ROLE: Record<ActeurType, string> = {
  par: 'partner', ent: 'company', lvr: 'delivery', cor: 'correspondent',
};

/* Email obligatoire : seul canal d'envoi opérationnel pour l'instant
 * (SMS/WhatsApp désactivés) — un code sans email ne pourrait jamais
 * être transmis au destinataire. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function GenerateCodeModal({ onClose, onToast }: GenerateCodeModalProps) {
  const [step, setStep]       = useState<1 | 2>(1);
  const [selType, setSelType] = useState<ActeurType>('par');
  const [nom, setNom]         = useState('');
  const [tel, setTel]         = useState('');
  const [email, setEmail]     = useState('');
  const [code, setCode]       = useState('');
  const [codeId, setCodeId]   = useState('');
  const [generating, setGenerating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const emailValid = EMAIL_RE.test(email.trim());

  /* Étape 1 → 2 : génère réellement le code côté backend et passe au résultat */
  const generer = async () => {
    if (generating || !emailValid) return;
    setGenerating(true);
    try {
      const res = await apiFetch<{ id: string; code: string }>('/dashboard/admin/codes', {
        method: 'POST',
        body: {
          targetRole:  TYPE_TO_ROLE[selType],
          targetEmail: email.trim(),
          targetName:  nom.trim() || null,
        },
      });
      setCode(res.code);
      setCodeId(res.id);
      setEmailSent(false);
      setStep(2);
      onToast(`✅ Code généré${nom.trim() ? ' pour ' + nom.trim() : ''}`, 's');
    } catch {
      onToast('Impossible de générer le code. Réessayez.', 'w');
    } finally {
      setGenerating(false);
    }
  };

  /* Envoie le code par email au destinataire enregistré à l'étape 1 */
  const envoyerParEmail = async () => {
    if (sendingEmail) return;
    setSendingEmail(true);
    try {
      await apiFetch(`/dashboard/admin/codes/${codeId}/send-email`, { method: 'POST' });
      setEmailSent(true);
      onToast('✉️ Code envoyé par email à ' + email.trim(), 's');
    } catch {
      onToast('Échec de l\'envoi de l\'email. Réessayez.', 'w');
    } finally {
      setSendingEmail(false);
    }
  };

  /* Copie le code dans le presse-papier */
  const copier = () => {
    navigator.clipboard?.writeText(code);
    onToast('📋 Code copié : ' + code, 's');
  };

  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <button className={styles.x} onClick={onClose}><i className="fas fa-xmark" /></button>

        {/* ── Étape 1 : choix du type + destinataire ── */}
        {step === 1 && (
          <>
            <div className={styles.head}>
              <div className={styles.title}>Générer un code de création</div>
              <div className={styles.sub}>
                L&apos;administrateur peut créer tous les types de comptes, y compris des partenaires.
              </div>
            </div>
            <div className={styles.body}>
              <div className={styles.fld}>
                <label className={styles.fldL}>Type d&apos;acteur</label>
                <div className={styles.typeGrid}>
                  {TYPES.map(t => (
                    <div key={t.id}
                      className={`${styles.typeOpt} ${styles['t_' + t.id]} ${selType === t.id ? styles.onOpt : ''}`}
                      onClick={() => setSelType(t.id)}>
                      <i className={`fas ${t.icon}`} />
                      <div className={styles.typeNm}>{t.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.fld}>
                <label className={styles.fldL}>Nom du destinataire (optionnel)</label>
                <input className={styles.fldIn} value={nom} onChange={e => setNom(e.target.value)}
                  placeholder="Ex. Fatoumata Camara" />
              </div>
              <div className={styles.fld}>
                <label className={styles.fldL}>Téléphone (optionnel)</label>
                <input className={styles.fldIn} value={tel} onChange={e => setTel(e.target.value)}
                  placeholder="+224 6•• •• •• ••" inputMode="tel" />
              </div>
              <div className={styles.fld}>
                <label className={styles.fldL}>Email du destinataire <span className={styles.required}>*</span></label>
                <input className={styles.fldIn} value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="destinataire@exemple.com" type="email" required />
                {email.trim().length > 0 && !emailValid && (
                  <div className={styles.fldErr}>Email invalide.</div>
                )}
              </div>
              <button className={styles.mBtn} onClick={generer} disabled={generating || !emailValid}
                title={!emailValid ? "L'email du destinataire est obligatoire" : undefined}>
                <i className={`fas ${generating ? 'fa-spinner fa-spin' : 'fa-bolt'}`} />
                {generating ? 'Génération…' : 'Générer le code'}
              </button>
            </div>
          </>
        )}

        {/* ── Étape 2 : affiche le code + options d'envoi ── */}
        {step === 2 && (
          <>
            <div className={styles.head}>
              <div className={styles.title}>Code généré ✓</div>
              <div className={styles.sub}>Envoyez-le au destinataire — le compte créé sera rattaché à votre zone.</div>
            </div>
            <div className={styles.body}>
              <div className={styles.result}>
                <div className={styles.resultL}>Code de création</div>
                <div className={styles.resultV}>{code}</div>
                <div className={styles.resultExp}>
                  <i className="fas fa-clock" /> Valable 7 jours · usage unique · Zone Conakry
                </div>
              </div>
              <div className={styles.sendRow}>
                <button className={`${styles.sendBtn} ${styles.sendMail}`}
                  disabled={sendingEmail || emailSent}
                  onClick={envoyerParEmail}>
                  <i className={`fas ${sendingEmail ? 'fa-spinner fa-spin' : emailSent ? 'fa-check' : 'fa-envelope'}`} />
                  {emailSent ? 'Envoyé' : 'Email'}
                </button>
                <button className={`${styles.sendBtn} ${styles.sendSms}`} disabled
                  title="Bientôt disponible">
                  <i className="fas fa-comment-sms" /> SMS
                </button>
                <button className={`${styles.sendBtn} ${styles.sendWa}`} disabled
                  title="Bientôt disponible">
                  <i className="fab fa-whatsapp" /> WhatsApp
                </button>
                <button className={`${styles.sendBtn} ${styles.sendCopy}`} onClick={copier}>
                  <i className="fas fa-copy" /> Copier
                </button>
              </div>
              <button className={styles.mBtn} onClick={onClose} style={{ marginTop: 16 }}>
                <i className="fas fa-check" /> Terminé
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
