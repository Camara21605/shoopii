/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/BoutiqueSidebar.tsx
 *
 * RÔLE    : Panneau de filtres du catalogue d'une boutique.
 *           Desktop : colonne gauche sticky.
 *           Mobile (≤ 960px) : tiroir superposé, ouvert par le bouton
 *           « Filtres » de ProduitsSection, avec un pied « Voir N produits ».
 *
 * FILTRES (mêmes règles que l'app mobile — data/filtresProduits.ts) :
 *   1. Recherche     → nom, marque, catégorie
 *   2. Tri           → Pertinence, Prix ↑/↓, Nouveautés, Meilleures ventes,
 *                      Plus populaires
 *   3. Catégories    → catégories réelles de la boutique
 *   4. Prix          → double curseur + champs min/max
 *   5. Disponibilité → en stock, en promotion, nouveautés
 *   6. Infos boutique (desktop uniquement — déjà dans l'onglet À propos)
 *
 * L'état vit dans BoutiquePage.tsx (un seul objet FiltresProduits).
 * ============================================================
 */
import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoutiqueInfo } from '../data/boutiqueMockData';
import { TRIS_PRODUITS, type FiltresProduits } from '../data/filtresProduits';
import styles from '../styles/BoutiqueSidebar.module.css';

interface CategorieReelle { label: string; emoji: string; count: number; }

interface Props {
  filtres:     FiltresProduits;
  onChange:    (patch: Partial<FiltresProduits>) => void;
  onReset:     () => void;
  nbFiltres:   number;
  /** Nombre de produits après filtrage (bouton du tiroir mobile). */
  nbResultats: number;
  totalProduits: number;
  categories:  CategorieReelle[];
  priceBounds: { min: number; max: number };
  /** Nombre de produits concernés par chaque case de disponibilité. */
  dispoCounts: { enStock: number; enPromo: number; nouveautes: number };
  /* Mobile uniquement : tiroir superposé (voir CSS). Sans effet sur desktop. */
  isOpen?:     boolean;
  onClose?:    () => void;
  boutiqueInfo: BoutiqueInfo | null;
}

const fmt = (n: number) => n.toLocaleString('fr-FR');

/** Champ prix : on laisse taper librement et on n'applique qu'à la
 *  sortie du champ (ou Entrée). Avant, chaque frappe était bornée
 *  immédiatement : taper « 5000 » dans Max donnait 20000 dès le « 5 ». */
function PrixInput({ value, placeholder, onCommit, label }: {
  value: number; placeholder: string; label: string; onCommit: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  /* Valeur changée ailleurs (curseur, Réinitialiser) : on resynchronise
   * pendant le rendu, même motif que ProduitsSection (pas d'effet). */
  const [valueRef, setValueRef] = useState(value);
  if (value !== valueRef) { setValueRef(value); setDraft(String(value)); }
  const commit = () => {
    const n = Number(draft.replace(/\s/g, ''));
    if (draft.trim() === '' || !Number.isFinite(n)) { onCommit(null); return; }
    onCommit(Math.round(n));
  };
  return (
    <label className={styles.priceField}>
      <span className={styles.priceLbl}>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        className={styles.priceIn}
        placeholder={placeholder}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
    </label>
  );
}

export default function BoutiqueSidebar({
  filtres, onChange, onReset, nbFiltres, nbResultats, totalProduits,
  categories, priceBounds, dispoCounts, isOpen = false, onClose, boutiqueInfo,
}: Props) {
  const { t } = useTranslation();

  /* Tiroir mobile : bloque le défilement de la page derrière et ferme
   * avec Échap. */
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [isOpen, onClose]);

  /* ── Prix ── */
  const { min: bMin, max: bMax } = priceBounds;
  const prixUnique = bMax <= bMin;
  const curMin = Math.min(Math.max(filtres.prixMin ?? bMin, bMin), bMax);
  const curMax = Math.max(Math.min(filtres.prixMax ?? bMax, bMax), bMin);
  const pct = (v: number) => (prixUnique ? 0 : ((v - bMin) / (bMax - bMin)) * 100);
  /* Pas du curseur : ~100 crans sur la plage, arrondi à une valeur ronde. */
  const step = prixUnique ? 1 : Math.max(1, Math.pow(10, Math.floor(Math.log10((bMax - bMin) / 100))));
  /* Une borne égale à la borne réelle n'est pas un filtre (null). */
  const setMin = (v: number | null) => {
    if (v == null || v <= bMin) return onChange({ prixMin: null });
    onChange({ prixMin: Math.min(v, curMax) });
  };
  const setMax = (v: number | null) => {
    if (v == null || v >= bMax) return onChange({ prixMax: null });
    onChange({ prixMax: Math.max(v, curMin) });
  };

  const triLabels: Record<string, string> = {
    pertinence: t('boutiqueDetail.sidebar.triOptions.pertinence'),
    prixAsc:    t('boutiqueDetail.sidebar.triOptions.prixCroissant'),
    prixDesc:   t('boutiqueDetail.sidebar.triOptions.prixDecroissant'),
    nouveautes: t('boutiqueDetail.sidebar.triOptions.nouveautes'),
    ventes:     t('boutiqueDetail.sidebar.triOptions.meilleuresVentes'),
    populaires: t('boutiqueDetail.sidebar.triOptions.populaires', 'Plus populaires'),
  };

  const infoRows = boutiqueInfo ? [
    { ico: '🕐', bg: 'bg1', title: t('boutiqueDetail.sidebar.horaires'),  sub: boutiqueInfo.horaires },
    { ico: '📍', bg: 'bg2', title: t('boutiqueDetail.sidebar.adresse'),   sub: boutiqueInfo.adresse  },
    { ico: '📞', bg: 'bg3', title: t('boutiqueDetail.sidebar.telephone'), sub: boutiqueInfo.tel      },
    { ico: '💬', bg: 'bg3', title: t('boutiqueDetail.sidebar.whatsapp'),  sub: boutiqueInfo.whatsapp ?? '' },
    { ico: '✉️', bg: 'bg4', title: t('boutiqueDetail.sidebar.email'),     sub: boutiqueInfo.email    },
  ].filter(r => r.sub && r.sub.trim().length > 0) : [];

  return (
    <>
      {/* Fond assombri — mobile uniquement (voir CSS), ferme le tiroir au clic */}
      {isOpen && <div className={styles.backdrop} onClick={onClose} />}

      <aside
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}
        aria-label={t('boutiqueDetail.sidebar.titreTiroir', 'Filtres')}
      >
        {/* En-tête du tiroir — mobile uniquement (voir CSS) */}
        <div className={styles.drawerHd}>
          <h3>
            <i className="fas fa-sliders" /> {t('boutiqueDetail.sidebar.titreTiroir', 'Filtres')}
            {nbFiltres > 0 && <span className={styles.hdBadge}>{nbFiltres}</span>}
          </h3>
          <button className={styles.drawerClose} onClick={onClose} aria-label={t('boutiqueDetail.sidebar.fermer', 'Fermer')}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        <div className={styles.body}>

          {/* En-tête desktop : titre + réinitialiser */}
          <div className={styles.deskHd}>
            <span>
              <i className="fas fa-sliders" /> {t('boutiqueDetail.sidebar.titreTiroir', 'Filtres')}
              {nbFiltres > 0 && <span className={styles.hdBadge}>{nbFiltres}</span>}
            </span>
            {nbFiltres > 0 && (
              <button className={styles.clearBtn} onClick={onReset}>
                {t('boutiqueDetail.sidebar.reinitialiser', 'Réinitialiser')}
              </button>
            )}
          </div>

          {/* ══ 1. Recherche ══ */}
          <div className={styles.searchBox}>
            <i className="fas fa-magnifying-glass" />
            <input
              type="search"
              value={filtres.recherche}
              onChange={e => onChange({ recherche: e.target.value })}
              placeholder={t('boutiqueDetail.sidebar.rechercher', {
                count: totalProduits,
                defaultValue: 'Rechercher parmi {{count}} produits',
              })}
              aria-label={t('boutiqueDetail.sidebar.rechercherAria', 'Rechercher dans la boutique')}
            />
            {filtres.recherche && (
              <button onClick={() => onChange({ recherche: '' })} aria-label={t('boutiqueDetail.sidebar.effacer', 'Effacer')}>
                <i className="fas fa-circle-xmark" />
              </button>
            )}
          </div>

          {/* ══ 2. Tri ══ */}
          <section className={styles.card}>
            <div className={styles.cardHd}>
              <h4><i className="fas fa-arrow-up-wide-short" /> {t('boutiqueDetail.sidebar.trierPar')}</h4>
            </div>
            <div className={styles.cardBd}>
              <select
                className={styles.sortSel}
                value={filtres.tri}
                onChange={e => onChange({ tri: e.target.value as FiltresProduits['tri'] })}
                aria-label={t('boutiqueDetail.sidebar.trierPar')}
              >
                {TRIS_PRODUITS.map(k => <option key={k} value={k}>{triLabels[k]}</option>)}
              </select>
            </div>
          </section>

          {/* ══ 3. Catégories — masqué s'il n'y en a qu'une (rien à choisir) ══ */}
          {categories.length > 1 && (
            <section className={styles.card}>
              <div className={styles.cardHd}>
                <h4><i className="fas fa-layer-group" /> {t('boutiqueDetail.sidebar.categories')}</h4>
                {filtres.categorie && (
                  <button className={styles.clearBtn} onClick={() => onChange({ categorie: null })}>
                    {t('boutiqueDetail.sidebar.effacer', 'Effacer')}
                  </button>
                )}
              </div>
              <div className={`${styles.cardBd} ${styles.cardBdPad}`}>
                <div className={styles.catList} role="radiogroup">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!filtres.categorie}
                    className={`${styles.catItem} ${!filtres.categorie ? styles.catItemActive : ''}`}
                    onClick={() => onChange({ categorie: null })}
                  >
                    <span className={styles.catEm}>✦</span>
                    <span className={styles.catNom}>{t('boutiqueDetail.sidebar.tout')}</span>
                    <span className={styles.catCnt}>{totalProduits}</span>
                  </button>
                  {categories.map(c => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={filtres.categorie === c.label}
                      key={c.label}
                      className={`${styles.catItem} ${filtres.categorie === c.label ? styles.catItemActive : ''}`}
                      onClick={() => onChange({ categorie: filtres.categorie === c.label ? null : c.label })}
                    >
                      <span className={styles.catEm}>{c.emoji}</span>
                      <span className={styles.catNom}>{c.label}</span>
                      <span className={styles.catCnt}>{c.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ══ 4. Prix ══
           * Tous les produits au même prix : pas de curseur (il n'y a rien
           * à filtrer — la capture du 13/10 montrait « 20000 / 20000 » avec
           * un curseur bloqué). */}
          {totalProduits > 0 && (
            <section className={styles.card}>
              <div className={styles.cardHd}>
                <h4><i className="fas fa-coins" /> {t('boutiqueDetail.sidebar.prix')}</h4>
                {(filtres.prixMin != null || filtres.prixMax != null) && (
                  <button className={styles.clearBtn} onClick={() => onChange({ prixMin: null, prixMax: null })}>
                    {t('boutiqueDetail.sidebar.effacer', 'Effacer')}
                  </button>
                )}
              </div>
              <div className={styles.cardBd}>
                {prixUnique ? (
                  <p className={styles.priceNote}>
                    {t('boutiqueDetail.sidebar.prixUnique', {
                      prix: fmt(bMin),
                      defaultValue: 'Tous les produits sont à {{prix}} GNF.',
                    })}
                  </p>
                ) : (
                  <>
                    <div className={styles.priceRangeTxt}>
                      {fmt(curMin)} – {fmt(curMax)} GNF
                    </div>
                    {/* Double curseur : deux <input range> superposés */}
                    <div
                      className={styles.range}
                      style={{ '--from': `${pct(curMin)}%`, '--to': `${pct(curMax)}%` } as CSSProperties}
                    >
                      <input
                        type="range" min={bMin} max={bMax} step={step} value={curMin}
                        aria-label={t('boutiqueDetail.sidebar.prixMin', 'Prix minimum')}
                        onChange={e => setMin(Math.min(Number(e.target.value), curMax))}
                      />
                      <input
                        type="range" min={bMin} max={bMax} step={step} value={curMax}
                        aria-label={t('boutiqueDetail.sidebar.prixMax', 'Prix maximum')}
                        onChange={e => setMax(Math.max(Number(e.target.value), curMin))}
                      />
                    </div>
                    <div className={styles.priceInputs}>
                      <PrixInput label={t('boutiqueDetail.sidebar.min', 'Min')} placeholder={String(bMin)} value={curMin} onCommit={setMin} />
                      <span className={styles.priceDash}>–</span>
                      <PrixInput label={t('boutiqueDetail.sidebar.max', 'Max')} placeholder={String(bMax)} value={curMax} onCommit={setMax} />
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* ══ 5. Disponibilité ══ */}
          <section className={styles.card}>
            <div className={styles.cardHd}>
              <h4><i className="fas fa-warehouse" /> {t('boutiqueDetail.sidebar.disponibilite')}</h4>
            </div>
            <div className={styles.cardBd}>
              <div className={styles.checkList}>
                {([
                  { k: 'enStock',    lbl: t('boutiqueDetail.sidebar.enStockUniquement') },
                  { k: 'enPromo',    lbl: t('boutiqueDetail.sidebar.enPromotion') },
                  { k: 'nouveautes', lbl: t('boutiqueDetail.sidebar.nouveautesSeulement') },
                ] as const).map(c => (
                  <label key={c.k} className={`${styles.checkItem} ${filtres[c.k] ? styles.checkItemOn : ''}`}>
                    <input
                      type="checkbox"
                      checked={filtres[c.k]}
                      onChange={e => onChange({ [c.k]: e.target.checked })}
                    />
                    <span className={styles.checkLbl}>{c.lbl}</span>
                    <span className={styles.catCnt}>{dispoCounts[c.k]}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* ══ 6. Infos boutique — desktop uniquement (déjà dans l'onglet
                 À propos ; le tiroir mobile ne garde que les filtres). ══ */}
          {infoRows.length > 0 && (
            <section className={`${styles.card} ${styles.infoCard}`}>
              <div className={styles.cardHd}>
                <h4><i className="fas fa-circle-info" /> {t('boutiqueDetail.sidebar.infosBoutique')}</h4>
              </div>
              <div className={styles.cardBd}>
                <div className={styles.infoRows}>
                  {infoRows.map(r => (
                    <div key={r.title} className={styles.infoRow}>
                      <div className={`${styles.infoIco} ${styles[r.bg]}`}>{r.ico}</div>
                      <div>
                        <div className={styles.infoTitle}>{r.title}</div>
                        <div className={styles.infoSub}>{r.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Pied du tiroir — mobile uniquement */}
        <div className={styles.drawerFt}>
          <button className={styles.ftReset} onClick={onReset} disabled={nbFiltres === 0}>
            {t('boutiqueDetail.sidebar.reinitialiser', 'Réinitialiser')}
          </button>
          <button className={styles.ftApply} onClick={onClose}>
            {t('boutiqueDetail.sidebar.voirResultats', {
              count: nbResultats,
              defaultValue: 'Voir {{count}} produits',
            })}
          </button>
        </div>
      </aside>
    </>
  );
}
