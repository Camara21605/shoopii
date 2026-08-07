/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/DocumentsSection.tsx
 * Section 8 — Documents & Vérification
 * Utilise l'UploadService côté backend via POST /parametres/documents/:type
 */
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: string) => void;
  uploadDocument: (type: string, file: File) => Promise<void>;
}

// Mapping type → champ dans ParametresData
const FIELD_MAP: Record<string, keyof ParametresData> = {
  cni:      'ownerIdDocument',
  rccm:     'documentRccm',
  bancaire: 'documentBancaire',
  photo:    'documentPhoto',
  nif:      'documentNif',
};

export default function DocumentsSection({ data, saving, onToast, uploadDocument }: Props) {
  const { t } = useTranslation();

  // Config des 5 types de documents
  const DOCS = [
    { type:'cni',      label:t('parametres.documents.docs.cni.label'),           icon:'fa-id-card',       accept:'image/*,application/pdf', hint:t('parametres.documents.docs.cni.hint') },
    { type:'rccm',     label:t('parametres.documents.docs.rccm.label'),icon:'fa-registered',    accept:'application/pdf',          hint:t('parametres.documents.docs.rccm.hint')  },
    { type:'bancaire', label:t('parametres.documents.docs.bancaire.label'),      icon:'fa-building-columns',accept:'application/pdf',        hint:t('parametres.documents.docs.bancaire.hint')   },
    { type:'photo',    label:t('parametres.documents.docs.photo.label'),    icon:'fa-store',         accept:'image/*',                  hint:t('parametres.documents.docs.photo.hint')        },
    { type:'nif',      label:t('parametres.documents.docs.nif.label'),  icon:'fa-file-invoice',  accept:'application/pdf',          hint:t('parametres.documents.docs.nif.hint')  },
  ];

  // Badge statut vérification
  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    pending:   { label:t('parametres.documents.status.pending'),          color:'var(--t2)',      bg:'rgba(128,128,128,.1)' },
    reviewing: { label:t('parametres.documents.status.reviewing'),  color:'var(--blue)',    bg:'var(--sky-2)'         },
    verified:  { label:t('parametres.documents.status.verified'),          color:'var(--emerald)', bg:'var(--em-bg)'         },
    rejected:  { label:t('parametres.documents.status.rejected'),           color:'var(--red)',     bg:'var(--rs-bg)'         },
  };

  // Un ref par type de document pour les inputs file cachés
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleFile(type: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      onToast(t('parametres.documents.toasts.tropLourd'), 'e');
      return;
    }

    try {
      onToast(t('parametres.documents.toasts.uploadEnCours'), 'i');
      await uploadDocument(type, file);
      onToast(t('parametres.documents.toasts.uploaded', { type }), 's');
    } catch {
      onToast(t('parametres.documents.toasts.echecUpload'), 'e');
    }

    // Reset l'input pour permettre re-sélection du même fichier
    e.target.value = '';
  }

  const statusConf = STATUS_CONFIG[data?.verificationStatus ?? 'pending'];

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-file-shield" /> {t('parametres.documents.title')}</h1>
        <p>{t('parametres.documents.subtitle')}</p>
      </div>

      {/* Badge statut global */}
      <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 18px', borderRadius:'var(--pill)', background:statusConf.bg, color:statusConf.color, fontWeight:700, fontSize:13, marginBottom:20, border:`1px solid ${statusConf.color}30` }}>
        <i className="fas fa-shield-halved" />
        {t('parametres.documents.statutVerification')} {statusConf.label}
      </div>

      <FormCard title={t('parametres.documents.requisTitle')} icon="fa-file-check" subtitle={t('parametres.documents.requisSubtitle')}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {DOCS.map(doc => {
            const url = data?.[FIELD_MAP[doc.type]] as string | null;
            const isPresent = !!url;

            return (
              <div key={doc.type} style={{
                display:'flex', alignItems:'center', gap:14,
                padding:'14px 16px', borderRadius:'var(--r-lg)',
                background: isPresent ? 'rgba(128,128,128,.06)' : 'var(--g50)',
                border:`1.5px solid ${isPresent ? 'rgba(128,128,128,.25)' : 'var(--bdr)'}`,
              }}>
                {/* Icône */}
                <div style={{
                  width:40, height:40, borderRadius:11, flexShrink:0,
                  background: isPresent ? 'rgba(128,128,128,.1)' : 'var(--sky,var(--g100))',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color: isPresent ? 'var(--t2)' : 'var(--t3)',
                }}>
                  <i className={`fas ${doc.icon}`} />
                </div>

                {/* Infos */}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)' }}>{doc.label}</div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>
                    {isPresent
                      ? <><i className="fas fa-check-circle" style={{ color:'var(--t2)' }} /> {t('parametres.documents.documentUploade')}</>
                      : doc.hint
                    }
                  </div>
                </div>

                {/* Bouton action */}
                <input
                  ref={el => { refs.current[doc.type] = el; }}
                  type="file"
                  accept={doc.accept}
                  style={{ display:'none' }}
                  onChange={e => handleFile(doc.type, e)}
                />
                <button
                  onClick={() => refs.current[doc.type]?.click()}
                  disabled={saving}
                  style={{
                    background: isPresent ? 'var(--sky,var(--g100))' : 'var(--navy)',
                    color: isPresent ? 'var(--t2)' : '#fff',
                    border: isPresent ? '1px solid var(--sky-3,#C8D9F8)' : 'none',
                    borderRadius:'var(--pill)', padding:'7px 16px',
                    fontSize:11, fontWeight:700, cursor:'pointer',
                    whiteSpace:'nowrap', flexShrink:0,
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  {isPresent ? t('parametres.documents.remplacer') : t('parametres.documents.uploader')}
                </button>
              </div>
            );
          })}
        </div>

        <div className={s.hint} style={{ marginTop:16 }}>
          <i className="fas fa-circle-info" /> {t('parametres.documents.hint')}
        </div>
      </FormCard>
    </>
  );
}