/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/BoutiqueNav.tsx
 *
 * MODIFICATION : Ajout de l'onglet "Correspondants"
 *   entre Livreurs et Avis.
 * ============================================================
 */
import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/BoutiqueNav.module.css';

export type OngletType =
  | 'produits' | 'promos' | 'livreurs'
  | 'correspondants'                     // ← AJOUTÉ
  | 'avis' | 'apropos';

interface Props {
  onglet:         OngletType;
  onChangeOnglet: (o: OngletType) => void;
  counts: {
    produits:        number;
    promos:          number;
    livreurs:        number;
    correspondants:  number;              // ← AJOUTÉ
    avis:            number;
  };
}

export default function BoutiqueNav({ onglet, onChangeOnglet, counts }: Props) {
  const { t } = useTranslation();
  const navRef = useRef<HTMLElement>(null);

  /* Même correctif que BoutiqueIdentity.tsx : hauteur réelle mesurée en
   * direct plutôt que devinée (48px codé en dur dans BoutiqueSidebar.
   * module.css) — les paddings des boutons changent selon la largeur
   * (≤900px, ≤480px), donc la hauteur de cette barre n'est pas fixe. */
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty('--boutique-nav-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const ONGLETS: {
    key:       OngletType;
    icon:      string;
    label:     string;
    countKey?: keyof Props['counts'];
  }[] = [
    { key:'produits',       icon:'fa-boxes-stacked',    label:t('boutiqueDetail.nav.produits'),        countKey:'produits'       },
    { key:'promos',         icon:'fa-tags',             label:t('boutiqueDetail.nav.promotions'),      countKey:'promos'         },
    { key:'livreurs',       icon:'fa-motorcycle',       label:t('boutiqueDetail.nav.livreurs'),        countKey:'livreurs'       },
    { key:'correspondants', icon:'fa-map-location-dot', label:t('boutiqueDetail.nav.correspondants'),  countKey:'correspondants' },
    { key:'avis',           icon:'fa-star',             label:t('boutiqueDetail.nav.avis'),            countKey:'avis'           },
    { key:'apropos',        icon:'fa-circle-info',      label:t('boutiqueDetail.nav.apropos')                                    },
  ];
  return (
    <nav className={styles.nav} ref={navRef}>
      <div className={styles.inner}>
        {ONGLETS.map(o => (
          <button
            key={o.key}
            className={`${styles.btn} ${onglet === o.key ? styles.btnActive : ''}`}
            onClick={() => onChangeOnglet(o.key)}
            title={o.label}
            aria-label={o.label}
          >
            <i className={`fas ${o.icon}`} />
            {/* BUG CORRIGÉ — le libellé traduit de chaque onglet n'était
             * jamais réellement affiché (seulement utilisé pour title/
             * aria-label) : la barre d'onglets ne montrait qu'une icône +
             * un compteur, sur TOUTES les tailles d'écran, pas seulement
             * mobile. `.label` se masque en dessous de 480px (voir CSS)
             * pour rester compact sur téléphone — la ligne défile déjà
             * horizontalement au besoin (overflow-x:auto). */}
            <span className={styles.label}>{o.label}</span>
            {o.countKey && (
              <span className={styles.cnt}>{counts[o.countKey]}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}