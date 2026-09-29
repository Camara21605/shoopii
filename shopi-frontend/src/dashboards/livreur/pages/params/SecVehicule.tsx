/*
 * FICHIER : src/dashboards/livreur/pages/params/SecVehicule.tsx
 * ✅ CONNECTÉ — données chargées depuis l'API + save
 *
 * Effet RÉEL de chaque champ : le type de véhicule sert de filtre dans la
 * recherche de livreurs des clients ; type, modèle et plaque sont affichés aux
 * clients et aux boutiques.
 *
 * BUGS CORRIGÉS :
 *   - L'ENREGISTREMENT ÉCHOUAIT TOUJOURS : le type partait sous le nom
 *     « VehicleType » alors que le serveur attend « vehicleType » et refuse tout
 *     champ inconnu (erreur 400 à chaque clic sur « Enregistrer ») ;
 *   - un champ vidé (marque, plaque…) n'était jamais effacé (non envoyé) ;
 *     année non vérifiée avant l'envoi ;
 *   - un rechargement des données effaçait la saisie non enregistrée ;
 *   - choix du type non accessible au clavier.
 * RETIRÉS car lus nulle part : « Capacité maximale » et « Colis acceptés »
 * (ces derniers étaient en plus enregistrés sous forme de libellés TRADUITS :
 * une sauvegarde en anglais décochait tout en français).
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

interface Props {
  data:         LivreurData | null;
  saving:       boolean;
  dirty:        () => void;
  clean?:       () => void;
  onPop:        (m: string, t?: string) => void;
  saveVehicule: (body: Record<string, unknown>) => Promise<void>;
}

/* Chaque type porte explicitement sa valeur enum backend (jamais un zip par position). */
function buildVehicleTypes(t: (key: string) => string) {
  return [
    { value:'moto',     em:'🛵', nm: t('livreurSecVehicule.vehicleTypes.moto.nm'),     sub: t('livreurSecVehicule.vehicleTypes.moto.sub')     },
    { value:'voiture',  em:'🚗', nm: t('livreurSecVehicule.vehicleTypes.voiture.nm'),  sub: t('livreurSecVehicule.vehicleTypes.voiture.sub')  },
    { value:'velo',     em:'🚴', nm: t('livreurSecVehicule.vehicleTypes.velo.nm'),     sub: t('livreurSecVehicule.vehicleTypes.velo.sub')     },
    { value:'tricycle', em:'🛺', nm: t('livreurSecVehicule.vehicleTypes.tricycle.nm'), sub: t('livreurSecVehicule.vehicleTypes.tricycle.sub') },
  ];
}

const ANNEE_MAX = new Date().getFullYear() + 1;
type Form = { type: string; marque: string; modele: string; annee: string; couleur: string; plaque: string };
const versForm = (d: LivreurData): Form => ({
  type: d.VehicleType ?? 'moto', marque: d.vehiculeMarque ?? '', modele: d.vehiculeModele ?? '',
  annee: d.vehiculeAnnee ? String(d.vehiculeAnnee) : '', couleur: d.vehiculeCouleur ?? '', plaque: d.vehiculePlaque ?? '',
});

