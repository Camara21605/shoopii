/* ================================================================
 * pages/ParametresPage.tsx — VERSION CONNECTÉE AU BACKEND
 *
 * Orchestrateur principal :
 *  1. Charge toutes les données via useCorrespondantParametres()
 *  2. Passe data + fonctions API à chaque section
 *  3. Gère l'état dirty global → SaveFloat
 *  4. Propage saveTrigger aux sections pour que SaveFloat déclenche
 *     la sauvegarde de la section active
 *
 * Pattern saveTrigger :
 *   - Parent incrémente saveTrigger quand l'utilisateur clique SaveFloat
 *   - La section active écoute saveTrigger via useEffect
 *   - Elle déclenche sa propre sauvegarde en réponse
 * ================================================================ */

import React, { useState, useCallback, useEffect } from 'react';

import ParamNav   from '../components/ParamNav';
import SaveFloat  from '../components/SaveFloat';
import SecLangue  from '../../../shared/components/params/SecLangue';

import SecProfil          from '../sections/params/SecProfil';
import SecDepot           from '../sections/params/SecDepot';
import SecZone            from '../sections/params/SecZone';
import SecEntites         from '../sections/params/SecEntites';
import SecColis           from '../sections/params/SecColis';
import SecPaiement        from '../sections/params/SecPaiement';
import SecDocuments       from '../sections/params/SecDocuments';
import SecSecurite        from '../sections/params/SecSecurite';
import SecNotifications   from '../sections/params/SecNotifications';
import SecConfidentialite from '../sections/params/SecConfidentialite';
import SecDanger          from '../sections/params/SecDanger';

import { useCorrespondantParametres } from '../hooks/useCorrespondantParametres';
import { type SectionId } from '../data/parametresData';

import p from '../styles/ParametresPage.module.css';
import s from '../styles/ParamsShared.module.css';

export default function ParametresPage() {
  const [section,     setSection]     = useState<SectionId>('profil');
  const [isDirty,     setIsDirty]     = useState(false);
  /* Incrémenter pour déclencher la sauvegarde dans la section active */
  const [saveTrigger, setSaveTrigger] = useState(0);

  /* ── Hook central : toutes les données + fonctions API ── */
  const {
    data, loading, saving, error, refresh,
    saveProfil,   uploadPhoto,
    saveDepot,
    saveZone,     saveHoraires,
    regenererCode, saveEntites,
    saveColis,
    savePaiement,
    uploadDocument, deleteDocument,
    saveSecurite, changePassword,
    saveNotifications,
    saveConfidentialite,
    suspendreCompte, desactiverCompte, supprimerCompte,
  } = useCorrespondantParametres();

  /* Callbacks transmis à chaque section */
  const dirty    = useCallback(() => setIsDirty(true),  []);
  const markClean = useCallback(() => setIsDirty(false), []);

  /* Réinitialise le dirty state quand la section change */
  useEffect(() => { setIsDirty(false); }, [section]);

  /* Props communs passés à chaque section (hormis les spécifiques) */
  const base = { dirty, markClean, saving, saveTrigger };

  /* ── ÉTATS DE CHARGEMENT / ERREUR ── */
  if (loading) {
    return (
      <div className={p.page} style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
        <div style={{ textAlign:'center' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize:32, color:'var(--cor,#B45309)', marginBottom:16, display:'block' }} />
          <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:700, color:'var(--navy)' }}>Chargement de vos paramètres…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={p.page} style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
        <div style={{ textAlign:'center' }}>
          <i className="fas fa-circle-exclamation" style={{ fontSize:32, color:'var(--red,#DC2626)', marginBottom:12, display:'block' }} />
          <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:700, color:'var(--red)' }}>Erreur de chargement</div>
          <div style={{ fontSize:13, color:'var(--t3)', margin:'8px 0 16px' }}>{error}</div>
          <button onClick={refresh} style={{ background:'var(--cor,#B45309)', color:'#fff', border:'none', borderRadius:'var(--pill)', padding:'10px 22px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            <i className="fas fa-rotate-right" /> Réessayer
          </button>
        </div>
      </div>
    );
  }

  /* ── RENDU DES SECTIONS ── */
  const renderSection = () => {
    switch (section) {
      case 'profil':
        return <SecProfil {...base} data={data}
          onSave={saveProfil} onUploadPhoto={uploadPhoto} />;
      case 'depot':
        return <SecDepot {...base} data={data}
          onSave={saveDepot} />;
      case 'zone':
        return <SecZone {...base} data={data}
          onSaveZone={saveZone} onSaveHoraires={saveHoraires} />;
      case 'entites':
        return <SecEntites {...base} data={data}
          onSave={saveEntites} onRegenerCode={regenererCode} />;
      case 'colis':
        return <SecColis {...base} data={data}
          onSave={saveColis} />;
      case 'paiement':
        return <SecPaiement {...base} data={data}
          onSave={savePaiement} />;
      case 'documents':
        return <SecDocuments data={data}
          onUpload={uploadDocument} onDelete={deleteDocument} />;
      case 'securite':
        return <SecSecurite {...base} data={data}
          onSave={saveSecurite} onChangePassword={changePassword} />;
      case 'notifications':
        return <SecNotifications {...base} data={data}
          onSave={saveNotifications} />;
      case 'confidentialite':
        return <SecConfidentialite {...base} data={data}
          onSave={saveConfidentialite} />;
      case 'langue':
        return <SecLangue />;
      case 'danger':
        return <SecDanger data={data}
          onSuspendre={suspendreCompte}
          onDesactiver={desactiverCompte}
          onSupprimer={supprimerCompte} />;
      default:
        return null;
    }
  };

  return (
    <div className={p.page}>
      <div className={p.layout}>

        {/* ── Navigation gauche ── */}
        {/*
          data={data} est indispensable :
          ParamNav l'utilise dans computeNavState() pour calculer
          les % de complétion et les points d'alerte de chaque section.
          Sans ce prop, tous les indicateurs restent vides.
        */}
        <ParamNav
          section={section}
          onSection={id => {
            setSection(id);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          data={data}
        />

        {/* ── Section active ── */}
        <div className={p.content}>
          {renderSection()}
        </div>
      </div>

      {/* ── Barre flottante ── */}
      <SaveFloat
        show={isDirty}
        saving={saving}
        onSave={() => setSaveTrigger(n => n + 1)}
        onCancel={markClean}
      />
    </div>
  );
}