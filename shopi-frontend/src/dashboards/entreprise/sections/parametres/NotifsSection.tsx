/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/NotifsSection.tsx
 * Section 10 — Notifications
 *
 * BUG CORRIGÉ — les 14 interrupteurs étaient enregistrés dans une colonne que
 * le système de notifications ne lisait jamais (couper « Nouvelle commande »
 * n'arrêtait aucune alerte), et 5 ne correspondaient à aucune notification
 * existante. Ils pilotent maintenant les VRAIES préférences (voir
 * NotifsParametresService côté serveur) : canaux push / e-mail + une ligne par
 * famille de notifications réellement envoyées aux entreprises. Chaque
 * interrupteur s'enregistre aussitôt (seule la ligne touchée est envoyée).
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import { apiFetch } from '../../../../shared/services/apiFetch';
import s from '../../styles/parametres/ParametresPage.module.css';
import type { ToastType } from '../../types';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: ToastType) => void;
  saveNotifs: (b: Record<string, boolean>) => Promise<void>;
}

interface NotifsView { global: { push: boolean; email: boolean }; items: Record<string, boolean> }
const URL_NOTIFS = '/dashboard/entreprise/parametres/notifications';

function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} disabled={disabled}
      style={{ width:44, height:24, borderRadius:12, cursor: disabled ? 'default' : 'pointer', flexShrink:0, border:'none', padding:0,
        background: on ? 'var(--t2)' : 'var(--g300)', position:'relative', transition:'background .2s', opacity: disabled ? .5 : 1 }}>
      <span style={{ position:'absolute', top:3, width:18, height:18, borderRadius:'50%',
        background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)', left: on ? 22 : 3 }} />
    </button>
  );
}

export default function NotifsSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [view,    setView]    = useState<NotifsView | null>(null);
  const [erreur,  setErreur]  = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<NotifsView>(URL_NOTIFS).then(setView).catch(() => setErreur(true));
  }, []);

  const GROUPS: { title: string; items: string[] }[] = [
    { title: t('parametres.notifs.groups.commandes'),      items: ['newOrder', 'orderCancelled', 'orderDelivered', 'returns', 'paymentReceived'] },
    { title: t('parametres.notifs.groups.stockCatalogue'), items: ['outOfStock', 'nearThreshold', 'productPublished', 'promos'] },
    { title: t('parametres.notifs.groups.clients'),        items: ['newReview', 'newFollower', 'likes', 'messages'] },
    { title: t('parametres.notifs.groups.shoneya'),        items: ['shopNews'] },
  ];

  /* Enregistrement immédiat d'UNE ligne (ou d'un canal) — affichage optimiste,
   * remis en place si le serveur refuse. */
  async function envoyer(key: string, body: Record<string, unknown>, optimiste: NotifsView) {
    const avant = view;
    setView(optimiste);
    setPending(key);
    try {
      setView(await apiFetch<NotifsView>(URL_NOTIFS, { method: 'PATCH', body }));
      onToast(t('parametres.notifs.savedToast'), 's');
    } catch {
      setView(avant);
      onToast(t('parametres.notifs.errorToast'), 'e');
    } finally { setPending(null); }
  }

  const toggleItem = (key: string) => {
    if (!view) return;
    const v = !view.items[key];
    void envoyer(key, { items: { [key]: v } }, { ...view, items: { ...view.items, [key]: v } });
  };
  const toggleCanal = (ch: 'push' | 'email') => {
    if (!view) return;
    const v = !view.global[ch];
    void envoyer(ch, { global: { [ch]: v } }, { ...view, global: { ...view.global, [ch]: v } });
  };

  const aucunCanal = !!view && !view.global.push && !view.global.email;

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-bell" /> {t('parametres.notifs.title')}</h1>
        <p>{t('parametres.notifs.subtitle')}</p>
      </div>

      {erreur ? (
        <div className={s.hint}><i className="fas fa-circle-exclamation" /> {t('parametres.notifs.chargementErreur')}</div>
      ) : !view ? (
        <div className={s.hint}><i className="fas fa-spinner fa-spin" /> {t('parametres.notifs.chargement')}</div>
      ) : (
        <>
          <FormCard title={t('parametres.notifs.canauxTitle')} icon="fa-tower-broadcast" subtitle={t('parametres.notifs.canauxSubtitle')}>
            {([['push', 'fa-mobile-screen'], ['email', 'fa-envelope']] as const).map(([ch, icon], idx) => (
              <div key={ch} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'11px 0', borderBottom: idx === 0 ? '1px solid var(--bdr)' : 'none' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}><i className={`fas ${icon}`} style={{ width:18, color:'var(--t3)' }} /> {t(`parametres.notifs.canal.${ch}`)}</div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{t(`parametres.notifs.canal.${ch}Sub`)}</div>
                </div>
                <Switch on={view.global[ch]} label={t(`parametres.notifs.canal.${ch}`)} onChange={() => toggleCanal(ch)} disabled={pending === ch} />
              </div>
            ))}
            {aucunCanal && (
              <div className={s.hint} style={{ color:'var(--amber)', marginTop:6 }}><i className="fas fa-triangle-exclamation" /> {t('parametres.notifs.aucunCanal')}</div>
            )}
          </FormCard>

          {GROUPS.map(group => (
            <FormCard key={group.title} title={group.title} icon="fa-bell" subtitle="">
              {group.items.map((key, idx) => (
                <div key={key} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
                  padding:'11px 0', borderBottom: idx < group.items.length - 1 ? '1px solid var(--bdr)' : 'none',
                  opacity: aucunCanal ? .55 : 1,
                }}>
                  <span style={{ fontSize:13, color:'var(--t1)' }}>{t(`parametres.notifs.items.${key}`)}</span>
                  <Switch on={!!view.items[key]} label={t(`parametres.notifs.items.${key}`)} onChange={() => toggleItem(key)} disabled={pending === key} />
                </div>
              ))}
            </FormCard>
          ))}

          <div className={s.hint}><i className="fas fa-circle-info" /> {t('parametres.notifs.inAppHint')}</div>
        </>
      )}
    </>
  );
}
