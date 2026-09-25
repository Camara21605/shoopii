/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/ParametresPage.tsx
 *
 * Centre de configuration complet de l'administrateur Shoneya.
 * 15 sections organisées en sidebar interne avec navigation rapide.
 *
 * Architecture :
 *  - sidebar interne (230px) avec groupes + recherche rapide
 *  - zone de contenu scrollable indépendante
 *  - bouton « Enregistrer » flottant (apparaît dès qu'une section
 *    envoie un toast de type 's' — indicateur de changement)
 *  - chaque section est un composant isolé dans pages/parametres/
 * ================================================================ */

import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from '../styles/ParametresPage.module.css';
import { isParamSection, type ParamSection } from './parametres/types';
import { NAV_GROUPS, SEC_META, MOCK_SECTIONS } from './parametres/navData';
import ParametresMobileMenu from './parametres/ParametresMobileMenu';
import { useIsNarrowScreen } from '../../../shared/hooks/useIsNarrowScreen';
import { useAppContext } from '../../../shared/context/AppContext';
import { apiFetch } from '../../../shared/services/apiFetch';

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
const SauvegardeSection     = lazy(() => import('./parametres/SauvegardeSection'));
const ConfidentialiteSection = lazy(() => import('./parametres/ConfidentialiteSection'));
const AvanceSection         = lazy(() => import('./parametres/AvanceSection'));
const SanteSection          = lazy(() => import('./parametres/SanteSection'));

/* ================================================================
 * Props du composant
 * ================================================================ */
interface ParametresPageProps {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

/* ================================================================
 * Composant principal
 * ================================================================ */
/* BUG CORRIGÉ — sur les 15 sections, 8 sont des maquettes 100% locales,
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
 * 'sante' retiré : reliée à GET /platform-security/health|summary|alerts —
 * routes déjà ouvertes au rôle ADMIN (voir SanteSection.tsx). Seules la
 * conformité et les sauvegardes restent réservées au Super Admin.
 * 'communication' retiré : reliée à GET/PUT /dashboard/admin/communication —
 * message/signature d'invitation + modèles de notification (voir
 * CommunicationSection.tsx + AdminCommunicationService).
 * NAV_GROUPS/SEC_META/MOCK_SECTIONS vivent maintenant dans
 * parametres/navData.ts, réutilisées par ParametresMobileMenu.tsx
 * (mode téléphone) — une seule source de vérité. */

export default function ParametresPage({ onToast }: ParametresPageProps) {
  const { logout } = useAppContext();
  const navigate = useNavigate();
  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl = searchParams.get('section');
  const [active,  setActive]  = useState<ParamSection>(
    isParamSection(sectionFromUrl) ? sectionFromUrl : 'profil',
  );
  const [query,   setQuery]   = useState('');

  /*
   * ── Mode téléphone : le "retour" du navigateur/appareil doit revenir
   *    au menu des paramètres, pas quitter le dashboard ──
   * Même mécanisme que sur les autres pages Paramètres (entreprise,
   * livreur) : sur grand écran, changer de section reste un simple
   * changement d'état local (comme avant) ; sous 1100px, la barre
   * d'onglets devient un menu groupé plein écran, et ouvrir une section
   * AJOUTE une entrée d'historique (?section=<id>) — le geste/touche
   * "retour" du téléphone revient alors naturellement au menu au lieu de
   * sortir direct du dashboard (le shell AdministrateurApp ne réagit lui-
   * même jamais à l'URL — activePage y est un état local indépendant —
   * donc ce va-et-vient reste entièrement local à cette page).
   */
  const isNarrow = useIsNarrowScreen(1100);
  const showMobileMenu = isNarrow && !isParamSection(sectionFromUrl);
  /* true seulement si CETTE session a elle-même empilé l'entrée
   * d'historique "détail" (tap sur une ligne du menu) — distingue ce cas
   * d'un lien direct vers ?section=xyz (rien à dépiler dans ce cas). */
  const pushedDetailRef = useRef(false);

  function goTo(section: ParamSection) {
    setActive(section);
    setQuery('');
    if (isNarrow) {
      pushedDetailRef.current = true;
      setSearchParams({ section });
    } else if (sectionFromUrl) {
      setSearchParams({}, { replace: true });
    }
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

  /* BUG CORRIGÉ — "Sécurité" et "Santé du système" affichaient des badges
   * codés en dur ('2'/'3'), identiques pour tout le monde. Les deux
   * sections sont pourtant déjà réellement connectées (SecuriteSection/
   * SanteSection) — seul le badge de la nav ne lisait pas ces données
   * avant que l'admin ne clique dessus. */
  const [navBadges, setNavBadges] = useState<Partial<Record<ParamSection, string>>>({});

  useEffect(() => {
    apiFetch<{ scoreItems: { ok: boolean }[] }>('/dashboard/super-admin/my-securite')
      .then(data => {
        const pending = (data.scoreItems ?? []).filter(i => !i.ok).length;
        if (pending > 0) setNavBadges(prev => ({ ...prev, securite: String(pending) }));
      })
      .catch(() => { /* silencieux — pas de badge plutôt qu'une erreur visible */ });

    apiFetch<{ count: number }>('/platform-security/alerts')
      .then(data => {
        if (data.count > 0) setNavBadges(prev => ({ ...prev, sante: String(data.count) }));
      })
      .catch(() => {});

    /* SecuriteSection prévient dès que le nombre de critères manquants change
     * (2FA activée, etc.) : le badge du menu reste juste sans recharger. */
    const onSecurity = (e: Event) => {
      const n = Number((e as CustomEvent<number>).detail) || 0;
      setNavBadges(prev => {
        const next = { ...prev };
        if (n > 0) next.securite = String(n); else delete next.securite;
        return next;
      });
    };
    window.addEventListener('admin-security-updated', onSecurity);
    return () => window.removeEventListener('admin-security-updated', onSecurity);
  }, []);

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
      case 'sauvegarde':      return <SauvegardeSection     {...props} />;
      case 'confidentialite': return <ConfidentialiteSection {...props} />;
      case 'avance':          return <AvanceSection         {...props} />;
      case 'sante':           return <SanteSection          {...props} />;
      default:                return null;
    }
  };

