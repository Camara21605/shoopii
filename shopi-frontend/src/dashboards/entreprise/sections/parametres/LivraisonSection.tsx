/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/LivraisonSection.tsx
 * Section 5 — Livraison
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: string) => void;
  saveLivraison: (b: Partial<ParametresData>) => Promise<void>;
}

const ZONES_GN = ['Kaloum','Dixinn','Ratoma','Matam','Matoto','Coyah','Dubréka','Kindia'];

export default function LivraisonSection({ data, saving, onDirty, onToast, saveLivraison }: Props) {
  const { t } = useTranslation();
  const [livraisonStandard, setLivraisonStandard] = useState(true);
  const [livraisonShopi,    setLivraisonShopi]    = useState(true);
  const [livraisonCorresp,  setLivraisonCorresp]  = useState(false);
  const [clickCollect,      setClickCollect]      = useState(true);
  const [livraisonExpress,  setLivraisonExpress]  = useState(false);
  const [zones,             setZones]             = useState<string[]>([]);

  useEffect(() => {
    if (!data) return;
    setLivraisonStandard(data.livraisonStandard ?? true);
    setLivraisonShopi(data.livraisonShopi       ?? true);
    setLivraisonCorresp(data.livraisonCorresp   ?? false);
    setClickCollect(data.clickCollect           ?? true);
    setLivraisonExpress(data.livraisonExpress   ?? false);
    setZones(data.zonesLivraison                ?? []);
  }, [data]);

  function toggleZone(zone: string) {
    setZones(prev => prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]);
    onDirty();
  }

  async function handleSave() {
    try {
      await saveLivraison({ livraisonStandard, livraisonShopi, livraisonCorresp, clickCollect, livraisonExpress, zonesLivraison: zones });
      onToast(t('parametres.livraison.savedToast'), 's');
    } catch { onToast(t('parametres.livraison.errorToast'), 'e'); }
  }

  const METHODES = [
    { label:t('parametres.livraison.standard'), sub:t('parametres.livraison.standardSub'),           value:livraisonStandard, set:setLivraisonStandard },
    { label:t('parametres.livraison.livreursShopi'),     sub:t('parametres.livraison.livreursShopiSub'),      value:livraisonShopi,    set:setLivraisonShopi    },
    { label:t('parametres.livraison.correspondants'),     sub:t('parametres.livraison.correspondantsSub'), value:livraisonCorresp,  set:setLivraisonCorresp  },
    { label:t('parametres.livraison.clickCollect'),    sub:t('parametres.livraison.clickCollectSub'),            value:clickCollect,      set:setClickCollect      },
    { label:t('parametres.livraison.express'),  sub:t('parametres.livraison.expressSub'),  value:livraisonExpress,  set:setLivraisonExpress  },
  ];

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-motorcycle" /> {t('parametres.livraison.title')}</h1>
        <p>{t('parametres.livraison.subtitle')}</p>
      </div>

      <FormCard title={t('parametres.livraison.methodesTitle')} icon="fa-truck" subtitle={t('parametres.livraison.methodesSubtitle')}>
        {METHODES.map(m => (
          <div key={m.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid var(--bdr)' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--navy)' }}>{m.label}</div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{m.sub}</div>
            </div>
            <div onClick={() => { m.set(!m.value); onDirty(); }}
              style={{ width:44, height:24, borderRadius:12, cursor:'pointer', background: m.value ? 'var(--t2)' : 'var(--g300)', position:'relative', transition:'background .2s', flexShrink:0 }}>
              <div style={{ position:'absolute', top:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)', left: m.value ? 22 : 3 }} />
            </div>
          </div>
        ))}
      </FormCard>

      <FormCard title={t('parametres.livraison.zonesTitle')} icon="fa-map-location-dot" subtitle={t('parametres.livraison.zonesSubtitle')}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {ZONES_GN.map(zone => (
            <button key={zone} onClick={() => toggleZone(zone)}
              style={{
                padding:'7px 16px', borderRadius:'var(--pill)', cursor:'pointer', fontSize:12, fontWeight:600,
                background: zones.includes(zone) ? 'var(--t2)' : 'var(--g50)',
                color: zones.includes(zone) ? '#fff' : 'var(--t2)',
                border: zones.includes(zone) ? '1.5px solid var(--t2)' : '1.5px solid var(--bdr2)',
                transition:'all .2s',
              }}
            >
              {zones.includes(zone) && <i className="fas fa-check" style={{ marginRight:5, fontSize:10 }} />}
              {zone}
            </button>
          ))}
        </div>
        <div className={s.hint} style={{ marginTop:10 }}>
          <i className="fas fa-circle-info" /> {t('parametres.livraison.zonesSelectionnees', { count: zones.length })}
        </div>

        <div className={s.saveRow}>
          <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> {t('parametres.livraison.sauvegardeEnCours')}</> : <><i className="fas fa-cloud-arrow-up" /> {t('parametres.livraison.sauvegarderLivraison')}</>}
          </button>
        </div>
      </FormCard>
    </>
  );
}