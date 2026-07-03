/* ================================================================
 * FICHIER : src/dashboards/partenaire/pages/ParametresPage.tsx
 *
 * Orchestrateur principal des paramètres partenaire.
 *
 * Responsabilités :
 *   1. Charge toutes les données via usePartenaireParametres()
 *   2. Gère l'état dirty global → SaveFloat
 *   3. Incrémente saveTrigger → section active réagit et sauvegarde
 *   4. Affiche la section correspondant à l'item actif de ParamNav
 *
 * Pattern saveTrigger :
 *   SaveFloat.onSave() → setSaveTrigger(n + 1)
 *   Chaque section écoute saveTrigger via useEffect et déclenche
 *   sa propre sauvegarde en réponse.
 * ================================================================ */

import { useState, useCallback } from 'react';

import ParamNav  from '../components/ParamNav';
import SaveFloat from '../components/SaveFloat';

import SecProfil          from '../sections/params/SecProfil';
import SecPaiement        from '../sections/params/SecPaiement';
import SecParrainage      from '../sections/params/SecParrainage';
import SecDocuments       from '../sections/params/SecDocuments';
import SecZone            from '../sections/params/SecZone';
import SecNotifications   from '../sections/params/SecNotifications';
import SecSecurite        from '../sections/params/SecSecurite';
import SecConfidentialite from '../sections/params/SecConfidentialite';
import SecPreferences     from '../sections/params/SecPreferences';
import SecDanger          from '../sections/params/SecDanger';

import { usePartenaireParametres } from '../hooks/usePartenaireParametres';
import { type SectionId }          from '../data/parametresData';
import { useToasts, ToastStack }   from '../components/Toast';

import p from '../styles/ParametresPage.module.css';

export default function ParametresPage() {
  const [section,     setSection]     = useState<SectionId>('profil');
  const [isDirty,     setIsDirty]     = useState(false);
  const [saveTrigger, setSaveTrigger] = useState(0);

  /* ── Hook central : données + fonctions API ── */
  const {
    data, loading, saving, error, refresh,
    saveProfil,    uploadPhoto,
    saveZone,
    saveSecurite,  changePassword,
    saveNotifications,
    saveConfidentialite,
    savePreferences,
    suspendreCompte, supprimerCompte,
  } = usePartenaireParametres();

  /* Stubs pour les sections sans backend encore (paiement, documents) */
  const stubSave = async () => { /* champs non encore persistés */ };
  const stubUploadDoc = async (_type: string, _file: File) => { /* idem */ };

  /* ── Toast (réutilisation du système partenaire) ── */
  const { toasts, pop: toast } = useToasts();

  /* ── État dirty ── */
  const dirty     = useCallback(() => setIsDirty(true),  []);
  const markClean = useCallback(() => setIsDirty(false), []);

  /* ── Sauvegarder : incrémente saveTrigger → section réagit ── */
  function handleSave() {
    setSaveTrigger(n => n + 1);
  }

  /* ── Annuler : recharge les données depuis l'API ── */
  function handleCancel() {
    refresh();
    setIsDirty(false);
    toast('↩️ Modifications annulées', 'i');
  }

  /* Props communes à toutes les sections */
  const sectionProps = { data, saving, dirty, markClean, saveTrigger };

  /* ── Rendu de la section active ── */
  function renderSection() {
    switch (section) {
      case 'profil':
        return (
          <SecProfil
            {...sectionProps}
            onSave={saveProfil}
            onUploadPhoto={uploadPhoto}
            onToast={toast}
          />
        );
      case 'paiement':
        return (
          <SecPaiement
            {...sectionProps}
            onSave={stubSave}
            onToast={toast}
          />
        );
      case 'parrainage':
        return <SecParrainage data={data} onToast={toast} />;
      case 'documents':
        return (
          <SecDocuments
            data={data}
            saving={saving}
            onUploadDocument={stubUploadDoc}
            onToast={toast}
          />
        );
      case 'zone':
        return (
          <SecZone
            {...sectionProps}
            onSave={saveZone}
            onToast={toast}
          />
        );
      case 'notifications':
        return (
          <SecNotifications
            {...sectionProps}
            onSave={saveNotifications}
            onToast={toast}
          />
        );
      case 'securite':
        return (
          <SecSecurite
            {...sectionProps}
            onSaveSecurite={saveSecurite}
            onChangePassword={changePassword}
            onToast={toast}
          />
        );
      case 'confidentialite':
        return (
          <SecConfidentialite
            {...sectionProps}
            onSave={saveConfidentialite}
            onToast={toast}
          />
        );
      case 'preferences':
        return (
          <SecPreferences
            {...sectionProps}
            onSave={savePreferences}
            onToast={toast}
          />
        );
      case 'danger':
        return (
          <SecDanger
            saving={saving}
            onSuspendre={suspendreCompte}
            onSupprimer={supprimerCompte}
            onToast={toast}
          />
        );
      default:
        return null;
    }
  }

  /* ── Chargement initial ── */
  if (loading) {
    return (
      <div className={p.page}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 0', color: 'var(--t3)' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 20 }} />
          <span style={{ fontSize: 14 }}>Chargement des paramètres…</span>
        </div>
      </div>
    );
  }

  /* ── Erreur critique ── */
  if (error) {
    return (
      <div className={p.page}>
        <div style={{ color: 'var(--red)', fontSize: 13.5 }}>
          <i className="fas fa-circle-exclamation" style={{ marginRight: 8 }} />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={p.page}>

      <div className={p.layout}>
        {/* ── Navigation gauche ── */}
        <ParamNav
          section={section}
          onSection={id => {
            /* Avertir si modifications non sauvegardées */
            setSection(id);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          data={data}
        />

        {/* ── Section active ── */}
        <main className={p.content}>
          {renderSection()}
        </main>
      </div>

      {/* ── Barre flottante d'enregistrement ── */}
      <SaveFloat
        show={isDirty}
        saving={saving}
        onSave={handleSave}
        onCancel={handleCancel}
      />

      <ToastStack toasts={toasts} />
    </div>
  );
}
