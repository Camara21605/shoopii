/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/ParametresPage.tsx
 *
 * Centre de configuration complet de l'administrateur Shopi.
 * 16 sections organisées en sidebar interne avec navigation rapide.
 *
 * Architecture :
 *  - sidebar interne (230px) avec groupes + recherche rapide
 *  - zone de contenu scrollable indépendante
 *  - bouton « Enregistrer » flottant (apparaît dès qu'une section
 *    envoie un toast de type 's' — indicateur de changement)
 *  - chaque section est un composant isolé dans pages/parametres/
 * ================================================================ */

import { useState, useCallback } from 'react';
import styles from '../styles/ParametresPage.module.css';
import type { ParamSection } from './parametres/types';

/* ── Imports des 16 sections ── */
import ProfilSection         from './parametres/ProfilSection';
import ZoneSection           from './parametres/ZoneSection';
import ValidationsSection    from './parametres/ValidationsSection';
import NotificationsSection  from './parametres/NotificationsSection';
import SecuriteSection       from './parametres/SecuriteSection';
import EntreprisesSection    from './parametres/EntreprisesSection';
import LivreursSection       from './parametres/LivreursSection';
import PartenairesSection    from './parametres/PartenairesSection';
import FinancesSection       from './parametres/FinancesSection';
import CommunicationSection  from './parametres/CommunicationSection';
import JournalSection        from './parametres/JournalSection';
import ApparenceSection      from './parametres/ApparenceSection';
import SauvegardeSection     from './parametres/SauvegardeSection';
import ConfidentialiteSection from './parametres/ConfidentialiteSection';
import AvanceSection         from './parametres/AvanceSection';
import SanteSection          from './parametres/SanteSection';

/* ================================================================
 * Configuration de la navigation latérale interne
 * ================================================================ */
interface NavItem {
  id:    ParamSection;
  label: string;
  icon:  string;
  badge?: string; /* nombre d'alertes éventuel */
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Compte',
    items: [
      { id: 'profil',          label: 'Profil',               icon: 'fa-user-circle' },
      { id: 'securite',        label: 'Sécurité',             icon: 'fa-shield-halved', badge: '2' },
      { id: 'apparence',       label: 'Apparence',            icon: 'fa-palette' },
    ],
  },
  {
    label: 'Ma zone',
    items: [
      { id: 'zone',            label: 'Zone & Couverture',    icon: 'fa-map-location-dot' },
      { id: 'validations',     label: 'Validations',          icon: 'fa-user-check' },
    ],
  },
  {
    label: 'Acteurs',
    items: [
      { id: 'entreprises',     label: 'Entreprises',          icon: 'fa-store' },
      { id: 'livreurs',        label: 'Livreurs',             icon: 'fa-motorcycle' },
      { id: 'partenaires',     label: 'Partenaires',          icon: 'fa-handshake' },
    ],
  },
  {
    label: 'Opérations',
    items: [
      { id: 'notifications',   label: 'Notifications',        icon: 'fa-bell' },
      { id: 'communication',   label: 'Communication',        icon: 'fa-comment-dots' },
      { id: 'finances',        label: 'Finances',             icon: 'fa-coins' },
    ],
  },
  {
    label: 'Système',
    items: [
      { id: 'journal',         label: "Journal d'activité",   icon: 'fa-clipboard-list' },
      { id: 'sauvegarde',      label: 'Sauvegarde',           icon: 'fa-database' },
      { id: 'confidentialite', label: 'Confidentialité',      icon: 'fa-lock' },
      { id: 'avance',          label: 'Paramètres avancés',   icon: 'fa-sliders' },
      { id: 'sante',           label: 'Santé du système',     icon: 'fa-heart-pulse', badge: '3' },
    ],
  },
];

/* Métadonnées par section (titre + sous-titre) */
const SEC_META: Record<ParamSection, { title: string; sub: string; group: string }> = {
  profil:          { title: 'Profil administrateur', sub: 'Identité, avatar et informations de compte',                   group: 'Compte' },
  securite:        { title: 'Sécurité',              sub: 'Mot de passe, 2FA, sessions actives et clés API',              group: 'Compte' },
  apparence:       { title: 'Apparence',             sub: 'Thème, couleur d\'accent, typographie et densité',             group: 'Compte' },
  zone:            { title: 'Zone & Couverture',     sub: 'Zone géographique, communes et alertes',                       group: 'Ma zone' },
  validations:     { title: 'Validations',           sub: 'Mode, délais et règles par type d\'acteur',                   group: 'Ma zone' },
  entreprises:     { title: 'Entreprises',           sub: 'Commission, documents requis et catégories autorisées',        group: 'Acteurs' },
  livreurs:        { title: 'Livreurs',              sub: 'Rayon, distance, assignation automatique et score',            group: 'Acteurs' },
  partenaires:     { title: 'Partenaires',           sub: 'Tiers, commissions, objectifs et programme bonus',             group: 'Acteurs' },
  notifications:   { title: 'Notifications',         sub: 'Canaux (SMS, e-mail, WhatsApp…) et événements notifiables',   group: 'Opérations' },
  communication:   { title: 'Communication',         sub: 'Templates de messages, réponse auto et signature',             group: 'Opérations' },
  finances:        { title: 'Finances',              sub: 'Devise, taxes, limites de retrait et méthodes de paiement',   group: 'Opérations' },
  journal:         { title: "Journal d'activité",    sub: 'Historique complet de toutes vos actions avec filtres',        group: 'Système' },
  sauvegarde:      { title: 'Sauvegarde',            sub: 'Sauvegarde automatique, historique et restauration',           group: 'Système' },
  confidentialite: { title: 'Confidentialité',       sub: 'Cookies, rétention des données et conformité RGPD',           group: 'Système' },
  avance:          { title: 'Paramètres avancés',    sub: 'Mode maintenance, urgence, cache et logs système',             group: 'Système' },
  sante:           { title: 'Santé du système',      sub: 'État en temps réel de tous les services de la plateforme',    group: 'Système' },
};

