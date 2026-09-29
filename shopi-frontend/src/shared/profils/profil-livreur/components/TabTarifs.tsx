/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/components/TabTarifs.tsx
 *
 * Onglet "Tarifs" : frais de livraison réels des lieux desservis.
 *
 * BUG CORRIGÉ (audit 2026-09) — l'onglet affichait un « tarif de base », un prix au km, un
 * supplément colis lourd et une majoration de nuit : d'anciens réglages du livreur (15 000 GNF
 * par défaut) que plus personne ne peut modifier et qu'aucune commande n'applique. Le client
 * voyait un prix différent de celui facturé au panier. Ce sont désormais les frais de la zone de
 * livraison (fixés par Shoneya), exactement ceux du panier.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/ProfilLivreur.module.css';
import type { LivreurProfile } from '../types';

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} GNF`;

export default function TabTarifs({ profile }: { profile: LivreurProfile }) {
  const { t } = useTranslation();
  const tarifs = Array.isArray(profile.tarifs) ? profile.tarifs : [];

  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.ct}><i className="fas fa-tag" /> {t('profilLivreur.tabTarifs.title')}</div></div>
      <div className={styles.infoGrid}>
        {tarifs.length === 0 ? (
          <div className={styles.tarifRow}>
            <div className={styles.trSvc}><i className="fas fa-circle-info" /> Aucune zone de livraison renseignée pour ce livreur.</div>
          </div>
        ) : tarifs.map(l => (
          <div key={l.lieu} className={styles.tarifRow}>
            <div className={styles.trSvc}>
              <i className="fas fa-location-dot" /> {l.lieu}
              {l.zoneNom && l.zoneNom.toLowerCase() !== l.lieu.toLowerCase() && (
                <span style={{ color: 'var(--t3)', fontWeight: 500 }}> · zone {l.zoneNom}</span>
              )}
            </div>
            <div className={styles.trPrice}>{l.frais === null ? 'Zone non couverte' : fmt(l.frais)}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 16px 14px', fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>
        Frais de livraison fixés par Shoneya selon la zone de livraison. Le montant exact pour votre adresse s’affiche au panier.
      </div>
    </div>
  );
}
