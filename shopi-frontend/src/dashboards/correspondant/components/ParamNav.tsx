/* ================================================================
 * components/ParamNav.tsx — VERSION DYNAMIQUE
 *
 * Props :
 *   section       — section active
 *   onSection(id) — callback changement de section
 *   data          — données API réelles (CorrespondantData | null)
 *
 * Calcul dynamique de chaque indicateur :
 *   pct      → % de complétion calculé depuis data (0–100)
 *   dotColor → 'r' (rouge) ou 'a' (amber) si attention requise
 *
 * Si data est null (chargement) → indicateurs masqués (skeleton)
 * ================================================================ */

import React, { useMemo } from 'react';
import s from '../styles/ParamNav.module.css';
import { NAV_ITEMS, type SectionId } from '../data/parametresData';
import type { CorrespondantData } from '../hooks/useCorrespondantParametres';

interface Props {
  section:   SectionId;
  onSection: (id: SectionId) => void;
  /** Données API — null pendant le chargement */
  data:      CorrespondantData | null;
}

/* Groupes dans l'ordre d'affichage */
const GROUPS = ['Identité', 'Activité', 'Finances', 'Compte'] as const;

// ─── Type de l'état calculé par section ───────────────────────

interface NavIndicator {
  /** Pourcentage affiché (ex: "85%") — undefined si non applicable */
  pct?:      string;
  /** Point coloré à droite — undefined si tout est OK */
  dotColor?: 'r' | 'a';
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/** Retourne "X%" en comptant les valeurs truthy dans la liste */
function calcPct(checks: unknown[], total?: number): string {
  const n     = total ?? checks.length;
  const done  = checks.filter(Boolean).length;
  return Math.round((done / n) * 100) + '%';
}

/** Retourne true si la valeur est remplie (non nulle, non vide) */
const filled = (v: unknown): boolean =>
  v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);

// ─────────────────────────────────────────────────────────────
// CALCUL DYNAMIQUE DES INDICATEURS
// ─────────────────────────────────────────────────────────────

/**
 * Calcule les indicateurs (pct / dotColor) pour chaque section
 * en se basant sur les données réelles de l'API.
 *
 * Appelé via useMemo pour éviter les recalculs inutiles.
 */