/* ================================================================
 * Props du composant
 * ================================================================ */
interface ParametresPageProps {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

/* ================================================================
 * Composant principal
 * ================================================================ */
export default function ParametresPage({ onToast }: ParametresPageProps) {
  const [active,  setActive]  = useState<ParamSection>('profil');
  const [query,   setQuery]   = useState('');
  const [dirty,   setDirty]   = useState(false);
  const [saving,  setSaving]  = useState(false);

  /* Intercepte les toasts de succès pour activer le bouton flottant */
  const handleToast = useCallback((msg: string, type?: 's' | 'i' | 'w') => {
    onToast(msg, type);
    if (type === 's') setDirty(true);
  }, [onToast]);

  /* Filtre la navigation latérale selon la recherche */
  const filteredGroups = NAV_GROUPS.map(g => ({
    ...g,
    items: query
      ? g.items.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
      : g.items,
  })).filter(g => g.items.length > 0);

  /* Sauvegarde globale (stub — sera connecté au backend) */
  const saveAll = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    setDirty(false);
    onToast('Toutes les modifications ont été enregistrées', 's');
  };

  /* Métadonnées de la section active */
  const meta = SEC_META[active];

  /* Rendu de la section active */
  const renderSection = () => {
    const props = { onToast: handleToast };
    switch (active) {
      case 'profil':          return <ProfilSection         {...props} />;
      case 'zone':            return <ZoneSection           {...props} />;
      case 'validations':     return <ValidationsSection    {...props} />;
      case 'notifications':   return <NotificationsSection  {...props} />;
      case 'securite':        return <SecuriteSection       {...props} />;
      case 'entreprises':     return <EntreprisesSection    {...props} />;
      case 'livreurs':        return <LivreursSection       {...props} />;
      case 'partenaires':     return <PartenairesSection    {...props} />;
      case 'finances':        return <FinancesSection       {...props} />;
      case 'communication':   return <CommunicationSection  {...props} />;
      case 'journal':         return <JournalSection        {...props} />;
      case 'apparence':       return <ApparenceSection      {...props} />;
      case 'sauvegarde':      return <SauvegardeSection     {...props} />;
      case 'confidentialite': return <ConfidentialiteSection {...props} />;
      case 'avance':          return <AvanceSection         {...props} />;
      case 'sante':           return <SanteSection          {...props} />;
      default:                return null;
    }
  };

  return (
    <div className={styles.wrap}>

      {/* ════════════════════════════════
       * SIDEBAR INTERNE DE NAVIGATION
       * ════════════════════════════════ */}
      <nav className={styles.sb}>

        {/* Recherche rapide dans les sections */}
        <div className={styles.sbSearch}>
          <div className={styles.sbSearchInner}>
            <i className="fas fa-magnifying-glass" />
            <input
              placeholder="Rechercher une section…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Groupes de navigation */}
        <div className={styles.sbNav}>
          {filteredGroups.map(g => (
            <div key={g.label} className={styles.sbGroup}>
              <div className={styles.sbGTitle}>{g.label}</div>
              {g.items.map(item => (
                <button
                  key={item.id}
                  className={`${styles.sbItem} ${active === item.id ? styles.on : ''}`}
                  onClick={() => { setActive(item.id); setQuery(''); }}
                >
                  <i className={`fas ${item.icon}`} />
                  {item.label}
                  {item.badge && <span className={styles.sbBadge}>{item.badge}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>

      {/* ════════════════════════════════
       * ZONE DE CONTENU
       * ════════════════════════════════ */}
      <div className={styles.content}>

        {/* En-tête de section */}
        <div className={styles.secHead}>
          <div className={styles.secCrumb}>
            <span>Paramètres</span>
            <i className="fas fa-chevron-right" />
            <span>{meta.group}</span>
            <i className="fas fa-chevron-right" />
            <span style={{ color: 'var(--navy)', fontWeight: 700 }}>{meta.title}</span>
          </div>
          <div className={styles.secTitleRow}>
            <div>
              <div className={styles.secTitle}>{meta.title}</div>
              <div className={styles.secSub}>{meta.sub}</div>
            </div>
          </div>
        </div>

        {/* Rendu de la section active */}
        {renderSection()}

      </div>

      {/* ════════════════════════════════
       * BOUTON FLOTTANT « ENREGISTRER »
       * ════════════════════════════════ */}
      {dirty && (
        <div className={styles.floatSave}>
          <button
            className={`${styles.floatSaveBtn} ${saving ? styles.floatSaveBusy : ''}`}
            onClick={saveAll}
          >
            <div className={styles.saveDot} />
            <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} />
            {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      )}

    </div>
  );
}
