/*
 * FICHIER : src/dashboards/livreur/pages/LivreurParametresPage.tsx
 *
 * Page paramètres complète du livreur.
 * Charge les données via useLivreurParametres() et
 * distribue les fonctions de sauvegarde à chaque section.
 */
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLivreurParametres } from '../hooks/useLivreurParametres';
import { useIsNarrowScreen } from '../../../shared/hooks/useIsNarrowScreen';
import ParamNav from '../components/ParamNav';
import ParamMobileMenu from '../components/ParamMobileMenu';
import { isParamSectionId, type ParamSectionId } from '../data/parametresData';
import SecLangue from '../../../shared/components/params/SecLangue';
import styles from '../styles/ParametresPage.module.css';
import paramMobileStyles from '../styles/ParamMobileMenu.module.css';

import SecProfil          from './params/SecProfil';
import SecDocuments       from './params/SecDocuments';
import SecZone            from './params/SecZone';
import SecVehicule        from './params/SecVehicule';
import SecPaiement        from './params/SecPaiement';
import SecSecurite        from './params/SecSecurite';
import SecNotifications   from './params/SecNotifications';
import SecConfidentialite from './params/SecConfidentialite';
import SecDanger          from './params/SecDanger';
import { confirmDialog } from '../../../shared/components/ui/ConfirmDialog';

interface Props { onBack: () => void; onPop: (m: string, t?: string) => void; onAvatarRefresh?: () => void; onLogout: () => void; }

