/* SecDocuments.tsx — VERSION CONNECTÉE */
import React, { useRef } from 'react';
import s from '../../styles/ParamsShared.module.css';
import { pop } from '../../components/Toast';
import { DOCUMENTS } from '../../data/parametresData';
import type { CorrespondantData } from '../../hooks/useCorrespondantParametres';

type DocType = 'cni' | 'bail' | 'assurance' | 'casier' | 'registre';

/* Mapping document metadata → champ data */
const DOC_FIELD: Record<DocType, keyof CorrespondantData> = {
  cni: 'documentCni', bail: 'documentBail', assurance: 'documentAssurance',
  casier: 'documentCasier', registre: 'documentRegistre',
};
const DOC_TYPE_MAP: Record<string, DocType> = {
  "Carte nationale d'identité":                    'cni',
  'Bail commercial / Attestation de local':         'bail',
  "Attestation d'assurance responsabilité":         'assurance',
  'Casier judiciaire (B3)':                         'casier',
  'Photos du point de dépôt':                       'registre', // handled separately
  'Registre de commerce / NIF':                     'registre',
};

const STATUS_LABEL: Record<string, string> = { ok:'✓ Vérifié', pend:'⏳ En attente', miss:'⚠ Manquant' };
const STATUS_CLS:   Record<string, string> = { ok: s.docStatusOk, pend: s.docStatusPend, miss: s.docStatusMiss };

interface Props {
  data:      CorrespondantData | null;
  onUpload:  (type: string, file: File) => Promise<void>;
  onDelete:  (type: string) => Promise<void>;
}

const INFO = [
  ['Délai de vérification','24–72h ouvrables après soumission'],
  ['Validité','Renouvelable tous les 12 mois'],
  ['Contact équipe','verification@shopi.africa'],
];

export default function SecDocuments({ data, onUpload, onDelete }: Props) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  /* Détermine le statut d'un document depuis les données API */
  function getStatus(docKey: keyof CorrespondantData): 'ok' | 'pend' | 'miss' {
    if (!data) return 'miss';
    const url = data[docKey] as string | null;
    if (!url) return 'miss';
    if (data.verificationStatus === 'verified') return 'ok';
    if (data.verificationStatus === 'reviewing') return 'pend';
    return 'ok'; // URL présente mais pas encore en review = uploadé
  }

  async function handleUpload(type: DocType, file: File) {
    try {
      await onUpload(type, file);
      pop(`✅ Document "${type}" uploadé`, 's');
    } catch (e: any) { pop(`❌ ${e.message}`, 'e'); }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={s.psHd}>
        <h1><i className="fas fa-file-shield" /> Documents & Vérification</h1>
        <p>Documents obligatoires pour maintenir votre statut de correspondant vérifié Shopi.</p>
      </div>

      <div className={s.fc}>
        <div className={s.fcHd}>
          <div><div className={s.fcTtl}><i className="fas fa-shield-check" /> Statut de vérification</div></div>
          {data?.verificationStatus === 'verified' && (
            <div style={{ background:'var(--em-bg)', color:'var(--emerald,#047857)', fontSize:11, fontWeight:700, padding:'5px 13px', borderRadius:'var(--pill)', border:'1px solid rgba(4,120,87,.2)', display:'flex', alignItems:'center', gap:5 }}>
              <i className="fas fa-shield-check" /> Correspondant vérifié
            </div>
          )}
          {data?.verificationStatus === 'reviewing' && (
            <div style={{ background:'var(--cor-bg)', color:'var(--cor,#B45309)', fontSize:11, fontWeight:700, padding:'5px 13px', borderRadius:'var(--pill)', border:'1px solid var(--bdr-cor)', display:'flex', alignItems:'center', gap:5 }}>
              <i className="fas fa-clock" /> Vérification en cours
            </div>
          )}
        </div>
        <div className={s.fcBody}>
          <div className={s.docList}>
            {DOCUMENTS.map(doc => {
              const docType = DOC_TYPE_MAP[doc.nm] ?? 'cni';
              const fieldKey = DOC_FIELD[docType];
              const status   = getStatus(fieldKey);
              const hasFile  = !!(data?.[fieldKey] as string | null);

              return (
                <div key={doc.nm} className={s.docItem}>
                  {/* Input file caché */}
                  <input ref={el => fileRefs.current[docType] = el} type="file"
                    accept="image/*,.pdf" hidden
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(docType, f); }} />
                  <div className={s.docIc} style={{ background:doc.bg }}>
                    <i className={`fas ${doc.ic}`} style={{ color:doc.c, fontSize:15 }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className={s.docNm}>{doc.nm}</div>
                    <div className={s.docSub}>{doc.sub}</div>
                    {/* Lien vers le document uploadé */}
                    {hasFile && (
                      <a href={data![fieldKey] as string} target="_blank" rel="noreferrer"
                        style={{ fontSize:10, color:'var(--cli,#1A4FC4)', marginTop:2, display:'inline-flex', alignItems:'center', gap:4 }}>
                        <i className="fas fa-link" /> Voir le document
                      </a>
                    )}
                  </div>
                  <span className={`${s.docStatus} ${STATUS_CLS[status]}`}>{STATUS_LABEL[status]}</span>
                  <div style={{ display:'flex', gap:5 }}>
                    <button className={s.docUpload} onClick={() => fileRefs.current[docType]?.click()}>
                      {hasFile ? 'Renouveler' : 'Uploader'}
                    </button>
                    {hasFile && (
                      <button onClick={() => onDelete(docType).then(() => pop('🗑️ Document supprimé', 'w'))}
                        style={{ background:'rgba(220,38,38,.07)', color:'var(--red)', border:'1px solid rgba(220,38,38,.2)', borderRadius:'var(--r-sm)', padding:'6px 10px', fontSize:11, cursor:'pointer' }}>
                        <i className="fas fa-trash-can" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={s.fc}>
        <div className={s.fcHd}><div><div className={s.fcTtl}><i className="fas fa-info-circle" /> Informations de vérification</div></div></div>
        <div className={s.fcBody}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11 }}>
            {INFO.map(([l, v]) => (
              <div key={l} style={{ background:'var(--g50)', border:'1px solid var(--bdr)', borderRadius:'var(--r-md,12px)', padding:12 }}>
                <div style={{ fontSize:10, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', marginBottom:4 }}>{l}</div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--navy)' }}>{v}</div>
              </div>
            ))}
            <div style={{ background:'var(--g50)', border:'1px solid var(--bdr)', borderRadius:'var(--r-md,12px)', padding:12 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', marginBottom:4 }}>Statut actuel</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--navy)', textTransform:'capitalize' }}>
                {data?.verificationStatus === 'verified' ? '✅ Vérifié' : data?.verificationStatus === 'reviewing' ? '⏳ En cours' : '⚠️ Non vérifié'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}