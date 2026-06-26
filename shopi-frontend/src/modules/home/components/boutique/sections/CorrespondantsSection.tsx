/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/CorrespondantsSection.tsx
 *
 * RÔLE    : Onglet "Correspondants" — grille des correspondants
 *           Shopi rattachés à la boutique, vue client.
 *
 * AFFICHE :
 *   - Résumé en haut : disponibles / complets / total
 *   - Bannière explicative "Qu'est-ce qu'un correspondant ?"
 *   - Grille de cartes CardCorrespondantBoutique
 * ============================================================
 */
import React, { useState } from 'react';
import { CORRESPONDANTS_MOCK } from '../data/boutiqueMockData';
import CardCorrespondantBoutique from '../components/CardCorrespondantBoutique';
import styles from '../styles/CorrespondantsSection.module.css';

interface Props { onToast: (m: string) => void; }

export default function CorrespondantsSection({ onToast }: Props) {
  const [showInfo, setShowInfo] = useState(true);

  const disponibles = CORRESPONDANTS_MOCK.filter(c => c.dispo).length;
  const complets    = CORRESPONDANTS_MOCK.filter(c => !c.dispo).length;

  return (
    <div>

      {/* ── Résumé en haut ── */}
      <div className={styles.resume}>
        <div className={`${styles.resumeItem} ${styles.resumeGreen}`}>
          <span className={styles.resumeDot} />
          <strong>{disponibles}</strong> disponible{disponibles > 1 ? 's' : ''}
        </div>
        <div className={`${styles.resumeItem} ${styles.resumeGray}`}>
          <span className={`${styles.resumeDot} ${styles.resumeDotGray}`} />
          <strong>{complets}</strong> complet{complets > 1 ? 's' : ''}
        </div>
        <div className={styles.resumeItem}>
          <i className="fas fa-map-location-dot" style={{ color:'#4338CA', fontSize:12 }} />
          <strong>{CORRESPONDANTS_MOCK.length}</strong> correspondants au total
        </div>
      </div>

      {/* ── Bannière explicative (fermable) ── */}
      {showInfo && (
        <div className={styles.infoBanner}>
          <div className={styles.ibIcon}>🏢</div>
          <div className={styles.ibText}>
            <div className={styles.ibTitle}>
              <i className="fas fa-circle-info" /> Qu'est-ce qu'un correspondant Shopi ?
            </div>
            <p className={styles.ibDesc}>
              Un correspondant est un représentant Shopi dans votre ville. Il réceptionne votre colis,
              le vérifie et le garde en lieu sûr. Vous pouvez le récupérer directement ou le confier
              à un livreur pour une livraison à domicile.
            </p>
            <div className={styles.ibSteps}>
              {[
                { ico:'fas fa-box',          label:'Colis reçu et vérifié'                 },
                { ico:'fas fa-shield-check', label:'Stockage sécurisé'                     },
                { ico:'fas fa-motorcycle',   label:'Remise directe ou via livreur'         },
                { ico:'fas fa-star',         label:'Noté et certifié Shopi'                },
              ].map(s => (
                <div key={s.label} className={styles.ibStep}>
                  <i className={s.ico} />
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <button className={styles.ibClose} onClick={() => setShowInfo(false)} aria-label="Fermer">
            <i className="fas fa-xmark" />
          </button>
        </div>
      )}

      {/* ── Grille des correspondants ── */}
      <div className={styles.grid}>
        {CORRESPONDANTS_MOCK.map(c => (
          <CardCorrespondantBoutique key={c.id} c={c} onToast={onToast} />
        ))}
      </div>
    </div>
  );
}