export default function SecVehicule({ data, saving, dirty, clean, onPop, saveVehicule }: Props) {
  const { t } = useTranslation();
  const VEHICLE_TYPES = buildVehicleTypes(t);
  const [form, setForm] = useState<Form>({ type: 'moto', marque: '', modele: '', annee: '', couleur: '', plaque: '' });

  /* Le formulaire ne reprend les données du serveur que si l'on n'était pas en train de le modifier */
  const prevDataRef = useRef<LivreurData | null>(null);
  useEffect(() => {
    if (!data) return;
    const prev = prevDataRef.current;
    prevDataRef.current = data;
    if (prev && JSON.stringify(form) !== JSON.stringify(versForm(prev))) return;
    setForm(versForm(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const set = (k: keyof Form, v: string) => { setForm(f => ({ ...f, [k]: v })); dirty(); };

  const anneeInvalide = !!form.annee && (!/^\d{4}$/.test(form.annee) || +form.annee < 1990 || +form.annee > ANNEE_MAX);

  async function handleSave() {
    if (anneeInvalide) { onPop(t('livreurSecVehicule.toasts.anneeInvalide', { max: ANNEE_MAX }), 'e'); return; }
    try {
      await saveVehicule({
        vehicleType:     form.type,
        vehiculeMarque:  form.marque.trim(),
        vehiculeModele:  form.modele.trim(),
        vehiculeAnnee:   form.annee ? Number(form.annee) : null,
        vehiculeCouleur: form.couleur.trim(),
        vehiculePlaque:  form.plaque.trim(),
      });
      onPop(t('livreurSecVehicule.toasts.saved'), 's');
      clean?.();
    } catch (err: unknown) {
      onPop((err as Error)?.message ?? t('livreurSecVehicule.toasts.saveError'), 'e');
    }
  }

  const champs: { k: keyof Form; label: string; icon: string; type?: string; max: number }[] = [
    { k:'marque',  label: t('livreurSecVehicule.detailsCard.marque'),  icon:'fa-tag',            max:100 },
    { k:'modele',  label: t('livreurSecVehicule.detailsCard.modele'),  icon:'fa-motorcycle',     max:100 },
    { k:'annee',   label: t('livreurSecVehicule.detailsCard.annee'),   icon:'fa-calendar',       max:4, type:'number' },
    { k:'couleur', label: t('livreurSecVehicule.detailsCard.couleur'), icon:'fa-palette',        max:50 },
    { k:'plaque',  label: t('livreurSecVehicule.detailsCard.plaque'),  icon:'fa-rectangle-list', max:20 },
  ];

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
          <div className={ps.radioGroup} role="radiogroup" aria-label={t('livreurSecVehicule.typeCard.titre')}>
            {VEHICLE_TYPES.map(v => (
              <button type="button" role="radio" aria-checked={form.type === v.value} key={v.value}
                className={`${ps.radioOpt} ${form.type === v.value ? ps.radioSel : ''}`}
                style={{ fontFamily:'inherit', textAlign:'left', width:'100%' }}
                onClick={() => set('type', v.value)}>
                <div className={ps.roDot} />
                <span className={ps.roEm}>{v.em}</span>
                <div><div className={ps.roTtl}>{v.nm}</div><div className={ps.roSub}>{v.sub}</div></div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Détails véhicule */}
      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-info-circle" /> {t('livreurSecVehicule.detailsCard.titre')}</div></div>
        <div className={ps.cb}>
          <div className={ps.grid2} style={{ marginBottom:14 }}>
            {champs.map(f => (
              <div key={f.k} className={ps.fiGroup}>
                <label className={ps.fiLabel} htmlFor={`veh-${f.k}`}>{f.label}</label>
                <div className={ps.fiWrap}>
                  <i className={`fas ${f.icon}`} style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                  <input id={`veh-${f.k}`} className={ps.fiInput} type={f.type ?? 'text'} value={form[f.k]} maxLength={f.max}
                    min={f.k === 'annee' ? 1990 : undefined} max={f.k === 'annee' ? ANNEE_MAX : undefined}
                    aria-invalid={f.k === 'annee' && anneeInvalide}
                    style={f.k === 'annee' && anneeInvalide ? { borderColor:'var(--red)' } : undefined}
                    onChange={e => set(f.k, e.target.value)} />
                </div>
                {f.k === 'annee' && anneeInvalide && (
                  <div className={ps.fiHint} style={{ color:'var(--red)' }}>{t('livreurSecVehicule.toasts.anneeInvalide', { max: ANNEE_MAX })}</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
            <button type="button" onClick={handleSave} disabled={saving || anneeInvalide}
              style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                padding:'12px 28px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:saving || anneeInvalide ? 0.6 : 1,
                display:'flex', alignItems:'center', gap:8 }}>
              {saving ? <><i className="fas fa-spinner fa-spin" /> {t('livreurSecVehicule.saving')}</> : <><i className="fas fa-cloud-arrow-up" /> {t('livreurSecVehicule.saveButton')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
