/* ================================================================
 * sections/params/SecProfil.tsx — VERSION CONNECTÉE
 *
 * Connexions API :
 *   onSave(dto)       → PATCH /correspondant/parametres/profil
 *                       firstName/lastName/email/phone → User
 *                       bio/langues/typeCorrespondant  → Correspondent
 *   onUploadPhoto(f)  → POST  /correspondant/parametres/profil/photo
 *                       → User.profilePicture
 *
 * Initialisation :
 *   useEffect([data]) → remplit les champs dès que les données arrivent
 * ================================================================ */

import React, { useState, useEffect, useRef } from 'react';
import s from '../../styles/ParamsShared.module.css';
import { pop } from '../../components/Toast';
import type { CorrespondantData } from '../../hooks/useCorrespondantParametres';

/* Étapes de complétion du profil */
const PC_STEPS = [
  { key:'photo',     label:'Photo',             field: (d: CorrespondantData) => !!d.profilePicture      },
  { key:'identite',  label:'Identité',          field: (d: CorrespondantData) => !!(d.firstName && d.lastName) },
  { key:'depot',     label:'Dépôt',             field: (d: CorrespondantData) => !!d.depotAdresse        },
  { key:'zone',      label:'Zone',              field: (d: CorrespondantData) => !!(d.zonesActives?.length) },
  { key:'horaires',  label:'Horaires détaillés',field: (d: CorrespondantData) => (d.horaires?.length > 0) },
  { key:'fiscal',    label:'Infos fiscales',    field: (d: CorrespondantData) => !!d.documentRegistre    },
  { key:'assurance', label:'Assurance',         field: (d: CorrespondantData) => !!d.documentAssurance   },
];

interface Props {
  data:           CorrespondantData | null;
  saving:         boolean;
  dirty:          () => void;
  markClean:      () => void;
  saveTrigger:    number;
  onSave:         (body: Partial<CorrespondantData>) => Promise<any>;
  onUploadPhoto:  (file: File) => Promise<void>;
}