export default function LivreurParametresPage({ onBack, onPop, onAvatarRefresh, onLogout }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl = searchParams.get('section');
  const [section, setSection] = useState<ParamSectionId>(
    isParamSectionId(sectionFromUrl) ? sectionFromUrl : 'profil',
  );
  const [isDirty, setIsDirty] = useState(false);

  const {
    data, loading, error, saving,
    saveProfil, uploadPhoto,
    uploadDocument,
    saveZones, saveHoraires,
    saveVehicule,
    savePaiement,
    savePassword, saveTwoFa,
    saveNotifs, savePrivacy,
    pauseCompte, desactiverCompte, supprimerCompte,
  } = useLivreurParametres();

  /*
   * ── Mode téléphone : le "retour" du navigateur/appareil doit revenir
   *    au menu des paramètres, pas quitter le dashboard ──
   * Même mécanisme que ParametresPage.tsx (entreprise) : sur grand écran,
   * changer de section reste un simple changement d'état local (comme
   * avant) ; sous 1100px, la barre de pills devient un menu groupé plein
   * écran, et ouvrir une section AJOUTE une entrée d'historique
   * (?section=<id>) — le geste/touche "retour" du téléphone revient alors
   * naturellement au menu au lieu de sortir direct du dashboard.
   */
  const isNarrow = useIsNarrowScreen(1100);
  const showMobileMenu = isNarrow && !isParamSectionId(sectionFromUrl);
  /* true seulement si CETTE session a elle-même empilé l'entrée d'historique
   * "détail" (tap sur une ligne du menu) — distingue ce cas d'un lien direct
   * vers ?section=xyz (rien à dépiler dans ce cas). */
  const pushedDetailRef = useRef(false);

  function markDirty() { setIsDirty(true); }
  async function goTo(s: ParamSectionId) {
    if (isDirty && s !== section) {
      const ok = await confirmDialog({ message: t('livreurParametres.unsavedConfirm'), icon: 'fa-floppy-disk' });
      if (!ok) return;
    }
    setIsDirty(false);
    setSection(s);
    if (isNarrow) {
      pushedDetailRef.current = true;
      setSearchParams({ section: s });
    } else if (sectionFromUrl) {
      setSearchParams({}, { replace: true });
    }
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  /* Bouton "Retour" de la vue détail (mode téléphone) → vers le menu. */
  async function goBackToMenu() {
    if (isDirty) {
      const ok = await confirmDialog({ message: t('livreurParametres.unsavedConfirm'), icon: 'fa-floppy-disk' });
      if (!ok) return;
      setIsDirty(false);
    }
    if (pushedDetailRef.current) {
      pushedDetailRef.current = false;
      navigate(-1);
    } else {
      /* Arrivé directement sur ?section=xyz (lien externe, favori, rechargement)
       * — rien à dépiler, on efface juste le paramètre. */
      setSearchParams({}, { replace: true });
    }
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'var(--t3)' }}>
      <div style={{ textAlign:'center' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize:28, display:'block', marginBottom:12 }} />
        {t('livreurParametres.chargement')}
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
          style={{ marginTop:16, background:'var(--btn)', color:'#fff', border:'none',
            borderRadius:'var(--pill)', padding:'10px 24px', cursor:'pointer', fontSize:13 }}>
          {t('livreurParametres.reessayer')}
        </button>
      </div>
    </div>
  );

  const common = { data, saving, dirty:markDirty, onPop };

  const sections: Record<ParamSectionId, React.ReactNode> = {
    profil:          <SecProfil          {...common} saveProfil={saveProfil} uploadPhoto={uploadPhoto} onAvatarRefresh={onAvatarRefresh} />,
    docs:            <SecDocuments       {...common} uploadDocument={uploadDocument} />,
    zone:            <SecZone            dirty={markDirty} onPop={onPop} saveZones={saveZones} saveHoraires={saveHoraires} data={data} saving={saving} />,
    vehicule:        <SecVehicule        dirty={markDirty} onPop={onPop} saveVehicule={saveVehicule} data={data} saving={saving} />,
    paiement:        <SecPaiement        dirty={markDirty} onPop={onPop} savePaiement={savePaiement} data={data} saving={saving} />,
    securite:        <SecSecurite        {...common} savePassword={savePassword} saveTwoFa={saveTwoFa} onLogout={onLogout} />,
    notifs:          <SecNotifications   {...common} saveNotifs={saveNotifs} />,
    confidentialite: <SecConfidentialite {...common} savePrivacy={savePrivacy} />,
    langue:          <SecLangue onPop={onPop} />,
    danger:          <SecDanger          saving={saving} onPop={onPop} pauseCompte={pauseCompte} desactiverCompte={desactiverCompte} supprimerCompte={supprimerCompte} />,
  };

  // ── Mode téléphone, écran racine : liste groupée façon réglages natifs
  // (voir ParamMobileMenu.tsx) — remplace entièrement la navigation/pills
  // ci-dessous et le contenu de section (elle a sa propre ligne de
  // déconnexion).
  if (showMobileMenu) {
    return (
      <div className={styles.page}>
        <ParamMobileMenu onOpen={goTo} onLogout={onLogout} photoUrl={data?.photoUrl} fullName={data?.fullName} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        {/* ── Navigation — masquée en mode téléphone (vue "détail",
             remplacée par le bouton "Retour" ci-dessous) ── */}
        {!isNarrow && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ParamNav active={section} onSelect={goTo} onBack={onBack} />

          {/* ── Déconnexion — persistante en bas de la navigation
              paramètres, quelle que soit la section active ── */}
          <div style={{ background: 'var(--white)', border: '1.5px solid var(--bdr)', borderRadius: 'var(--r-xl, 26px)', padding: 10, boxShadow: 'var(--sh-xs)' }}>
            <button
              type="button"
              onClick={onLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '10px 11px', borderRadius: 'var(--r-md, 12px)',
                fontSize: 13, fontWeight: 700, color: 'var(--red)',
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <i className="fas fa-right-from-bracket" style={{ width: 15, textAlign: 'center', fontSize: 13 }} />
              {t('livreurParametres.seDeconnecter')}
            </button>
          </div>
        </div>
        )}
        <div className={styles.content}>
          {/* ── Mode téléphone, vue "détail" : retour vers le menu racine
               plutôt que de dépendre uniquement du bouton "retour" du
               navigateur/appareil (voir goBackToMenu, qui, lui, gère déjà
               ce dernier via l'historique). ── */}
          {isNarrow && (
            <button type="button" className={paramMobileStyles.backRow} onClick={goBackToMenu}>
              <i className="fas fa-arrow-left" />
              <span>{t('livreurParametres.back')}</span>
            </button>
          )}
          {sections[section]}
        </div>
      </div>
    </div>
  );
}