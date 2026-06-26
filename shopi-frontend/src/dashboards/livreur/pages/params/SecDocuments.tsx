/*
 * FICHIER : src/dashboards/livreur/pages/params/SecDocuments.tsx
 * ✅ CONNECTÉ — upload réel vers l'API + statut depuis les données
 */
import React, { useRef } from 'react';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

interface Props {
  data:           LivreurData | null;
  saving:         boolean;
  onPop:          (m: string, t?: string) => void;
  uploadDocument: (type: string, file: File) => Promise<void>;
}

type DocKey = 'cni' | 'permis' | 'assurance' | 'casier';

const DOCS: { type: DocKey; label: string; sub: string; icon: string; accept: string }[] = [
  { type:'cni',      label:"CNI / Passeport",            sub:"Pièce d'identité officielle", icon:'fa-id-card',          accept:'image/*,application/pdf' },
  { type:'permis',   label:"Permis de conduire",         sub:"Permis valide correspondant à votre véhicule", icon:'fa-car',               accept:'image/*,application/pdf' },
  { type:'assurance',label:"Attestation d'assurance",   sub:"Couverture en cours de validité", icon:'fa-shield-halved',      accept:'application/pdf'         },
  { type:'casier',   label:"Casier judiciaire",          sub:"Extrait de casier B3 récent (< 3 mois)", icon:'fa-file-shield',        accept:'application/pdf'         },
];

const VERIFICATION_CFG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  pending:   { label:'Non soumis',         bg:'rgba(180,83,9,.09)',  color:'#B45309',   icon:'fa-clock'         },
  reviewing: { label:'En cours d\'examen', bg:'rgba(26,79,196,.09)', color:'var(--blue)', icon:'fa-magnifying-glass' },
  verified:  { label:'✅ Compte vérifié',  bg:'var(--em-bg)',        color:'var(--emerald)', icon:'fa-shield-check' },
  rejected:  { label:'❌ Dossier refusé', bg:'rgba(220,38,38,.09)', color:'var(--red)',  icon:'fa-circle-xmark'  },
};

export default function SecDocuments({ data, saving, onPop, uploadDocument }: Props) {
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  const verif = VERIFICATION_CFG[data?.verificationStatus ?? 'pending'];

  const urlMap: Record<DocKey, string | null | undefined> = {
    cni:      data?.documentCni,
    permis:   data?.documentPermis,
    assurance:data?.documentAssurance,
    casier:   data?.documentCasier,
  };

  async function handleFile(type: DocKey, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { onPop('❌ Fichier trop lourd — maximum 10 MB', 'e'); return; }
    try {
      onPop(`⏳ Upload "${DOCS.find(d=>d.type===type)?.label}" en cours…`, 'i');
      await uploadDocument(type, file);
      onPop(`✅ Document soumis — votre dossier est en cours d'examen`, 's');
    } catch (err: any) {
      onPop(err?.message ?? "❌ Échec de l'upload. Réessayez.", 'e');
    }
    e.target.value = '';
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-file-shield" /> Documents & Vérification</h2>
        <p>Documents obligatoires pour maintenir votre compte livreur actif sur Shopi.</p>
      </div>

      {/* Badge statut global */}
      <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 16px',
        borderRadius:'var(--pill)', background:verif.bg, color:verif.color,
        fontWeight:700, fontSize:12, alignSelf:'flex-start',
        border:`1px solid ${verif.color}30` }}>
        <i className={`fas ${verif.icon}`} /> {verif.label}
      </div>

      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}>
          <div className={ps.chT}><i className="fas fa-shield-check" /> Documents requis</div>
        </div>
        <div className={ps.cb}>
          {DOCS.map((d, i) => {
            const url     = urlMap[d.type];
            const present = !!url;
            return (
              <div key={d.type} style={{
                display:'flex', alignItems:'center', gap:12, padding:'13px 0',
                borderBottom: i < DOCS.length-1 ? '1px solid var(--bdr)' : 'none',
              }}>
                <div style={{ width:42, height:42, borderRadius:11, flexShrink:0,
                  background: present ? 'var(--em-bg)' : 'var(--sky)',
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className={`fas ${d.icon}`} style={{ color: present ? 'var(--emerald)' : 'var(--blue)', fontSize:16 }} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)' }}>{d.label}</div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>
                    {present
                      ? <><i className="fas fa-check-circle" style={{ color:'var(--emerald)' }} /> Document soumis</>
                      : d.sub
                    }
                  </div>
                </div>

                {/* Badge statut doc */}
                <span style={{ fontSize:10, fontWeight:700, padding:'4px 10px', borderRadius:'var(--pill)',
                  background: present ? 'var(--em-bg)' : 'rgba(220,38,38,.09)',
                  color: present ? 'var(--emerald)' : 'var(--red)',
                  border:`1px solid ${present ? 'rgba(4,120,87,.2)' : 'rgba(220,38,38,.2)'}`,
                  flexShrink:0 }}>
                  {present ? '✓ Soumis' : '⚠ Manquant'}
                </span>

                <input
                  ref={el => { refs.current[d.type] = el; }}
                  type="file" accept={d.accept} style={{ display:'none' }}
                  onChange={e => handleFile(d.type, e)} />
                <button
                  onClick={() => refs.current[d.type]?.click()}
                  disabled={saving}
                  style={{ background:'var(--sky)', color:'var(--blue)', border:'1px solid var(--sky-3)',
                    borderRadius:'var(--r-sm)', padding:'7px 14px', fontSize:11, fontWeight:700,
                    flexShrink:0, cursor:'pointer', opacity:saving ? 0.5 : 1 }}>
                  {present ? 'Renouveler' : 'Uploader'}
                </button>
              </div>
            );
          })}

          <div className={ps.fiHint} style={{ marginTop:12 }}>
            <i className="fas fa-circle-info" />
            Une fois les 4 documents soumis, votre dossier est examiné sous 48h par l'équipe Shopi.
          </div>
        </div>
      </div>
    </div>
  );
}