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

import { useState, useEffect } from 'react';
import { useTranslation }            from 'react-i18next';
import type { TFunction }            from 'i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../../shared/context/ToastContext';
import { useAppContext } from '../../../shared/context/AppContext';
import { useParametres } from '../hooks/useParametres';
import SecLangue from '../../../shared/components/params/SecLangue';

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

// ─────────────────────────────────────────────────────────────
// CONFIG SIDEBAR
// ─────────────────────────────────────────────────────────────

type SectionKey =
  | 'boutique' | 'horaires' | 'catalogue' | 'livraison' | 'paiement'
  | 'commissions' | 'documents' | 'confidentialiteSecurite' | 'securite' | 'notifs' | 'privacy' | 'langue' | 'danger';

function getSidebarItems(t: TFunction): { key: SectionKey; icon: string; label: string; danger?: boolean }[] {
  return [
    { key:'boutique',     icon:'fa-store',              label:t('parametres.sidebar.items.boutique')      },
    { key:'horaires',     icon:'fa-clock',              label:t('parametres.sidebar.items.horaires')                 },
    { key:'catalogue',    icon:'fa-tags',               label:t('parametres.sidebar.items.catalogue')     },
    { key:'livraison',    icon:'fa-motorcycle',         label:t('parametres.sidebar.items.livraison')                },
    { key:'paiement',     icon:'fa-credit-card',        label:t('parametres.sidebar.items.paiement')   },
    { key:'commissions',  icon:'fa-percent',            label:t('parametres.sidebar.items.commissions')        },
    { key:'documents',    icon:'fa-file-shield',        label:t('parametres.sidebar.items.documents') },
    { key:'confidentialiteSecurite', icon:'fa-shield-halved', label:t('parametres.sidebar.items.confidentialiteSecurite') },
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
  } = useParametres();

  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl = searchParams.get('section') as SectionKey | null;

  const [activeSection, setActiveSection] = useState<SectionKey>(
    sectionFromUrl && getSidebarItems(t).some(i => i.key === sectionFromUrl)
      ? sectionFromUrl
      : 'boutique',
  );
  const [isDirty, setIsDirty] = useState(false);

  /* Sync URL → section si l'URL change depuis l'extérieur */
  useEffect(() => {
    const s = searchParams.get('section') as SectionKey | null;
    if (s && getSidebarItems(t).some(i => i.key === s) && s !== activeSection) {
      setActiveSection(s);
    }
  }, [searchParams]);

  /* Signaler modifications non sauvegardées */
  function markDirty() { setIsDirty(true); }

  /* Changer de section + écrire dans l'URL */
  function goTo(key: SectionKey) {
    if (isDirty && key !== activeSection) {
      const ok = window.confirm(t('parametres.confirmQuitterModifs'));
      if (!ok) return;
    }
    setIsDirty(false);
    setActiveSection(key);
    setSearchParams({ section: key }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  return (
    <div className="page on" style={{ padding:0 }}>
      <div className={s.parametresLayout}>

        {/* ── Sidebar navigation ── */}
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
                <div className={s.sbcStatus}>
                  {data.status === 'active'    ? t('parametres.sidebar.statusActive')    :
                   data.status === 'suspended' ? t('parametres.sidebar.statusPaused')  : t('parametres.sidebar.statusPrivate')}
                </div>
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
              <span>Se déconnecter</span>
            </button>
          </div>
        </aside>

        {/* ── Contenu de la section active ── */}
        <main className={s.parametresContent}>
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

          {activeSection === 'confidentialiteSecurite' && (
            <>
              <SecuriteSection
                {...commonProps}
                save2FA={save2FA}
                savePassword={savePassword}
                onReload={reload}
              />
              <PrivacySection
                {...commonProps}
                savePrivacy={savePrivacy}
              />
            </>
          )}

          {activeSection === 'securite' && (
            <SecuriteSection
              {...commonProps}
              save2FA={save2FA}
              savePassword={savePassword}
              onReload={reload}
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

          {activeSection === 'langue' && (
            <SecLangue onPop={pop} />
          )}

          {activeSection === 'danger' && (
            <DangerSection
              {...commonProps}
            />
          )}
        </main>
      </div>
    </div>
  );
}