/* ================================================================
 * FICHIER : src/modules/commande/components/ProgressBar.tsx
 *
 * Bandeau navy de progression globale de la commande.
 * Affiche l'étape en cours et le pourcentage d'avancement.
 * ================================================================ */

import styles from '../styles/ProgressBar.module.css';
import type { Acteur } from '../data/types';

interface ProgressBarProps {
  acteurs:     Acteur[];
  currentStep: number;
  progression: number;     // 0–100
  done:        boolean;
}

const ROLE_LABEL: Record<string, string> = {
  entreprise: 'Entreprise', livreur: 'Livreur',
  correspondant: 'Correspondant', client: 'Client',
};

export default function ProgressBar({ acteurs, currentStep, progression, done }: ProgressBarProps) {
  const total = acteurs.length;
  const acteurCourant = acteurs[currentStep];

  return (
    <div className={styles.card}>
      <div className={styles.bg} />
      <div className={styles.in}>
        <div className={styles.lbl}>Suivi de la commande</div>

        <div className={styles.stepTxt}>
          {done
            ? '✅ Commande livrée et validée par tous les acteurs'
            : <>Étape {currentStep + 1}/{total} — En attente de validation{' '}
                <em>{ROLE_LABEL[acteurCourant?.role] ?? ''}</em></>}
        </div>

        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${done ? 100 : progression}%` }} />
        </div>
        <div className={styles.pct}>
          <span>Payée</span>
          <span>{done ? 100 : progression} %</span>
          <span>Livrée</span>
        </div>
      </div>
    </div>
  );
}