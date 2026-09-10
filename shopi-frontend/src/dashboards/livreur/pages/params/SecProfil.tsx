/*
 * FICHIER : src/dashboards/livreur/pages/params/SecProfil.tsx
 * ✅ CONNECTÉ À L'API
 */
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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

function buildPcSteps(t: (key: string) => string) {
  return [
    { label: t('livreurSecProfil.steps.photo'),     key:'photoUrl'         },
    { label: t('livreurSecProfil.steps.identite'),  key:'fullName'         },
    { label: t('livreurSecProfil.steps.zones'),     key:'communesActives'  },
    { label: t('livreurSecProfil.steps.vehicule'),  key:'VehicleType'      },
    { label: t('livreurSecProfil.steps.horaires'),  key:'horaires'         },
    { label: t('livreurSecProfil.steps.documents'), key:'documentCni'      },
  ];
}

export default function SecProfil({ data, saving, dirty, onPop, saveProfil, uploadPhoto, onAvatarRefresh }: Props) {
  const { t } = useTranslation();
  const PC_STEPS = buildPcSteps(t);
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
      onPop(t('livreurSecProfil.toasts.saveSuccess'), 's');
      onAvatarRefresh?.();
    } catch (err: any) {
      onPop(err?.message ?? t('livreurSecProfil.toasts.saveError'), 'e');
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { onPop(t('livreurSecProfil.toasts.photoTooBig'), 'e'); return; }
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      onPop(t('livreurSecProfil.toasts.photoInvalidFormat'), 'e'); return;
    }
    try {
      onPop(t('livreurSecProfil.toasts.photoUploading'), 'i');
      await uploadPhoto(file);
      onPop(t('livreurSecProfil.toasts.photoUpdated'), 's');
      onAvatarRefresh?.();
    } catch (err: any) {
      onPop(err?.message ?? t('livreurSecProfil.toasts.photoUploadError'), 'e');
    }
    e.target.value = '';
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-user" /> {t('livreurSecProfil.header.titre')}</h2>
        <p>{t('livreurSecProfil.header.sub')}</p>
      </div>

      {/* Complétion */}
      <div className={ps.profComplete}>
        <div className={ps.pcBg} />
        <div className={ps.pcInner}>
          <div className={ps.pcCircle}>
            <div className={ps.pcPct}>{pct}%</div>
            <div className={ps.pcPctL}>{t('livreurSecProfil.completion.label')}</div>
          </div>
          <div className={ps.pcInfo}>
            <div className={ps.pcTitle}>{t('livreurSecProfil.completion.titlePrefix', { pct })}{pct < 100 && t('livreurSecProfil.completion.titleSuffix')}</div>
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
          <div style={{ fontSize:11, color:'rgba(228,228,231,.45)', maxWidth:160, lineHeight:1.5, flexShrink:0 }}>
            {t('livreurSecProfil.completion.footerPart1')}<strong style={{ color:'#000000' }}>{t('livreurSecProfil.completion.footerBold')}</strong>{t('livreurSecProfil.completion.footerPart2')}
          </div>
        </div>
      </div>

      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-id-card" /> {t('livreurSecProfil.identiteCard.titre')}</div></div>
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
                style={{ background:'var(--tl-bg)', color:'var(--teal)', border:'1px solid rgba(0,0,0,.2)',
                  borderRadius:'var(--pill)', padding:'6px 14px', fontSize:11, fontWeight:700, width:'100%', cursor:'pointer' }}>
                {saving ? <><i className="fas fa-spinner fa-spin" /></> : t('livreurSecProfil.avatar.changer')}
              </button>
            </div>
            <div style={{ flex:1, minWidth:200 }}>
              <div onClick={() => photoRef.current?.click()}
                style={{ border:'2px dashed var(--bdr2)', borderRadius:'var(--r-xl)', padding:24, textAlign:'center', cursor:'pointer', background:'var(--g50)' }}>
                <i className="fas fa-cloud-arrow-up" style={{ fontSize:26, color:'var(--t4)', display:'block', marginBottom:8 }} />
                <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)', marginBottom:4 }}>{t('livreurSecProfil.avatar.dragTitle')}</div>
                <div style={{ fontSize:11, color:'var(--t3)' }}>{t('livreurSecProfil.avatar.dragSubPrefix')}<span style={{ color:'var(--teal)', fontWeight:600 }}>{t('livreurSecProfil.avatar.dragSubBrowse')}</span>{t('livreurSecProfil.avatar.dragSubSuffix')}</div>
              </div>
            </div>
          </div>

          {/* Emoji picker */}
          <div style={{ marginBottom:18 }}>
            <div className={ps.fiLabel} style={{ marginBottom:9 }}>
              {t('livreurSecProfil.emoji.label')} <span className={ps.fiOpt}>{t('livreurSecProfil.emoji.sub')}</span>
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
              <div className={ps.fiLabel}>{t('livreurSecProfil.fields.prenom')}</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-user" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input className={ps.fiInput} value={firstName} onChange={e => { setFirstName(e.target.value); dirty(); }} placeholder={t('livreurSecProfil.fields.prenomPlaceholder')} />
              </div>
            </div>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>{t('livreurSecProfil.fields.nom')}</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-user" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input className={ps.fiInput} value={lastName} onChange={e => { setLastName(e.target.value); dirty(); }} placeholder={t('livreurSecProfil.fields.nomPlaceholder')} />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className={ps.fiGroup} style={{ marginBottom:14 }}>
            <div className={ps.fiLabel}>{t('livreurSecProfil.fields.bio')} <span className={ps.fiOpt}>{t('livreurSecProfil.fields.bioSub')}</span></div>
            <div className={ps.fiWrap} style={{ alignItems:'flex-start' }}>
              <i className="fas fa-pen-to-square" style={{ position:'absolute', left:13, top:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
              <textarea className={ps.fiInput}
                style={{ paddingTop:11, minHeight:80, lineHeight:1.6, resize:'vertical' }}
                value={bio} onChange={e => { setBio(e.target.value); dirty(); }}
                placeholder={t('livreurSecProfil.fields.bioPlaceholder')} maxLength={500}
              />
            </div>
            <div className={ps.fiHint}><i className="fas fa-circle-info" /> {t('livreurSecProfil.fields.bioCompteur', { count: bio.length })}</div>
          </div>

          {/* Téléphone + Email */}
          <div className={ps.grid2} style={{ marginBottom:14 }}>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>{t('livreurSecProfil.fields.telephone')}</div>
              <div className={ps.fiWrap} style={{ position:'relative' }}>
                <div className={ps.phonePfx}>🇬🇳 +224</div>
                <input className={ps.fiInput} type="tel" value={phone}
                  onChange={e => { setPhone(e.target.value); dirty(); }}
                  style={{ paddingLeft:90 }} placeholder={t('livreurSecProfil.fields.telephonePlaceholder')} />
              </div>
              <div className={ps.fiHint}><i className="fas fa-circle-info" /> {t('livreurSecProfil.fields.telephoneHint')}</div>
            </div>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>{t('livreurSecProfil.fields.email')}</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-envelope" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input className={ps.fiInput} type="email" value={email}
                  onChange={e => { setEmail(e.target.value); dirty(); }} placeholder={t('livreurSecProfil.fields.emailPlaceholder')} />
              </div>
            </div>
          </div>

          {/* Langues + Ville */}
          <div className={ps.grid2}>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>{t('livreurSecProfil.fields.langues')}</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-language" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input className={ps.fiInput} value={langues}
                  onChange={e => { setLangues(e.target.value); dirty(); }} placeholder={t('livreurSecProfil.fields.languesPlaceholder')} />
              </div>
            </div>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>{t('livreurSecProfil.fields.ville')}</div>
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
            ? <><i className="fas fa-spinner fa-spin" /> {t('livreurSecProfil.save.saving')}</>
            : <><i className="fas fa-cloud-arrow-up" /> {t('livreurSecProfil.save.button')}</>
          }
        </button>
      </div>
    </div>
  );
}