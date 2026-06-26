// src/dashboards/livreur/pages/AjouterCorrespondantPage.tsx
// Permet à un livreur d'ajouter (inviter) un correspondant dans son réseau,
// exactement comme le fait une entreprise — différent de "suivre" un correspondant.

import React, { useState } from 'react';
import shared from '../styles/Shared.module.css';
import {
  correspondantsApi,
  type CorrespondantType,
  type InvitationResponse,
} from '../../../shared/services/api/correspondants.api';

interface Props { onPop: (m: string, t?: string) => void; }

function typeLabel(type: CorrespondantType): string {
  return {
    principal: '⭐ Principal',
    entrepot:  '🏭 Entrepôt',
    export:    '✈️ Export',
    relais:    '📍 Relais',
  }[type];
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--r-md)',
  border: '1.5px solid var(--bdr)',
  fontSize: 13,
  fontFamily: 'var(--fb)',
  color: 'var(--navy)',
  background: 'var(--white)',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--t2)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 6,
};

const groupStyle: React.CSSProperties = { marginBottom: 14 };

export default function AjouterCorrespondantPage({ onPop }: Props) {
  const [etape,    setEtape]    = useState<1 | 2 | 3>(1);
  const [nom,      setNom]      = useState('');
  const [email,    setEmail]    = useState('');
  const [ville,    setVille]    = useState('');
  const [quartier, setQuartier] = useState('');
  const [type,     setType]     = useState<CorrespondantType>('relais');
  const [message,  setMessage]  = useState(
    'Bonjour,\n\nVous avez été sélectionné pour rejoindre le réseau de correspondants Shopi.\n\nVeuillez utiliser le code ci-joint pour créer votre compte.'
  );
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<InvitationResponse | null>(null);

  function validerEtape1() {
    if (!nom.trim())   { onPop('⚠️ Le nom est requis', 'w');   return; }
    if (!email.trim()) { onPop('⚠️ L\'email est requis', 'w'); return; }
    if (!email.includes('@') || !email.includes('.')) { onPop('⚠️ Email invalide', 'w'); return; }
    setEtape(2);
  }

  async function handleEnvoyer() {
    setLoading(true);
    try {
      const res = await correspondantsApi.inviter({
        fullName: nom.trim(),
        email:    email.trim(),
        type,
        ville:    ville.trim() || undefined,
        quartier: quartier.trim() || undefined,
        message:  message.trim() || undefined,
      });
      setResult(res);
      setEtape(3);
      onPop(`✅ Invitation envoyée à ${email}`, 's');
    } catch (err: any) {
      onPop(`❌ ${err.message}`, 'e');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setEtape(1);
    setNom('');
    setEmail('');
    setVille('');
    setQuartier('');
    setType('relais');
    setResult(null);
  }

  const realCode = result?.code ?? '';

  return (
    <div className={shared.page}>
      <div className={`${shared.card} ${shared.cardLast}`}>
        <div className={shared.ch}>
          <div className={shared.chT}><i className="fas fa-user-plus" /> Ajouter un correspondant</div>
        </div>
        <div className={shared.cb}>

          {/* Étapes */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
            {['Informations', 'Aperçu', 'Confirmé'].map((e, i) => (
              <React.Fragment key={i}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{
                    width:22, height:22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:11, fontWeight:800,
                    background: etape === i+1 ? 'var(--teal)' : etape > i+1 ? 'var(--em-bg)' : 'var(--g100)',
                    color:      etape === i+1 ? '#fff' : etape > i+1 ? 'var(--emerald)' : 'var(--t3)',
                  }}>
                    {etape > i+1 ? <i className="fas fa-check" /> : i+1}
                  </span>
                  <span style={{ fontSize:12, fontWeight:700, color: etape === i+1 ? 'var(--navy)' : 'var(--t3)' }}>{e}</span>
                </div>
                {i < 2 && <div style={{ flex:1, height:1, background: etape > i+1 ? 'var(--emerald)' : 'var(--g200)' }} />}
              </React.Fragment>
            ))}
          </div>

          {/* ÉTAPE 1 — informations */}
          {etape === 1 && (
            <div className={shared.g2}>
              <div>
                <div style={groupStyle}>
                  <label style={labelStyle}><i className="fas fa-store" /> Nom du point relais *</label>
                  <input style={inputStyle} placeholder="Ex: RelaisPlus Kaloum" value={nom} onChange={e => setNom(e.target.value)} />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}><i className="fas fa-envelope" /> Email de contact *</label>
                  <input type="email" style={inputStyle} placeholder="Ex: relais@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
                  <p style={{ fontSize:11, color:'var(--t3)', marginTop:5 }}><i className="fas fa-circle-info" /> Le code d'invitation sera envoyé à cet email.</p>
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}><i className="fas fa-tag" /> Type de correspondant</label>
                  <select style={inputStyle} value={type} onChange={e => setType(e.target.value as CorrespondantType)}>
                    <option value="relais">📍 Point relais — Dépôt/retrait colis</option>
                    <option value="entrepot">🏭 Entrepôt — Stockage régional</option>
                    <option value="export">✈️ Export — International</option>
                    <option value="principal">⭐ Principal — Hub central</option>
                  </select>
                </div>
              </div>
              <div>
                <div style={groupStyle}>
                  <label style={labelStyle}><i className="fas fa-city" /> Ville</label>
                  <input style={inputStyle} placeholder="Ex: Conakry" value={ville} onChange={e => setVille(e.target.value)} />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}><i className="fas fa-map-pin" /> Quartier / Zone</label>
                  <input style={inputStyle} placeholder="Ex: Kaloum, Matam…" value={quartier} onChange={e => setQuartier(e.target.value)} />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}><i className="fas fa-message" /> Message personnalisé</label>
                  <textarea style={{ ...inputStyle, resize:'vertical' }} rows={5} value={message} onChange={e => setMessage(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 — aperçu */}
          {etape === 2 && (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--t3)', marginBottom:10 }}><i className="fas fa-eye" /> Aperçu de l'email qui sera envoyé</div>
              <div style={{ border:'1px solid var(--bdr)', borderRadius:'var(--r-lg)', overflow:'hidden', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'var(--g50)', borderBottom:'1px solid var(--bdr)' }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--teal)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontFamily:'var(--fd)' }}>S</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)' }}>Invitation Shopi — Rejoignez notre réseau</div>
                    <div style={{ fontSize:11, color:'var(--t3)' }}>À : <strong>{email}</strong></div>
                  </div>
                </div>
                <div style={{ padding:'14px 16px' }}>
                  <p style={{ fontSize:13, color:'var(--navy)', marginBottom:8 }}>Bonjour <strong>{nom}</strong>,</p>
                  <p style={{ whiteSpace:'pre-line', fontSize:12.5, color:'var(--t2)', lineHeight:1.6, marginBottom:12 }}>{message}</p>
                  <div style={{ background:'var(--g50)', border:'1px dashed var(--bdr2)', borderRadius:'var(--r-md)', padding:'10px 14px', textAlign:'center', marginBottom:12 }}>
                    <div style={{ fontSize:11, color:'var(--t3)', marginBottom:4 }}>Votre code d'invitation</div>
                    <div style={{ fontFamily:'var(--fd)', fontSize:18, letterSpacing:'0.3em', color:'var(--t4)' }}>••••-••••-••</div>
                    <div style={{ fontSize:10, color:'var(--t4)', marginTop:4 }}>Valable 7 jours · Usage unique · Généré à l'envoi</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, color:'var(--t2)' }}>
                    {ville && <div><i className="fas fa-city" /> Ville : <strong>{ville}</strong></div>}
                    {quartier && <div><i className="fas fa-map-pin" /> Zone : <strong>{quartier}</strong></div>}
                    <div><i className="fas fa-tag" /> Type : <strong>{typeLabel(type)}</strong></div>
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'flex-start', fontSize:12, color:'var(--t2)', background:'var(--sky)', border:'1px solid var(--sky-3)', borderRadius:'var(--r-md)', padding:'10px 14px' }}>
                <i className="fas fa-circle-info" style={{ marginTop:2, color:'var(--blue)' }} />
                <span>Ce code expire dans <strong>7 jours</strong>. Il peut être utilisé une seule fois. L'email sera envoyé depuis <strong>noreply@shopi.gn</strong>.</span>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 — confirmation */}
          {etape === 3 && result && (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
              <div style={{ fontFamily:'var(--fd)', fontSize:18, fontWeight:800, color:'var(--navy)', marginBottom:4 }}>Invitation envoyée !</div>
              <div style={{ fontSize:13, color:'var(--t3)', marginBottom:18 }}>Code envoyé à <strong>{result.email}</strong></div>

              <div style={{ textAlign:'left', maxWidth:380, margin:'0 auto 16px', background:'var(--g50)', border:'1px solid var(--bdr)', borderRadius:'var(--r-lg)', padding:'14px 16px' }}>
                {[
                  ['Nom', result.fullName],
                  ['Email', result.email],
                  ...(ville ? [['Ville', ville]] : []),
                  ['Type', typeLabel(type)],
                ].map(([l, v]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, padding:'5px 0', borderBottom:'1px solid var(--bdr)' }}>
                    <span style={{ color:'var(--t3)' }}>{l}</span>
                    <strong style={{ color:'var(--navy)' }}>{v}</strong>
                  </div>
                ))}
              </div>

              <div style={{ maxWidth:380, margin:'0 auto', background:'var(--white)', border:'1.5px solid var(--teal)', borderRadius:'var(--r-lg)', padding:'14px 16px' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--t3)', marginBottom:8 }}>Code d'invitation généré</div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:8 }}>
                  <span style={{ fontFamily:'var(--fd)', fontSize:20, fontWeight:800, letterSpacing:'0.15em', color:'var(--navy)' }}>{realCode}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(realCode); onPop('📋 Code copié !', 's'); }}
                    style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)', padding:'6px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}
                  >
                    <i className="fas fa-copy" /> Copier
                  </button>
                </div>
                <div style={{ fontSize:11, color:'var(--t3)' }}>
                  <i className="fas fa-clock" /> Expire le {new Date(result.expiresAt).toLocaleDateString('fr-FR')} · Usage unique
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20, paddingTop:16, borderTop:'1px solid var(--bdr)' }}>
            {etape === 1 && (
              <button
                onClick={validerEtape1}
                style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)', padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer' }}
              >
                Suivant <i className="fas fa-arrow-right" />
              </button>
            )}
            {etape === 2 && (
              <>
                <button
                  onClick={() => setEtape(1)}
                  disabled={loading}
                  style={{ background:'var(--white)', color:'var(--t2)', border:'1.5px solid var(--bdr)', borderRadius:'var(--pill)', padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer' }}
                >
                  <i className="fas fa-arrow-left" /> Retour
                </button>
                <button
                  onClick={handleEnvoyer}
                  disabled={loading}
                  style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)', padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer' }}
                >
                  {loading ? <><i className="fas fa-spinner fa-spin" /> Envoi…</> : <><i className="fas fa-paper-plane" /> Envoyer l'invitation</>}
                </button>
              </>
            )}
            {etape === 3 && (
              <button
                onClick={reset}
                style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)', padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer' }}
              >
                <i className="fas fa-user-plus" /> Ajouter un autre correspondant
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