function computeNavState(
  data: CorrespondantData | null,
): Record<SectionId, NavIndicator> {

  /* Pendant le chargement : on retourne des indicateurs vides */
  if (!data) {
    const empty: NavIndicator = {};
    return {
      profil:'', depot:'', zone:'', entites:'', colis:'',
      paiement:'', documents:'', securite:'', notifications:'',
      confidentialite:'', langue:'', danger:'',
    } as any;
  }

  /* ── §1 Profil & Identité ─────────────────────────────────
   * Champs : prénom, nom, bio, langues, photo, type correspondant
   * firstName/lastName/profilePicture viennent de User via fusion
   */
  const profilPct = calcPct([
    filled(data.firstName),
    filled(data.lastName),
    filled(data.bio),
    filled(data.langues),
    filled(data.profilePicture),
    filled(data.typeCorrespondant),
  ]);

  /* ── §2 Point de dépôt ────────────────────────────────────
   * Champs obligatoires : nom, adresse, commune, ville, téléphone dépôt
   * Champs optionnels   : repère, capacité, type de local, accès
   */
  const depotPct = calcPct([
    filled(data.depotNom),
    filled(data.depotAdresse),
    filled(data.depotCommune),
    filled(data.depotVille),
    filled(data.depotPhone),
    filled(data.depotCapacite),
    filled(data.depotTypeLocal),
    filled(data.depotAcces),
  ]);

  /* ── §3 Zone & Horaires ────────────────────────────────────
   * 3 checks : zones actives, horaires chargés, règles auto configurées
   */
  const zonePct = calcPct([
    (data.zonesActives?.length ?? 0) > 0,
    (data.horaires?.length    ?? 0) > 0,
    filled(data.zoneAutoRules),
  ]);

  /* ── §4 Entités partenaires ───────────────────────────────
   * Codes boutique + livreur générés, colabSettings configuré
   */
  const entitesPct = calcPct([
    filled(data.codeBoutique),
    filled(data.codeLivreur),
    filled(data.colabSettings),
  ]);

  /* ── §5 Gestion des colis ─────────────────────────────────
   * Délai & capacité ont des valeurs par défaut, donc toujours OK.
   * On regarde surtout les types de colis et les règles incidents.
   */
  const colisPct = calcPct([
    data.colisDelaiMax    > 0,
    data.colisCapaciteMax > 0,
    (data.colisTypesAcceptes?.length ?? 0) > 0,
    filled(data.colisIncidentRules),
  ]);

  /* ── §6 Paiement & Commissions ────────────────────────────
   * Au moins une méthode configurée + fréquence de virement définie
   */
  const paiementPct = calcPct([
    (data.paiementMethodes?.length ?? 0) > 0,
    filled(data.virementFrequence),
  ]);

  /* ── §7 Documents & Vérification ─────────────────────────
   * Logique dot :
   *   - 'r' (rouge)  : verificationStatus === 'rejected' ou documents manquants critiques
   *   - 'a' (amber)  : documents en attente de vérification (reviewing) ou manquants
   *   - undefined    : tout est vérifié
   */
  const docsRequis  = [data.documentCni, data.documentBail, data.documentAssurance] as const;
  const toutsOk     = docsRequis.every(Boolean) && data.verificationStatus === 'verified';
  const rejeté      = data.verificationStatus === 'rejected';
  const manquant    = docsRequis.some(d => !d);

  const documentsDot: 'r' | 'a' | undefined =
    rejeté                                    ? 'r' :
    manquant || data.verificationStatus === 'reviewing' ? 'a' :
    toutsOk                                   ? undefined :
    'a';

  /* ── §8 Sécurité ──────────────────────────────────────────
   * Mot de passe (toujours défini = 1 check OK)
   * + 2FA activé (bonus)
   */
  const securitePct = calcPct([
    true,                    // mot de passe toujours présent dans User
    data.twoFaEnabled,       // 2FA activé = compte plus sécurisé
  ]);

  /* ── §9 Notifications ─────────────────────────────────────
   * notifSettings configuré = préférences personnalisées
   * Sinon on considère les valeurs par défaut comme 50%
   */
  const notifPct = filled(data.notifSettings) ? '100%' : '50%';

  /* ── §10 Confidentialité ──────────────────────────────────
   * privacySettings personnalisé = paramètres définis
   */
  const confidPct = filled(data.privacySettings) ? '100%' : '50%';

  /* ── §11 Zone sensible ────────────────────────────────────
   * Point rouge si le compte n'est pas actif (suspendu, désactivé, suppression initiée)
   */
  const dangerDot: 'r' | undefined =
    data.status !== 'active' ? 'r' : undefined;

  return {
    profil:          { pct: profilPct },
    depot:           { pct: depotPct  },
    zone:            { pct: zonePct   },
    entites:         { pct: entitesPct },
    colis:           { pct: colisPct  },
    paiement:        { pct: paiementPct },
    documents:       { dotColor: documentsDot },
    securite:        { pct: securitePct },
    notifications:   { pct: notifPct  },
    confidentialite: { pct: confidPct },
    langue:          {},
    danger:          { dotColor: dangerDot },
  };
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT
// ─────────────────────────────────────────────────────────────

export default function ParamNav({ section, onSection, data }: Props) {

  /* Calcul mémoïsé — ne se relance que si `data` change */
  const navState = useMemo(() => computeNavState(data), [data]);

  return (
    <nav className={s.nav} id="pnav" aria-label="Navigation paramètres">
      {GROUPS.map(grp => {
        const items = NAV_ITEMS.filter(i => i.group === grp);
        return (
          <div key={grp}>
            <div className={s.sect}>{grp}</div>

            {items.map(item => {
              /* Indicateur dynamique calculé depuis les données API */
              const indicator = navState[item.id] ?? {};

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className={[
                    s.item,
                    section === item.id ? s.itemOn     : '',
                    item.isDanger       ? s.itemDanger : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onSection(item.id)}
                  onKeyDown={e => e.key === 'Enter' && onSection(item.id)}
                  aria-current={section === item.id ? 'page' : undefined}
                  title={item.label}
                >
                  {/* Icône section */}
                  <i className={`fas ${item.icon} ${s.icon}`} />

                  {/* Libellé */}
                  <span>{item.label}</span>

                  {/* ── Indicateur droit : % calculé ── */}
                  {indicator.pct && !indicator.dotColor && (
                    <span
                      className={s.pct}
                      style={{
                        /* Couleur adaptée au % : rouge < 50%, amber < 80%, vert ≥ 80% */
                        color:
                          parseInt(indicator.pct) < 50 ? 'var(--red,#DC2626)' :
                          parseInt(indicator.pct) < 80 ? 'var(--cor,#B45309)' :
                          'var(--emerald,#047857)',
                      }}
                    >
                      {data ? indicator.pct : '—'}
                    </span>
                  )}

                  {/* ── Indicateur droit : point coloré ── */}
                  {indicator.dotColor === 'r' && (
                    <span
                      className={`${s.dot} ${s.dotR}`}
                      title="Action requise"
                    />
                  )}
                  {indicator.dotColor === 'a' && (
                    <span
                      className={`${s.dot} ${s.dotA}`}
                      title="En attente"
                    />
                  )}

                  {/* Skeleton pendant le chargement */}
                  {!data && (
                    <span style={{
                      display:'inline-block', width:28, height:8,
                      borderRadius:4, background:'rgba(255,255,255,.06)',
                      animation:'pulse 1.5s ease infinite',
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}