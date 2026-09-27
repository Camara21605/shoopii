/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/DocumentsSection.tsx
 * Section 8 — Documents & Vérification
 * Utilise l'UploadService côté backend via POST /parametres/documents/:type
 *
 * CORRECTIONS :
 *   - documents OBLIGATOIRES (CNI, RCCM, justificatif bancaire — les seuls
 *     qui déclenchent l'examen côté serveur) distingués des facultatifs, avec
 *     la progression « x / 3 » ;
 *   - photos (JPG/PNG/WebP) acceptées pour toutes les pièces, comme le serveur
 *     (le sélecteur n'autorisait que le PDF pour certaines — pénible depuis un
 *     téléphone) ; type et taille vérifiés avant l'envoi ;
 *   - chaque statut expliqué ; toast avec le NOM du document (et non « cni ») ;
 *   - plus de promesse « contacté sous 48 h » que rien ne garantit.
 */
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';
import type { ToastType } from '../../types';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: ToastType) => void;
  uploadDocument: (type: string, file: File) => Promise<void>;
}

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
const TYPES_OK = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

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
    { type:'cni',      label:t('parametres.documents.docs.cni.label'),      icon:'fa-id-card',          accept:ACCEPT,                           obligatoire:true  },
    { type:'rccm',     label:t('parametres.documents.docs.rccm.label'),     icon:'fa-registered',       accept:ACCEPT,                           obligatoire:true  },
    { type:'bancaire', label:t('parametres.documents.docs.bancaire.label'), icon:'fa-building-columns', accept:ACCEPT,                           obligatoire:true  },
    { type:'photo',    label:t('parametres.documents.docs.photo.label'),    icon:'fa-store',            accept:'image/jpeg,image/png,image/webp', obligatoire:false },
    { type:'nif',      label:t('parametres.documents.docs.nif.label'),      icon:'fa-file-invoice',     accept:ACCEPT,                           obligatoire:false },
  ];
  const nbObligatoiresFournis = DOCS.filter(d => d.obligatoire && !!data?.[FIELD_MAP[d.type]]).length;

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
    e.target.value = '';           // re-choisir le même fichier redéclenche onChange
    if (!file) return;
    const label = DOCS.find(d => d.type === type)?.label ?? type;

    if (file.size > 10 * 1024 * 1024) {
      onToast(t('parametres.documents.toasts.tropLourd'), 'e');
      return;
    }
    if (!TYPES_OK.includes(file.type) || (type === 'photo' && file.type === 'application/pdf')) {
      onToast(t('parametres.documents.toasts.formatInvalide'), 'e');
      return;
    }

    try {
      onToast(t('parametres.documents.toasts.uploadEnCours'), 'i');
      await uploadDocument(type, file);
      onToast(t('parametres.documents.toasts.uploaded', { type: label }), 's');
    } catch (err: unknown) {
      onToast(err instanceof Error && err.message ? `❌ ${err.message}` : t('parametres.documents.toasts.echecUpload'), 'e');
    }
  }

  const statut = data?.verificationStatus ?? 'pending';
  const statusConf = STATUS_CONFIG[statut] ?? STATUS_CONFIG.pending;

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
      <div className={s.hint} style={{ marginTop:-10, marginBottom:18 }}>
        <i className="fas fa-circle-info" /> {t(`parametres.documents.statusHint.${statut}`, { count: nbObligatoiresFournis })}
      </div>

      <FormCard title={t('parametres.documents.requisTitle')} icon="fa-file-check" subtitle={t('parametres.documents.requisSubtitle')}
        action={<span className={`${s.badge} ${nbObligatoiresFournis === 3 ? s.green : s.blue}`} style={{ fontSize:11, padding:'4px 12px' }}>{t('parametres.documents.progression', { n: nbObligatoiresFournis })}</span>}
      >
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
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    {doc.label}
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:999,
                      background: doc.obligatoire ? 'var(--am-bg, rgba(180,83,9,.09))' : 'var(--g100)',
                      color: doc.obligatoire ? 'var(--amber)' : 'var(--t3)' }}>
                      {doc.obligatoire ? t('parametres.documents.obligatoire') : t('parametres.documents.facultatif')}
                    </span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>
                    {isPresent
                      ? <><i className="fas fa-check-circle" style={{ color:'var(--t2)' }} /> {t('parametres.documents.documentUploade')}</>
                      : (doc.type === 'photo' ? t('parametres.documents.hintPhoto') : t('parametres.documents.hintFormats'))
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
                  type="button"
                  aria-label={`${isPresent ? t('parametres.documents.remplacer') : t('parametres.documents.uploader')} — ${doc.label}`}
                  onClick={() => refs.current[doc.type]?.click()}
                  disabled={saving}
                  style={{
                    background: isPresent ? 'var(--sky,var(--g100))' : 'var(--btn, #111113)',
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