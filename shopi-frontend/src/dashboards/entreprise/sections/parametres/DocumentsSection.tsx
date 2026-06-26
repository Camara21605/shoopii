/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/DocumentsSection.tsx
 * Section 8 — Documents & Vérification
 * Utilise l'UploadService côté backend via POST /parametres/documents/:type
 */
import React, { useRef } from 'react';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: string) => void;
  uploadDocument: (type: string, file: File) => Promise<void>;
}

// Config des 5 types de documents
const DOCS = [
  { type:'cni',      label:'CNI / Passeport',           icon:'fa-id-card',       accept:'image/*,application/pdf', hint:'JPG, PNG ou PDF · max 10 MB' },
  { type:'rccm',     label:'Registre du Commerce (RCCM)',icon:'fa-registered',    accept:'application/pdf',          hint:'PDF uniquement · max 10 MB'  },
  { type:'bancaire', label:'Justificatif bancaire',      icon:'fa-building-columns',accept:'application/pdf',        hint:'Relevé ou attestation PDF'   },
  { type:'photo',    label:'Photo boutique physique',    icon:'fa-store',         accept:'image/*',                  hint:'JPG, PNG · max 10 MB'        },
  { type:'nif',      label:'Attestation fiscale (NIF)',  icon:'fa-file-invoice',  accept:'application/pdf',          hint:'PDF uniquement · max 10 MB'  },
];

// Mapping type → champ dans ParametresData
const FIELD_MAP: Record<string, keyof ParametresData> = {
  cni:      'ownerIdDocument',
  rccm:     'documentRccm',
  bancaire: 'documentBancaire',
  photo:    'documentPhoto',
  nif:      'documentNif',
};

// Badge statut vérification
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label:'Non soumis',          color:'#B45309', bg:'rgba(180,83,9,.1)'   },
  reviewing: { label:'En cours d\'examen',  color:'#1A4FC4', bg:'rgba(26,79,196,.1)'  },
  verified:  { label:'✅ Vérifié',          color:'#047857', bg:'rgba(4,120,87,.1)'   },
  rejected:  { label:'❌ Refusé',           color:'#DC2626', bg:'rgba(220,38,38,.1)'  },
};

export default function DocumentsSection({ data, saving, onToast, uploadDocument }: Props) {
  // Un ref par type de document pour les inputs file cachés
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleFile(type: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      onToast('❌ Fichier trop lourd (max 10 MB)', 'e');
      return;
    }

    try {
      onToast('⏳ Upload en cours…', 'i');
      await uploadDocument(type, file);
      onToast(`✅ Document "${type}" uploadé`, 's');
    } catch {
      onToast(`❌ Échec de l'upload`, 'e');
    }

    // Reset l'input pour permettre re-sélection du même fichier
    e.target.value = '';
  }

  const statusConf = STATUS_CONFIG[data?.verificationStatus ?? 'pending'];

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-file-shield" /> Documents & Vérification</h1>
        <p>Soumettez vos documents légaux pour obtenir le badge "Boutique vérifiée Shopi".</p>
      </div>

      {/* Badge statut global */}
      <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 18px', borderRadius:'var(--pill)', background:statusConf.bg, color:statusConf.color, fontWeight:700, fontSize:13, marginBottom:20, border:`1px solid ${statusConf.color}30` }}>
        <i className="fas fa-shield-halved" />
        Statut de vérification : {statusConf.label}
      </div>

      <FormCard title="Documents requis" icon="fa-file-check" subtitle="Les 3 documents obligatoires : CNI + RCCM + Justificatif bancaire">
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {DOCS.map(doc => {
            const url = data?.[FIELD_MAP[doc.type]] as string | null;
            const isPresent = !!url;

            return (
              <div key={doc.type} style={{
                display:'flex', alignItems:'center', gap:14,
                padding:'14px 16px', borderRadius:'var(--r-lg)',
                background: isPresent ? 'rgba(4,120,87,.06)' : 'var(--g50)',
                border:`1.5px solid ${isPresent ? 'rgba(4,120,87,.25)' : 'var(--bdr)'}`,
              }}>
                {/* Icône */}
                <div style={{
                  width:40, height:40, borderRadius:11, flexShrink:0,
                  background: isPresent ? 'rgba(4,120,87,.1)' : 'var(--sky,#EEF3FD)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color: isPresent ? '#047857' : 'var(--t3)',
                }}>
                  <i className={`fas ${doc.icon}`} />
                </div>

                {/* Infos */}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)' }}>{doc.label}</div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>
                    {isPresent
                      ? <><i className="fas fa-check-circle" style={{ color:'#047857' }} /> Document uploadé</>
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
                    background: isPresent ? 'var(--sky,#EEF3FD)' : 'var(--navy)',
                    color: isPresent ? 'var(--blue)' : '#fff',
                    border: isPresent ? '1px solid var(--sky-3,#C8D9F8)' : 'none',
                    borderRadius:'var(--pill)', padding:'7px 16px',
                    fontSize:11, fontWeight:700, cursor:'pointer',
                    whiteSpace:'nowrap', flexShrink:0,
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  {isPresent ? 'Remplacer' : 'Uploader'}
                </button>
              </div>
            );
          })}
        </div>

        <div className={s.hint} style={{ marginTop:16 }}>
          <i className="fas fa-circle-info" /> Une fois les 3 documents obligatoires soumis, votre dossier passe automatiquement en révision. L'équipe Shopi vous contactera sous 48h.
        </div>
      </FormCard>
    </>
  );
}