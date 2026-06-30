/*
 * FICHIER : src/dashboards/livreur/pages/params/SecProfil.tsx
 * ✅ CONNECTÉ À L'API
 */
import React, { useState, useRef, useEffect } from 'react';
import { EMOJIS } from '../../data/parametresData';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

interface Props {
  data:             LivreurData | null;
  saving:           boolean;
  dirty:            () => void;
  onPop:            (m: string, t?: string) => void;
  saveProfil:       (body: Partial<LivreurData>) => Promise<void>;
  uploadPhoto:      (file: File) => Promise<void>;
  onAvatarRefresh?: () => void;
}

const PC_STEPS = [
  { label:'Photo',    key:'photoUrl'    },
  { label:'Identité', key:'fullName'    },
  { label:'Zones',    key:'communesActives' },
  { label:'Vehicule', key:'VehicleType' },
  { label:'Horaires', key:'horaires'    },
  { label:'Documents', key:'documentCni' },
];

export default function SecProfil({ data, saving, dirty, onPop, saveProfil, uploadPhoto, onAvatarRefresh }: Props) {
  const [selEmoji,   setSelEmoji]   = useState(0);
  const [firstName,  setFirstName]  = useState('');
  const [lastName,   setLastName]   = useState('');
  const [bio,        setBio]        = useState('');
  const [phone,      setPhone]      = useState('');
  const [email,      setEmail]      = useState('');
  const [langues,    setLangues]    = useState('');
  const [ville,      setVille]      = useState('Conakry');
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    const nameParts = data.fullName?.split(' ') ?? [];
    setFirstName(data.firstName ?? nameParts[0] ?? '');
    setLastName(data.lastName  ?? nameParts.slice(1).join(' ') ?? '');
    setBio(data.bio         ?? '');
    setPhone(data.phone     ?? '');
    setEmail(data.email     ?? '');
    setLangues(data.langues ?? '');
    setVille(data.ville     ?? 'Conakry');
    const emojiIdx = EMOJIS.indexOf(data.deliveryEmoji ?? '🛵');
    if (emojiIdx >= 0) setSelEmoji(emojiIdx);
  }, [data]);

  /* % complétion dynamique */
  const pct = data ? Math.round(
    [data.photoUrl, data.fullName, data.communesActives?.length, data.VehicleType, data.horaires?.length, data.documentCni]
      .filter(Boolean).length / 6 * 100
  ) : 0;

  async function handleSave() {
    try {
      await saveProfil({
        firstName, lastName,
        bio, phone, email, langues, ville,
        deliveryEmoji: EMOJIS[selEmoji] ?? '🛵',
      });
      onPop('✅ Profil sauvegardé avec succès', 's');
      onAvatarRefresh?.();
    } catch (err: any) {
      onPop(err?.message ?? '❌ Erreur lors de la sauvegarde', 'e');
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { onPop('❌ Photo trop lourde (max 5 MB)', 'e'); return; }
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      onPop('❌ Format invalide — JPG, PNG ou WebP uniquement', 'e'); return;
    }
    try {
      onPop('⏳ Upload de la photo en cours…', 'i');
      await uploadPhoto(file);
      onPop('✅ Photo de profil mise à jour', 's');
      onAvatarRefresh?.();
    } catch (err: any) {
      onPop(err?.message ?? "❌ Échec de l'upload", 'e');
    }
    e.target.value = '';
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-user" /> Profil personnel</h2>
        <p>Ces informations apparaissent sur votre profil public — visibles par les boutiques et clients.</p>
      </div>

      {/* Complétion */}
      <div className={ps.profComplete}>
        <div className={ps.pcBg} />
        <div className={ps.pcInner}>
          <div className={ps.pcCircle}>
            <div className={ps.pcPct}>{pct}%</div>
            <div className={ps.pcPctL}>Profil</div>
          </div>
          <div className={ps.pcInfo}>
            <div className={ps.pcTitle}>Profil complété à {pct}%{pct < 100 && ' — À compléter'}</div>
            <div className={ps.pcBarBg}><div className={ps.pcBarFill} style={{ width:`${pct}%` }} /></div>
            <div className={ps.pcSteps}>
              {PC_STEPS.map(s => {
                const done = !!(data && (data as any)[s.key]);
                return (
                  <span key={s.label} className={`${ps.pcStep} ${done ? ps.pcDone : ps.pcMiss}`}>
                    <i className={`fas ${done ? 'fa-check-circle' : 'fa-circle'}`} /> {s.label}
                  </span>
                );
              })}
            </div>
          </div>
          <div style={{ fontSize:11, color:'rgba(200,217,248,.45)', maxWidth:160, lineHeight:1.5, flexShrink:0 }}>
            Un profil complet reçoit <strong style={{ color:'#10B981' }}>3×</strong> plus de missions
          </div>
        </div>
      </div>

      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-id-card" /> Identité & Photo</div></div>
        <div className={ps.cb}>

          {/* Avatar */}
          <div style={{ display:'flex', alignItems:'flex-start', gap:20, marginBottom:20, flexWrap:'wrap' }}>
            <div style={{ textAlign:'center', flexShrink:0 }}>
              <div
                onClick={() => photoRef.current?.click()}
                style={{
                  width:88, height:88, borderRadius:22, overflow:'hidden',
                  background:'linear-gradient(135deg,var(--teal),var(--navy-2))',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:40, border:'3px solid var(--sky-3)',
                  cursor:'pointer', boxShadow:'var(--sh-md)', marginBottom:10,
                }}
              >
                {data?.photoUrl
                  ? <img src={data.photoUrl} alt="photo" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <span>{data?.deliveryEmoji ?? '🛵'}</span>
                }
              </div>
              <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp"
                style={{ display:'none' }} onChange={handlePhotoChange} />
              <button onClick={() => photoRef.current?.click()} disabled={saving}
                style={{ background:'var(--tl-bg)', color:'var(--teal)', border:'1px solid rgba(14,116,144,.2)',
                  borderRadius:'var(--pill)', padding:'6px 14px', fontSize:11, fontWeight:700, width:'100%', cursor:'pointer' }}>
                {saving ? <><i className="fas fa-spinner fa-spin" /></> : 'Changer'}
              </button>
            </div>
            <div style={{ flex:1, minWidth:200 }}>
              <div onClick={() => photoRef.current?.click()}
                style={{ border:'2px dashed var(--bdr2)', borderRadius:'var(--r-xl)', padding:24, textAlign:'center', cursor:'pointer', background:'var(--g50)' }}>
                <i className="fas fa-cloud-arrow-up" style={{ fontSize:26, color:'var(--t4)', display:'block', marginBottom:8 }} />
                <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)', marginBottom:4 }}>Glissez votre photo ici</div>
                <div style={{ fontSize:11, color:'var(--t3)' }}>ou <span style={{ color:'var(--teal)', fontWeight:600 }}>parcourir</span> · JPG, PNG · max 5 MB</div>
              </div>
            </div>
          </div>

          {/* Emoji picker */}
          <div style={{ marginBottom:18 }}>
            <div className={ps.fiLabel} style={{ marginBottom:9 }}>
              Icône de livraison <span className={ps.fiOpt}>affichée sur vos missions</span>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {EMOJIS.map((em, i) => (
                <div key={em} onClick={() => { setSelEmoji(i); dirty(); }}
                  style={{ width:48, height:48, borderRadius:12, cursor:'pointer', display:'flex', alignItems:'center',
                    justifyContent:'center', fontSize:22,
                    background: selEmoji===i ? 'var(--tl-bg)' : 'var(--g50)',
                    border:`1.5px solid ${selEmoji===i ? 'var(--teal)' : 'var(--bdr2)'}`,
                    transition:'all .2s' }}
                >{em}</div>
              ))}
            </div>
          </div>

          {/* Prénom + Nom */}
          <div className={ps.grid2} style={{ marginBottom:14 }}>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>Prénom</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-user" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input className={ps.fiInput} value={firstName} onChange={e => { setFirstName(e.target.value); dirty(); }} placeholder="Prénom" />
              </div>
            </div>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>Nom</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-user" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input className={ps.fiInput} value={lastName} onChange={e => { setLastName(e.target.value); dirty(); }} placeholder="Nom de famille" />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className={ps.fiGroup} style={{ marginBottom:14 }}>
            <div className={ps.fiLabel}>Bio publique <span className={ps.fiOpt}>visible sur votre profil</span></div>
            <div className={ps.fiWrap} style={{ alignItems:'flex-start' }}>
              <i className="fas fa-pen-to-square" style={{ position:'absolute', left:13, top:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
              <textarea className={ps.fiInput}
                style={{ paddingTop:11, minHeight:80, lineHeight:1.6, resize:'vertical' }}
                value={bio} onChange={e => { setBio(e.target.value); dirty(); }}
                placeholder="Décrivez votre expérience, vos zones et vos spécialités…" maxLength={500}
              />
            </div>
            <div className={ps.fiHint}><i className="fas fa-circle-info" /> {bio.length}/500 caractères</div>
          </div>

          {/* Téléphone + Email */}
          <div className={ps.grid2} style={{ marginBottom:14 }}>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>Téléphone principal</div>
              <div className={ps.fiWrap} style={{ position:'relative' }}>
                <div className={ps.phonePfx}>🇬🇳 +224</div>
                <input className={ps.fiInput} type="tel" value={phone}
                  onChange={e => { setPhone(e.target.value); dirty(); }}
                  style={{ paddingLeft:90 }} placeholder="620 00 00 00" />
              </div>
              <div className={ps.fiHint}><i className="fas fa-circle-info" /> Utilisé pour Orange Money et les appels clients</div>
            </div>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>Email</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-envelope" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input className={ps.fiInput} type="email" value={email}
                  onChange={e => { setEmail(e.target.value); dirty(); }} placeholder="votre@email.com" />
              </div>
            </div>
          </div>

          {/* Langues + Ville */}
          <div className={ps.grid2}>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>Langues parlées</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-language" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input className={ps.fiInput} value={langues}
                  onChange={e => { setLangues(e.target.value); dirty(); }} placeholder="Français, Pular, Soussou" />
              </div>
            </div>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>Ville de résidence</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-city" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <select className={ps.fiInput} value={ville}
                  onChange={e => { setVille(e.target.value); dirty(); }}
                  style={{ appearance:'none', paddingRight:30 }}>
                  {['Conakry','Kindia','Boké','Labé','Kankan','Faranah','Mamou','N\'Zérékoré'].map(v => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={handleSave} disabled={saving}
          style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
            padding:'12px 28px', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:8,
            cursor:'pointer', opacity:saving ? 0.6 : 1 }}>
          {saving
            ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</>
            : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder le profil</>
          }
        </button>
      </div>
    </div>
  );
}