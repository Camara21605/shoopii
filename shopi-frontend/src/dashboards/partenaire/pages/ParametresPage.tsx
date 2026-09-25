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

import { useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ParamNav        from '../components/ParamNav';
import ParamMobileMenu from '../components/ParamMobileMenu';
import SaveFloat from '../components/SaveFloat';
import { useAppContext } from '../../../shared/context/AppContext';
import { useIsNarrowScreen } from '../../../shared/hooks/useIsNarrowScreen';

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
import { isSectionId, type SectionId } from '../data/parametresData';
import { useToasts, ToastStack }   from '../components/Toast';

import p from '../styles/ParametresPage.module.css';

export default function ParametresPage() {
  const { t } = useTranslation();
  const { logout } = useAppContext();
  const navigate = useNavigate();
  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl = searchParams.get('section');
  const [section,     setSection]     = useState<SectionId>(
    isSectionId(sectionFromUrl) ? sectionFromUrl : 'profil',
  );
  const [isDirty,     setIsDirty]     = useState(false);
  const [saveTrigger, setSaveTrigger] = useState(0);

  /*
   * ── Mode téléphone : le "retour" du navigateur/appareil doit revenir
   *    au menu des paramètres, pas quitter le dashboard ──
   * Même mécanisme que sur les autres pages Paramètres (entreprise,
   * livreur, correspondant, admin) : sur grand écran, changer de
   * section reste un simple changement d'état local (comme avant) ;
   * sous 1100px, la barre de pills devient un menu groupé plein écran,
   * et ouvrir une section AJOUTE une entrée d'historique
   * (?section=<id>) — le geste/touche "retour" du téléphone revient
   * alors naturellement au menu au lieu de sortir direct du dashboard.
   */
  const isNarrow = useIsNarrowScreen(1100);
  const showMobileMenu = isNarrow && !isSectionId(sectionFromUrl);
  /* true seulement si CETTE session a elle-même empilé l'entrée
   * d'historique "détail" (tap sur une ligne du menu) — distingue ce cas
   * d'un lien direct vers ?section=xyz (rien à dépiler dans ce cas). */
  const pushedDetailRef = useRef(false);

  function goTo(id: SectionId) {
    setSection(id);
    if (isNarrow) {
      pushedDetailRef.current = true;
      setSearchParams({ section: id });
    } else if (sectionFromUrl) {
      setSearchParams({}, { replace: true });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* Bouton "Retour" de la vue détail (mode téléphone) → vers le menu. */
  function goBackToMenu() {
    if (pushedDetailRef.current) {
      pushedDetailRef.current = false;
      navigate(-1);
    } else {
      /* Arrivé directement sur ?section=xyz (lien externe, favori, rechargement)
       * — rien à dépiler, on efface juste le paramètre. */
      setSearchParams({}, { replace: true });
    }
  }

  /* ── Hook central : données + fonctions API ── */
  const {
    data, loading, saving, error, refresh,
    saveProfil,    uploadPhoto,
    saveZone,
    saveSecurite,  changePassword,
    saveNotifications,
    saveConfidentialite,
    suspendreCompte, supprimerCompte,
    documents, uploadDocument,
  } = usePartenaireParametres();

  /* Stub pour la section sans backend encore (paiement) */
  const stubSave = async () => { /* champs non encore persistés */ };

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
    toast(t('partenaireParametres.page.annulerToast'), 'i');
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
            documents={documents}
            saving={saving}
            onUploadDocument={uploadDocument}
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
            onLogout={handleLogout}
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
        return <SecPreferences onToast={toast} />;
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
          <span style={{ fontSize: 14 }}>{t('partenaireParametres.page.loading')}</span>
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

  // ── Mode téléphone, écran racine : liste groupée façon réglages
  // natifs (voir ParamMobileMenu.tsx) — remplace entièrement la
  // navigation/pills et le contenu de section (elle a sa propre ligne
  // de déconnexion).
  if (showMobileMenu) {
    return (
      <div className={p.page}>
        <ParamMobileMenu data={data} onOpen={goTo} onLogout={handleLogout} />
        <ToastStack toasts={toasts} />
      </div>
    );
  }

  return (
    <div className={p.page}>

      <div className={p.layout}>
        {/* ── Navigation gauche — masquée en mode téléphone (vue
            "détail", remplacée par le bouton "Retour" ci-dessous) ── */}
        {!isNarrow && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ParamNav
            section={section}
            onSection={goTo}
            data={data}
          />

          {/* ── Déconnexion — persistante en bas de la navigation
              paramètres, quelle que soit la section active ── */}
          <div style={{ background: 'var(--white)', border: '1.5px solid var(--bdr)', borderRadius: 'var(--r-xl, 26px)', padding: 10, boxShadow: 'var(--sh-xs)' }}>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '10px 11px', borderRadius: 'var(--r-md, 12px)',
                fontSize: 13, fontWeight: 700, color: 'var(--red)',
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <i className="fas fa-right-from-bracket" style={{ width: 15, textAlign: 'center', fontSize: 13 }} />
              {t('partenaireParametres.page.deconnexion')}
            </button>
          </div>
        </div>
        )}

        {/* ── Section active ── */}
        <main className={p.content}>
          {/* ── Mode téléphone, vue "détail" : retour vers le menu
               racine plutôt que de dépendre uniquement du bouton
               "retour" du navigateur/appareil (voir goBackToMenu, qui,
               lui, gère déjà ce dernier via l'historique). ── */}
          {isNarrow && (
            <button type="button" onClick={goBackToMenu} style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '10px 16px', marginBottom: 14,
              background: 'var(--white)', border: '1.5px solid var(--bdr)', borderRadius: 'var(--pill)',
              fontSize: 13, fontWeight: 700, color: 'var(--t2)', cursor: 'pointer',
            }}>
              <i className="fas fa-arrow-left" style={{ fontSize: 12 }} />
              {t('partenaireParametres.page.back')}
            </button>
          )}
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
