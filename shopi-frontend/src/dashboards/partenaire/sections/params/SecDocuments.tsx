/* ================================================================
 * FICHIER : sections/params/SecDocuments.tsx
 * Section "Vérification" — documents d'identité et justificatifs.
 * API : onUploadDocument(type, file) → POST /partenaire/parametres/documents
 * ================================================================ */

import { useRef } from 'react';
import s from '../../styles/ParamsShared.module.css';
import type { PartenaireData } from '../../hooks/usePartenaireParametres';

interface Props {
  data:             PartenaireData | null;
  saving:           boolean;
  onUploadDocument: (type: string, file: File) => Promise<void>;
  onToast:          (msg: string, type?: 's' | 'i' | 'w') => void;
}

/* Définition des documents */
const DOCS = [
  { key: 'documentCni',      icon: 'fa-id-card',   label: "Pièce d'identité (CNI / Passeport)", required: true  },
  { key: 'documentDomicile', icon: 'fa-file-invoice', label: 'Justificatif de domicile',          required: true  },
  { key: 'documentActivite', icon: 'fa-briefcase',  label: "Justificatif d'activité",             required: false },
];

export default function SecDocuments({ data, saving, onUploadDocument, onToast }: Props) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleUpload(type: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onUploadDocument(type, file);
      onToast('✅ Document téléversé avec succès', 's');
    } catch {
      onToast('❌ Échec du téléversement', 'w');
    }
  }

  function getDocState(key: string): 'ok' | 'wait' | 'todo' {
    /* Les champs documentCni/documentDomicile/documentActivite ne sont pas
       encore dans l'entité Partner — section affichée en mode "à configurer".
       Sera enrichi quand les champs seront ajoutés à la DB. */
    const url = (data as any)?.[key];
    if (!url) return 'todo';
    return 'ok';
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
                onClick={() => {
                  if (state === 'ok') { onToast('👁️ Aperçu du document', 'i'); }
                  else { fileRefs.current[doc.key]?.click(); }
                }}
              >
                {state === 'ok' ? 'Voir' : state === 'wait' ? 'Voir' : 'Ajouter'}
              </button>
              <input
                type="file" accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
                ref={el => { fileRefs.current[doc.key] = el; }}
                onChange={e => handleUpload(doc.key, e)}
              />
            </div>
          );
        })}
        {/* Téléphone */}
        <div className={s.docItem}>
          <div className={`${s.docIc} ${s.docOk}`}><i className="fas fa-mobile-screen" /></div>
          <div className={s.docMain}>
            <div className={s.docNm}>Numéro de téléphone</div>
            <div className={`${s.docSt} ${s.docStOk}`}><i className="fas fa-circle-check" /> Confirmé par SMS</div>
          </div>
          <button className={s.docAct} onClick={() => onToast('🔄 Renvoyer le code SMS', 'i')}>Modifier</button>
        </div>
      </div>
    </div>
  );
}
