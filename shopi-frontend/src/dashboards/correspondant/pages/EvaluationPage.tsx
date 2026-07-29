// pages/EvaluationPage.tsx
import { useState, useEffect } from 'react';
import sh from '../styles/Shared.module.css';
import { apiFetch } from '@/shared/services/apiFetch';

interface EvaluationData { averageRating: number; totalMissions: number }

export default function EvaluationPage() {
  const [data, setData]       = useState<EvaluationData>({ averageRating: 0, totalMissions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<EvaluationData>('/dashboard/correspondant/evaluation')
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fullStars = Math.round(data.averageRating);

  return (
    <div className={sh.page}>
      <div className={sh.g2} style={{ marginBottom:0 }}>
        <div className={sh.card} style={{ marginBottom:0 }}>
          <div className={sh.ch}><div className={sh.chT}><i className="fas fa-star" /> Mon évaluation</div></div>
          <div className={sh.cb}>
            {loading ? (
              <div style={{ textAlign:'center', padding:24, color:'var(--t3)' }}>Chargement…</div>
            ) : (
              <div style={{ textAlign:'center', padding:'14px 0 20px' }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:52, fontWeight:800, color:'var(--navy)', letterSpacing:'-3px', lineHeight:1 }}>
                  {data.averageRating.toFixed(1)}
                </div>
                <div style={{ fontSize:18, color:'var(--t1)', margin:'5px 0 4px', letterSpacing:'-1px' }}>
                  {'★'.repeat(fullStars)}{'☆'.repeat(5 - fullStars)}
                </div>
                <div style={{ fontSize:12, color:'var(--t3)' }}>
                  {data.totalMissions} mission{data.totalMissions > 1 ? 's' : ''} au total
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={sh.card} style={{ marginBottom:0 }}>
          <div className={sh.ch}><div className={sh.chT}><i className="fas fa-comment" /> Avis reçus</div></div>
          <div className={sh.cb}>
            <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--t3)' }}>
              <i className="fas fa-comment-slash" style={{ fontSize:28, opacity:.4, marginBottom:10, display:'block' }} />
              Avis clients détaillés — bientôt disponible.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
