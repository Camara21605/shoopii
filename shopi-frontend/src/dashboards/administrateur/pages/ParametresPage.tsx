/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/ParametresPage.tsx
 *
 * Centre de configuration complet de l'administrateur Shoneya.
 * 16 sections organisées en sidebar interne avec navigation rapide.
 *
 * Architecture :
 *  - sidebar interne (230px) avec groupes + recherche rapide
 *  - zone de contenu scrollable indépendante
 *  - bouton « Enregistrer » flottant (apparaît dès qu'une section
 *    envoie un toast de type 's' — indicateur de changement)
 *  - chaque section est un composant isolé dans pages/parametres/
 * ================================================================ */

import { useState, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/ParametresPage.module.css';
import type { ParamSection } from './parametres/types';
import { useAppContext } from '../../../shared/context/AppContext';

/* ── Imports des 16 sections — chargées à la demande (une seule
 * section est visible à la fois) au lieu d'être toutes regroupées
 * dans le chunk ParametresPage, même lazy-loadé, dès l'ouverture
 * de la page. ── */
const ProfilSection         = lazy(() => import('./parametres/ProfilSection'));
const ZoneSection           = lazy(() => import('./parametres/ZoneSection'));
const ValidationsSection    = lazy(() => import('./parametres/ValidationsSection'));
const NotificationsSection  = lazy(() => import('./parametres/NotificationsSection'));
const SecuriteSection       = lazy(() => import('./parametres/SecuriteSection'));
const EntreprisesSection    = lazy(() => import('./parametres/EntreprisesSection'));
const LivreursSection       = lazy(() => import('./parametres/LivreursSection'));
const PartenairesSection    = lazy(() => import('./parametres/PartenairesSection'));
const FinancesSection       = lazy(() => import('./parametres/FinancesSection'));
const CommunicationSection  = lazy(() => import('./parametres/CommunicationSection'));
const JournalSection        = lazy(() => import('./parametres/JournalSection'));
const ApparenceSection      = lazy(() => import('./parametres/ApparenceSection'));
const SauvegardeSection     = lazy(() => import('./parametres/SauvegardeSection'));
const ConfidentialiteSection = lazy(() => import('./parametres/ConfidentialiteSection'));
const AvanceSection         = lazy(() => import('./parametres/AvanceSection'));
const SanteSection          = lazy(() => import('./parametres/SanteSection'));

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
/* BUG CORRIGÉ — sur les 16 sections, 8 sont des maquettes 100% locales,
 * sans le moindre appel réseau : chaque toggle/champ/bouton "Sauvegarder"
 * ne modifie qu'un état React local, jamais persisté nulle part (les 8
 * autres — profil/sécurité/notifications/zone/validations/entreprises/
 * livreurs/partenaires — sont réellement connectées, soit directement
 * via apiFetch, soit via un fichier services/*.service.ts dédié, voir
 * leurs en-têtes respectifs). Le bouton flottant "Enregistrer les
 * modifications" ci-dessous était lui-même un stub (voir son ancien
 * commentaire "sera connecté au backend") : un setTimeout(800ms) suivi
 * d'un toast de succès, sans jamais rien envoyer au serveur — de plus,
 * il était totalement redondant pour les sections réelles, qui
 * persistent déjà chacune leurs propres changements via leur propre
 * bouton "Sauvegarder" interne. Retiré. Les sections non connectées
 * sont maintenant grisées (désactivées) avec un bandeau explicite
 * plutôt que de laisser croire qu'elles enregistrent quoi que ce soit.
 * 'journal' retiré de cette liste : la section est maintenant reliée à
 * GET /dashboard/admin/audit (voir JournalSection.tsx + AdminAuditService).
 * 'apparence' retiré : ERREUR DE CLASSIFICATION CORRIGÉE — cette section
 * était déjà 100% réelle (GET/PUT/POST /appearance via appearanceService.ts)
 * et n'aurait jamais dû être grisée ici.
 * 'sante' retiré : reliée à GET /platform-security/health|summary|alerts —
 * routes déjà ouvertes au rôle ADMIN (voir SanteSection.tsx). Seules la
 * conformité et les sauvegardes restent réservées au Super Admin.
 * 'communication' retiré : reliée à GET/PUT /dashboard/admin/communication —
 * message/signature d'invitation + modèles de notification (voir
 * CommunicationSection.tsx + AdminCommunicationService). */
const MOCK_SECTIONS = new Set<ParamSection>([
  'finances',
  'sauvegarde', 'confidentialite', 'avance',
]);

export default function ParametresPage({ onToast }: ParametresPageProps) {
  const { logout } = useAppContext();
  const navigate = useNavigate();
  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const [active,  setActive]  = useState<ParamSection>('profil');
  const [query,   setQuery]   = useState('');

  /* Filtre la navigation latérale selon la recherche */
  const filteredGroups = NAV_GROUPS.map(g => ({
    ...g,
    items: query
      ? g.items.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
      : g.items,
  })).filter(g => g.items.length > 0);

  /* Métadonnées de la section active */
  const meta = SEC_META[active];
  const isMock = MOCK_SECTIONS.has(active);

  /* Rendu de la section active */
  const renderSection = () => {
    const props = { onToast };
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

        {/* Bandeau honnête — cette section n'est pas encore reliée au
            backend (voir MOCK_SECTIONS ci-dessus) : tout ce qui suit est
            une maquette visuelle, rien n'est réellement enregistré. */}
        {isMock && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--g50, #F5F5F5)', border: '1px solid var(--bdr, #E4E4E7)',
            borderRadius: 10, padding: '10px 16px', margin: '0 28px 16px',
            fontSize: 12.5, fontWeight: 600, color: 'var(--t2, #52525B)',
          }}>
            <i className="fas fa-circle-info" style={{ color: 'var(--amber, #F59E0B)' }} />
            Cette section est en aperçu — elle sera bientôt disponible et connectée au backend. Rien de ce qui suit n&apos;est encore enregistré.
          </div>
        )}

        {/* Rendu de la section active — désactivée si maquette non
            connectée. `<fieldset disabled>` cascade nativement sur les
            vrais boutons/inputs (ex: "Sauvegarder"), mais ces sections
            mock implémentent leurs interrupteurs comme de simples <div
            onClick> (pas des <input type="checkbox">) que fieldset ne
            neutralise pas — pointerEvents:'none' sur le wrapper bloque
            tous les clics universellement, quelle que soit l'implémentation
            interne, en plus d'estomper visuellement toute la section. */}
        <Suspense fallback={
          <div style={{ textAlign: 'center', padding: '3rem', opacity: .4 }}>
            <i className="fas fa-spinner fa-spin fa-2x" />
          </div>
        }>
          <fieldset disabled={isMock} style={isMock
            ? { border: 0, margin: 0, padding: 0, opacity: 0.6, pointerEvents: 'none' }
            : { border: 0, margin: 0, padding: 0 }}>
            {renderSection()}
          </fieldset>
        </Suspense>

        {/* ── Déconnexion — en bas de la page paramètres, sous toutes
            les sections ── */}
        <div style={{ padding: '24px 28px', borderTop: '1px solid var(--bdr)', marginTop: 8 }}>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '10px 18px', borderRadius: 'var(--pill, 999px)',
              fontSize: 13, fontWeight: 700, color: 'var(--red, #DC2626)',
              background: 'none', border: '1px solid var(--red, #DC2626)', cursor: 'pointer',
            }}
          >
            <i className="fas fa-right-from-bracket" />
            Se déconnecter
          </button>
        </div>

      </div>

    </div>
  );
}
