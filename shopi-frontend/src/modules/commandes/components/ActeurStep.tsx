/* ================================================================
 * FICHIER : src/modules/commande/components/ActeurStep.tsx
 *
 * Une étape de la chaîne de validation (un acteur).
 *
 * Logique "page unique adaptée au rôle" :
 *  - editable = (statut === 'now') ET (acteur.role === currentRole)
 *    → seul l'acteur concerné, quand c'est son tour, voit le champ
 *      de code actif et peut valider.
 *  - les autres voient l'étape en lecture seule (attente / validé).
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/ActeurStep.module.css';
import CodeInput from './CodeInput';
import type { Acteur, ActeurRole, EtapeStatut } from '../data/types';

interface ActeurStepProps {
  acteur:      Acteur;
  statut:      EtapeStatut;          // wait | now | done
  currentRole: ActeurRole;           // rôle de l'utilisateur courant
  valideA?:    string;               // heure de validation
  codeDemo?:   string;               // code affiché en démo (sinon masqué)
  onValidate:  (code: string) => Promise<boolean>;
}

const ROLE_LABEL: Record<ActeurRole, string> = {
  entreprise: 'Entreprise', livreur: 'Livreur',
  correspondant: 'Correspondant', client: 'Client',
};

/* libellé du bouton selon le rôle */
const BTN_LABEL: Record<ActeurRole, string> = {
  entreprise:    'Valider & préparer le colis',
  livreur:       'Confirmer la prise du colis',
  correspondant: 'Confirmer la réception au relais',
  client:        'Confirmer la réception du colis',
};

export default function ActeurStep({
  acteur, statut, currentRole, valideA, codeDemo, onValidate,
}: ActeurStepProps) {
  const [error, setError]   = useState(false);
  const [code, setCode]     = useState('');
  const [busy, setBusy]     = useState(false);

  /* Cet acteur peut-il saisir son code maintenant ? */
  const editable = statut === 'now' && acteur.role === currentRole;
  /* C'est le tour de cet acteur mais ce n'est pas l'utilisateur courant */
  const waitingOther = statut === 'now' && acteur.role !== currentRole;

  async function submit() {
    if (code.length < 6) { setError(true); setTimeout(() => setError(false), 400); return; }
    setBusy(true);
    const ok = await onValidate(code);
    setBusy(false);
    if (!ok) { setError(true); setTimeout(() => setError(false), 400); setCode(''); }
  }

  return (
    <div className={`${styles.step} ${styles[statut]}`}>
      {/* Pastille / icône */}
      <div className={styles.node}>
        <i className={`fas ${statut === 'done' ? 'fa-check' : acteur.icone}`} />
      </div>

      <div className={styles.body}>
        <div className={styles.top}>
          <span className={`${styles.role} ${styles['role_' + acteur.role]}`}>
            {ROLE_LABEL[acteur.role]}
          </span>
          {statut === 'done' && (
            <span className={`${styles.state} ${styles.ok}`}>Validé {valideA}</span>
          )}
          {statut === 'now' && (
            <span className={`${styles.state} ${styles.now}`}>À valider</span>
          )}
          {statut === 'wait' && (
            <span className={`${styles.state} ${styles.wait}`}>En attente</span>
          )}
        </div>

        <div className={styles.nm}>{acteur.nom}</div>
        <div className={styles.desc}>{acteur.action}</div>

        {/* Zone de saisie — seulement si c'est l'acteur courant et son tour */}
        {editable && (
          <div className={styles.codeZone}>
            {codeDemo && (
              <div className={styles.hint}>
                <i className="fas fa-key" /> Code (démo) →{' '}
                <span className={styles.demo}>{codeDemo}</span>
              </div>
            )}
            <CodeInput error={error} onChange={setCode} onComplete={setCode} />
            <button className={styles.btn} onClick={submit} disabled={busy}>
              <i className="fas fa-check" /> {BTN_LABEL[acteur.role]}
            </button>
          </div>
        )}

        {/* C'est son tour mais ce n'est pas vous → message d'attente */}
        {waitingOther && (
          <div className={styles.waitMsg}>
            <i className="fas fa-hourglass-half" />{' '}
            En attente de la validation de {ROLE_LABEL[acteur.role].toLowerCase()}…
          </div>
        )}
      </div>
    </div>
  );
}