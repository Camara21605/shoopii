/* ================================================================
 * sections/params/SecDepot.tsx — VERSION CONNECTÉE
 * PATCH /correspondant/parametres/depot → DepotService
 * ================================================================ */

import { useState, useEffect, lazy, Suspense } from 'react';
import s from '../../styles/ParamsShared.module.css';
import ToggleRow from './ToggleRow';
import { pop } from '../../components/Toast';
import { ACCESS_TOGGLES } from '../../data/parametresData';
import type { CorrespondantData } from '../../hooks/useCorrespondantParametres';
import type { ToggleRow as TRow } from '../../data/parametresData';
import '../../../../shared/location/styles/location.css';
import type { LocationPickerValue } from '../../../../shared/location/components/LocationPicker';

const LocationPicker = lazy(() => import('../../../../shared/location/components/LocationPicker'));

interface Props {
  data:       CorrespondantData | null;
  saving:     boolean;
  dirty:      () => void;
  markClean:  () => void;
  saveTrigger:number;
  onSave:     (body: Partial<CorrespondantData>) => Promise<any>;
}

export default function SecDepot({ data, saving, dirty, markClean, saveTrigger, onSave }: Props) {
  const [nom,       setNom]       = useState('');
  const [adresse,   setAdresse]   = useState('');
  const [commune,   setCommune]   = useState('Kaloum');
  const [ville,     setVille]     = useState('Conakry');
  const [repere,    setRepere]    = useState('');
  const [phone,     setPhone]     = useState('');
  const [capacite,  setCapacite]  = useState("Jusqu'à 50 colis");
  const [typeLocal, setTypeLocal] = useState('Centre commercial');
  const [acces,     setAcces]     = useState('Oui — accès contrôlé');
  const [toggles,   setToggles]   = useState<TRow[]>(ACCESS_TOGGLES.map(t => ({ ...t })));
  const [locationVal, setLocationVal] = useState<LocationPickerValue | null>(null);

  /* ── Init depuis API ── */
  useEffect(() => {
    if (!data) return;
    setNom(data.depotNom       ?? '');
    setAdresse(data.depotAdresse ?? '');
    setCommune(data.depotCommune ?? 'Kaloum');
    setVille(data.depotVille   ?? 'Conakry');
    setRepere(data.depotRepere ?? '');
    setPhone(data.depotPhone   ?? '');
    if ((data as any).depotLatitude && (data as any).depotLongitude) {
      setLocationVal({
        coordinates: { latitude: Number((data as any).depotLatitude), longitude: Number((data as any).depotLongitude) },
        address: null,
      });
    }
    setCapacite(data.depotCapacite  ?? "Jusqu'à 50 colis");
    setTypeLocal(data.depotTypeLocal ?? 'Centre commercial');
    setAcces(data.depotAcces   ?? 'Oui — accès contrôlé');
    /* Restaurer les toggles d'accès depuis depotAccessOptions */
    if (data.depotAccessOptions) {
      setToggles(prev => prev.map(t => ({
        ...t,
        checked: data.depotAccessOptions?.[t.label.toLowerCase().replace(/ /g,'_')] ?? t.checked,
      })));
    }
  }, [data]);

  /* ── SaveFloat trigger ── */
  useEffect(() => { if (saveTrigger > 0) handleSave(); }, [saveTrigger]);

  async function handleSave() {
    /* Convertir les toggles en objet JSON pour depotAccessOptions */
    const depotAccessOptions: Record<string, boolean> = {};
    toggles.forEach(t => {
      const key = t.label.toLowerCase().replace(/ /g, '_');
      depotAccessOptions[key] = t.checked;
    });

    try {
      await onSave({
        depotNom: nom, depotAdresse: adresse, depotCommune: commune, depotVille: ville,
        depotRepere: repere, depotPhone: phone, depotCapacite: capacite,
        depotTypeLocal: typeLocal, depotAcces: acces, depotAccessOptions,
        ...(locationVal?.coordinates && {
          depotLatitude:  locationVal.coordinates.latitude,
          depotLongitude: locationVal.coordinates.longitude,
        }),
      } as any);
      markClean();
      pop('✅ Point de dépôt sauvegardé', 's');
    } catch (e: any) {
      pop(`❌ ${e.message}`, 'e');
    }
  }

  function updateToggle(i: number, checked: boolean) {
    setToggles(prev => prev.map((t, idx) => idx === i ? { ...t, checked } : t));
    dirty();
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={s.psHd}>
        <h1><i className="fas fa-store-alt" /> Point de dépôt</h1>
        <p>Point de relais physique où boutiques et livreurs déposent et retirent les colis.</p>
      </div>

      <div className={s.fc}>
        <div className={s.fcHd}><div><div className={s.fcTtl}><i className="fas fa-location-dot" /> Localisation du dépôt</div></div></div>
        <div className={s.fcBody}>
          <div className={s.fg}>
            <div className={s.fl}>Nom du point de dépôt *</div>
            <div className={s.fw}>
              <i className="fas fa-store" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
              <input className={s.fin} value={nom} onChange={e => { setNom(e.target.value); dirty(); }} />
            </div>
            <div className={s.fiHint}><i className="fas fa-circle-info" /> Ce nom apparaît dans les informations de livraison des clients</div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>Adresse complète *</div>
            <div className={s.fw}>
              <i className="fas fa-location-dot" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
              <input className={s.fin} value={adresse} onChange={e => { setAdresse(e.target.value); dirty(); }} />
            </div>
          </div>
          <div className={s.grid2}>
            <div className={s.fg}>
              <div className={s.fl}>Commune / Quartier *</div>
              <div className={s.fw}>
                <i className="fas fa-map-pin" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
                <select className={s.fin} value={commune} onChange={e => { setCommune(e.target.value); dirty(); }}>
                  {['Kaloum','Dixinn','Matam','Ratoma','Matoto'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className={s.fg}>
              <div className={s.fl}>Ville *</div>
              <div className={s.fw}>
                <i className="fas fa-city" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
                <select className={s.fin} value={ville} onChange={e => { setVille(e.target.value); dirty(); }}>
                  {['Conakry','Kindia','Boké','Labé'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>Repère / Indication</div>
            <div className={s.fw}>
              <i className="fas fa-sign-hanging" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
              <input className={s.fin} value={repere} onChange={e => { setRepere(e.target.value); dirty(); }} />
            </div>
          </div>

          {/* ── Carte GPS du dépôt ── */}
          <div className={s.fg}>
            <div className={s.fl}>
              <i className="fas fa-map-location-dot" style={{ marginRight:6, color:'var(--blue)' }} />
              Position GPS du dépôt
              <span className={s.flOpt} style={{ marginLeft:8 }}>Cliquez ou glissez le marqueur</span>
            </div>
            <Suspense fallback={
              <div style={{ height:260, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--sky-2,#f0f4ff)', borderRadius:12 }}>
                <i className="fas fa-circle-notch fa-spin" style={{ color:'var(--blue)', fontSize:22 }} />
              </div>
            }>
              <LocationPicker
                value={locationVal}
                onChange={v => { setLocationVal(v); dirty(); }}
                height="260px"
                placeholder="Rechercher votre point de dépôt…"
              />
            </Suspense>
            {locationVal?.coordinates && (
              <div className={s.fiHint} style={{ marginTop:6 }}>
                <i className="fas fa-check-circle" style={{ color:'var(--emerald)', marginRight:5 }} />
                GPS enregistré : {locationVal.coordinates.latitude.toFixed(5)}, {locationVal.coordinates.longitude.toFixed(5)}
              </div>
            )}
          </div>

          <div className={s.grid2}>
            <div className={s.fg}>
              <div className={s.fl}>Téléphone du dépôt <span className={s.flOpt}>≠ téléphone personnel</span></div>
              <div className={s.fw} style={{ position:'relative' }}>
                <div className={s.phonePfx}>🇬🇳 +224</div>
                <input className={s.fin} type="tel" value={phone} onChange={e => { setPhone(e.target.value); dirty(); }} style={{ paddingLeft:90 }} />
              </div>
              <div className={s.fiHint}><i className="fas fa-circle-info" /> Numéro public du relais affiché aux clients — stocké dans Correspondent.depotPhone</div>
            </div>
            <div className={s.fg}>
              <div className={s.fl}>Capacité maximale</div>
              <div className={s.fw}>
                <i className="fas fa-boxes-stacked" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
                <select className={s.fin} value={capacite} onChange={e => { setCapacite(e.target.value); dirty(); }}>
                  {["Jusqu'à 10 colis","Jusqu'à 25 colis","Jusqu'à 50 colis","+50 colis (grand espace)"].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={s.fc}>
        <div className={s.fcHd}><div><div className={s.fcTtl}><i className="fas fa-door-open" /> Conditions d'accès</div></div></div>
        <div className={s.fcBody}>
          <div className={s.grid2} style={{ marginBottom:14 }}>
            <div className={s.fg}>
              <div className={s.fl}>Type de local</div>
              <div className={s.fw}>
                <i className="fas fa-building" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
                <select className={s.fin} value={typeLocal} onChange={e => { setTypeLocal(e.target.value); dirty(); }}>
                  {['Local commercial','Centre commercial','Bureau professionnel','Domicile sécurisé','Entrepôt'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className={s.fg}>
              <div className={s.fl}>Accès sécurisé</div>
              <div className={s.fw}>
                <i className="fas fa-lock" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
                <select className={s.fin} value={acces} onChange={e => { setAcces(e.target.value); dirty(); }}>
                  {['Oui — accès contrôlé','Non — accès libre','Partiel — selon horaires'].map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>
          </div>
          {toggles.map((t, i) => (
            <ToggleRow key={t.label} label={t.label} sub={t.sub} checked={t.checked} badge={t.badge} onChange={v => updateToggle(i, v)} />
          ))}
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder</>}
        </button>
      </div>
    </div>
  );
}