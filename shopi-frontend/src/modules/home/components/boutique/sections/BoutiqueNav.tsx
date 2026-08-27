/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/BoutiqueNav.tsx
 *
 * MODIFICATION : Ajout de l'onglet "Correspondants"
 *   entre Livreurs et Avis.
 * ============================================================
 */
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
    <nav className={styles.nav}>
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
            {o.countKey && (
              <span className={styles.cnt}>{counts[o.countKey]}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}