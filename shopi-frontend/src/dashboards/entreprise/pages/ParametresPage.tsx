/*
 * FICHIER : src/dashboards/entreprise/pages/ParametresPage.tsx
 *
 * Page paramètres complète connectée à l'API.
 * Utilise useParametres() pour charger les données et
 * passe les fonctions de sauvegarde à chaque section.
 *
 * ARCHITECTURE :
 *   ParametresPage
 *     ├── useParametres()           ← hook central (1 appel API initial)
 *     ├── ParametresSidebar         ← navigation entre les 12 sections
 *     ├── BoutiqueSection           ← sections 1+2 (connectée)
 *     ├── HorairesSection           ← section 3  (connectée)
 *     ├── CatalogueSection          ← section 4  (connectée)
 *     ├── LivraisonSection          ← section 5  (connectée)
 *     ├── PaiementSection           ← section 6  (connectée)
 *     ├── CommissionsSection        ← section 7  (connectée)
 *     ├── DocumentsSection          ← section 8  (connectée)
 *     ├── SecuriteSection           ← section 9  (connectée)
 *     ├── NotifsSection             ← section 10 (connectée)
 *     ├── PrivacySection            ← section 11 (connectée)
 *     └── DangerSection             ← section 12 (connectée)
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation }            from 'react-i18next';
import type { TFunction }            from 'i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../../shared/context/ToastContext';
import { useAppContext } from '../../../shared/context/AppContext';
import { useIsNarrowScreen } from '../../../shared/hooks/useIsNarrowScreen';
import { useParametres } from '../hooks/useParametres';
import { useTeamPermissions } from '../hooks/useTeamPermissions';
import SecLangue from '../../../shared/components/params/SecLangue';
import ParametresMobileMenu from '../components/parametres/ParametresMobileMenu';

// Sections
import BoutiqueSection    from '../sections/parametres/BoutiqueSection';
import HorairesSection    from '../sections/parametres/HorairesSection';
import CatalogueSection   from '../sections/parametres/CatalogueSection';
import LivraisonSection   from '../sections/parametres/LivraisonSection';
import PaiementSection    from '../sections/parametres/PaiementSection';
import CommissionsSection from '../sections/parametres/CommissionsSection';
import DocumentsSection   from '../sections/parametres/DocumentsSection';
import SecuriteSection    from '../sections/parametres/SecuriteSection';
import NotifsSection      from '../sections/parametres/NotifsSection';
import PrivacySection     from '../sections/parametres/PrivacySection';
import DangerSection      from '../sections/parametres/DangerSection';

import s from '../styles/parametres/ParametresPage.module.css';
import { confirmDialog } from '../../../shared/components/ui/ConfirmDialog';

// ─────────────────────────────────────────────────────────────
// CONFIG SIDEBAR
// ─────────────────────────────────────────────────────────────

export type SectionKey =
  | 'boutique' | 'horaires' | 'catalogue' | 'livraison' | 'paiement'
  | 'commissions' | 'documents' | 'securite' | 'notifs' | 'privacy' | 'langue' | 'danger';

/** Même liste que SectionKey, lisible à l'exécution — valide un paramètre reçu de l'URL. */
const SECTION_KEYS: SectionKey[] = [
  'boutique', 'horaires', 'catalogue', 'livraison', 'paiement',
  'commissions', 'documents', 'securite', 'notifs', 'privacy', 'langue', 'danger',
];
function isSectionKey(v: string | null): v is SectionKey {
  return !!v && (SECTION_KEYS as string[]).includes(v);
}

