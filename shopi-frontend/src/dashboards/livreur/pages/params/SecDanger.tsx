/*
 * FICHIER : src/dashboards/livreur/pages/params/SecDanger.tsx
 * ✅ CONNECTÉ — /dashboard/livreur/parametres/danger (+ /pause, /desactiver, /reprendre, /supprimer)
 *
 * CORRIGÉ :
 *   - l'écran n'affichait jamais l'état du compte et n'offrait aucun moyen de
 *     reprendre après une pause (« Réactivez à tout moment depuis ce menu »
 *     était faux) : état chargé depuis le serveur + bouton « Reprendre ».
 *   - après la suppression, le livreur restait sur son tableau de bord avec
 *     une session fermée : il est maintenant déconnecté.
 *   - textes alignés sur ce que fait réellement le serveur (données
 *     conservées puis anonymisées après 30 jours, refus si livraisons en
 *     cours ou fonds au portefeuille, reprise automatique après 30 jours).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../../shared/services/apiFetch';
import ps from '../../styles/ParamsShared.module.css';

const BASE = '/dashboard/livreur/parametres/danger';
type Etat = 'actif' | 'pause' | 'desactive' | 'suspendu' | 'banni';
interface EtatCompte { etat: Etat; jusquau: string | null }
type Action = 'pause' | 'desactiver' | 'supprimer';

const ICONES: Record<Action, string> = { pause: 'fa-pause-circle', desactiver: 'fa-moon', supprimer: 'fa-trash-can' };

interface Props {
  onPop:    (m: string, t?: string) => void;
  onLogout: () => void;
}

export default function SecDanger({ onPop, onLogout }: Props) {
  const { t, i18n } = useTranslation();
  const [etat,     setEtat]     = useState<EtatCompte | null>(null);
  const [erreur,   setErreur]   = useState(false);
  const [action,   setAction]   = useState<Action | null>(null);
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [busy,     setBusy]     = useState(false);

  const charger = () => apiFetch<EtatCompte>(BASE).then(e => { setEtat(e); setErreur(false); }).catch(() => setErreur(true));
  useEffect(() => { void charger(); }, []);

  const dateLisible = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  function ouvrir(a: Action) { setAction(a); setPassword(''); setShowPwd(false); }
  function fermer() { if (!busy) { setAction(null); setPassword(''); } }

  async function confirmer() {
    if (!action || busy) return;
    if (!password) { onPop(t('livreurSecDanger.toasts.motDePasseRequis'), 'w'); return; }
    setBusy(true);
    try {
      if (action === 'supprimer') {
        await apiFetch(`${BASE}/supprimer`, { method: 'DELETE', body: { password } });
        onPop(t('livreurSecDanger.toasts.supprimerOk'), 'w');
        setAction(null);
        setTimeout(onLogout, 1500);   // sessions déjà fermées côté serveur
        return;
      }
      const res = await apiFetch<EtatCompte>(`${BASE}/${action}`, { method: 'PATCH', body: { password } });
      setEtat({ etat: res.etat, jusquau: res.jusquau });
      onPop(t(action === 'pause' ? 'livreurSecDanger.toasts.pauseOk' : 'livreurSecDanger.toasts.desactiverOk'), 'w');
      setAction(null); setPassword('');
    } catch (err: unknown) {
      onPop((err as Error)?.message || t('livreurSecDanger.toasts.echec'), 'e');
    } finally {
      setBusy(false);
    }
  }

  async function reprendre() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiFetch<EtatCompte>(`${BASE}/reprendre`, { method: 'PATCH' });
      setEtat({ etat: res.etat, jusquau: res.jusquau });
      onPop(t('livreurSecDanger.toasts.repriseOk'), 's');
    } catch (err: unknown) {
      onPop((err as Error)?.message || t('livreurSecDanger.toasts.echec'), 'e');
    } finally {
      setBusy(false);
    }
  }

  const enPause   = etat?.etat === 'pause' || etat?.etat === 'desactive';
  const bloque    = etat?.etat === 'suspendu' || etat?.etat === 'banni';
  /* pause / désactivation : seulement depuis un compte en activité */
  const actions: Action[] = enPause || bloque ? ['supprimer'] : ['pause', 'desactiver', 'supprimer'];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2 style={{ color:'var(--red)' }}>
          <i className="fas fa-triangle-exclamation" style={{ color:'var(--red)' }} /> {t('livreurSecDanger.header.titre')}
        </h2>
        <p>{t('livreurSecDanger.header.sub')}</p>
      </div>

      {erreur && (
        <div className={ps.card}><div className={ps.cb} style={{ fontSize:13, color:'var(--t3)' }}>
          {t('livreurSecDanger.erreur')}{' '}
          <button type="button" onClick={() => void charger()} style={{ background:'none', border:'none', color:'var(--teal)', fontWeight:700, cursor:'pointer' }}>{t('livreurSecDanger.reessayer')}</button>
        </div></div>
      )}
      {!etat && !erreur && <div style={{ textAlign:'center', color:'var(--t3)', padding:24 }}><i className="fas fa-spinner fa-spin" /></div>}

      {etat && (
        <>
          {/* ── État actuel ── */}
          <div className={ps.card} data-etat={etat.etat}>
            <div className={ps.cb} style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <i className={`fas ${etat.etat === 'actif' ? 'fa-circle-check' : enPause ? 'fa-circle-pause' : 'fa-ban'}`}
                style={{ fontSize:20, color: etat.etat === 'actif' ? 'var(--teal)' : 'var(--red)' }} />
              <div style={{ flex:1, minWidth:180 }}>
                <div className={ps.srLbl}>{t(`livreurSecDanger.etat.${etat.etat}.titre`)}</div>
                <div className={ps.srSub}>{t(`livreurSecDanger.etat.${etat.etat}.sub`, { date: dateLisible(etat.jusquau) })}</div>
              </div>
              {enPause && (
                <button type="button" onClick={() => void reprendre()} disabled={busy}
                  style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)', padding:'9px 18px',
                    fontSize:13, fontWeight:700, cursor: busy ? 'wait' : 'pointer' }}>
                  <i className="fas fa-play" style={{ marginRight:6 }} />{t('livreurSecDanger.reprendre')}
                </button>
              )}
            </div>
          </div>

          {/* ── Actions ── */}
          <div className={`${ps.card} ${ps.cardDanger} ${ps.cardLast}`}>
            <div className={`${ps.ch} ${ps.chDanger}`}>
              <div className={`${ps.chT} ${ps.chTDanger}`}>
                <i className="fas fa-triangle-exclamation" style={{ color:'var(--red)' }} /> {t('livreurSecDanger.actionsSensibles')}
              </div>
            </div>
            <div className={ps.cb}>
              {actions.map(a => (
                <div key={a} className={ps.dangerRow}>
                  <div>
                    <div className={ps.drTtl}>{t(`livreurSecDanger.actions.${a}.ttl`)}</div>
                    <div className={ps.drSub}>{t(`livreurSecDanger.actions.${a}.sub`)}</div>
                  </div>
                  <button type="button" className={ps.drBtn} onClick={() => ouvrir(a)}>
                    <i className={`fas ${ICONES[a]}`} style={{ marginRight:6 }} /> {t(`livreurSecDanger.actions.${a}.btn`)}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Confirmation par mot de passe ── */}
      {action && (
        <div role="dialog" aria-modal="true" aria-labelledby="danger-titre" onClick={fermer}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:900, padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--white)', borderRadius:'var(--r-xl)', padding:28, maxWidth:440, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'rgba(0,0,0,.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`fas ${ICONES[action]}`} style={{ color:'var(--red)', fontSize:16 }} />
              </div>
              <div>
                <div id="danger-titre" style={{ fontSize:15, fontWeight:800, color:'var(--navy)' }}>{t(`livreurSecDanger.actions.${action}.ttl`)}</div>
                <div style={{ fontSize:12, color:'var(--t3)' }}>{t('livreurSecDanger.modal.confirmationRequise')}</div>
              </div>
            </div>

            <div style={{ padding:'12px 14px', background:'rgba(0,0,0,.06)', border:'1px solid rgba(0,0,0,.2)', borderRadius:'var(--r-lg)', marginBottom:18, fontSize:12, color:'#18181B', lineHeight:1.5 }}>
              {t(`livreurSecDanger.actions.${action}.confirm`)}
            </div>

            <label htmlFor="danger-pwd" style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--navy)', marginBottom:8, textTransform:'uppercase', letterSpacing:.5 }}>
              {t('livreurSecDanger.modal.saisirMotDePasse')}
            </label>
            <div style={{ position:'relative', marginBottom:16 }}>
              <i className="fas fa-lock" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'var(--t3)', fontSize:13 }} />
              <input id="danger-pwd" type={showPwd ? 'text' : 'password'} value={password} autoFocus autoComplete="current-password"
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void confirmer(); if (e.key === 'Escape') fermer(); }}
                placeholder={t('livreurSecDanger.modal.placeholderMotDePasse')}
                style={{ width:'100%', padding:'11px 42px 11px 38px', border:'1.5px solid var(--bdr2)', borderRadius:'var(--r-md)', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'var(--fb)', background:'var(--g50)' }} />
              <button type="button" onClick={() => setShowPwd(!showPwd)} aria-label={t(showPwd ? 'livreurSecDanger.modal.masquer' : 'livreurSecDanger.modal.afficher')}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:13 }}>
                <i className={`fas ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button type="button" onClick={fermer} disabled={busy}
                style={{ flex:1, background:'var(--g50)', border:'1.5px solid var(--bdr2)', borderRadius:'var(--pill)', padding:'11px 0', fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--t2)' }}>
                {t('livreurSecDanger.modal.annuler')}
              </button>
              <button type="button" onClick={() => void confirmer()} disabled={busy || !password}
                style={{ flex:1, background: password ? '#000000' : 'var(--g200)', color: password ? '#fff' : 'var(--t3)', border:'none',
                  borderRadius:'var(--pill)', padding:'11px 0', fontSize:13, fontWeight:700, cursor: password && !busy ? 'pointer' : 'not-allowed',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                {busy
                  ? <><i className="fas fa-spinner fa-spin" /> {t('livreurSecDanger.modal.enCours')}</>
                  : <><i className={`fas ${ICONES[action]}`} /> {t('livreurSecDanger.modal.confirmer')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
