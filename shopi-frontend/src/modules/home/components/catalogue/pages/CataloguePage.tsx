/* ================================================================
 * FICHIER : src/modules/home/components/catalogue/pages/CataloguePage.tsx
 *
 * RÔLE : Page "/catalogue" — navigation façon grande marketplace :
 *   • onglets du haut  : Tout / Produits / Services  (distingue les
 *     entreprises de produits de celles de services)
 *   • colonne de gauche : types d'entreprise (groupés Produits / Services /
 *     Mixte quand l'onglet est "Tout")
 *   • panneau de droite : catégories du type choisi + entreprises du type
 *     (ou, pour "Toutes les entreprises", tous les types + entreprises)
 *
 * ÉTAT dans l'URL (?mode=products|services&type=<id>) : lien partageable
 * et bouton retour du navigateur cohérent.
 * ================================================================ */

import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Header from '../../layout/Header';
import CatalogueIcon from '../../ui/CatalogueIcon';
import {
  useCatalogueTypes, useTypeCategories, useTypeCompanies,
  type CatalogueType, type Mode, type Nature,
} from '../hooks/useCatalogueExplorer';

import styles from './CataloguePage.module.css';
import { typeName, categoryName } from '../../../../../shared/utils/catalogueCase';

const NATURE_ICON: Record<Nature, string> = {
  products: 'fa-bag-shopping',
  services: 'fa-screwdriver-wrench',
  neutral:  'fa-layer-group',
};

interface TileProps {
  label:       string;
  onClick:     () => void;
  color?:      string | null;
  children:    React.ReactNode;
  badge?:      Nature;
  badgeTitle?: string;
}

function Tile({ label, onClick, color, children, badge, badgeTitle }: TileProps) {
  return (
    <button type="button" className={styles.tile} onClick={onClick}>
      <span
        className={styles.tileImg}
        style={color ? { background: `color-mix(in srgb, ${color} 14%, var(--g100,#F1F3F6))` } : undefined}
      >
        <span className={styles.tileMedia}>{children}</span>
        {badge && (
          <span className={styles.tileBadge} title={badgeTitle} data-nature={badge}>
            <i className={`fas ${NATURE_ICON[badge]}`} />
          </span>
        )}
      </span>
      <span className={styles.tileLabel}>{label}</span>
    </button>
  );
}

