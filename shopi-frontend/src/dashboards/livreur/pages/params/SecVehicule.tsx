/*
 * FICHIER : src/dashboards/livreur/pages/params/SecVehicule.tsx
 * ✅ CONNECTÉ — données chargées depuis l'API + save
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

interface Props {
  data:         LivreurData | null;
  saving:       boolean;
  dirty:        () => void;
  onPop:        (m: string, t?: string) => void;
  saveVehicule: (body: Partial<LivreurData>) => Promise<void>;
}

/* BUG CORRIGÉ — ce tableau était zippé PAR INDEX avec VEHICLE_VALUES
 * ci-dessous ('moto','voiture','velo','tricycle',...) pour retrouver la
 * valeur enum backend à sauvegarder. Le commentaire d'origine affirmait
 * "ordre exactement préservé", mais l'ordre AFFICHÉ ici était
 * moto/vélo/voiture/tricycle — vélo et voiture inversés par rapport à
 * VEHICLE_VALUES (moto/voiture/vélo/tricycle) : choisir "Vélo"
 * enregistrait en réalité "voiture", et vice-versa. Chaque type porte
 * maintenant sa vraie valeur enum explicitement — plus aucun zip par
 * position possible. */
function buildVehicleTypes(t: (key: string) => string) {
  return [
    { value:'moto',     em:'🛵', nm: t('livreurSecVehicule.vehicleTypes.moto.nm'),     sub: t('livreurSecVehicule.vehicleTypes.moto.sub')     },
    { value:'voiture',  em:'🚗', nm: t('livreurSecVehicule.vehicleTypes.voiture.nm'),  sub: t('livreurSecVehicule.vehicleTypes.voiture.sub')  },
    { value:'velo',     em:'🚴', nm: t('livreurSecVehicule.vehicleTypes.velo.nm'),     sub: t('livreurSecVehicule.vehicleTypes.velo.sub')     },
    { value:'tricycle', em:'🛺', nm: t('livreurSecVehicule.vehicleTypes.tricycle.nm'), sub: t('livreurSecVehicule.vehicleTypes.tricycle.sub') },
  ];
}

function buildColisTypes(t: (key: string) => string): string[] {
  return [
    t('livreurSecVehicule.colisTypes.electronique'),
    t('livreurSecVehicule.colisTypes.vetements'),
    t('livreurSecVehicule.colisTypes.colisStandard'),
    t('livreurSecVehicule.colisTypes.alimentation'),
    t('livreurSecVehicule.colisTypes.pharmacie'),
    t('livreurSecVehicule.colisTypes.documents'),
  ];
}

/* Clés internes de capacité — stables, alignées sur l'enum backend
 * (IsIn(['10kg','20kg','50kg','50kg+']) côté DTO). Le libellé affiché
 * vient de t(), jamais utilisé comme valeur. */
const CAPACITE_KEYS = ['cap10', 'cap20', 'cap50', 'cap50plus'] as const;
const CAPACITE_BACKEND: Record<string, string> = { cap10:'10kg', cap20:'20kg', cap50:'50kg', cap50plus:'50kg+' };
const CAPACITE_BACKEND_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(CAPACITE_BACKEND).map(([k,v]) => [v,k])
);

