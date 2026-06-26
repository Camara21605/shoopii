/* ================================================================
 * FICHIER : src/modules/commande/sections/ValidationChain.tsx
 * La chaîne de validation : un ActeurStep par acteur.
 * ================================================================ */

import styles from '../styles/ValidationChain.module.css';
import ActeurStep from '../components/ActeurStep';
import type { Commande, ActeurRole, EtapeStatut } from '../data/types';

interface Props {
  commande:    Commande;
  statuts:     EtapeStatut[];
  times:       string[];
  currentRole: ActeurRole;
  showDemoCodes?: boolean;       // affiche les codes (démo) ; false en prod
  onValidate:  (idx: number, code: string) => Promise<boolean>;
}

export default function ValidationChain({
  commande, statuts, times, currentRole, showDemoCodes, onValidate,
}: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <div className={styles.chT}><i className="fas fa-shield-check" /> Chaîne de validation</div>
        <span className={styles.badge}>Codes sécurisés</span>
      </div>
      <div className={styles.cb}>
        <div className={styles.chain}>
          {commande.acteurs.map((acteur, i) => (
            <ActeurStep
              key={acteur.role}
              acteur={acteur}
              statut={statuts[i]}
              currentRole={currentRole}
              valideA={times[i]}
              codeDemo={showDemoCodes ? commande.codes[acteur.role] : undefined}
              onValidate={(code) => onValidate(i, code)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}