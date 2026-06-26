import { useNavigate } from 'react-router-dom';
import type { PromoPublic } from '../pages/BoutiquePage';
import styles from '../styles/PromotionsSection.module.css';

interface Props {
  promos:    PromoPublic[];
  loading:   boolean;
  companyId: string;
  onToast:   (m: string) => void;
}

/* ── Helpers ── */
const TYPE_CONFIG: Record<string, { emoji: string; tag: string; color: string }> = {
  discount:  { emoji: '🏷️',  tag: 'Réduction',       color: '#3B72F0' },
  'free-ship':{ emoji: '🚚', tag: 'Livraison offerte', color: '#059669' },
  bundle:    { emoji: '🎁',  tag: 'Bundle',            color: '#7C3AED' },
  flash:     { emoji: '⚡',  tag: 'Vente flash',       color: '#DC2626' },
};

function formatValeur(p: PromoPublic): string {
  if (p.type === 'free-ship') return 'Offerte';
  if (p.valueType === 'percent' && p.valeur) return `−${p.valeur}%`;
  if (p.valueType === 'fixed'   && p.valeur) return `−${p.valeur.toLocaleString('fr-FR')} GNF`;
  if (p.type === 'bundle') return 'Bundle';
  return '—';
}

function formatSous(p: PromoPublic): string {
  const parts: string[] = [];
  if (p.montantMinimum) parts.push(`Dès ${p.montantMinimum.toLocaleString('fr-FR')} GNF`);
  if (p.endDate)        parts.push(`Jusqu'au ${p.endDate}`);
  if (p.flashStock)     parts.push(`${p.flashStock} restants`);
  if (p.maxUtilisations && p.usesCount) {
    const restants = p.maxUtilisations - p.usesCount;
    if (restants > 0) parts.push(`${restants} utilisations restantes`);
  }
  return parts.join(' · ') || p.nom;
}

function PromoCard({ p, onToast }: { p: PromoPublic; onToast: (m: string) => void }) {
  const cfg    = TYPE_CONFIG[p.type] ?? TYPE_CONFIG.discount;
  const valeur = formatValeur(p);
  const sous   = formatSous(p);
  const isFlash = p.type === 'flash';

  return (
    <div
      className={styles.card}
      style={{ borderColor: `${cfg.color}33` }}
      onClick={() => onToast(`🏷️ Code promo : ${p.code}`)}
    >
      {/* Fond radial */}
      <div className={styles.cardBg} style={{
        background: `radial-gradient(ellipse 60% 70% at 80% 25%, ${cfg.color}44, transparent 55%)`,
      }} />

      {/* Emoji décoratif */}
      <div className={styles.cardEm}>{cfg.emoji}</div>

      {/* Contenu */}
      <div className={styles.cardContent}>

        {/* Badge type */}
        <div className={styles.tag} style={{ background: cfg.color }}>
          {isFlash && <i className="fas fa-bolt" style={{ fontSize:9 }} />} {cfg.tag}
        </div>

        {/* Valeur principale */}
        <div className={styles.pct}>{valeur}</div>

        {/* Nom + sous-titre */}
        <div className={styles.titre}>{p.nom}</div>
        <div className={styles.sub}>{sous}</div>

        {/* Code promo */}
        <div style={{
          display:'inline-flex', alignItems:'center', gap:8,
          background:'rgba(255,255,255,.12)', borderRadius:8,
          padding:'6px 12px', marginTop:4, width:'fit-content',
        }}>
          <i className="fas fa-tag" style={{ color:'rgba(200,217,248,.7)', fontSize:10 }} />
          <span style={{ fontFamily:'monospace', fontWeight:800, color:'#fff', fontSize:13, letterSpacing:1 }}>
            {p.code}
          </span>
        </div>

        {/* Bouton */}
        <button
          className={styles.btn}
          onClick={e => { e.stopPropagation(); onToast(`✅ Code copié : ${p.code}`); }}
        >
          Copier le code <i className="fas fa-copy" />
        </button>
      </div>
    </div>
  );
}

export default function PromotionsSection({ promos, loading, onToast }: Props) {

  if (loading) return (
    <div style={{ padding:'48px 0', textAlign:'center', color:'var(--t3)' }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize:24, display:'block', marginBottom:10 }} />
      Chargement des promotions…
    </div>
  );

  if (promos.length === 0) return (
    <div style={{ padding:'48px 20px', textAlign:'center', color:'var(--t3)' }}>
      <i className="fas fa-tag" style={{ fontSize:36, display:'block', marginBottom:14, color:'var(--t4)' }} />
      <div style={{ fontWeight:700, fontSize:15, color:'var(--navy)', marginBottom:6 }}>
        Aucune promotion active
      </div>
      <div style={{ fontSize:12, lineHeight:1.6 }}>
        Cette boutique n'a pas de promotion en cours pour le moment.
      </div>
    </div>
  );

  return (
    <div>
      <div style={{
        fontSize:12, color:'var(--t3)', marginBottom:14,
        display:'flex', alignItems:'center', gap:6,
      }}>
        <i className="fas fa-tag" style={{ color:'var(--blue)' }} />
        {promos.length} promotion{promos.length > 1 ? 's' : ''} active{promos.length > 1 ? 's' : ''}
      </div>
      <div className={styles.grid}>
        {promos.map(p => (
          <PromoCard key={p.id} p={p} onToast={onToast} />
        ))}
      </div>
    </div>
  );
}
