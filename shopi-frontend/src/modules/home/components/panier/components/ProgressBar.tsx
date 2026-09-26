/*
 * ProgressBar.tsx — Étapes de la commande (Panier → Livraison → Confirmation)
 *
 * L'état de chaque étape reflète le formulaire RÉEL : la barre avance quand
 * l'adresse et le mode de livraison sont complets, puis quand la commande est
 * prête à être envoyée (conditions acceptées). Avant, elle restait figée sur
 * « Livraison » quoi que fasse le client.
 */
import { useTranslation } from 'react-i18next';
import { useCart } from '../../../../../shared/context/CartContext';
import styles from '../styles/ProgressBar.module.css';

interface Props {
  /** Adresse complète + mode de livraison valide (livreur choisi si besoin). */
  livraisonOk?: boolean;
  /** Tout est prêt : conditions acceptées. */
  pret?:        boolean;
}

type State = 'done' | 'active' | 'idle';

export default function ProgressBar({ livraisonOk = false, pret = false }: Props) {
  const { t } = useTranslation();
  const { count } = useCart();
  const k = (key: string) => `panierCommande.v2.etapes.${key}`;

  const steps: { label: string; sub: string; state: State }[] = [
    {
      label: t(k('panier')),
      sub:   count > 0 ? t('panierCommande.progressBar.articleCount', { count }) : t('panierCommande.progressBar.vide'),
      state: count > 0 ? 'done' : 'active',
    },
    {
      label: t(k('livraison')),
      sub:   livraisonOk ? t(k('adresseMode')) : t(k('aCompleter')),
      state: livraisonOk ? 'done' : count > 0 ? 'active' : 'idle',
    },
    {
      label: t(k('confirmation')),
      sub:   pret ? t(k('prete')) : t(k('aVerifier')),
      state: livraisonOk ? (pret ? 'done' : 'active') : 'idle',
    },
  ];

  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        {steps.map((s, i) => (
          <div key={i} className={`${styles.step} ${styles[s.state]}`} aria-current={s.state === 'active' ? 'step' : undefined}>
            <div className={[
              styles.sn,
              s.state === 'done'   ? styles.snDone   : '',
              s.state === 'active' ? styles.snActive : '',
            ].filter(Boolean).join(' ')}>
              {s.state === 'done' ? <i className="fas fa-check" style={{ fontSize: 10 }} /> : i + 1}
            </div>
            <div>
              <div className={styles.sl}>{s.label}</div>
              <div className={styles.ss}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
