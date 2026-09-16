// pages/EvaluationPage.tsx
import { useState, useEffect } from 'react';
import sh from '../styles/Shared.module.css';
import { apiFetch } from '@/shared/services/apiFetch';
import { fetchCorrespondantAvis, repondreCorrespondantAvis } from '../services/avis.api';
import type { CorrespondantAvisApi, CorrespondantAvisStatsApi } from '../services/avis.api';

interface EvaluationData { averageRating: number; totalMissions: number }

function initiales(nom: string): string {
  return nom.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

export default function EvaluationPage() {
  const [data, setData]       = useState<EvaluationData>({ averageRating: 0, totalMissions: 0 });
  const [loading, setLoading] = useState(true);

  const [avis,        setAvis]        = useState<CorrespondantAvisApi[]>([]);
  const [stats,       setStats]       = useState<CorrespondantAvisStatsApi | null>(null);
  const [avisLoading, setAvisLoading] = useState(true);

  const [replyBoxId,  setReplyBoxId]  = useState<string | null>(null);
  const [replyText,   setReplyText]   = useState('');
  const [replySaving, setReplySaving] = useState(false);

  useEffect(() => {
    apiFetch<EvaluationData>('/dashboard/correspondant/evaluation')
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetchCorrespondantAvis()
      .then(res => { setAvis(res.avis); setStats(res.stats); })
      .catch(() => {})
      .finally(() => setAvisLoading(false));
  }, []);

  async function handleSendReply(avisId: string) {
    if (!replyText.trim()) return;
    setReplySaving(true);
    try {
      await repondreCorrespondantAvis(avisId, replyText.trim());
      setAvis(prev => prev.map(a => a.id === avisId ? { ...a, reponse: replyText.trim() } : a));
    } catch { /* silencieux — pas de toast global disponible sur cette page */ }
    finally {
      setReplySaving(false);
      setReplyBoxId(null);
      setReplyText('');
    }
  }

  const fullStars = Math.round(data.averageRating);
  const total     = stats?.total ?? avis.length;

  return (
    <div className={sh.page}>
      <div className={sh.g2} style={{ marginBottom:0 }}>
        <div className={sh.card} style={{ marginBottom:0 }}>
          <div className={sh.ch}><div className={sh.chT}><i className="fas fa-star" /> Mon évaluation</div></div>
          <div className={sh.cb}>
            {loading ? (
              <div style={{ textAlign:'center', padding:24, color:'var(--t3)' }}>Chargement…</div>
            ) : (
              <>
                <div style={{ textAlign:'center', padding:'14px 0 20px' }}>
                  <div style={{ fontFamily:'var(--fd)', fontSize:52, fontWeight:800, color:'var(--navy)', letterSpacing:'-3px', lineHeight:1 }}>
                    {data.averageRating.toFixed(1)}
                  </div>
                  <div style={{ fontSize:18, color:'var(--amber)', margin:'5px 0 4px', letterSpacing:'-1px' }}>
                    {'★'.repeat(fullStars)}{'☆'.repeat(5 - fullStars)}
                  </div>
                  <div style={{ fontSize:12, color:'var(--t3)' }}>
                    {data.totalMissions} mission{data.totalMissions > 1 ? 's' : ''} au total
                  </div>
                </div>

                {!avisLoading && total > 0 && [5, 4, 3, 2, 1].map(s => {
                  const p = stats?.distribution?.[String(s)] ?? 0;
                  return (
                    <div key={s} style={{ display:'flex', alignItems:'center', gap:9, fontSize:12, marginBottom:7 }}>
                      <span style={{ minWidth:18 }}>{s}★</span>
                      <div style={{ flex:1, height:6, background:'var(--g200)', borderRadius:'var(--pill)', overflow:'hidden' }}>
                        <div style={{ width:`${p}%`, height:'100%', background:'var(--amber)', borderRadius:'var(--pill)' }} />
                      </div>
                      <span style={{ minWidth:24, textAlign:'right', fontSize:10, color:'var(--t3)' }}>{p}%</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        <div className={sh.card} style={{ marginBottom:0 }}>
          <div className={sh.ch}><div className={sh.chT}><i className="fas fa-comment" /> Avis reçus</div></div>
          <div className={sh.cb}>
            {avisLoading && (
              <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--t3)' }}>Chargement…</div>
            )}

            {!avisLoading && avis.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--t3)' }}>
                <i className="fas fa-comment-slash" style={{ fontSize:28, opacity:.4, marginBottom:10, display:'block' }} />
                Vous n'avez reçu aucun avis pour le moment.
              </div>
            )}

            {!avisLoading && avis.map((a, i) => (
              <div key={a.id} style={{ paddingBottom:14, borderBottom: i < avis.length - 1 ? '1px solid var(--bdr)' : 'none', paddingTop: i > 0 ? 14 : 0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:7 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--g100)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--fd)', fontSize:14, fontWeight:700, color:'var(--navy)', flexShrink:0 }}>
                    {a.clientInitiales ?? initiales(a.clientNom)}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)' }}>{a.clientNom}</div>
                    <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{a.commandeRef} · {a.date}</div>
                  </div>
                  <div style={{ color:'var(--amber)', fontSize:12, marginLeft:'auto', letterSpacing:-1 }}>
                    {'★'.repeat(a.note)}{'☆'.repeat(5 - a.note)}
                  </div>
                </div>

                {a.commentaire && (
                  <div style={{ fontSize:12, color:'var(--t2)', lineHeight:1.6, background:'var(--g50)', borderRadius:'var(--r-md)', padding:'9px 12px', marginBottom:7 }}>
                    "{a.commentaire}"
                  </div>
                )}

                {a.reponse && replyBoxId !== a.id && (
                  <div style={{ padding:'9px 12px', background:'var(--g100)', border:'1px solid var(--bdr2)', borderRadius:'var(--r-md)', marginBottom:7 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--t2)', marginBottom:3 }}>
                      <i className="fas fa-map-pin" /> Votre réponse
                    </div>
                    <div style={{ fontSize:11.5, color:'var(--t2)', lineHeight:1.55 }}>{a.reponse}</div>
                  </div>
                )}

                {replyBoxId === a.id ? (
                  <div>
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Répondre à cet avis…"
                      rows={2}
                      style={{
                        width:'100%', border:'1.5px solid var(--bdr2)', borderRadius:'var(--r-md)',
                        padding:'9px 11px', fontSize:12, color:'var(--navy)', resize:'vertical',
                        outline:'none', fontFamily:'inherit', boxSizing:'border-box',
                      }}
                    />
                    <div style={{ display:'flex', gap:7, marginTop:6 }}>
                      <button disabled={replySaving} onClick={() => handleSendReply(a.id)} style={{
                        background:'var(--navy)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                        padding:'6px 14px', fontSize:11.5, fontWeight:700, cursor:'pointer', opacity: replySaving ? .6 : 1,
                      }}>
                        {replySaving ? <><i className="fas fa-spinner fa-spin" /> Envoi…</> : 'Publier'}
                      </button>
                      <button onClick={() => { setReplyBoxId(null); setReplyText(''); }} style={{
                        background:'var(--white)', color:'var(--t2)', border:'1px solid var(--bdr2)',
                        borderRadius:'var(--pill)', padding:'6px 12px', fontSize:11.5, fontWeight:600, cursor:'pointer',
                      }}>
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  !a.reponse ? (
                    <button onClick={() => { setReplyBoxId(a.id); setReplyText(''); }} style={{
                      background:'var(--g100)', color:'var(--navy)', border:'1px solid var(--bdr2)',
                      borderRadius:'var(--pill)', padding:'6px 13px', fontSize:11.5, fontWeight:700, cursor:'pointer',
                    }}>
                      <i className="fas fa-reply" /> Répondre
                    </button>
                  ) : (
                    <button onClick={() => { setReplyBoxId(a.id); setReplyText(a.reponse ?? ''); }} style={{
                      background:'none', color:'var(--t3)', border:'none',
                      padding:0, fontSize:11, fontWeight:600, cursor:'pointer',
                    }}>
                      <i className="fas fa-pen" /> Modifier la réponse
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
