/*
 * FICHIER : src/dashboards/livreur/pages/params/SecNotifications.tsx
 * ✅ CONNECTÉ
 *
 * BUG CORRIGÉ — les 3 groupes de toggles étaient construits en zippant
 * un tableau de libellés (buildNotifsXxx) avec un tableau de clés API
 * (XXX_KEYS) PAR INDEX : dès que les deux tableaux n'avaient pas
 * exactement la même longueur/ordre (missions : 4 libellés pour 5 clés ;
 * canaux : 4 libellés pour 3 clés), chaque toggle finissait rattaché à
 * la MAUVAISE clé — cocher "Missions urgentes" enregistrait en réalité
 * "missionAnnulee", et "Email" ne correspondait à aucune clé réelle
 * (retombait sur un identifiant inventé "c3", silencieusement ignoré
 * par le DTO backend). Chaque toggle porte maintenant sa clé explicite,
 * plus de zip par position. "Missions urgentes à proximité" et
 * "WhatsApp" n'ont aucune colonne backend correspondante (voir
 * NotifsLivreurService.DEFAULT_NOTIFS) : marqués "Bientôt disponible"
 * plutôt que de prétendre fonctionner.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

interface NotifItem { key: string; l: string; sub: string; comingSoon?: boolean; }

/* Clés = colonnes réelles de NotifsLivreurService.DEFAULT_NOTIFS (backend) */
function buildMissionsItems(t: (key: string) => string): NotifItem[] {
  return [
    { key:'nouvelleMission', l:t('livreurSecNotifications.missions.nouvelleMission.l'), sub:t('livreurSecNotifications.missions.nouvelleMission.sub') },
    { key:'missionAnnulee',  l:t('livreurSecNotifications.missions.missionAnnulee.l'),  sub:t('livreurSecNotifications.missions.missionAnnulee.sub')  },
    { key:'missionLivree',   l:t('livreurSecNotifications.missions.missionLivree.l'),   sub:t('livreurSecNotifications.missions.missionLivree.sub')   },
    { key:'rappelMission',   l:t('livreurSecNotifications.missions.rappelMission.l'),   sub:t('livreurSecNotifications.missions.rappelMission.sub')   },
    { key:'messageClient',   l:t('livreurSecNotifications.missions.messageClient.l'),   sub:t('livreurSecNotifications.missions.messageClient.sub')   },
    { key:'missionUrgente',  l:t('livreurSecNotifications.missions.missionUrgente.l'),  sub:t('livreurSecNotifications.missions.missionUrgente.sub'), comingSoon:true },
  ];
}
function buildFinancesItems(t: (key: string) => string): NotifItem[] {
  return [
    { key:'gainRecu',         l:t('livreurSecNotifications.finances.gainRecu.l'),         sub:t('livreurSecNotifications.finances.gainRecu.sub')         },
    { key:'virementEffectue', l:t('livreurSecNotifications.finances.virementEffectue.l'), sub:t('livreurSecNotifications.finances.virementEffectue.sub') },
    { key:'rapportHebdo',     l:t('livreurSecNotifications.finances.rapportHebdo.l'),     sub:t('livreurSecNotifications.finances.rapportHebdo.sub')     },
  ];
}
function buildCanauxItems(t: (key: string) => string): NotifItem[] {
  return [
    { key:'pushNotif',  l:t('livreurSecNotifications.canaux.push.l'),     sub:t('livreurSecNotifications.canaux.push.sub')     },
    { key:'smsNotif',   l:t('livreurSecNotifications.canaux.sms.l'),      sub:t('livreurSecNotifications.canaux.sms.sub')      },
    { key:'emailNotif', l:t('livreurSecNotifications.canaux.email.l'),    sub:t('livreurSecNotifications.canaux.email.sub')    },
    { key:'whatsapp',   l:t('livreurSecNotifications.canaux.whatsapp.l'), sub:t('livreurSecNotifications.canaux.whatsapp.sub'), comingSoon:true },
  ];
}

