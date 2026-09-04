/* ================================================================
 * FICHIER : sections/params/SecDocuments.tsx
 * Section "Vérification" — documents d'identité et justificatifs.
 * API : onUploadDocument(type, file) → POST /partenaire/parametres/documents
 * ================================================================ */

import { useRef } from 'react';
import s from '../../styles/ParamsShared.module.css';
import type { PartenaireDocumentsState } from '../../hooks/usePartenaireParametres';

interface Props {
  documents:        PartenaireDocumentsState | null;
  saving:           boolean;
  onUploadDocument: (type: string, file: File) => Promise<void>;
  onToast:          (msg: string, type?: 's' | 'i' | 'w') => void;
}

/* Définition des documents — la clé correspond au type attendu par
   POST /dashboard/partenaire/parametres/documents/:type */
const DOCS = [
  { key: 'cni',      icon: 'fa-id-card',      label: "Pièce d'identité (CNI / Passeport)", required: true  },
  { key: 'domicile', icon: 'fa-file-invoice', label: 'Justificatif de domicile',           required: true  },
  { key: 'activite', icon: 'fa-briefcase',    label: "Justificatif d'activité",            required: false },
] as const;

export default function SecDocuments({ documents, saving, onUploadDocument, onToast }: Props) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleUpload(type: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onUploadDocument(type, file);
      onToast('✅ Document téléversé avec succès', 's');
    } catch (err: any) {
      onToast(err?.message ?? '❌ Échec du téléversement', 'w');
    } finally {
      e.target.value = '';
    }
  }

  /* En attente de vérification admin dès que les 2 documents obligatoires
     sont présents mais que verificationStatus n'est pas encore "verified"
     (voir DocumentsPartenaireService.uploadDocument côté backend). */
  function getDocState(key: 'cni' | 'domicile' | 'activite'): 'ok' | 'wait' | 'todo' {
    const present = documents?.documents?.[key]?.present ?? false;
    if (!present) return 'todo';
    if (documents?.verificationStatus === 'verified') return 'ok';
    return 'wait';
  }

  const STATUS_LABELS: Record<string, { label: string; icon: string }> = {
    ok:   { label: 'Vérifié', icon: 'fa-circle-check' },
    wait: { label: 'En cours de vérification', icon: 'fa-clock' },
    todo: { label: 'Non fourni', icon: 'fa-minus-circle' },
  };

  return (
    <div className={s.fc}>
      <div className={s.fcHd}>
        <div>
          <div className={s.fcTtl}><i className="fas fa-id-card" /> Documents & vérification</div>
          <div className={s.fcSub}>La vérification renforce votre indice de confiance et débloque des paliers supérieurs.</div>
        </div>
      </div>
      <div className={s.fcBody}>
        {DOCS.map(doc => {
          const state = getDocState(doc.key);
          const st    = STATUS_LABELS[state];
          return (
            <div className={s.docItem} key={doc.key}>
              <div className={`${s.docIc} ${state === 'ok' ? s.docOk : state === 'wait' ? s.docWait : s.docTodo}`}>
                <i className={`fas ${doc.icon}`} />
              </div>
              <div className={s.docMain}>
                <div className={s.docNm}>
                  {doc.label}
                  {!doc.required && <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--t3)' }}>(optionnel)</span>}
                </div>
                <div className={`${s.docSt} ${state === 'ok' ? s.docStOk : state === 'wait' ? s.docStWait : s.docStTodo}`}>
                  <i className={`fas ${st.icon}`} /> {st.label}
                </div>
              </div>
              <button
                className={s.docAct}
                disabled={saving}
                onClick={() => fileRefs.current[doc.key]?.click()}
              >
                {state === 'todo' ? 'Ajouter' : 'Remplacer'}
              </button>
              {/* Seul le PDF est accepté côté backend (UploadService.uploadDocument) */}
              <input
                type="file" accept=".pdf"
                style={{ display: 'none' }}
                ref={el => { fileRefs.current[doc.key] = el; }}
                onChange={e => handleUpload(doc.key, e)}
              />
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>
        <i className="fas fa-lock" style={{ marginRight: 6 }} />
        La pièce d'identité et le justificatif de domicile sont obligatoires : tant qu'ils
        ne sont pas fournis, le retrait de vos commissions reste bloqué.
      </div>
    </div>
  );
}
