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

import React, { useState, useEffect } from 'react';
import { useSearchParams }           from 'react-router-dom';
import { useToast } from '../../../shared/context/ToastContext';
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

const SIDEBAR_ITEMS: { key: SectionKey; icon: string; label: string; danger?: boolean }[] = [
  { key:'boutique',     icon:'fa-store',              label:'Boutique & Identité'      },
  { key:'horaires',     icon:'fa-clock',              label:'Horaires'                 },
  { key:'catalogue',    icon:'fa-tags',               label:'Catalogue & Produits'     },
  { key:'livraison',    icon:'fa-motorcycle',         label:'Livraison'                },
  { key:'paiement',     icon:'fa-credit-card',        label:'Paiement & Facturation'   },
  { key:'commissions',  icon:'fa-percent',            label:'Commissions Shopi'        },
  { key:'documents',    icon:'fa-file-shield',        label:'Documents & Vérification' },
  { key:'confidentialiteSecurite', icon:'fa-shield-halved', label:'Confidentialité et sécurité' },
  { key:'securite',     icon:'fa-shield-halved',      label:'Sécurité'                 },
  { key:'notifs',       icon:'fa-bell',               label:'Notifications'            },
  { key:'privacy',      icon:'fa-eye-slash',          label:'Confidentialité'          },
  { key:'langue',       icon:'fa-language',           label:'Langue'                   },
  { key:'danger',       icon:'fa-triangle-exclamation',label:'Zone sensible',danger:true},
];

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default function ParametresPage() {
  const { pop } = useToast();

  // Hook central — 1 seul appel API pour toute la page
  const {
    data, loading, error, saving,
    saveBoutique, saveContact, uploadLogo, uploadCover, deleteLogo,
    saveHoraires,
    saveCatalogue,
    saveLivraison,
    savePaiement, savePlan,
    uploadDocument,
    save2FA,
    saveNotifs,
    savePrivacy,
  } = useParametres();

  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl = searchParams.get('section') as SectionKey | null;

  const [activeSection, setActiveSection] = useState<SectionKey>(
    sectionFromUrl && SIDEBAR_ITEMS.some(i => i.key === sectionFromUrl)
      ? sectionFromUrl
      : 'boutique',
  );
  const [isDirty, setIsDirty] = useState(false);

  /* Sync URL → section si l'URL change depuis l'extérieur */
  useEffect(() => {
    const s = searchParams.get('section') as SectionKey | null;
    if (s && SIDEBAR_ITEMS.some(i => i.key === s) && s !== activeSection) {
      setActiveSection(s);
    }
  }, [searchParams]);

  /* Signaler modifications non sauvegardées */
  function markDirty() { setIsDirty(true); }

  /* Changer de section + écrire dans l'URL */
  function goTo(key: SectionKey) {
    if (isDirty && key !== activeSection) {
      const ok = window.confirm('Vous avez des modifications non sauvegardées. Quitter quand même ?');
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
          Chargement des paramètres…
        </div>
      </div>
    );
  }

  // ── Erreur de chargement ──────────────────────────────────
  if (error) {
    return (
      <div className="page on" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <div style={{ textAlign:'center', color:'var(--red,#DC2626)' }}>
          <i className="fas fa-triangle-exclamation" style={{ fontSize:28, marginBottom:12, display:'block' }} />
          {error}
          <br />
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop:16, background:'var(--navy)', color:'#fff', border:'none', borderRadius:'var(--pill)', padding:'10px 24px', cursor:'pointer', fontSize:13 }}
          >
            Réessayer
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
            <i className="fas fa-gear" /> Paramètres
          </div>

          {/* Indicateur modifications non sauvegardées */}
          {isDirty && (
            <div className={s.dirtyBadge}>
              <i className="fas fa-circle-dot" /> Modifications en attente
            </div>
          )}

          <nav className={s.sidebarNav}>
            {SIDEBAR_ITEMS.map(item => (
              <button
                key={item.key}
                className={`${s.sidebarItem} ${activeSection === item.key ? s.active : ''} ${item.danger ? s.dangerItem : ''}`}
                onClick={() => goTo(item.key)}
              >
                <i className={`fas ${item.icon}`} />
                <span>{item.label}</span>
                {activeSection === item.key && <i className="fas fa-chevron-right" style={{ marginLeft:'auto', fontSize:10, opacity:0.5 }} />}
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
                  {data.status === 'active'    ? '🟢 Active'    :
                   data.status === 'suspended' ? '🟡 En pause'  : '🔴 Privée'}
                </div>
              </div>
            </div>
          )}
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