const DEFAULTS: Record<string, boolean> = {
  nouvelleMission:true, missionAnnulee:true, missionLivree:true, rappelMission:true, messageClient:true,
  gainRecu:true, virementEffectue:true, rapportHebdo:false,
  pushNotif:true, smsNotif:true, emailNotif:false,
};

interface Props {
  data:       LivreurData | null;
  saving:     boolean;
  dirty:      () => void;
  onPop:      (m: string, t?: string) => void;
  saveNotifs: (body: Record<string, boolean>) => Promise<void>;
}

function ToggleGroup({ items, vals, onChange, comingSoonLabel }: {
  items: NotifItem[];
  vals:  Record<string, boolean>;
  onChange: (key: string, v: boolean) => void;
  comingSoonLabel: string;
}) {
  return (
    <>
      {items.map(item => (
        <div key={item.key} className={ps.setRow}>
          <div>
            <div className={ps.srLbl}>
              {item.l}
              {item.comingSoon && (
                <span style={{ marginLeft:8, fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:'var(--pill)', background:'var(--g100)', color:'var(--t3)', border:'1px solid var(--bdr2)', textTransform:'uppercase' as const }}>
                  {comingSoonLabel}
                </span>
              )}
            </div>
            <div className={ps.srSub}>{item.sub}</div>
          </div>
          <label className={ps.tog}>
            <input
              type="checkbox"
              checked={item.comingSoon ? false : (vals[item.key] ?? true)}
              disabled={item.comingSoon}
              onChange={e => onChange(item.key, e.target.checked)}
            />
            <span className={ps.togs} />
          </label>
        </div>
      ))}
    </>
  );
}

export default function SecNotifications({ data, saving, dirty, onPop, saveNotifs }: Props) {
  const { t } = useTranslation();
  const MISSIONS_ITEMS = buildMissionsItems(t);
  const FINANCES_ITEMS = buildFinancesItems(t);
  const CANAUX_ITEMS   = buildCanauxItems(t);
  const [vals, setVals] = useState<Record<string, boolean>>(DEFAULTS);

  useEffect(() => {
    if (data?.notifSettings) setVals({ ...DEFAULTS, ...data.notifSettings });
  }, [data]);

  function handleChange(key: string, v: boolean) {
    setVals(prev => ({ ...prev, [key]: v }));
    dirty();
  }

  async function handleSave() {
    try {
      await saveNotifs(vals);
      onPop(t('livreurSecNotifications.toasts.saved'), 's');
    } catch (err: any) {
      onPop(err?.message ?? t('livreurSecNotifications.toasts.saveError'), 'e');
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-bell" /> {t('livreurSecNotifications.header.titre')}</h2>
        <p>{t('livreurSecNotifications.header.sub')}</p>
      </div>
      <div className={ps.card}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-motorcycle" /> {t('livreurSecNotifications.missionsCard.titre')}</div></div>
        <div className={ps.cb}><ToggleGroup items={MISSIONS_ITEMS} vals={vals} onChange={handleChange} comingSoonLabel={t('livreurSecNotifications.comingSoon')} /></div>
      </div>
      <div className={ps.card}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-coins" /> {t('livreurSecNotifications.financesCard.titre')}</div></div>
        <div className={ps.cb}><ToggleGroup items={FINANCES_ITEMS} vals={vals} onChange={handleChange} comingSoonLabel={t('livreurSecNotifications.comingSoon')} /></div>
      </div>
      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-mobile-screen" /> {t('livreurSecNotifications.canauxCard.titre')}</div></div>
        <div className={ps.cb}><ToggleGroup items={CANAUX_ITEMS} vals={vals} onChange={handleChange} comingSoonLabel={t('livreurSecNotifications.comingSoon')} /></div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={handleSave} disabled={saving}
          style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
            padding:'12px 28px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1,
            display:'flex', alignItems:'center', gap:7 }}>
          {saving ? <><i className="fas fa-spinner fa-spin" /> {t('livreurSecNotifications.saving')}</> : <><i className="fas fa-cloud-arrow-up" /> {t('livreurSecNotifications.saveButton')}</>}
        </button>
      </div>
    </div>
  );
}
