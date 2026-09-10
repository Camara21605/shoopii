/* ================================================================
 * FICHIER : sections/params/SecDocuments.tsx
 * Section "Vérification" — documents d'identité et justificatifs.
 * API : onUploadDocument(type, file) → POST /partenaire/parametres/documents
 * ================================================================ */

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  { key: 'cni',      icon: 'fa-id-card',      required: true  },
  { key: 'domicile', icon: 'fa-file-invoice', required: true  },
  { key: 'activite', icon: 'fa-briefcase',    required: false },
] as const;

export default function SecDocuments({ documents, saving, onUploadDocument, onToast }: Props) {
  const { t } = useTranslation();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleUpload(type: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onUploadDocument(type, file);
      onToast(t('partenaireParametres.secDocuments.uploadSuccessToast'), 's');
    } catch (err: any) {
      onToast(err?.message ?? t('partenaireParametres.secDocuments.uploadErrorToast'), 'w');
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

  const STATUS_ICON: Record<string, string> = {
    ok: 'fa-circle-check', wait: 'fa-clock', todo: 'fa-minus-circle',
  };

  return (
    <div className={s.fc}>
      <div className={s.fcHd}>
        <div>
          <div className={s.fcTtl}><i className="fas fa-id-card" /> {t('partenaireParametres.secDocuments.title')}</div>
          <div className={s.fcSub}>{t('partenaireParametres.secDocuments.sub')}</div>
        </div>
      </div>
      <div className={s.fcBody}>
        {DOCS.map(doc => {
          const state = getDocState(doc.key);
          return (
            <div className={s.docItem} key={doc.key}>
              <div className={`${s.docIc} ${state === 'ok' ? s.docOk : state === 'wait' ? s.docWait : s.docTodo}`}>
                <i className={`fas ${doc.icon}`} />
              </div>
              <div className={s.docMain}>
                <div className={s.docNm}>
                  {t(`partenaireParametres.secDocuments.docs.${doc.key}`)}
                  {!doc.required && <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--t3)' }}>{t('partenaireParametres.secDocuments.optionnel')}</span>}
                </div>
                <div className={`${s.docSt} ${state === 'ok' ? s.docStOk : state === 'wait' ? s.docStWait : s.docStTodo}`}>
                  <i className={`fas ${STATUS_ICON[state]}`} /> {t(`partenaireParametres.secDocuments.statuts.${state}`)}
                </div>
              </div>
              <button
                className={s.docAct}
                disabled={saving}
                onClick={() => fileRefs.current[doc.key]?.click()}
              >
                {state === 'todo' ? t('partenaireParametres.secDocuments.ajouterBtn') : t('partenaireParametres.secDocuments.remplacerBtn')}
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
        {t('partenaireParametres.secDocuments.footerNote')}
      </div>
    </div>
  );
}
