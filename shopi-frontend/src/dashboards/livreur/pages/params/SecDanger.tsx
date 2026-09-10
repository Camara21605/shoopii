/*
 * FICHIER : src/dashboards/livreur/pages/params/SecDanger.tsx
 * ✅ CONNECTÉ — confirmation par mot de passe + appels API réels
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ps from '../../styles/ParamsShared.module.css';

interface Props {
  saving:           boolean;
  onPop:            (m: string, t?: string) => void;
  pauseCompte:      (password: string) => Promise<void>;
  desactiverCompte: (password: string) => Promise<void>;
  supprimerCompte:  (password: string) => Promise<void>;
}

type ActionType = 'pause' | 'desactiver' | 'supprimer' | null;

interface ActionCfg { ttl: string; sub: string; btn: string; icon: string; confirm: string }

function buildActionCfg(t: (key: string) => string): Record<NonNullable<ActionType>, ActionCfg> {
  return {
    pause: {
      ttl: t('livreurSecDanger.actions.pause.ttl'),
      sub: t('livreurSecDanger.actions.pause.sub'),
      btn: t('livreurSecDanger.actions.pause.btn'),
      icon: 'fa-pause-circle',
      confirm: t('livreurSecDanger.actions.pause.confirm'),
    },
    desactiver: {
      ttl: t('livreurSecDanger.actions.desactiver.ttl'),
      sub: t('livreurSecDanger.actions.desactiver.sub'),
      btn: t('livreurSecDanger.actions.desactiver.btn'),
      icon: 'fa-ban',
      confirm: t('livreurSecDanger.actions.desactiver.confirm'),
    },
    supprimer: {
      ttl: t('livreurSecDanger.actions.supprimer.ttl'),
      sub: t('livreurSecDanger.actions.supprimer.sub'),
      btn: t('livreurSecDanger.actions.supprimer.btn'),
      icon: 'fa-trash-can',
      confirm: t('livreurSecDanger.actions.supprimer.confirm'),
    },
  };
}

export default function SecDanger({ saving, onPop, pauseCompte, desactiverCompte, supprimerCompte }: Props) {
  const { t } = useTranslation();
  const ACTION_CFG = buildActionCfg(t);
  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [password,     setPassword]     = useState('');
  const [showPwd,      setShowPwd]      = useState(false);

  function openModal(action: ActionType) { setActiveAction(action); setPassword(''); setShowPwd(false); }
  function closeModal() { setActiveAction(null); setPassword(''); }

  async function handleConfirm() {
    if (!password) { onPop(t('livreurSecDanger.toasts.motDePasseRequis'), 'w'); return; }
    if (!activeAction) return;
    try {
      if      (activeAction === 'pause')      await pauseCompte(password);
      else if (activeAction === 'desactiver') await desactiverCompte(password);
      else                                    await supprimerCompte(password);
      onPop(
        activeAction === 'pause'      ? t('livreurSecDanger.toasts.pauseOk') :
        activeAction === 'desactiver' ? t('livreurSecDanger.toasts.desactiverOk') :
        t('livreurSecDanger.toasts.supprimerOk'), 'w'
      );
      closeModal();
    } catch (err: any) {
      onPop(err?.message ?? t('livreurSecDanger.toasts.motDePasseIncorrect'), 'e');
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2 style={{ color:'var(--red)' }}>
          <i className="fas fa-triangle-exclamation" style={{ color:'var(--red)' }} /> {t('livreurSecDanger.header.titre')}
        </h2>
        <p>{t('livreurSecDanger.header.sub')}</p>
      </div>

      <div className={`${ps.card} ${ps.cardDanger} ${ps.cardLast}`}>
        <div className={`${ps.ch} ${ps.chDanger}`}>
          <div className={`${ps.chT} ${ps.chTDanger}`}>
            <i className="fas fa-triangle-exclamation" style={{ color:'var(--red)' }} /> {t('livreurSecDanger.actionsSensibles')}
          </div>
        </div>
        <div className={ps.cb}>
          {(Object.keys(ACTION_CFG) as ActionType[]).map(action => {
            const cfg = ACTION_CFG[action!]!;
            return (
              <div key={action} className={ps.dangerRow}>
                <div>
                  <div className={ps.drTtl}>{cfg.ttl}</div>
                  <div className={ps.drSub}>{cfg.sub}</div>
                </div>
                <button className={ps.drBtn} onClick={() => openModal(action)}>
                  <i className={`fas ${cfg.icon}`} style={{ marginRight:6 }} /> {cfg.btn}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de confirmation */}
      {activeAction && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.6)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:900, padding:16,
        }}>
          <div style={{ background:'var(--white)', borderRadius:'var(--r-xl)', padding:28,
            maxWidth:440, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'rgba(0,0,0,.1)',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`fas ${ACTION_CFG[activeAction].icon}`} style={{ color:'var(--red)', fontSize:16 }} />
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:'var(--navy)' }}>{ACTION_CFG[activeAction].ttl}</div>
                <div style={{ fontSize:12, color:'var(--t3)' }}>{t('livreurSecDanger.modal.confirmationRequise')}</div>
              </div>
            </div>

            <div style={{ padding:'12px 14px', background:'rgba(0,0,0,.06)', border:'1px solid rgba(0,0,0,.2)',
              borderRadius:'var(--r-lg)', marginBottom:18, fontSize:12, color:'#18181B', lineHeight:1.5 }}>
              {ACTION_CFG[activeAction].confirm}
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--navy)', marginBottom:8, textTransform:'uppercase', letterSpacing:.5 }}>
                {t('livreurSecDanger.modal.saisirMotDePasse')}
              </div>
              <div style={{ position:'relative' }}>
                <i className="fas fa-lock" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'var(--t3)', fontSize:13 }} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                  autoFocus
                  placeholder={t('livreurSecDanger.modal.placeholderMotDePasse')}
                  style={{ width:'100%', padding:'11px 42px 11px 38px', border:'1.5px solid var(--bdr2)',
                    borderRadius:'var(--r-md)', fontSize:13, outline:'none', boxSizing:'border-box',
                    fontFamily:'var(--fb)', background:'var(--g50)' }}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                    background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:13 }}>
                  <i className={`fas ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={closeModal} disabled={saving}
                style={{ flex:1, background:'var(--g50)', border:'1.5px solid var(--bdr2)',
                  borderRadius:'var(--pill)', padding:'11px 0', fontSize:13, fontWeight:600,
                  cursor:'pointer', color:'var(--t2)' }}>
                {t('livreurSecDanger.modal.annuler')}
              </button>
              <button onClick={handleConfirm} disabled={saving || !password}
                style={{ flex:1, background: password ? '#000000' : 'var(--g200)',
                  color: password ? '#fff' : 'var(--t3)', border:'none',
                  borderRadius:'var(--pill)', padding:'11px 0', fontSize:13, fontWeight:700,
                  cursor: password ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center',
                  justifyContent:'center', gap:7 }}>
                {saving
                  ? <><i className="fas fa-spinner fa-spin" /> {t('livreurSecDanger.modal.enCours')}</>
                  : <><i className={`fas ${ACTION_CFG[activeAction].icon}`} /> {t('livreurSecDanger.modal.confirmer')}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