export default function SecVehicule({ data, saving, dirty, onPop, saveVehicule }: Props) {
  const { t } = useTranslation();
  const VEHICLE_TYPES = buildVehicleTypes(t);
  const COLIS_TYPES   = buildColisTypes(t);
  const capaciteLabel = (key: string) => t(`livreurSecVehicule.capacite.${key}`);
  const [selVehicle,    setSelVehicle]    = useState('moto');
  const [colisOn,       setColisOn]       = useState(COLIS_TYPES.map((_, i) => i < 5));
  const [marque,        setMarque]        = useState('');
  const [modele,        setModele]        = useState('');
  const [annee,         setAnnee]         = useState('');
  const [couleur,       setCouleur]       = useState('');
  const [plaque,        setPlaque]        = useState('');
  const [selCapacite,   setSelCapacite]   = useState<string>('cap20');

  useEffect(() => {
    if (!data) return;
    // Type véhicule
    setSelVehicle(data.VehicleType ?? 'moto');
    // Champs texte
    setMarque(data.vehiculeMarque  ?? '');
    setModele(data.vehiculeModele  ?? '');
    setAnnee(data.vehiculeAnnee    ? String(data.vehiculeAnnee) : '');
    setCouleur(data.vehiculeCouleur ?? '');
    setPlaque(data.vehiculePlaque  ?? '');
    // Capacité
    setSelCapacite(CAPACITE_BACKEND_REVERSE[data.vehiculeCapacite] ?? 'cap20');
    // Colis acceptés
    if (data.colisAcceptes) {
      setColisOn(COLIS_TYPES.map(c => data.colisAcceptes!.includes(c)));
    }
  }, [data]);

  async function handleSave() {
    try {
      await saveVehicule({
        VehicleType:     selVehicle as any,
        vehiculeMarque:   marque   || undefined,
        vehiculeModele:   modele   || undefined,
        vehiculeAnnee:    annee    ? Number(annee) : undefined,
        vehiculeCouleur:  couleur  || undefined,
        vehiculePlaque:   plaque   || undefined,
        vehiculeCapacite: CAPACITE_BACKEND[selCapacite] ?? '20kg',
        colisAcceptes:    COLIS_TYPES.filter((_, i) => colisOn[i]),
      });
      onPop(t('livreurSecVehicule.toasts.saved'), 's');
    } catch (err: any) {
      onPop(err?.message ?? t('livreurSecVehicule.toasts.saveError'), 'e');
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-motorcycle" /> {t('livreurSecVehicule.header.titre')}</h2>
        <p>{t('livreurSecVehicule.header.sub')}</p>
      </div>

      {/* Type véhicule */}
      <div className={ps.card}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-truck" /> {t('livreurSecVehicule.typeCard.titre')}</div></div>
        <div className={ps.cb}>
          <div className={ps.radioGroup}>
            {VEHICLE_TYPES.map(v => (
              <div key={v.value} className={`${ps.radioOpt} ${selVehicle===v.value ? ps.radioSel : ''}`}
                onClick={() => { setSelVehicle(v.value); dirty(); }}>
                <div className={ps.roDot} />
                <span className={ps.roEm}>{v.em}</span>
                <div><div className={ps.roTtl}>{v.nm}</div><div className={ps.roSub}>{v.sub}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Détails véhicule */}
      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-info-circle" /> {t('livreurSecVehicule.detailsCard.titre')}</div></div>
        <div className={ps.cb}>
          <div className={ps.grid2} style={{ marginBottom:14 }}>
            {[
              { label: t('livreurSecVehicule.detailsCard.marque'),  icon:'fa-tag',            val:marque,  set:setMarque  },
              { label: t('livreurSecVehicule.detailsCard.modele'),  icon:'fa-motorcycle',     val:modele,  set:setModele  },
              { label: t('livreurSecVehicule.detailsCard.annee'),   icon:'fa-calendar',       val:annee,   set:setAnnee,  type:'number' },
              { label: t('livreurSecVehicule.detailsCard.couleur'), icon:'fa-palette',        val:couleur, set:setCouleur },
              { label: t('livreurSecVehicule.detailsCard.plaque'),  icon:'fa-rectangle-list', val:plaque,  set:setPlaque  },
            ].map(f => (
              <div key={f.label} className={ps.fiGroup}>
                <div className={ps.fiLabel}>{f.label}</div>
                <div className={ps.fiWrap}>
                  <i className={`fas ${f.icon}`} style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                  <input className={ps.fiInput} type={f.type ?? 'text'} value={f.val}
                    onChange={e => { f.set(e.target.value); dirty(); }} />
                </div>
              </div>
            ))}
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>{t('livreurSecVehicule.detailsCard.capaciteMax')}</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-weight-hanging" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <select className={ps.fiInput} value={selCapacite}
                  onChange={e => { setSelCapacite(e.target.value); dirty(); }}
                  style={{ appearance:'none', paddingRight:30 }}>
                  {CAPACITE_KEYS.map(k => <option key={k} value={k}>{capaciteLabel(k)}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className={ps.fiGroup}>
            <div className={ps.fiLabel}>{t('livreurSecVehicule.colisLabel')}</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
              {COLIS_TYPES.map((c, i) => (
                <label key={c} style={{
                  display:'flex', alignItems:'center', gap:6,
                  background: colisOn[i] ? 'var(--tl-bg)' : 'var(--g50)',
                  border:`1.5px solid ${colisOn[i] ? 'var(--teal)' : 'var(--bdr2)'}`,
                  borderRadius:'var(--pill)', padding:'6px 13px', cursor:'pointer',
                  fontSize:12, fontWeight:600,
                  color: colisOn[i] ? 'var(--teal)' : 'var(--t2)', transition:'all .2s',
                }}>
                  <input type="checkbox" checked={colisOn[i]} style={{ accentColor:'var(--teal)', width:13, height:13 }}
                    onChange={e => { const n=[...colisOn]; n[i]=e.target.checked; setColisOn(n); dirty(); }} />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                padding:'12px 28px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1,
                display:'flex', alignItems:'center', gap:8 }}>
              {saving ? <><i className="fas fa-spinner fa-spin" /> {t('livreurSecVehicule.saving')}</> : <><i className="fas fa-cloud-arrow-up" /> {t('livreurSecVehicule.saveButton')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}