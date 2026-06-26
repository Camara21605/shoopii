/*
 * FICHIER : src/modules/home/components/produit/sections/TabsSection.tsx
 * RÔLE    : Onglets d'information du produit.
 *           - Description : texte + liste de fonctionnalités
 *           - Caractéristiques : tableau specs
 *           - Livraison & Correspondants : guide explicatif
 *           - Avis (248) : liste avis clients vérifiés
 */
import React, { useState } from 'react';
import type { ProduitInfo, AvisClient } from '../data/produitMockData';
import styles from '../styles/TabsSection.module.css';

type TabId = 'desc' | 'specs' | 'delivery' | 'reviews';

interface Props {
  produit: ProduitInfo;
  avis:    AvisClient[];
  onToast: (m: string) => void;
}

export default function TabsSection({ produit, avis, onToast }: Props) {
  const [tab, setTab] = useState<TabId>('desc');

  const TABS: { id: TabId; label: string }[] = [
    { id:'desc',     label:'Description'                   },
    { id:'specs',    label:'Caractéristiques'              },
    { id:'delivery', label:'Livraison & Correspondants'    },
    { id:'reviews',  label:`Avis (${produit.avis})`        },
  ];

  return (
    <div className={styles.wrap}>
      {/* ── Navigation onglets ── */}
      <div className={styles.nav}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tabBtn} ${tab === t.id ? styles.tabBtnActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>

        {/* ── Description ── */}
        {tab === 'desc' && (
          <div className={styles.descContent}>
            <h3>À propos de l'iPhone 15 Pro</h3>
            <p>{produit.description}</p>
            <h3>Performances</h3>
            <ul>
              {['Puce A17 Pro gravée en 3 nm — la plus rapide jamais intégrée','GPU 6 cœurs pour des graphismes de niveau console',"Jusqu'à 29h d'autonomie vidéo"].map(l => <li key={l}>{l}</li>)}
            </ul>
            <h3>Caméra ProRes</h3>
            <ul>
              {['Triple caméra 48MP principal, 12MP ultrawide, 12MP téléphoto 3x','Enregistrement 4K/60fps ProRes','Smart HDR 5'].map(l => <li key={l}>{l}</li>)}
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
            <h3>Livraison internationale et correspondants</h3>
            <p>Cette boutique est basée en France. Shopi propose un système de correspondants locaux pour faciliter la réception de vos commandes en Afrique.</p>
            <h3>Comment fonctionne le correspondant Shopi ?</h3>
            <ul>
              {["Le correspondant est un représentant Shopi dans votre ville ou région","Il réceptionne votre colis, vérifie son état et vous notifie","Il le conserve en lieu sûr et vous le remet ou le confie à un livreur local","Il facilite la communication entre vous et la boutique internationale"].map(l => <li key={l}>{l}</li>)}
            </ul>
            <h3>Tarification des livreurs selon la distance</h3>
            <ul>
              {["Même ville : tarif de base (ex. 15 000 – 25 000 GNF)","Ville proche (rayon 50 km) : +30% du tarif de base","Autre région / préfecture : +80% du tarif de base","International : tarif fixé par accord entre boutique et correspondant"].map(l => <li key={l}>{l}</li>)}
            </ul>
            <h3>Multiplicateurs de vitesse</h3>
            <ul>
              {["🐢 Économique : ×1.0 — délai classique","🚴 Standard : ×1.3 — délai normal recommandé","🚀 Express : ×1.8 — livraison prioritaire","⚡ Ultra : ×2.5 — livraison immédiate"].map(l => <li key={l}>{l}</li>)}
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
                      <i className="fas fa-check-circle" /> Achat vérifié
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
