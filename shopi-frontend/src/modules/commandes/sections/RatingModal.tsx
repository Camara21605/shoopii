/* ================================================================
 * FICHIER : src/modules/commande/sections/RatingModal.tsx
 *
 * Modale de notation des acteurs (étoiles) + pourboire livreur.
 * S'affiche après la validation finale du client.
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/RatingModal.module.css';
import type { Acteur, ActeurRole } from '../data/types';

interface Props {
  acteurs:     Acteur[];               // on note tous sauf le client lui-même
  pourboire:   number | null;
  onSetPourboire: (v: number) => void;
  onNoter:     (role: ActeurRole, note: number, commentaire?: string) => void;
  onSubmit:    () => void;
  onSkip:      () => void;
}

const RATE_LABELS = ['', 'Très insatisfait', 'Insatisfait', 'Correct', 'Satisfait', 'Excellent !'];
const TIPS = [5000, 10000, 20000, 0];

export default function RatingModal({
  acteurs, pourboire, onSetPourboire, onNoter, onSubmit, onSkip,
}: Props) {
  /* note + survol + commentaire par acteur */
  const [notes, setNotes]       = useState<Record<string, number>>({});
  const [hover, setHover]       = useState<Record<string, number | null>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  /* on note tous les acteurs participant SAUF le client (qui note) */
  const aNoter = acteurs.filter(a => a.role !== 'client');

  function setStar(role: ActeurRole, v: number) {
    setNotes(p => ({ ...p, [role]: v }));
    onNoter(role, v, comments[role]);
  }

  function send() {
    /* propage les commentaires définitifs */
    Object.entries(notes).forEach(([role, v]) =>
      onNoter(role as ActeurRole, v, comments[role]));
    onSubmit();
  }

  return (
    <div className={styles.backdrop} onClick={e => { if (e.target === e.currentTarget) onSkip(); }}>
      <div className={styles.modal}>

        <div className={styles.hero}>
          <div className={styles.heroBg} />
          <div className={styles.heroIn}>
            <div className={styles.heroIc}><i className="fas fa-star" /></div>
            <div className={styles.heroT}>Comment s'est passée la livraison ?</div>
            <div className={styles.heroS}>Votre avis aide les acteurs à s'améliorer et guide les autres clients.</div>
          </div>
        </div>

        <div className={styles.body}>
          {aNoter.map(a => {
            /* null = pas de survol → affiche la note enregistrée */
            const display = hover[a.role] != null ? hover[a.role]! : (notes[a.role] ?? 0);
            return (
              <div key={a.role} className={styles.actor}>
                <div className={styles.actorTop}>
                  <div className={`${styles.av} ${styles['av_' + a.role]}`}>{a.initiales}</div>
                  <div>
                    <div className={styles.nm}>{a.nom}</div>
                    <div className={styles.rl}>{a.sousTitre}</div>
                  </div>
                </div>

                {/* Étoiles — sur leur propre ligne pour éviter le débordement */}
                <div style={{ marginTop:12 }}>
                  <div
                    className={styles.stars}
                    onMouseLeave={() => setHover(p => ({ ...p, [a.role]: null }))}
                  >
                    {[1, 2, 3, 4, 5].map(v => (
                      <span key={v}
                        className={`${styles.star} ${v <= display ? styles.on : ''}`}
                        onMouseEnter={() => setHover(p => ({ ...p, [a.role]: v }))}
                        onClick={() => setStar(a.role, v)}
                      >★</span>
                    ))}
                  </div>

                  {/* Label — hauteur fixe pour ne pas faire sauter la mise en page */}
                  <div className={styles.note}>
                    {display > 0 ? RATE_LABELS[display] : ' '}
                  </div>
                </div>

                {notes[a.role] > 0 && (
                  <textarea className={styles.cmt} rows={2}
                    placeholder="Un commentaire ? (optionnel)"
                    value={comments[a.role] ?? ''}
                    onChange={e => setComments(p => ({ ...p, [a.role]: e.target.value }))} />
                )}

                {/* Pourboire — uniquement sous le livreur */}
                {a.role === 'livreur' && (
                  <div className={styles.tipBox}>
                    <div className={styles.tipT}><i className="fas fa-hand-holding-heart" /> Laisser un pourboire ?</div>
                    <div className={styles.tipS}>100 % reversé au livreur via Mobile Money. Geste optionnel.</div>
                    <div className={styles.tipChips}>
                      {TIPS.map(t => (
                        <button key={t}
                          className={`${styles.tipChip} ${pourboire === t ? styles.tipOn : ''}`}
                          onClick={() => onSetPourboire(t)}>
                          {t === 0 ? 'Aucun' : t.toLocaleString('fr-FR')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className={styles.foot}>
          <button className={styles.skip} onClick={onSkip}>Plus tard</button>
          <button className={styles.send} onClick={send}><i className="fas fa-paper-plane" /> Envoyer mes avis</button>
        </div>
      </div>
    </div>
  );
}