/*
 * FICHIER : src/modules/home/components/produit/sections/TabsSection.tsx
 * RÔLE    : Onglets d'information du produit.
 *           - Description : texte réel saisi par le vendeur (état vide si absent)
 *           - Caractéristiques : tableau specs réel (état vide si absent)
 *           - Vente en gros : MOQ + paliers, affiché seulement si venteEnGros
 *           - Livraison & Correspondants : guide explicatif (générique, pas
 *             spécifique au produit)
 *           - Avis : PAS de système d'avis produit réel dans le projet à ce
 *             jour (seul CompanyAvis existe, au niveau boutique) — état vide
 *             honnête plutôt que les faux avis précédemment codés en dur.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProduitInfo } from '../data/produitMockData';
import styles from '../styles/TabsSection.module.css';

interface WholesaleTier { quantiteMin: number; quantiteMax: number | null; prixUnitaire: number; ordre: number }

type TabId = 'desc' | 'specs' | 'gros' | 'delivery' | 'reviews';

interface Props {
  produit: ProduitInfo;
  venteEnGros?:    boolean;
  moq?:            number | null;
  wholesaleTiers?: WholesaleTier[];
}

export default function TabsSection({ produit, venteEnGros = false, moq, wholesaleTiers = [] }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>('desc');

  const TABS: { id: TabId; label: string }[] = [
    { id:'desc',     label:t('produitDetail.tabs.description')             },
    { id:'specs',    label:t('produitDetail.tabs.caracteristiques')        },
    ...(venteEnGros ? [{ id:'gros' as TabId, label:t('produitDetail.tabs.venteEnGros') }] : []),
    { id:'delivery', label:t('produitDetail.tabs.livraisonCorrespondants') },
    { id:'reviews',  label:t('produitDetail.tabs.avisCount', { count: produit.avis }) },
  ];

  return (
    <div className={styles.wrap}>
      {/* ── Navigation onglets ── */}
      <div className={styles.nav}>
        {TABS.map(tabItem => (
          <button
            key={tabItem.id}
            className={`${styles.tabBtn} ${tab === tabItem.id ? styles.tabBtnActive : ''}`}
            onClick={() => setTab(tabItem.id)}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>

        {/* ── Description ── */}
        {tab === 'desc' && (
          <div className={styles.descContent}>
            {produit.description?.trim() ? (
              <>
                <h3>{t('produitDetail.tabs.aProposTitre')}</h3>
                <p>{produit.description}</p>
              </>
            ) : (
              <p className={styles.emptyTab}>{t('produitDetail.tabs.aucuneDescription')}</p>
            )}
          </div>
        )}

        {/* ── Caractéristiques ── */}
        {tab === 'specs' && (
          produit.specs.length > 0 ? (
            <table className={styles.specsTable}>
              <tbody>
                {produit.specs.map(s => (
                  <tr key={s.label}>
                    <td className={styles.specLbl}>{s.label}</td>
                    <td className={styles.specVal}>{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={styles.emptyTab}>{t('produitDetail.tabs.aucuneCaracteristique')}</p>
          )
        )}

        {/* ── Vente en gros ── */}
        {tab === 'gros' && (
          <div className={styles.descContent}>
            {moq != null && (
              <p>{t('produitDetail.tabs.grosMoqInfo', { moq })}</p>
            )}
            {wholesaleTiers.length > 0 ? (
              <table className={styles.specsTable}>
                <tbody>
                  {wholesaleTiers.map((tier, i) => (
                    <tr key={i}>
                      <td className={styles.specLbl}>
                        {tier.quantiteMin}{tier.quantiteMax != null ? `–${tier.quantiteMax}` : '+'} {t('produitDetail.infoSection.gros.unites')}
                      </td>
                      <td className={styles.specVal}>{tier.prixUnitaire.toLocaleString('fr')} GNF</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={styles.emptyTab}>{t('produitDetail.tabs.aucunPalierGros')}</p>
            )}
          </div>
        )}

        {/* ── Livraison & Correspondants ── */}
        {tab === 'delivery' && (
          <div className={styles.descContent}>
            <h3>{t('produitDetail.tabs.livraisonTitre')}</h3>
            <p>{t('produitDetail.tabs.livraisonDesc')}</p>
            <h3>{t('produitDetail.tabs.commentTitre')}</h3>
            <ul>
              {[
                t('produitDetail.tabs.commentList.representant'),
                t('produitDetail.tabs.commentList.receptionne'),
                t('produitDetail.tabs.commentList.conserve'),
                t('produitDetail.tabs.commentList.facilite'),
              ].map(l => <li key={l}>{l}</li>)}
            </ul>
            <h3>{t('produitDetail.tabs.tarifTitre')}</h3>
            <ul>
              {[
                t('produitDetail.tabs.tarifList.memeVille'),
                t('produitDetail.tabs.tarifList.villeProche'),
                t('produitDetail.tabs.tarifList.autreRegion'),
                t('produitDetail.tabs.tarifList.international'),
              ].map(l => <li key={l}>{l}</li>)}
            </ul>
            <h3>{t('produitDetail.tabs.multiplicateursTitre')}</h3>
            <ul>
              {[
                t('produitDetail.tabs.multiplicateursList.eco'),
                t('produitDetail.tabs.multiplicateursList.standard'),
                t('produitDetail.tabs.multiplicateursList.express'),
                t('produitDetail.tabs.multiplicateursList.ultra'),
              ].map(l => <li key={l}>{l}</li>)}
            </ul>
          </div>
        )}

        {/* ── Avis — pas de système d'avis produit réel à ce jour ── */}
        {tab === 'reviews' && (
          <p className={styles.emptyTab}>{t('produitDetail.tabs.aucunAvis')}</p>
        )}
      </div>
    </div>
  );
}
