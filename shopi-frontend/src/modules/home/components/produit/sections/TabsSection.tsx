/*
 * FICHIER : src/modules/home/components/produit/sections/TabsSection.tsx
 * RÔLE    : Onglets d'information du produit.
 *           - Description : texte + liste de fonctionnalités
 *           - Caractéristiques : tableau specs
 *           - Livraison & Correspondants : guide explicatif
 *           - Avis (248) : liste avis clients vérifiés
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProduitInfo, AvisClient } from '../data/produitMockData';
import styles from '../styles/TabsSection.module.css';

type TabId = 'desc' | 'specs' | 'delivery' | 'reviews';

interface Props {
  produit: ProduitInfo;
  avis:    AvisClient[];
  onToast: (m: string) => void;
}

export default function TabsSection({ produit, avis, onToast }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>('desc');

  const TABS: { id: TabId; label: string }[] = [
    { id:'desc',     label:t('produitDetail.tabs.description')             },
    { id:'specs',    label:t('produitDetail.tabs.caracteristiques')        },
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
            <h3>{t('produitDetail.tabs.aProposTitre')}</h3>
            <p>{produit.description}</p>
            <h3>{t('produitDetail.tabs.performances')}</h3>
            <ul>
              {[
                t('produitDetail.tabs.performancesList.puce'),
                t('produitDetail.tabs.performancesList.gpu'),
                t('produitDetail.tabs.performancesList.autonomie'),
              ].map(l => <li key={l}>{l}</li>)}
            </ul>
            <h3>{t('produitDetail.tabs.cameraProRes')}</h3>
            <ul>
              {[
                t('produitDetail.tabs.cameraList.triple'),
                t('produitDetail.tabs.cameraList.enregistrement'),
                t('produitDetail.tabs.cameraList.smartHdr'),
              ].map(l => <li key={l}>{l}</li>)}
            </ul>
          </div>
        )}

        {/* ── Caractéristiques ── */}
        {tab === 'specs' && (
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

        {/* ── Avis ── */}
        {tab === 'reviews' && (
          <div className={styles.avisListe}>
            {avis.map(a => (
              <div key={a.id} className={styles.avisItem}>
                <div className={styles.avisTop}>
                  <div className={styles.avisAv} style={{ background: a.couleur }}>{a.initiale}</div>
                  <div>
                    <div className={styles.avisNom}>{a.nom}</div>
                    <div className={styles.avisDate}>{a.date}</div>
                  </div>
                  {a.verified && (
                    <span className={styles.avisVerif}>
                      <i className="fas fa-check-circle" /> {t('produitDetail.tabs.achatVerifie')}
                    </span>
                  )}
                </div>
                <div className={styles.avisStars}>{'★'.repeat(a.note)}{'☆'.repeat(5-a.note)}</div>
                <div className={styles.avisTitre}>{a.titre}</div>
                <div className={styles.avisTexte}>{a.texte}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
