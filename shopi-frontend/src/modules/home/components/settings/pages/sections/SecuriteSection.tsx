/* ================================================================
 * src/modules/home/components/settings/sections/SecuriteSection.tsx
 * DYNAMIQUE — GET securite + PATCH password/2fa/questions/codes
 * ================================================================ */

import React, { useState, useEffect } from 'react';
import s from '../styles/SettingsCard.module.css';
import { Toggle } from '../components/Toggle';
import { settingsApi, type SecuriteData } from '../../api/settings.api';

interface Props { onToast: (msg: string) => void; }

export default function SecuriteSection({ onToast }: Props) {
  const [securite,      setSecurite]      = useState<SecuriteData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [editPwd,       setEditPwd]       = useState(false);
  const [editQuestions, setEditQuestions] = useState(false);
  const [savingPwd,     setSavingPwd]     = useState(false);
  const [savingQ,       setSavingQ]       = useState(false);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [codes,         setCodes]         = useState<string[] | null>(null);

  /* Formulaire mot de passe */
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  /* Alertes de sécurité (état local pour réactivité UI) */
  const [alerts, setAlerts] = useState({
    connex:      { sms: true,  email: true,  push: true  },
    mdp:         { sms: true,  email: true,  push: false },
    tentatives:  { sms: true,  email: true,  push: false },
    transaction: { sms: true,  email: true,  push: true  },
    pays:        { sms: true,  email: true,  push: true  },
  });

  /* Questions de sécurité */
  const [questions, setQuestions] = useState([
    { question: '', reponse: '' },
    { question: '', reponse: '' },
  ]);

  /* ── Chargement ── */
  useEffect(() => {
    settingsApi.getSecurite()
      .then(setSecurite)
      .catch(() => onToast('❌ Impossible de charger les données de sécurité'))
      .finally(() => setLoading(false));
  }, []);

  /* ── Changer le mot de passe ── */
  async function savePassword() {
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      onToast('❌ Les mots de passe ne correspondent pas'); return;
    }
    setSavingPwd(true);
    try {
      const res = await settingsApi.changePassword({
        currentPassword: pwdForm.currentPassword,
        newPassword:     pwdForm.newPassword,
      });
      onToast(`✅ ${res.message}`);
      setEditPwd(false);
      setPwdForm({ currentPassword:'', newPassword:'', confirmPassword:'' });
      /* Recharger les données de sécurité */
      settingsApi.getSecurite().then(setSecurite).catch(() => {});
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSavingPwd(false); }
  }

  /* ── Toggle 2FA ── */
  async function toggle2fa(enabled: boolean) {
    try {
      await settingsApi.update2fa({ twoFaEnabled: enabled, twoFaMethod: enabled ? 'sms' : undefined });
      setSecurite(prev => prev ? { ...prev, twoFaEnabled: enabled } : prev);
      onToast(enabled ? '🔐 2FA activé avec succès' : '⚠️ 2FA désactivé');
    } catch (err: any) { onToast(`❌ ${err.message}`); }
  }

  /* ── Sauvegarder questions ── */
  async function saveQuestions() {
    const valid = questions.filter(q => q.question && q.reponse);
    if (valid.length === 0) { onToast('⚠️ Renseignez au moins une question'); return; }
    setSavingQ(true);
    try {
      const res = await settingsApi.updateQuestions({ questions: valid });
      onToast(`✅ ${res.message}`);
      setEditQuestions(false);
      setSecurite(prev => prev ? { ...prev, questionsConfigurees: valid.length } : prev);
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSavingQ(false); }
  }

  /* ── Générer codes de secours ── */
  async function genererCodes() {
    setGeneratingCodes(true);
    try {
      const res = await settingsApi.genererCodesSecours();
      setCodes(res.codes);
      setSecurite(prev => prev ? { ...prev, codesSecours: res.codes.length } : prev);
      onToast('📋 Codes générés — sauvegardez-les maintenant !');
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setGeneratingCodes(false); }
  }

  const toggleAlert = (key: keyof typeof alerts, ch: 'sms'|'email'|'push') =>
    setAlerts(prev => ({ ...prev, [key]: { ...prev[key], [ch]: !prev[key][ch] } }));

  /* Durée depuis dernier changement MDP */
  const joursDepuisMdp = securite?.dernierChangementMdp
    ? Math.floor((Date.now() - new Date(securite.dernierChangementMdp).getTime()) / 86400000)
    : null;

  if (loading) return (
    <div className={s.card}>
      <div style={{ padding:'48px 24px', textAlign:'center', color:'var(--t3)' }}>
        <i className="fas fa-circle-notch fa-spin" style={{ fontSize:24 }} />
      </div>
    </div>
  );

  return (
    <>
      {/* ── Authentification & Accès ── */}
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoEmerald}`}><i className="fas fa-lock" /></div>
            <div>
              <div className={s.cardH}>Authentification & Accès</div>
              <div className={s.cardSub}>Plusieurs couches de protection pour votre compte</div>
            </div>
          </div>
        </div>
        <div className={s.cardBody}>

          {/* ── Mot de passe ── */}
          <div className={s.secRow}>
            <div className={`${s.secIco} ${s.icoEmerald}`}><i className="fas fa-key" /></div>
            <div className={s.secInfo}>
              <div className={s.secTitle}>Mot de passe</div>
              <div className={s.secDesc}>
                {joursDepuisMdp !== null
                  ? `Dernière modification il y a ${joursDepuisMdp} jour${joursDepuisMdp > 1 ? 's' : ''}`
                  : 'Jamais modifié'}
              </div>
            </div>
            <span className={`${s.secStatus} ${s.statusOn}`}><i className="fas fa-circle" style={{ fontSize:6 }} /> Actif</span>
            <button className={s.secBtn} onClick={() => setEditPwd(v => !v)}>Modifier</button>
          </div>

          {/* Formulaire changement MDP */}
          <div className={`${s.editForm} ${editPwd ? s.editFormOpen : ''}`}>
            <div className={s.editGrid}>
              <div className={`${s.field} ${s.fieldFull}`}>
                <label>Mot de passe actuel</label>
                <input type="password" value={pwdForm.currentPassword}
                  onChange={e => setPwdForm(f => ({...f, currentPassword: e.target.value}))} />
              </div>
              <div className={s.field}>
                <label>Nouveau mot de passe</label>
                <input type="password" value={pwdForm.newPassword}
                  onChange={e => setPwdForm(f => ({...f, newPassword: e.target.value}))} />
                <span className={s.fieldHint}>Min. 8 caractères, 1 majuscule, 1 chiffre</span>
              </div>
              <div className={s.field}>
                <label>Confirmer</label>
                <input type="password" value={pwdForm.confirmPassword}
                  onChange={e => setPwdForm(f => ({...f, confirmPassword: e.target.value}))} />
              </div>
              <div className={s.fieldActions}>
                <button className={s.btnSave} onClick={savePassword} disabled={savingPwd}>
                  {savingPwd ? <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</> : 'Changer le mot de passe'}
                </button>
                <button className={s.btnCancel} onClick={() => setEditPwd(false)}>Annuler</button>
              </div>
            </div>
          </div>

          {/* ── 2FA ── */}
          <div className={s.secRow}>
            <div className={`${s.secIco} ${s.icoAmber}`}><i className="fas fa-mobile-screen" /></div>
            <div className={s.secInfo}>
              <div className={s.secTitle}>Authentification à deux facteurs (2FA)</div>
              <div className={s.secDesc}>Protège votre compte même si votre mot de passe est compromis</div>
            </div>
            <span className={`${s.secStatus} ${securite?.twoFaEnabled ? s.statusOn : s.statusOff}`}>
              <i className="fas fa-circle" style={{ fontSize:6 }} />
              {' '}{securite?.twoFaEnabled ? 'Activé' : 'Désactivé'}
            </span>
            <button
              className={`${s.secBtn} ${!securite?.twoFaEnabled ? s.secBtnPrim : ''}`}
              onClick={() => toggle2fa(!securite?.twoFaEnabled)}
            >
              {securite?.twoFaEnabled ? 'Désactiver' : <><i className="fas fa-plus" /> Activer</>}
            </button>
          </div>

          {/* ── Codes de secours ── */}
          <div className={s.secRow}>
            <div className={`${s.secIco} ${s.icoNavy}`}><i className="fas fa-life-ring" /></div>
            <div className={s.secInfo}>
              <div className={s.secTitle}>Codes de secours</div>
              <div className={s.secDesc}>
                {securite?.codesSecours
                  ? `${securite.codesSecours} codes à usage unique disponibles`
                  : '8 codes à usage unique — à conserver si vous perdez accès à votre 2FA'}
              </div>
            </div>
            <span className={`${s.secStatus} ${securite?.codesSecours ? s.statusOn : s.statusWarn}`}>
              {securite?.codesSecours
                ? <><i className="fas fa-circle" style={{ fontSize:6 }} /> Générés</>
                : <><i className="fas fa-triangle-exclamation" style={{ fontSize:9 }} /> Non générés</>
              }
            </span>
            <button
              className={`${s.secBtn} ${!securite?.codesSecours ? s.secBtnWarn : ''}`}
              onClick={genererCodes}
              disabled={generatingCodes}
            >
              {generatingCodes
                ? <i className="fas fa-circle-notch fa-spin" />
                : securite?.codesSecours ? 'Regénérer' : 'Générer'
              }
            </button>
          </div>

          {/* Affichage des codes générés */}
          {codes && (
            <div style={{ margin:'0 24px 16px', background:'var(--navy)', borderRadius:'var(--r-md)', padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'rgba(200,217,248,.55)', marginBottom:12, textTransform:'uppercase', letterSpacing:'1px' }}>
                ⚠️ Sauvegardez ces codes — ils ne s'afficheront qu'une fois
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {codes.map((c, i) => (
                  <div key={i} style={{ fontFamily:'monospace', fontSize:14, fontWeight:700, color:'#fff', background:'rgba(255,255,255,.08)', borderRadius:6, padding:'8px 12px', letterSpacing:'2px' }}>
                    {c}
                  </div>
                ))}
              </div>
              <button
                style={{ marginTop:12, background:'none', border:'1px solid rgba(255,255,255,.2)', borderRadius:8, padding:'6px 14px', color:'rgba(200,217,248,.7)', fontSize:11, fontWeight:600, cursor:'pointer' }}
                onClick={() => { navigator.clipboard.writeText(codes.join('\n')); onToast('📋 Codes copiés !'); }}
              >
                <i className="fas fa-copy" /> Tout copier
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Questions de sécurité ── */}
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoRose}`}><i className="fas fa-question-circle" /></div>
            <div>
              <div className={s.cardH}>Questions de sécurité</div>
              <div className={s.cardSub}>
                {securite?.questionsConfigurees ?? 0}/2 questions configurées
              </div>
            </div>
          </div>
          <button className={`${s.cardAction} ${s.cardActionOutline}`} onClick={() => setEditQuestions(v => !v)}>
            <i className="fas fa-pen" /> {securite?.questionsConfigurees ? 'Modifier' : 'Configurer'}
          </button>
        </div>
        <div className={s.cardBody}>
          {[0, 1].map(i => (
            <div key={i} className={s.secRow}>
              <div className={`${s.secIco} ${i < (securite?.questionsConfigurees ?? 0) ? s.icoRose : s.icoAmber}`}>
                <i className="fas fa-shield-halved" />
              </div>
              <div className={s.secInfo}>
                <div className={s.secTitle}>Question {i + 1}</div>
                <div className={s.secDesc}>{i < (securite?.questionsConfigurees ?? 0) ? 'Configurée · Réponse masquée' : 'Non configurée'}</div>
              </div>
              <span className={`${s.secStatus} ${i < (securite?.questionsConfigurees ?? 0) ? s.statusOn : s.statusWarn}`}>
                {i < (securite?.questionsConfigurees ?? 0)
                  ? <><i className="fas fa-circle" style={{ fontSize:6 }} /> OK</>
                  : <><i className="fas fa-triangle-exclamation" style={{ fontSize:9 }} /> Manquante</>
                }
              </span>
            </div>
          ))}

          <div className={`${s.editForm} ${editQuestions ? s.editFormOpen : ''}`}>
            <div className={s.editGrid}>
              {questions.map((q, i) => (
                <React.Fragment key={i}>
                  <div className={`${s.field} ${s.fieldFull}`}>
                    <label>Question {i + 1}</label>
                    <select value={q.question} onChange={e => setQuestions(prev => prev.map((x, j) => j === i ? {...x, question: e.target.value} : x))}>
                      <option value="">Choisir une question…</option>
                      <option value="animal">Quel est le nom de votre premier animal de compagnie ?</option>
                      <option value="ecole">Quel était le nom de votre école primaire ?</option>
                      <option value="ville">Quelle est la ville où vous êtes né ?</option>
                      <option value="ami">Quel était le nom de votre meilleur ami d'enfance ?</option>
                      <option value="mere">Quel est le prénom de votre grand-mère maternelle ?</option>
                    </select>
                  </div>
                  <div className={`${s.field} ${s.fieldFull}`}>
                    <label>Réponse {i + 1}</label>
                    <input type="text" placeholder="Votre réponse secrète…"
                      value={q.reponse}
                      onChange={e => setQuestions(prev => prev.map((x, j) => j === i ? {...x, reponse: e.target.value} : x))}
                    />
                  </div>
                </React.Fragment>
              ))}
              <div className={s.fieldActions}>
                <button className={s.btnSave} onClick={saveQuestions} disabled={savingQ}>
                  {savingQ ? <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</> : 'Enregistrer'}
                </button>
                <button className={s.btnCancel} onClick={() => setEditQuestions(false)}>Annuler</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Alertes de sécurité ── */}
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoAmber}`}><i className="fas fa-bell" /></div>
            <div><div className={s.cardH}>Alertes de sécurité</div><div className={s.cardSub}>Soyez notifié immédiatement en cas d'activité suspecte</div></div>
          </div>
        </div>
        <div className={s.cardBody}>
          {([
            { key:'connex' as const,      ico:'icoEmerald' as const, icon:'fa-right-to-bracket',    title:'Nouvelle connexion détectée',         desc:'Alerte si connexion depuis un appareil ou pays inconnu' },
            { key:'mdp' as const,         ico:'icoRose' as const,    icon:'fa-key',                 title:'Changement de mot de passe',           desc:'Alerte immédiate si votre mot de passe est modifié' },
            { key:'tentatives' as const,  ico:'icoAmber' as const,   icon:'fa-triangle-exclamation',title:'Tentatives de connexion échouées',     desc:'Alerte après 3 tentatives incorrectes consécutives' },
            { key:'transaction' as const, ico:'icoViolet' as const,  icon:'fa-credit-card',         title:'Transaction suspecte ou refusée',      desc:'Alerte en cas de paiement inhabituellement élevé' },
            { key:'pays' as const,        ico:'icoRed' as const,     icon:'fa-user-slash',          title:'Accès depuis un pays inhabituel',      desc:'Alerte si votre compte est utilisé depuis un pays inconnu' },
          ] as const).map(({ key, ico, icon, title, desc }) => (
            <div key={key} className={s.notifRow}>
              <div className={s.notifLeft}>
                <div className={`${s.notifIco} ${s[ico]}`}><i className={`fas ${icon}`} /></div>
                <div><div className={s.notifTitle}>{title}</div><div className={s.notifDesc}>{desc}</div></div>
              </div>
              <div className={s.notifChannels}>
                {(['sms','email','push'] as const).map(ch => (
                  <div key={ch} className={s.notifCh}>
                    <Toggle checked={alerts[key][ch]} onChange={() => toggleAlert(key, ch)} />
                    <span>{ch === 'sms' ? 'SMS' : ch === 'email' ? 'Email' : 'Push'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}