function getSidebarItems(t: TFunction): { key: SectionKey; icon: string; label: string; danger?: boolean }[] {
  return [
    { key:'boutique',     icon:'fa-store',              label:t('parametres.sidebar.items.boutique')      },
    { key:'horaires',     icon:'fa-clock',              label:t('parametres.sidebar.items.horaires')                 },
    { key:'catalogue',    icon:'fa-tags',               label:t('parametres.sidebar.items.catalogue')     },
    { key:'livraison',    icon:'fa-motorcycle',         label:t('parametres.sidebar.items.livraison')                },
    { key:'paiement',     icon:'fa-credit-card',        label:t('parametres.sidebar.items.paiement')   },
    { key:'commissions',  icon:'fa-percent',            label:t('parametres.sidebar.items.commissions')        },
    { key:'documents',    icon:'fa-file-shield',        label:t('parametres.sidebar.items.documents') },
    { key:'securite',     icon:'fa-shield-halved',      label:t('parametres.sidebar.items.securite')                 },
    { key:'notifs',       icon:'fa-bell',               label:t('parametres.sidebar.items.notifs')            },
    { key:'privacy',      icon:'fa-eye-slash',          label:t('parametres.sidebar.items.privacy')          },
    { key:'langue',       icon:'fa-language',           label:t('parametres.sidebar.items.langue')                   },
    { key:'danger',       icon:'fa-triangle-exclamation',label:t('parametres.sidebar.items.danger'),danger:true},
  ];
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default function ParametresPage() {
  const { t } = useTranslation();
  const { pop } = useToast();
  const { logout } = useAppContext();
  const navigate = useNavigate();
  const { can, isOwner, loading: permLoading } = useTeamPermissions();
  const canEdit = isOwner || can('settings', 'edit');

  /* Point unique de déconnexion pour ce dashboard — voir en bas de la
     sidebar interne des paramètres (persistant quelle que soit la
     section active). */
  function handleLogout() {
    logout();
    navigate('/login');
  }

  // Hook central — 1 seul appel API pour toute la page
  const {
    data, loading, error, saving,
    saveBoutique, saveContact, uploadLogo, uploadCover, deleteLogo,
    saveHoraires,
    saveCatalogue,
    saveLivraison,
    savePaiement, savePlan,
    uploadDocument,
    save2FA, savePassword,
    saveNotifs,
    savePrivacy,
    reload,
    pauseBoutique, desactiverCompte, supprimerBoutique,
  } = useParametres();

  /* Boutique supprimée avec succès (Zone sensible) — le profil Company
   * n'existe plus, impossible de rester sur ce dashboard. Même geste que
   * handleLogout ci-dessus. */
  function handleDeleted() {
    logout();
    navigate('/login');
  }

  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl = searchParams.get('section') as SectionKey | null;

  const [activeSection, setActiveSection] = useState<SectionKey>(
    isSectionKey(sectionFromUrl) ? sectionFromUrl : 'boutique',
  );
  const [isDirty, setIsDirty] = useState(false);

  /* Sync URL → section si l'URL change depuis l'extérieur */
  useEffect(() => {
    const sec = searchParams.get('section') as SectionKey | null;
    if (sec && isSectionKey(sec) && sec !== activeSection) {
      setActiveSection(sec);
    }
  }, [searchParams]);

  /*
   * ── Mode téléphone : le "retour" du navigateur/appareil doit revenir
   *    au menu des paramètres, pas quitter le dashboard ──
   * Même mécanisme que src/modules/home/components/settings/pages/
   * SettingsPage.tsx : sur grand écran, changer de section REMPLACE le
   * paramètre d'URL (comportement historique, pas d'entrée d'historique
   * par onglet) ; sous 1100px, la liste de pills devient un menu groupé
   * plein écran, et ouvrir une section AJOUTE une entrée d'historique
   * (?section=<clé>) — le geste/touche "retour" du téléphone revient
   * alors naturellement au menu au lieu de sortir direct du dashboard.
   */
  const isNarrow = useIsNarrowScreen(1100);
  const showMobileMenu = isNarrow && !isSectionKey(sectionFromUrl);
  /* true seulement si CETTE session a elle-même empilé l'entrée d'historique
   * "détail" (tap sur une ligne du menu) — distingue ce cas d'un lien direct
   * vers ?section=xyz (rien à dépiler dans ce cas). */
  const pushedDetailRef = useRef(false);

  /* Signaler modifications non sauvegardées */
  function markDirty() { setIsDirty(true); }

  /* Changer de section + écrire dans l'URL */
  async function goTo(key: SectionKey) {
    if (isDirty && key !== activeSection) {
      const ok = await confirmDialog({ message: t('parametres.confirmQuitterModifs'), icon: 'fa-floppy-disk' });
      if (!ok) return;
    }
    setIsDirty(false);
    setActiveSection(key);
    if (isNarrow) {
      pushedDetailRef.current = true;
      setSearchParams({ section: key });
    } else {
      setSearchParams({ section: key }, { replace: true });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* Bouton "Retour" de la vue détail (mode téléphone) → vers le menu. */
  async function goBackToMenu() {
    if (isDirty) {
      const ok = await confirmDialog({ message: t('parametres.confirmQuitterModifs'), icon: 'fa-floppy-disk' });
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

  // ── Accès refusé (collaborateur sans settings.view) — mise à jour
  // instantanée si la permission est révoquée pendant qu'il est déjà sur
  // la page (voir useTeamPermissions : socket team:permissions_changed).
  // Vérifié AVANT loading/error : GET /dashboard/entreprise/parametres est
  // gardé côté backend (settings.view), donc sans ce garde le collaborateur
  // verrait un spinner puis une erreur générique "Impossible de charger…".
  if (!permLoading && !isOwner && !can('settings', 'view')) {
    return (
      <div className="page on" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <div style={{ textAlign:'center', color:'var(--t2)' }}>
          <i className="fas fa-lock" style={{ fontSize:28, opacity:.5, marginBottom:12, display:'block' }} />
          <strong>{t('parametres.accessDenied.title')}</strong>
          <div style={{ fontSize:13, marginTop:6 }}>{t('parametres.accessDenied.message')}</div>
        </div>
      </div>
    );
  }

  // ── État de chargement ────────────────────────────────────
  if (loading) {
    return (
      <div className="page on" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <div style={{ textAlign:'center', color:'var(--t3)' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize:28, marginBottom:12, display:'block' }} />
          {t('parametres.loading')}
        </div>
      </div>
    );
  }

  // ── Erreur de chargement ──────────────────────────────────
  if (error) {
    return (
      <div className="page on" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <div style={{ textAlign:'center', color:'var(--t1)' }}>
          <i className="fas fa-triangle-exclamation" style={{ fontSize:28, marginBottom:12, display:'block' }} />
          {error}
          <br />
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop:16, background:'var(--navy)', color:'#fff', border:'none', borderRadius:'var(--pill)', padding:'10px 24px', cursor:'pointer', fontSize:13 }}
          >
            {t('parametres.reessayer')}
          </button>
        </div>
      </div>
    );
  }

  // Props communs à toutes les sections
  const commonProps = { data, saving, onDirty: markDirty, onToast: pop };
  const statusLabel = data && (
    data.status === 'active'    ? t('parametres.sidebar.statusActive')   :
    data.status === 'suspended' ? t('parametres.sidebar.statusPaused')   : t('parametres.sidebar.statusPrivate')
  );

  // ── Mode téléphone, écran racine : liste groupée façon réglages natifs
  // (voir ParametresMobileMenu.tsx) — remplace entièrement la sidebar/pills
  // ci-dessous et le contenu de section (elle a son propre titre et sa
  // propre ligne de déconnexion).
  if (showMobileMenu) {
    return (
      <div className="page on" style={{ padding: 0 }}>
        <ParametresMobileMenu
          items={getSidebarItems(t)}
          onOpen={goTo}
          onLogout={handleLogout}
          logo={data?.logo}
          companyName={data?.companyName}
          statusLabel={statusLabel || undefined}
          canEdit={canEdit}
        />
      </div>
    );
  }

  return (
    <div className="page on" style={{ padding:0 }}>
      <div className={s.parametresLayout}>

        {/* ── Sidebar navigation — masquée en mode téléphone (vue "détail",
             remplacée par le bouton "Retour" ci-dessous) ── */}
        {!isNarrow && (
        <aside className={s.sidebar}>
          <div className={s.sidebarTitle}>
            <i className="fas fa-gear" /> {t('parametres.sidebar.title')}
          </div>

          {/* Indicateur modifications non sauvegardées */}
          {isDirty && (
            <div className={s.dirtyBadge}>
              <i className="fas fa-circle-dot" /> {t('parametres.sidebar.dirtyBadge')}
            </div>
          )}

          <nav className={s.sidebarNav}>
            {getSidebarItems(t).map(item => (
              <button
                key={item.key}
                className={`${s.sidebarItem} ${activeSection === item.key ? s.active : ''} ${item.danger ? s.dangerItem : ''}`}
                onClick={() => goTo(item.key)}
              >
                <i className={`fas ${item.icon}`} />
                <span>{item.label}</span>
                {activeSection === item.key && <i className={`fas fa-chevron-right ${s.chevron}`} style={{ marginLeft:'auto', fontSize:10, opacity:0.5 }} />}
              </button>
            ))}
          </nav>

          {/* Infos boutique dans la sidebar */}
          {data && (
            <div className={s.sidebarBoutiqueCard}>
              <div className={s.sbcLogo}>
                {data.logo
                  ? <img src={data.logo} alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:10 }} />
                  : '🏪'
                }
              </div>
              <div className={s.sbcInfo}>
                <div className={s.sbcName}>{data.companyName}</div>
                <div className={s.sbcStatus}>{statusLabel}</div>
              </div>
            </div>
          )}

          {/* ── Déconnexion — persistante en bas de la sidebar paramètres,
              quelle que soit la section active ── */}
          <div style={{ borderTop: '1px solid var(--bdr)', marginTop: 10, paddingTop: 10 }}>
            <button
              type="button"
              className={`${s.sidebarItem} ${s.dangerItem}`}
              onClick={handleLogout}
            >
              <i className="fas fa-right-from-bracket" />
              <span>{t('parametres.sidebar.logout')}</span>
            </button>
          </div>
        </aside>
        )}

        {/* ── Contenu de la section active ── */}
        <main className={s.parametresContent}>
          {/* ── Mode téléphone, vue "détail" : retour vers le menu racine
               plutôt que de dépendre uniquement du bouton "retour" du
               navigateur/appareil (voir goBackToMenu, qui, lui, gère déjà
               ce dernier via l'historique). ── */}
          {isNarrow && (
            <button type="button" className={s.sidebarItem} style={{ marginBottom: 4 }} onClick={goBackToMenu}>
              <i className="fas fa-arrow-left" />
              <span>{t('parametres.sidebar.back')}</span>
            </button>
          )}

          {activeSection === 'langue' && (
            /* SecLangue n'appelle onPop qu'avec le type 's' (succès) — adaptateur
             * pour matcher la signature (m,t?:ToastType) de pop() (voir même
             * correctif dans partenaire/sections/params/SecPreferences.tsx). */
            <SecLangue onPop={(m, ty) => pop(m, (ty as 's' | 'i' | 'w' | 'e') ?? 's')} />
          )}

          {!canEdit && activeSection !== 'langue' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 10,
              padding: '10px 14px', marginBottom: 16, fontSize: 12.5, fontWeight: 600, color: 'var(--t2)',
            }}>
              <i className="fas fa-lock" style={{ fontSize: 12 }} />
              {t('parametres.readOnly')}
            </div>
          )}

          {/* fieldset disabled cascade automatiquement à tous les inputs/
           * boutons/selects/textareas descendants — évite de devoir gater
           * individuellement chaque bouton "Enregistrer"/upload/suppression
           * des 11 sections pour un collaborateur avec settings.view mais
           * sans settings.edit. La section langue (préférence personnelle,
           * pas un paramètre de la boutique) est rendue en dehors, jamais
           * désactivée. */}
          <fieldset disabled={!canEdit} style={{ border: 0, margin: 0, padding: 0 }}>

          {activeSection === 'boutique' && (
            <BoutiqueSection
              {...commonProps}
              saveBoutique={saveBoutique}
              saveContact={saveContact}
              uploadLogo={uploadLogo}
              uploadCover={uploadCover}
              deleteLogo={deleteLogo}
            />
          )}

          {activeSection === 'horaires' && (
            <HorairesSection
              {...commonProps}
              saveHoraires={saveHoraires}
            />
          )}

          {activeSection === 'catalogue' && (
            <CatalogueSection
              {...commonProps}
              saveCatalogue={saveCatalogue}
            />
          )}

          {activeSection === 'livraison' && (
            <LivraisonSection
              {...commonProps}
              saveLivraison={saveLivraison}
            />
          )}

          {activeSection === 'paiement' && (
            <PaiementSection
              {...commonProps}
              savePaiement={savePaiement}
            />
          )}

          {activeSection === 'commissions' && (
            <CommissionsSection
              {...commonProps}
              savePlan={savePlan}
            />
          )}

          {activeSection === 'documents' && (
            <DocumentsSection
              {...commonProps}
              uploadDocument={uploadDocument}
            />
          )}

          {activeSection === 'securite' && (
            <SecuriteSection
              {...commonProps}
              save2FA={save2FA}
              savePassword={savePassword}
              onReload={reload}
              onLogout={handleLogout}
            />
          )}

          {activeSection === 'notifs' && (
            <NotifsSection
              {...commonProps}
              saveNotifs={saveNotifs}
            />
          )}

          {activeSection === 'privacy' && (
            <PrivacySection
              {...commonProps}
              savePrivacy={savePrivacy}
            />
          )}

          {activeSection === 'danger' && (
            <DangerSection
              {...commonProps}
              pauseBoutique={pauseBoutique}
              desactiverCompte={desactiverCompte}
              supprimerBoutique={supprimerBoutique}
              onDeleted={handleDeleted}
              isOwner={isOwner}
            />
          )}

          </fieldset>
        </main>
      </div>
    </div>
  );
}