  // ── Mode téléphone, écran racine : liste groupée façon réglages natifs
  // (voir ParametresMobileMenu.tsx) — remplace entièrement la barre
  // d'onglets et le contenu de section (elle a sa propre ligne de
  // déconnexion).
  if (showMobileMenu) {
    return (
      <div className={styles.wrap}>
        <ParametresMobileMenu onOpen={goTo} onLogout={handleLogout} navBadges={navBadges} />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>

      {/* ════════════════════════════════
       * SIDEBAR INTERNE DE NAVIGATION — masquée en mode téléphone
       * (vue "détail", remplacée par le bouton "Retour" ci-dessous)
       * ════════════════════════════════ */}
      {!isNarrow && (
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
                  onClick={() => goTo(item.id)}
                >
                  <i className={`fas ${item.icon}`} />
                  {item.label}
                  {navBadges[item.id] && <span className={styles.sbBadge}>{navBadges[item.id]}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>
      )}

      {/* ════════════════════════════════
       * ZONE DE CONTENU
       * ════════════════════════════════ */}
      <div className={styles.content}>

        {/* ── Mode téléphone, vue "détail" : retour vers le menu racine
             plutôt que de dépendre uniquement du bouton "retour" du
             navigateur/appareil (voir goBackToMenu, qui, lui, gère déjà
             ce dernier via l'historique). ── */}
        {isNarrow && (
          <button type="button" onClick={goBackToMenu} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '10px 16px', margin: '16px 16px 0',
            background: 'var(--white)', border: '1px solid var(--bdr)', borderRadius: 'var(--pill)',
            fontSize: 13, fontWeight: 700, color: 'var(--t2)', cursor: 'pointer',
          }}>
            <i className="fas fa-arrow-left" style={{ fontSize: 12 }} />
            Retour
          </button>
        )}

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
            les sections. En mode téléphone (vue "détail"), déjà présente
            dans le menu racine : pas besoin de la répéter ici. ── */}
        {!isNarrow && (
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
        )}

      </div>

    </div>
  );
}
