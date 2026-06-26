/*
 * FICHIER : src/dashboards/livreur/pages/LivreurParametresPage.tsx
 *
 * Page paramètres complète du livreur.
 * Charge les données via useLivreurParametres() et
 * distribue les fonctions de sauvegarde à chaque section.
 */
import React, { useState } from 'react';
import { useLivreurParametres } from '../hooks/useLivreurParametres';
import ParamNav from '../components/ParamNav';
import type { ParamSectionId } from '../data/parametresData';

import SecProfil          from './params/SecProfil';
import SecDocuments       from './params/SecDocuments';
import SecZone            from './params/SecZone';
import SecVitesses        from './params/SecVitesses';
import SecVehicule        from './params/SecVehicule';
import SecPaiement        from './params/SecPaiement';
import SecSecurite        from './params/SecSecurite';
import SecNotifications   from './params/SecNotifications';
import SecConfidentialite from './params/SecConfidentialite';
import SecDanger          from './params/SecDanger';

interface Props { onBack: () => void; onPop: (m: string, t?: string) => void; }

export default function LivreurParametresPage({ onBack, onPop }: Props) {
  const [section, setSection] = useState<ParamSectionId>('profil');
  const [isDirty, setIsDirty] = useState(false);

  const {
    data, loading, error, saving,
    saveProfil, uploadPhoto,
    uploadDocument, deleteDocument,
    saveZones, saveHoraires,
    saveVitesses, saveVehicule,
    savePaiement,
    savePassword, saveTwoFa,
    saveNotifs, savePrivacy,
    pauseCompte, desactiverCompte, supprimerCompte,
  } = useLivreurParametres();

  function markDirty() { setIsDirty(true); }
  function goTo(s: ParamSectionId) {
    if (isDirty && s !== section) {
      const ok = window.confirm('Vous avez des modifications non sauvegardées. Quitter quand même ?');
      if (!ok) return;
    }
    setIsDirty(false);
    setSection(s);
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'var(--t3)' }}>
      <div style={{ textAlign:'center' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize:28, display:'block', marginBottom:12 }} />
        Chargement des paramètres…
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div style={{ textAlign:'center', color:'var(--red)' }}>
        <i className="fas fa-triangle-exclamation" style={{ fontSize:28, display:'block', marginBottom:12 }} />
        {error}
        <br />
        <button onClick={() => window.location.reload()}
          style={{ marginTop:16, background:'var(--navy)', color:'#fff', border:'none',
            borderRadius:'var(--pill)', padding:'10px 24px', cursor:'pointer', fontSize:13 }}>
          Réessayer
        </button>
      </div>
    </div>
  );

  const common = { data, saving, dirty:markDirty, onPop };

  const sections: Record<ParamSectionId, React.ReactNode> = {
    profil:          <SecProfil          {...common} saveProfil={saveProfil} uploadPhoto={uploadPhoto} />,
    docs:            <SecDocuments       {...common} uploadDocument={uploadDocument} />,
    zone:            <SecZone            dirty={markDirty} onPop={onPop} saveZones={saveZones} saveHoraires={saveHoraires} data={data} saving={saving} />,
    vitesses:        <SecVitesses        {...common} saveVitesses={saveVitesses} />,
    vehicule:        <SecVehicule        dirty={markDirty} onPop={onPop} saveVehicule={saveVehicule} data={data} saving={saving} />,
    paiement:        <SecPaiement        dirty={markDirty} onPop={onPop} savePaiement={savePaiement} data={data} saving={saving} />,
    securite:        <SecSecurite        {...common} savePassword={savePassword} saveTwoFa={saveTwoFa} />,
    notifs:          <SecNotifications   {...common} saveNotifs={saveNotifs} />,
    confidentialite: <SecConfidentialite {...common} savePrivacy={savePrivacy} />,
    danger:          <SecDanger          saving={saving} onPop={onPop} pauseCompte={pauseCompte} desactiverCompte={desactiverCompte} supprimerCompte={supprimerCompte} />,
  };

  return (
    <div style={{ display:'flex', gap:20, padding:'20px 24px', alignItems:'flex-start', minHeight:'100vh' }}>
      <ParamNav active={section} onSelect={goTo} onBack={onBack} />
      <div style={{ flex:1, minWidth:0 }}>
        {sections[section]}
      </div>
    </div>
  );
}