export default function CataloguePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [sp, setSp] = useSearchParams();

  const modeParam = sp.get('mode');
  const mode: Mode | undefined = modeParam === 'products' || modeParam === 'services' ? modeParam : undefined;
  const typeParam = sp.get('type') ?? undefined;

  const { types, loading: typesLoading, error: typesError, reload } = useCatalogueTypes();

  /* Onglet Produits → types "products" + "neutral" ; Services → "services"
   * + "neutral" (un type neutre sert les deux modèles, cf. CompanyTypeNature). */
  const visibleTypes = useMemo(
    () => types.filter(ty => !mode || ty.nature === 'neutral' || ty.nature === mode),
    [types, mode],
  );
  const activeType: CatalogueType | undefined = visibleTypes.find(ty => ty.id === typeParam);

  const { categories, loading: catsLoading } = useTypeCategories(activeType?.id);
  const { companies, total, loading: compLoading } = useTypeCompanies(activeType?.id, mode);

  const setParams = (next: { mode?: Mode | null; type?: string | null }) => {
    const p = new URLSearchParams(sp);
    if ('mode' in next) { if (next.mode) p.set('mode', next.mode); else p.delete('mode'); }
    if ('type' in next) { if (next.type) p.set('type', next.type); else p.delete('type'); }
    setSp(p, { replace: true });
  };

  const goBoutiques = (filters: string[] = []) => {
    const parts = [...filters, ...(mode ? [`mode=${mode}`] : [])];
    navigate(parts.length ? `/boutiques?${parts.join('&')}` : '/boutiques');
  };

  const natureLabel = (n: Nature) => t(`cataloguePage.nature.${n}`);

  /* Sidebar : groupée par nature dans l'onglet "Tout", à plat sinon. */
  const groups: { key: Nature | 'flat'; items: CatalogueType[] }[] = mode
    ? [{ key: 'flat', items: visibleTypes }]
    : (['products', 'services', 'neutral'] as Nature[])
        .map(n => ({ key: n, items: visibleTypes.filter(ty => ty.nature === n) }))
        .filter(g => g.items.length > 0);

  const tabs: { val: Mode | undefined; label: string }[] = [
    { val: undefined,  label: t('cataloguePage.tabs.tout') },
    { val: 'products', label: t('cataloguePage.tabs.produits') },
    { val: 'services', label: t('cataloguePage.tabs.services') },
  ];

  return (
    <div className={styles.page}>
      <Header
        onToast={() => {}}
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />

      {/* ── Onglets Tout / Produits / Services ── */}
      <div className={styles.tabs} role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.label}
            role="tab"
            aria-selected={mode === tab.val}
            className={`${styles.tab} ${mode === tab.val ? styles.tabOn : ''}`}
            onClick={() => setParams({ mode: tab.val ?? null })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.split}>
        {/* ── Colonne gauche : types ── */}
        <nav className={styles.side} aria-label={t('cataloguePage.title')}>
          {typesLoading && [...Array(8)].map((_, i) => <div key={i} className={styles.sideSkeleton} />)}

          {!typesLoading && !typesError && (
            <>
              <button
                className={`${styles.sideItem} ${!activeType ? styles.sideOn : ''}`}
                onClick={() => setParams({ type: null })}
              >
                {t('cataloguePage.allCompanies')}
              </button>
              {groups.map(g => (
                <div key={g.key}>
                  {g.key !== 'flat' && (
                    <div className={styles.sideGroup}>
                      <i className={`fas ${NATURE_ICON[g.key]}`} /> {natureLabel(g.key)}
                    </div>
                  )}
                  {g.items.map(ty => (
                    <button
                      key={ty.id}
                      className={`${styles.sideItem} ${activeType?.id === ty.id ? styles.sideOn : ''}`}
                      onClick={() => setParams({ type: ty.id })}
                    >
                      <span className={styles.sideEmoji}><CatalogueIcon imageUrl={ty.imageUrl} icone={ty.icone} fallback="🏢" /></span>
                      <span className={styles.sideName}>{typeName(ty.nom)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </nav>

        {/* ── Panneau droit ── */}
        <main className={styles.panel} key={`${mode ?? 'all'}-${activeType?.id ?? 'all'}`}>
          {typesError && !typesLoading && (
            <div className={styles.state}>
              <i className="fas fa-triangle-exclamation" />
              <div>{t('cataloguePage.errorLoad')}</div>
              <button className={styles.retry} onClick={reload}>{t('cataloguePage.retry')}</button>
            </div>
          )}

          {!typesError && (
            <>
              {/* En-tête du panneau */}
              <div className={styles.panelHead}>
                <div className={styles.panelTitle}>
                  {activeType ? typeName(activeType.nom) : t('cataloguePage.allCompanies')}
                  {activeType && (
                    <span className={styles.natureTag} data-nature={activeType.nature}>
                      {natureLabel(activeType.nature)}
                    </span>
                  )}
                </div>
                <button
                  className={styles.panelMore}
                  aria-label={t('cataloguePage.seeAll')}
                  onClick={() => activeType ? navigate(`/types/${activeType.id}`) : goBoutiques()}
                >
                  <i className="fas fa-chevron-right" />
                </button>
              </div>

              {/* Catégories du type — ou, sans type choisi, la liste des types */}
              <div className={styles.grid}>
                <Tile
                  label={t('cataloguePage.seeAll')}
                  onClick={() => activeType ? goBoutiques([`type=${activeType.id}`]) : goBoutiques()}
                >
                  <i className={`fas fa-table-cells-large ${styles.seeAllIco}`} />
                </Tile>

                {activeType
                  ? categories.map(c => (
                      <Tile
                        key={c.id}
                        label={categoryName(c.nom)}
                        color={c.couleur ?? activeType.couleur}
                        onClick={() => goBoutiques([`type=${activeType.id}`, `category=${c.id}`])}
                      >
                        <CatalogueIcon imageUrl={c.imageUrl} icone={c.icone} fallback="📁" />
                      </Tile>
                    ))
                  : visibleTypes.map(ty => (
                      <Tile
                        key={ty.id}
                        label={typeName(ty.nom)}
                        color={ty.couleur}
                        badge={ty.nature}
                        badgeTitle={natureLabel(ty.nature)}
                        onClick={() => setParams({ type: ty.id })}
                      >
                        <CatalogueIcon imageUrl={ty.imageUrl} icone={ty.icone} fallback="🏢" />
                      </Tile>
                    ))}
              </div>
              {activeType && catsLoading && <div className={styles.hint}>{t('cataloguePage.loading')}</div>}
              {activeType && !catsLoading && categories.length === 0 && (
                <div className={styles.hint}>{t('cataloguePage.noCategories')}</div>
              )}

              {/* Entreprises */}
              <div className={styles.sectionRow}>
                <div className={styles.sectionTitle}>
                  {t('cataloguePage.companies')}
                  {total > 0 && <span className={styles.sectionCount}>{total}</span>}
                </div>
                {total > companies.length && (
                  <button
                    className={styles.sectionLink}
                    onClick={() => goBoutiques(activeType ? [`type=${activeType.id}`] : [])}
                  >
                    {t('cataloguePage.seeAll')} <i className="fas fa-arrow-right" />
                  </button>
                )}
              </div>

              {compLoading && (
                <div className={styles.grid}>
                  {[...Array(6)].map((_, i) => <div key={i} className={styles.tileSkeleton} />)}
                </div>
              )}

              {!compLoading && companies.length === 0 && (
                <div className={styles.hint}>{t('cataloguePage.noCompanies')}</div>
              )}

              {!compLoading && companies.length > 0 && (
                <div className={styles.grid}>
                  {companies.map(c => (
                    <Tile
                      key={c.id}
                      label={c.companyName}
                      badge={c.businessModel}
                      badgeTitle={natureLabel(c.businessModel)}
                      onClick={() => navigate(`/boutique/${c.id}`)}
                    >
                      {c.logo
                        ? <img src={c.logo} alt="" loading="lazy" className={styles.logoImg} />
                        : <span className={styles.initial}>{c.companyName.slice(0, 1).toUpperCase()}</span>}
                    </Tile>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
