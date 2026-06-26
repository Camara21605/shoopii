import styles from '../styles/ProfilClient.module.css';
import type { Avis, AvisScore } from '../data/profilClientData';

interface Props {
  avis:     Avis[];
  score:    AvisScore;
  onToast:  (m: string) => void;
}

/* Étoiles dynamiques selon la note */
function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span>
      {[1,2,3,4,5].map(v => (
        <span key={v} style={{ color: v <= Math.round(n) ? '#F59E0B' : '#D1D5DB', fontSize: size }}>★</span>
      ))}
    </span>
  );
}

export default function SectionReviews({ avis, score, onToast }: Props) {
  const hasAvis = avis.length > 0 || score.total > 0;

  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <div className={styles.ct}>
          <i className="fas fa-star" /> Mes avis clients
          {score.total > 0 && (
            <span style={{ marginLeft:6, fontWeight:400, color:'var(--t3)', fontSize:12 }}>
              ({score.total})
            </span>
          )}
        </div>
      </div>

      {/* ── Pas encore d'avis ── */}
      {!hasAvis && (
        <div style={{ padding:'36px 0', textAlign:'center', color:'var(--t3)' }}>
          <i className="fas fa-star" style={{ fontSize:32, display:'block', marginBottom:12, color:'var(--t4)' }} />
          <div style={{ fontWeight:700, fontSize:13.5, color:'var(--navy)', marginBottom:6 }}>
            Aucun avis pour l'instant
          </div>
          <div style={{ fontSize:12, lineHeight:1.6, maxWidth:300, margin:'0 auto' }}>
            Vos avis sur les boutiques apparaîtront ici après la livraison de vos commandes.
          </div>
        </div>
      )}

      {/* ── Score global + répartition (si avis disponibles) ── */}
      {hasAvis && (
        <>
          <div className={styles.scoreBox}>
            <div className={styles.scoreLeft}>
              <div className={styles.scoreNum}>{score.moyenne.toFixed(1)}</div>
              <div style={{ margin:'4px 0' }}>
                <Stars n={score.moyenne} size={16} />
              </div>
              <div className={styles.scoreTotal}>{score.total} avis</div>
            </div>
            <div className={styles.scoreBars}>
              {score.repartition.map(r => (
                <div key={r.etoiles} className={styles.scoreBarRow}>
                  <span style={{ color:'#F59E0B', fontSize:11, width:20, flexShrink:0 }}>
                    {r.etoiles}★
                  </span>
                  <div className={styles.scoreBarTrack}>
                    <div className={styles.scoreBarFill} style={{ width:`${r.pct}%` }} />
                  </div>
                  <span style={{ fontSize:11, color:'var(--t3)', width:20, textAlign:'right', flexShrink:0 }}>
                    {r.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Liste des avis ── */}
          <div>
            {avis.map(a => (
              <div key={a.id} className={styles.rev}>
                <div className={styles.revTop}>
                  <div className={styles.revImg}>{a.emoji}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className={styles.revNm}>{a.produit}</div>
                    <div style={{ margin:'2px 0' }}>
                      <Stars n={a.note} size={12} />
                    </div>
                    <div className={styles.revShop}>
                      {a.boutique} {a.international && '🌍'}
                    </div>
                  </div>
                  <div className={styles.revBadge}>
                    <span className={a.statut === 'verifie' ? styles.revVerif : styles.revAttente}>
                      {a.statut === 'verifie' ? 'Achat vérifié' : 'En attente'}
                    </span>
                  </div>
                </div>
                <div className={styles.revTxt}>{a.texte}</div>
                <div className={styles.revFooter}>
                  <span>{a.date}</span>
                  <span>·</span>
                  <div className={styles.revLike} onClick={() => onToast('👍 Merci')}>
                    <i className="fas fa-thumbs-up" /> {a.utile} utile
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Note d'information backend */}
      <div style={{
        margin:'12px 0 0', padding:'10px 14px',
        background:'var(--sky)', borderRadius:'var(--r-md)',
        fontSize:11, color:'var(--t3)', display:'flex', gap:8, alignItems:'flex-start',
      }}>
        <i className="fas fa-info-circle" style={{ color:'var(--blue)', marginTop:1 }} />
        <span>
          Les avis sont enregistrés après validation de la livraison (notation des acteurs).
          L'historique complet sera disponible une fois l'endpoint <code>/client/avis</code> activé côté serveur.
        </span>
      </div>
    </div>
  );
}
