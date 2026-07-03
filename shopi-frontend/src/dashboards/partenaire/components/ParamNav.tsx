/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/ParamNav.tsx
 *
 * Navigation gauche des paramètres partenaire.
 *
 * Indicateurs dynamiques calculés depuis PartenaireData :
 *   pct      → pourcentage de complétude (0–100)
 *   dotColor → 'r' rouge (action urgente) ou 'a' amber (en attente)
 *
 * Si data est null (chargement) → skeleton affiché.
 * ================================================================ */

import { useMemo } from 'react';
import s from '../styles/ParamNav.module.css';
import { NAV_ITEMS, type SectionId } from '../data/parametresData';
import type { PartenaireData } from '../hooks/usePartenaireParametres';

interface Props {
  section:   SectionId;
  onSection: (id: SectionId) => void;
  /** null pendant le chargement initial */
  data:      PartenaireData | null;
}

/* Groupes dans l'ordre d'affichage */
const GROUPS = ['Identité', 'Activité', 'Finances', 'Compte'] as const;

interface NavIndicator {
  pct?:      string;
  dotColor?: 'r' | 'a';
}

// ─────────────────────────────────────────────────────────────
// CALCUL DYNAMIQUE DES INDICATEURS
// Reflète la progression réelle du compte partenaire.
// ─────────────────────────────────────────────────────────────

function computeNavState(data: PartenaireData | null): Record<SectionId, NavIndicator> {
  if (!data) return Object.fromEntries(NAV_ITEMS.map(i => [i.id, {}])) as any;

  const f = (v: unknown): boolean =>
    v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);

  const pct = (checks: boolean[], total?: number): string =>
    Math.round((checks.filter(Boolean).length / (total ?? checks.length)) * 100) + '%';

  /* Profil : photo + identité + bio + zone */
  const profilPct = pct([f(data.profilePicture), f(data.firstName), f(data.lastName), f(data.bio), f(data.phone)]);

  /* Documents : indicateur amber par défaut (section en attente de backend)
     Le statut de vérification sera disponible quand les champs seront ajoutés
     à l'entité Partner. */
  const docDot: 'a' | undefined = 'a';

  /* Zone d'activité — champs réels sur l'entité Partner */
  const zonePct = pct([f(data.zone), f(data.commune), f(data.ville)]);

  /* Paiement : section locale (pas encore dans l'entité Partner) */
  const paiePct = '50%';

  /* Sécurité : toujours un mot de passe (OK) + 2FA (bonus) */
  const secuPct = pct([true, data.twoFaEnabled]);

  /* Notifications : paramètres personnalisés */
  const notifPct = f(data.notifActeurActive) ? '100%' : '50%';

  /* Confidentialité */
  const confidPct = '100%'; // personnalisé = toujours OK

  /* Danger : point rouge si compte non actif */
  const dangerDot: 'r' | undefined = data.status !== 'active' ? 'r' : undefined;

  return {
    profil:          { pct: profilPct },
    documents:       { dotColor: docDot },
    zone:            { pct: zonePct },
    parrainage:      {}, // statique
    paiement:        { pct: paiePct },
    notifications:   { pct: notifPct },
    securite:        { pct: secuPct },
    confidentialite: { pct: confidPct },
    preferences:     {},
    danger:          { dotColor: dangerDot },
  };
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT
// ─────────────────────────────────────────────────────────────

export default function ParamNav({ section, onSection, data }: Props) {
  const navState = useMemo(() => computeNavState(data), [data]);

  return (
    <nav className={s.nav} aria-label="Navigation paramètres partenaire">
      {GROUPS.map(grp => {
        const items = NAV_ITEMS.filter(i => i.group === grp);
        return (
          <div key={grp} className={s.group}>
            <div className={s.sect}>{grp}</div>
            {items.map(item => {
              const indicator = navState[item.id] ?? {};
              return (
                <button
                  key={item.id}
                  className={[
                    s.item,
                    section === item.id ? s.itemOn : '',
                    item.isDanger ? s.itemDanger : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onSection(item.id)}
                  aria-current={section === item.id ? 'page' : undefined}
                >
                  <i className={`fas ${item.icon} ${s.icon}`} />
                  <span>{item.label}</span>

                  {/* % de complétion */}
                  {indicator.pct && !indicator.dotColor && (
                    <span
                      className={s.pct}
                      style={{
                        color:
                          parseInt(indicator.pct) < 50 ? 'var(--red)' :
                          parseInt(indicator.pct) < 80 ? 'var(--amber)' :
                          'var(--emerald)',
                      }}
                    >
                      {data ? indicator.pct : '—'}
                    </span>
                  )}

                  {/* Point coloré */}
                  {indicator.dotColor === 'r' && <span className={`${s.dot} ${s.dotR}`} />}
                  {indicator.dotColor === 'a' && <span className={`${s.dot} ${s.dotA}`} />}

                  {/* Skeleton chargement */}
                  {!data && (
                    <span style={{
                      display: 'inline-block', width: 28, height: 8,
                      borderRadius: 4, background: 'var(--g200)',
                      marginLeft: 'auto',
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