export default function SecProfil({ data, saving, dirty, markClean, saveTrigger, onSave, onUploadPhoto }: Props) {
  /* ── État local du formulaire ── */
  const [prenom,  setPrenom]  = useState('');
  const [nom,     setNom]     = useState('');
  const [bio,     setBio]     = useState('');
  const [phone,   setPhone]   = useState('');
  const [email,   setEmail]   = useState('');
  const [langues, setLangues] = useState('');
  const [type,    setType]    = useState('regional');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Initialisation depuis les données API ── */
  useEffect(() => {
    if (!data) return;
    setPrenom(data.firstName  ?? '');
    setNom(data.lastName      ?? '');
    setBio(data.bio           ?? '');
    setPhone(data.phone       ?? '');
    setEmail(data.email       ?? '');
    setLangues(data.langues   ?? '');
    setType(data.typeCorrespondant ?? 'regional');
  }, [data]);

  /* ── Réponse au saveTrigger (déclenché par SaveFloat) ── */
  useEffect(() => {
    if (saveTrigger > 0) handleSave();
  }, [saveTrigger]);

  /* ── Calcul complétion profil ── */
  const doneCount = data ? PC_STEPS.filter(s => s.field(data)).length : 0;
  const pct       = Math.round((doneCount / PC_STEPS.length) * 100);

  /* ── Sauvegarde ── */
  async function handleSave() {
    try {
      await onSave({ firstName: prenom, lastName: nom, bio, phone, email, langues, typeCorrespondant: type as any });
      markClean();
      pop('✅ Profil sauvegardé', 's');
    } catch (e: any) {
      pop(`❌ ${e.message ?? 'Erreur de sauvegarde'}`, 'e');
    }
  }

  /* ── Upload photo ── */
  async function handlePhotoFile(file: File) {
    setUploading(true);
    try {
      await onUploadPhoto(file);
      pop('✅ Photo mise à jour', 's');
      markClean();
    } catch (e: any) {
      pop(`❌ ${e.message ?? 'Upload échoué'}`, 'e');
    } finally {
      setUploading(false);
    }
  }

  const TYPE_MAP: Record<string, string> = {
    regional: 'Régional (Conakry)',
    zonal:    'Zonal (inter-régional)',
    national: 'National (tout le pays)',
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      <div className={s.psHd}>
        <h1><i className="fas fa-user" /> Profil & Identité</h1>
        <p>Informations publiques de votre compte correspondant. Visibles par vos boutiques partenaires et livreurs.</p>
      </div>

      {/* ── Barre complétion ── */}
      <div className={s.profileComplete}>
        <div className={s.pcBg} />
        <div className={s.pcInner}>
          <div className={s.pcRing}>
            <div className={s.pcRingVal}>{pct}%</div>
            <div className={s.pcRingLbl}>Profil</div>
          </div>
          <div className={s.pcInfo}>
            <div className={s.pcTitle}>Profil complété à {pct}%</div>
            <div className={s.pcBarBg}><div className={s.pcBarFill} style={{ width:`${pct}%` }} /></div>
            <div className={s.pcSteps}>
              {PC_STEPS.map(step => (
                <span key={step.key} className={`${s.pcStep} ${data && step.field(data) ? s.pcDone : s.pcMiss}`}>
                  <i className={`fas ${data && step.field(data) ? 'fa-check-circle' : 'fa-circle'}`} />
                  {step.label}
                </span>
              ))}
            </div>
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.45)', maxWidth:150, lineHeight:1.5, flexShrink:0 }}>
            Un profil complet attire <strong style={{ color:'var(--cor-lt,#F59E0B)' }}>2× plus</strong> de boutiques partenaires
          </div>
        </div>
      </div>

      {/* ── Photo ── */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div>
            <div className={s.fcTtl}><i className="fas fa-camera" /> Photo & Apparence</div>
            <div className={s.fcSub}>Votre photo rassure les boutiques et livreurs partenaires</div>
          </div>
        </div>
        <div className={s.fcBody}>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => {
            const file = e.target.files?.[0];
            if (file) handlePhotoFile(file);
          }} />
          <div style={{ display:'flex', alignItems:'flex-start', gap:22, flexWrap:'wrap' }}>
            <div style={{ textAlign:'center', flexShrink:0 }}>
              {/* Avatar : photo réelle ou emoji par défaut */}
              {data?.profilePicture
                ? <img src={data.profilePicture} alt="profil"
                    style={{ width:90, height:90, borderRadius:24, objectFit:'cover', border:'3px solid var(--cor-bg2)', display:'block', marginBottom:10, boxShadow:'var(--sh-md)' }} />
                : <div onClick={() => fileRef.current?.click()} style={{ width:90, height:90, borderRadius:24, background:'linear-gradient(135deg,var(--cor,#B45309),var(--navy-2,#112648))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, border:'3px solid var(--cor-bg2)', marginBottom:10, cursor:'pointer', boxShadow:'var(--sh-md)' }}>📍</div>
              }
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{ background:'var(--cor-bg)', color:'var(--cor,#B45309)', border:'1px solid var(--bdr-cor)', borderRadius:'var(--pill)', padding:'6px 14px', fontSize:11, fontWeight:700, display:'block', width:'100%', cursor:'pointer', marginBottom:4 }}>
                {uploading ? <><i className="fas fa-spinner fa-spin" /> Upload…</> : 'Changer'}
              </button>
            </div>
            <div style={{ flex:1, minWidth:200 }}>
              <div onClick={() => fileRef.current?.click()} style={{ border:'2px dashed var(--bdr-cor)', borderRadius:'var(--r-xl)', padding:24, textAlign:'center', cursor:'pointer', background:'var(--g50)' }}>
                <i className="fas fa-cloud-arrow-up" style={{ fontSize:28, color:'var(--t4)', display:'block', marginBottom:9 }} />
                <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)', marginBottom:4 }}>Glissez votre photo ici</div>
                <div style={{ fontSize:11, color:'var(--t3)' }}>ou <span style={{ color:'var(--cor)', fontWeight:600 }}>parcourir</span> · JPG, PNG · max 5 MB</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Informations personnelles ── */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div>
            <div className={s.fcTtl}><i className="fas fa-id-card" /> Informations personnelles</div>
            <div className={s.fcSub}>firstName/lastName/email/phone → mis à jour dans votre compte User</div>
          </div>
        </div>
        <div className={s.fcBody}>
          <div className={s.grid2}>
            <div className={s.fg}>
              <div className={s.fl}>Prénom <span className={s.flOpt}>*</span></div>
              <div className={s.fw}>
                <i className="fas fa-user" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
                <input className={s.fin} value={prenom} onChange={e => { setPrenom(e.target.value); dirty(); }} />
              </div>
            </div>
            <div className={s.fg}>
              <div className={s.fl}>Nom <span className={s.flOpt}>*</span></div>
              <div className={s.fw}>
                <i className="fas fa-user" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
                <input className={s.fin} value={nom} onChange={e => { setNom(e.target.value); dirty(); }} />
              </div>
            </div>
          </div>

          <div className={s.fg}>
            <div className={s.fl}>Biographie <span className={s.flOpt}>visible sur votre profil public — stockée dans Correspondent.bio</span></div>
            <div className={s.fw} style={{ alignItems:'flex-start' }}>
              <i className="fas fa-pen-to-square" style={{ position:'absolute', left:13, top:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
              <textarea className={s.fin} value={bio} onChange={e => { setBio(e.target.value); dirty(); }} style={{ paddingTop:11 }} />
            </div>
            <div className={s.fiHint}><i className="fas fa-circle-info" /> {bio.length}/500 caractères</div>
          </div>

          <div className={s.grid2}>
            <div className={s.fg}>
              <div className={s.fl}>Téléphone principal <span className={s.flOpt}>* — Orange Money</span></div>
              <div className={s.fw} style={{ position:'relative' }}>
                <div className={s.phonePfx}>🇬🇳 +224</div>
                <input className={s.fin} type="tel" value={phone} onChange={e => { setPhone(e.target.value); dirty(); }} style={{ paddingLeft:90 }} />
              </div>
              <div className={s.fiHint}><i className="fas fa-circle-info" /> Numéro Orange Money principal — stocké dans User.phone</div>
            </div>
            <div className={s.fg}>
              <div className={s.fl}>Email <span className={s.flOpt}>*</span></div>
              <div className={s.fw}>
                <i className="fas fa-envelope" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
                <input className={s.fin} type="email" value={email} onChange={e => { setEmail(e.target.value); dirty(); }} />
              </div>
            </div>
          </div>

          <div className={s.grid2}>
            <div className={s.fg}>
              <div className={s.fl}>Langues parlées</div>
              <div className={s.fw}>
                <i className="fas fa-language" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
                <input className={s.fin} value={langues} onChange={e => { setLangues(e.target.value); dirty(); }} />
              </div>
            </div>
            <div className={s.fg}>
              <div className={s.fl}>Type de correspondant</div>
              <div className={s.fw}>
                <i className="fas fa-network-wired" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
                <select className={s.fin} value={type} onChange={e => { setType(e.target.value); dirty(); }}>
                  <option value="regional">Régional (Conakry)</option>
                  <option value="zonal">Zonal (inter-régional)</option>
                  <option value="national">National (tout le pays)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder le profil</>}
        </button>
      </div>
    </div>
  );
}