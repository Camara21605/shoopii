/*
 * FICHIER : src/dashboards/livreur/pages/params/SecNotifications.tsx
 * ✅ CONNECTÉ — préférences RÉELLES du moteur de notifications
 *   GET / PATCH /dashboard/livreur/parametres/notifications
 *
 * BUG CORRIGÉ — les 11 interrupteurs étaient enregistrés dans un JSON que
 * personne ne lisait (aucun effet sur les notifications reçues). Ils pilotent
 * maintenant les vraies préférences, par familles réellement envoyées aux
 * livreurs (voir NotifsLivreurService.NOTIF_ITEMS côté serveur), plus les deux
 * canaux réels (push, e-mail). SMS et WhatsApp retirés : non branchés.
 * Chaque interrupteur s'enregistre aussitôt, un à la fois (jamais de retour en
 * arrière dû à une réponse en retard).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../../shared/services/apiFetch';
import { useSerialQueue } from '../../../../shared/hooks/useSerialQueue';
import ps from '../../styles/ParamsShared.module.css';

const URL_NOTIFS = '/dashboard/livreur/parametres/notifications';
interface NotifsView { global: { push: boolean; email: boolean }; items: Record<string, boolean> }

const ITEMS: { key: string; icon: string }[] = [
  { key: 'missions',  icon: 'fa-motorcycle' },
  { key: 'paiements', icon: 'fa-coins' },
  { key: 'messages',  icon: 'fa-comment-dots' },
  { key: 'avis',      icon: 'fa-star' },
  { key: 'abonnes',   icon: 'fa-user-plus' },
  { key: 'annonces',  icon: 'fa-bullhorn' },
];

interface Props { onPop: (m: string, t?: string) => void; }

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <label className={ps.tog}>
      <input type="checkbox" role="switch" aria-label={label} checked={on} onChange={e => onChange(e.target.checked)} />
      <span className={ps.togs} />
    </label>
  );
}

export default function SecNotifications({ onPop }: Props) {
  const { t } = useTranslation();
  const [view,   setView]   = useState<NotifsView | null>(null);
  const [erreur, setErreur] = useState(false);
  const queue = useSerialQueue();

  const charger = () => apiFetch<NotifsView>(URL_NOTIFS).then(v => { setView(v); setErreur(false); }).catch(() => setErreur(true));
  useEffect(() => { void charger(); }, []);

  function envoyer(body: Record<string, unknown>, optimiste: NotifsView) {
    setView(optimiste);
    const { promise, isLatest } = queue(() => apiFetch<NotifsView>(URL_NOTIFS, { method: 'PATCH', body }));
    promise
      .then(v => { if (isLatest()) setView(v); onPop(t('livreurSecNotifications.toasts.saved'), 's'); })
      .catch(() => { onPop(t('livreurSecNotifications.toasts.saveError'), 'e'); if (isLatest()) void charger(); });
  }

  const toggleItem = (key: string, v: boolean) => view && envoyer({ items: { [key]: v } }, { ...view, items: { ...view.items, [key]: v } });
  const toggleCanal = (ch: 'push' | 'email', v: boolean) => view && envoyer({ global: { [ch]: v } }, { ...view, global: { ...view.global, [ch]: v } });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-bell" /> {t('livreurSecNotifications.header.titre')}</h2>
        <p>{t('livreurSecNotifications.reel.sub')}</p>
      </div>

      {erreur && (
        <div className={ps.card}><div className={ps.cb} style={{ fontSize:13, color:'var(--t3)' }}>
          {t('livreurSecNotifications.reel.erreur')}{' '}
          <button type="button" onClick={() => void charger()} style={{ background:'none', border:'none', color:'var(--teal)', fontWeight:700, cursor:'pointer' }}>{t('livreurSecNotifications.reel.reessayer')}</button>
        </div></div>
      )}
      {!view && !erreur && <div style={{ textAlign:'center', color:'var(--t3)', padding:24 }}><i className="fas fa-spinner fa-spin" /></div>}

      {view && (
        <>
          <div className={ps.card}>
            <div className={ps.ch}><div className={ps.chT}><i className="fas fa-mobile-screen" /> {t('livreurSecNotifications.canauxCard.titre')}</div></div>
            <div className={ps.cb}>
              {(['push', 'email'] as const).map(ch => (
                <div key={ch} className={ps.setRow}>
                  <div>
                    <div className={ps.srLbl}>{t(`livreurSecNotifications.reel.canaux.${ch}.l`)}</div>
                    <div className={ps.srSub}>{t(`livreurSecNotifications.reel.canaux.${ch}.sub`)}</div>
                  </div>
                  <Switch on={view.global[ch]} label={t(`livreurSecNotifications.reel.canaux.${ch}.l`)} onChange={v => toggleCanal(ch, v)} />
                </div>
              ))}
            </div>
          </div>

          <div className={`${ps.card} ${ps.cardLast}`}>
            <div className={ps.ch}><div className={ps.chT}><i className="fas fa-list-check" /> {t('livreurSecNotifications.reel.familles')}</div></div>
            <div className={ps.cb}>
              {ITEMS.map(it => (
                <div key={it.key} className={ps.setRow}>
                  <div>
                    <div className={ps.srLbl}><i className={`fas ${it.icon}`} style={{ width:16, color:'var(--teal)', marginRight:6 }} />{t(`livreurSecNotifications.reel.items.${it.key}.l`)}</div>
                    <div className={ps.srSub}>{t(`livreurSecNotifications.reel.items.${it.key}.sub`)}</div>
                  </div>
                  <Switch on={!!view.items[it.key]} label={t(`livreurSecNotifications.reel.items.${it.key}.l`)} onChange={v => toggleItem(it.key, v)} />
                </div>
              ))}
              <div className={ps.fiHint} style={{ marginTop:10 }}>
                <i className="fas fa-circle-info" /> {t('livreurSecNotifications.reel.note')}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
