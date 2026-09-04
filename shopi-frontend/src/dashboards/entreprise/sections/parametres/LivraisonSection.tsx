/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/LivraisonSection.tsx
 * Section 5 — Livraison
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import { apiFetch } from '@/shared/services/apiFetch';
import s from '../../styles/parametres/ParametresPage.module.css';

interface ZoneCommune { id: string; nom: string; code: string; }
interface ZonesDisponibles { zoneId: string | null; zoneNom: string | null; communes: ZoneCommune[]; }

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: string) => void;
  saveLivraison: (b: Partial<ParametresData>) => Promise<void>;
}

export default function LivraisonSection({ data, saving, onDirty, onToast, saveLivraison }: Props) {
  const { t } = useTranslation();
  const [livraisonStandard, setLivraisonStandard] = useState(true);
  const [livraisonShopi,    setLivraisonShopi]    = useState(true);
  const [livraisonCorresp,  setLivraisonCorresp]  = useState(false);
  const [clickCollect,      setClickCollect]      = useState(true);
  const [livraisonExpress,  setLivraisonExpress]  = useState(false);
  const [zones,             setZones]             = useState<string[]>([]);

  /* BUG CORRIGÉ — la liste de zones proposées venait d'un fichier
   * statique (geo-guinee.ts) sans rapport avec le référentiel
   * géographique réellement géré par les super-admins/admins : une
   * boutique pouvait cocher n'importe quel nom de commune du pays, y
   * compris des zones jamais attribuées à son admin. On charge
   * maintenant la VRAIE zone attribuée à cette entreprise (via son
   * admin assigné) depuis GET .../livraison/zones-disponibles — voir
   * livraison-parametres.service.ts côté backend. */
  const [zonesDispo, setZonesDispo] = useState<ZonesDisponibles | null>(null);
  const [loadingZones, setLoadingZones] = useState(true);

  useEffect(() => {
    apiFetch<ZonesDisponibles>('/dashboard/entreprise/parametres/livraison/zones-disponibles')
      .then(setZonesDispo)
      .catch(() => setZonesDispo({ zoneId: null, zoneNom: null, communes: [] }))
      .finally(() => setLoadingZones(false));
  }, []);

  /* true au montage ET après chaque rechargement depuis l'API — même
   * garde que HorairesSection/CatalogueSection pour éviter que l'auto-save
   * ci-dessous ne se redéclenche juste après avoir reçu les données qu'il
   * vient lui-même d'enregistrer. */
  const skipNextSaveRef = useRef(true);

  useEffect(() => {
    if (!data) return;
    setLivraisonStandard(data.livraisonStandard ?? true);
    setLivraisonShopi(data.livraisonShopi       ?? true);
    setLivraisonCorresp(data.livraisonCorresp   ?? false);
    setClickCollect(data.clickCollect           ?? true);
    setLivraisonExpress(data.livraisonExpress   ?? false);
    setZones(data.zonesLivraison                ?? []);
    skipNextSaveRef.current = true;
  }, [data]);

  function toggleZone(zone: string) {
    setZones(prev => prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]);
    onDirty();
  }

  /* Sauvegarde automatique — plus de bouton "Sauvegarder" : chaque
   * changement (méthode ou zone) déclenche un enregistrement après une
   * courte pause (800ms). Même pattern que Horaires/Catalogue. */
  useEffect(() => {
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return; }
    const timer = setTimeout(() => {
      saveLivraison({ livraisonStandard, livraisonShopi, livraisonCorresp, clickCollect, livraisonExpress, zonesLivraison: zones })
        .then(() => onToast(t('parametres.livraison.savedToast'), 's'))
        .catch(() => onToast(t('parametres.livraison.errorToast'), 'e'));
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livraisonStandard, livraisonShopi, livraisonCorresp, clickCollect, livraisonExpress, zones]);

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
        {/* Les communes proposées sont exactement celles de la zone
         * géographique attribuée à cette entreprise par son admin
         * (Company.adminId → Admin.zoneId → GeoZone.couvertureIds) —
         * plus de liste statique ni de sélecteur de ville arbitraire. */}
        {loadingZones ? (
          <div className={s.hint}><i className="fas fa-spinner fa-spin" /> {t('parametres.livraison.zonesChargement')}</div>
        ) : !zonesDispo?.communes.length ? (
          <div className={s.hint}>
            <i className="fas fa-circle-exclamation" /> {t('parametres.livraison.aucuneZoneAssignee')}
          </div>
        ) : (
          <>
            {zonesDispo.zoneNom && (
              <div className={s.hint} style={{ marginBottom: 10 }}>
                <i className="fas fa-map-pin" /> {t('parametres.livraison.zoneAssignee', { nom: zonesDispo.zoneNom })}
              </div>
            )}
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {zonesDispo.communes.map(c => (
                <button key={c.id} onClick={() => toggleZone(c.nom)}
                  style={{
                    padding:'7px 16px', borderRadius:'var(--pill)', cursor:'pointer', fontSize:12, fontWeight:600,
                    background: zones.includes(c.nom) ? 'var(--t2)' : 'var(--g50)',
                    color: zones.includes(c.nom) ? '#fff' : 'var(--t2)',
                    border: zones.includes(c.nom) ? '1.5px solid var(--t2)' : '1.5px solid var(--bdr2)',
                    transition:'all .2s',
                  }}
                >
                  {zones.includes(c.nom) && <i className="fas fa-check" style={{ marginRight:5, fontSize:10 }} />}
                  {c.nom}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Récapitulatif de TOUTES les zones cochées — inclut aussi
         * d'éventuelles zones enregistrées avant ce correctif (ancienne
         * liste statique) qui ne feraient plus partie de la zone
         * attribuée : on ne les perd pas silencieusement, l'entreprise
         * peut toujours les retirer ici. */}
        {zones.length > 0 && (
          <div style={{ marginTop: 14, display:'flex', flexWrap:'wrap', gap:6 }}>
            {zones.map(z => (
              <span key={z} style={{
                display:'inline-flex', alignItems:'center', gap:6,
                fontSize:11, fontWeight:600, color:'var(--blue)',
                background:'var(--sky)', border:'1px solid var(--sky-3,#C8D9F8)',
                borderRadius:999, padding:'4px 10px',
              }}>
                {z}
                <i className="fas fa-xmark" style={{ cursor:'pointer', fontSize:10 }} onClick={() => toggleZone(z)} />
              </span>
            ))}
          </div>
        )}

        <div className={s.hint} style={{ marginTop:10 }}>
          <i className="fas fa-circle-info" /> {t('parametres.livraison.zonesSelectionnees', { count: zones.length })}
        </div>

        {/* Plus de bouton — enregistrement automatique (voir l'effet
         * debounced ci-dessus). Indicateur discret pendant l'appel réseau. */}
        {saving && (
          <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:7, fontSize:12.5, color:'var(--t3)' }}>
            <i className="fas fa-spinner fa-spin" /> {t('parametres.livraison.sauvegardeEnCours')}
          </div>
        )}
      </FormCard>
    </>
  );
}