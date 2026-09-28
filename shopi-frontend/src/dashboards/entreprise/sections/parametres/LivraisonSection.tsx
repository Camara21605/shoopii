/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/LivraisonSection.tsx
 * Section 5 — Livraison
 *
 * Relié au système :
 *   - modes affichés sur la page boutique publique et repris par défaut sur
 *     les nouveaux produits ;
 *   - VÉRIFIÉS à la commande (commande-creation.service) : un client ne peut
 *     plus commander avec un mode que la boutique a désactivé ;
 *   - au moins un mode reste actif (sinon plus aucune commande possible) ;
 *   - zones : communes de la zone attribuée à la boutique (le serveur refuse
 *     les autres).
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import { apiFetch } from '@/shared/services/apiFetch';
import s from '../../styles/parametres/ParametresPage.module.css';
import type { ToastType } from '../../types';

interface ZoneCommune { id: string; nom: string; code: string; }
interface ZonesDisponibles { zoneId: string | null; zoneNom: string | null; communes: ZoneCommune[]; }

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: ToastType) => void;
  saveLivraison: (b: Partial<ParametresData>) => Promise<void>;
}

export default function LivraisonSection({ data, saving, onToast, saveLivraison }: Props) {
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

  /* Dernières valeurs CONFIRMÉES par le serveur (empreinte JSON) — même
   * correctif que CatalogueSection : l'ancien drapeau « ignorer le prochain
   * changement » restait armé quand les données rechargées étaient identiques
   * et avalait la modification SUIVANTE (jamais enregistrée). */
  const serverSnapRef  = useRef<string | null>(null);
  const editVersionRef = useRef(0);
  const confirmedVersionRef = useRef(0);
  /* Version confirmée par le serveur : tant qu'une modification n'est pas
   * confirmée, aucune donnée arrivant du serveur (chargement lent, réponse
   * d'une ancienne requête) ne réécrit l'écran — plus de « je coche, ça se
   * décoche ». `resync` relance l'alignement une fois la confirmation reçue. */
  const [resync, setResync] = useState(0);

  const current = { livraisonStandard, livraisonShopi, livraisonCorresp, clickCollect, livraisonExpress, zonesLivraison: zones };
  const currentSnap = JSON.stringify(current);

  useEffect(() => {
    if (!data) return;
    const server = {
      livraisonStandard: data.livraisonStandard ?? true,
      livraisonShopi:    data.livraisonShopi    ?? true,
      livraisonCorresp:  data.livraisonCorresp  ?? false,
      clickCollect:      data.clickCollect      ?? true,
      livraisonExpress:  data.livraisonExpress  ?? false,
      zonesLivraison:    data.zonesLivraison    ?? [],
    };
    if (editVersionRef.current !== confirmedVersionRef.current) return;
    serverSnapRef.current = JSON.stringify(server);
    setLivraisonStandard(server.livraisonStandard);
    setLivraisonShopi(server.livraisonShopi);
    setLivraisonCorresp(server.livraisonCorresp);
    setClickCollect(server.clickCollect);
    setLivraisonExpress(server.livraisonExpress);
    setZones(server.zonesLivraison);
  }, [data, resync]);

  function toggleZone(zone: string) {
    editVersionRef.current += 1;
    setZones(prev => prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]);
  }

  /* Sauvegarde automatique (800 ms) dès que l'écran diffère du serveur */
  /* Enregistrement en attente (délai de 800 ms) : envoyé tout de suite si l'on
   * quitte la section avant — avant, le minuteur était annulé et la dernière
   * modification n'était jamais enregistrée. */
  const pendingSaveRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { pendingSaveRef.current?.(); }, []);
  useEffect(() => {
    if (serverSnapRef.current === null) return;
    /* Uniquement après une modification FAITE PAR L'UTILISATEUR : un simple
     * alignement sur les données du serveur (premier affichage) ne doit jamais
     * rien enregistrer — sinon les valeurs par défaut de l'écran, visibles un
     * instant avant le chargement, pouvaient écraser les vraies. */
    if (editVersionRef.current === confirmedVersionRef.current) return;
    /* Revenu exactement à l'état enregistré (ex. double clic) : rien à envoyer */
    if (currentSnap === serverSnapRef.current) { confirmedVersionRef.current = editVersionRef.current; return; }
    const run = () => {
      pendingSaveRef.current = null;
      const version = editVersionRef.current;
      saveLivraison(current)
        .then(() => { confirmedVersionRef.current = version; setResync(n => n + 1); onToast(t('parametres.livraison.savedToast'), 's'); })
        .catch((e: unknown) => {
          onToast(e instanceof Error && e.message ? `❌ ${e.message}` : t('parametres.livraison.errorToast'), 'e');
          /* Échec : le hook recharge les vraies valeurs ; on les accepte si rien n'a changé depuis */
          if (editVersionRef.current === version) { confirmedVersionRef.current = version; setResync(n => n + 1); }
        });
    };
    pendingSaveRef.current = run;
    const timer = setTimeout(run, 800);
    /* Minuteur annulé : ce qu'il devait envoyer ne doit plus partir « en quittant » */
    return () => { clearTimeout(timer); if (pendingSaveRef.current === run) pendingSaveRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSnap]);

  /* `recoit` : mode qui permet au client de RECEVOIR sa commande (express n'est
   * qu'une option en plus) — au moins un doit rester actif. */
  const METHODES = [
    { key:'standard', label:t('parametres.livraison.standard'),      sub:t('parametres.livraison.standardSub'),          value:livraisonStandard, set:setLivraisonStandard, recoit:true  },
    { key:'shopi',    label:t('parametres.livraison.livreursShopi'), sub:t('parametres.livraison.livreursShopiSub'),     value:livraisonShopi,    set:setLivraisonShopi,    recoit:true  },
    { key:'corresp',  label:t('parametres.livraison.correspondants'),sub:t('parametres.livraison.correspondantsSub'),    value:livraisonCorresp,  set:setLivraisonCorresp,  recoit:true  },
    { key:'collect',  label:t('parametres.livraison.clickCollect'),  sub:t('parametres.livraison.clickCollectSub'),      value:clickCollect,      set:setClickCollect,      recoit:true  },
    { key:'express',  label:t('parametres.livraison.express'),       sub:t('parametres.livraison.expressSub'),           value:livraisonExpress,  set:setLivraisonExpress,  recoit:false },
  ];

  function toggleMethode(m: typeof METHODES[number]) {
    if (m.value && m.recoit && METHODES.filter(x => x.recoit && x.value).length === 1) {
      onToast(t('parametres.livraison.dernierMode'), 'w');
      return;
    }
    editVersionRef.current += 1;
    m.set(!m.value);
  }

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-motorcycle" /> {t('parametres.livraison.title')}</h1>
        <p>{t('parametres.livraison.subtitle')}</p>
      </div>

      <FormCard title={t('parametres.livraison.methodesTitle')} icon="fa-truck" subtitle={t('parametres.livraison.methodesSubtitle')}>
        {METHODES.map(m => (
          <div key={m.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'12px 0', borderBottom:'1px solid var(--bdr)' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--navy)' }}>{m.label}</div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{m.sub}</div>
            </div>
            <button type="button" role="switch" aria-checked={m.value} aria-label={m.label}
              onClick={() => toggleMethode(m)}
              style={{ width:44, height:24, borderRadius:12, cursor:'pointer', border:'none', padding:0, background: m.value ? 'var(--t2)' : 'var(--g300)', position:'relative', transition:'background .2s', flexShrink:0 }}>
              <span style={{ position:'absolute', top:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)', left: m.value ? 22 : 3 }} />
            </button>
          </div>
        ))}
        <div className={s.hint} style={{ marginTop:10 }}>
          <i className="fas fa-circle-info" /> {t('parametres.livraison.modesVerifiesHint')}
        </div>
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
                <button key={c.id} type="button" aria-pressed={zones.includes(c.nom)} onClick={() => toggleZone(c.nom)}
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
                <button type="button" onClick={() => toggleZone(z)} aria-label={t('parametres.livraison.retirerZone', { zone: z })}
                  style={{ background:'none', border:'none', padding:0, cursor:'pointer', color:'inherit', display:'flex' }}>
                  <i className="fas fa-xmark" style={{ fontSize:10 }} />
                </button>
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