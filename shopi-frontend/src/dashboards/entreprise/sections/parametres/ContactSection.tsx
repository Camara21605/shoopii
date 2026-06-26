// src/dashboards/entreprise/sections/parametres/ContactSection.tsx
import { useState } from 'react';
import FormCard from '../../components/parametres/FormCard';
import ToggleRow from '../../components/parametres/ToggleRow';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props { onDirty: () => void; onToast: (m: string, t?: string) => void; }

export default function ContactSection({ onDirty, onToast }: Props) {
  const [toggles, setToggles] = useState({ address: true, map: true, phone: false });
  const set = (k: keyof typeof toggles) => (v: boolean) => { setToggles(p => ({ ...p, [k]: v })); onDirty(); };

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-address-book" /> Contact &amp; Localisation</h1>
        <p>Coordonnées et adresse physique de votre boutique, affichées aux clients et utilisées pour la livraison.</p>
      </div>
      <FormCard title="Contacts" icon="fa-phone">
        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>Téléphone boutique <span className={s.flOpt}>public</span></div>
            <div className={s.fw}><div className={s.phonePfx}>🇬🇳 +224</div><input className={s.fin} type="tel" defaultValue="620 10 26 44" style={{ paddingLeft:90 }} onChange={onDirty} /></div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>WhatsApp boutique</div>
            <div className={s.fw}><i className="fab fa-whatsapp" style={{ position:'absolute', left:13, color:'#25D366', fontSize:13, zIndex:1 }} /><input className={s.fin} placeholder="620 00 00 00" onChange={onDirty} /></div>
            <div className={s.hint}><i className="fas fa-circle-info" /> Les clients vous contacteront directement via WhatsApp</div>
          </div>
        </div>
        <div className={s.fg}><div className={s.fl}>Email boutique <span className={s.flOpt}>public</span></div><div className={s.fw}><i className={`fas fa-envelope ${s.fi}`} /><input className={s.fin} type="email" defaultValue="maboutique@shopi.gn" onChange={onDirty} /></div></div>
      </FormCard>

      <FormCard title="Adresse physique" icon="fa-location-dot" subtitle="Localisation de votre boutique ou point de retrait">
        <div className={s.fg}><div className={s.fl}>Adresse complète <span className={s.flOpt}>*</span></div><div className={s.fw}><i className={`fas fa-map-marker-alt ${s.fi}`} /><input className={s.fin} defaultValue="Avenue de la République, Kaloum, en face du Grand Marché" onChange={onDirty} /></div></div>
        <div className={s.grid3}>
          <div className={s.fg}><div className={s.fl}>Commune <span className={s.flOpt}>*</span></div><div className={s.fw}><i className={`fas fa-map-pin ${s.fi}`} /><select className={`${s.fin} ${s.finSelect}`} onChange={onDirty}><option>Kaloum</option><option>Dixinn</option><option>Matam</option><option>Ratoma</option><option>Matoto</option></select></div></div>
          <div className={s.fg}><div className={s.fl}>Ville <span className={s.flOpt}>*</span></div><div className={s.fw}><i className={`fas fa-city ${s.fi}`} /><select className={`${s.fin} ${s.finSelect}`} onChange={onDirty}><option>Conakry</option><option>Kindia</option><option>Labé</option></select></div></div>
          <div className={s.fg}><div className={s.fl}>Pays</div><div className={s.fw}><i className={`fas fa-globe-africa ${s.fi}`} /><select className={`${s.fin} ${s.finSelect}`}><option>🇬🇳 Guinée</option></select></div></div>
        </div>
        <div className={s.fg}><div className={s.fl}>Repère / Indication</div><div className={s.fw}><i className={`fas fa-sign-hanging ${s.fi}`} /><input className={s.fin} defaultValue="Bâtiment rouge à côté de la pharmacie centrale, panneau Shopi visible" onChange={onDirty} /></div><div className={s.hint}><i className="fas fa-circle-info" /> Aide les livreurs et clients à vous trouver facilement</div></div>
        <div className={s.hint} style={{ background:'var(--sky-2,#f0f4ff)', padding:'10px 12px', borderRadius:8, border:'1px solid var(--sky-3,#c7d9f8)' }}>
          <i className="fas fa-map-location-dot" style={{ color:'var(--blue)', marginRight:7 }} />
          Pour épingler votre position exacte sur la carte, utilisez <strong>Voir ma boutique → Localisation</strong>.
        </div>
        <ToggleRow label="Afficher l'adresse complète" sub="L'adresse exacte est visible sur votre page boutique publique" checked={toggles.address} onChange={set('address')} />
        <ToggleRow label="Afficher la carte interactive" sub="Afficher la carte OpenStreetMap sur votre page boutique" checked={toggles.map} onChange={set('map')} />
        <ToggleRow label="Afficher le numéro de téléphone" sub="Le téléphone boutique est visible par tous les clients" checked={toggles.phone} onChange={set('phone')} />
      </FormCard>
      <div className={s.saveRow}><button className={s.saveBtn} onClick={() => onToast('✅ Contact sauvegardé', 's')}><i className="fas fa-cloud-arrow-up" /> Sauvegarder</button></div>
    </>
  );
}
