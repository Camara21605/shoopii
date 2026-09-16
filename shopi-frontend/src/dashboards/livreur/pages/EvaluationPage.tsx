// src/dashboards/livreur/pages/EvaluationPage.tsx
import { useState, useEffect } from 'react';
import { fetchLivreurAvis, repondreLivreurAvis } from '../services/avis.api';
import type { LivreurAvisApi, LivreurAvisStatsApi } from '../services/avis.api';
import shared from '../styles/Shared.module.css';

interface Props { onPop: (m: string, t?: string) => void; }

/* ── Initiales depuis le nom (repli si clientInitiales absent) ── */
function initiales(nom: string): string {
  return nom.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

export default function EvaluationPage({ onPop }: Props) {
  const [avis,    setAvis]    = useState<LivreurAvisApi[]>([]);
  const [stats,   setStats]   = useState<LivreurAvisStatsApi | null>(null);
  const [loading, setLoading] = useState(true);

  const [replyBoxId,  setReplyBoxId]  = useState<string | null>(null);
  const [replyText,   setReplyText]   = useState('');
  const [replySaving, setReplySaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchLivreurAvis()
      .then(res => { setAvis(res.avis); setStats(res.stats); })
      .catch(() => onPop('Impossible de charger vos avis.', 'e'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSendReply(avisId: string) {
    if (!replyText.trim()) return;
    setReplySaving(true);
    try {
      await repondreLivreurAvis(avisId, replyText.trim());
      setAvis(prev => prev.map(a => a.id === avisId ? { ...a, reponse: replyText.trim() } : a));
      onPop('Réponse publiée', 's');
    } catch {
      onPop('Impossible d\'envoyer la réponse.', 'e');
    } finally {
      setReplySaving(false);
      setReplyBoxId(null);
      setReplyText('');
    }
  }

  const moyenne = stats?.moyenne ?? 0;
  const total   = stats?.total   ?? avis.length;
  const satisfaction = total > 0
    ? Math.round(((stats?.distribution?.['4'] ?? 0) + (stats?.distribution?.['5'] ?? 0)))
    : 0;

  return (
    <div className={shared.page}>
      <div className={shared.g2}>

        {/* ── Score global + distribution (réel) ── */}
        <div className={`${shared.card} ${shared.cardLast}`}>
          <div className={shared.ch}><div className={shared.chT}><i className="fas fa-star" /> Mon évaluation</div></div>
          <div className={shared.cb}>
            <div style={{ textAlign: 'center', padding: '14px 0 18px' }}>
              <div style={{ fontFamily: 'var(--fd)', fontSize: 52, fontWeight: 800, color: 'var(--navy)', letterSpacing: -3, lineHeight: 1 }}>
                {loading ? '…' : moyenne.toFixed(1)}
              </div>
              <div style={{ fontSize: 18, color: 'var(--amber)', margin: '5px 0 4px', letterSpacing: -1 }}>
                {'★'.repeat(Math.round(moyenne))}{'☆'.repeat(5 - Math.round(moyenne))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                {loading ? '…' : `${total} avis${total > 0 ? ` · ${satisfaction}% satisfaction` : ''}`}
              </div>
            </div>

            {[5, 4, 3, 2, 1].map(s => {
              const p = stats?.distribution?.[String(s)] ?? 0;
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, marginBottom: 7 }}>
                  <span style={{ minWidth: 18 }}>{s}★</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--g200)', borderRadius: 'var(--pill)', overflow: 'hidden' }}>
                    <div style={{ width: `${p}%`, height: '100%', background: 'var(--amber)', borderRadius: 'var(--pill)' }} />
                  </div>
                  <span style={{ minWidth: 24, textAlign: 'right', fontSize: 10, color: 'var(--t3)' }}>{p}%</span>
                </div>
              );
            })}

            {!loading && total === 0 && (
              <div style={{ textAlign: 'center', padding: '18px 0 4px', color: 'var(--t3)', fontSize: 12.5 }}>
                Aucun avis pour l'instant — il apparaîtra ici dès qu'un client note l'une de vos livraisons.
              </div>
            )}
          </div>
        </div>

        {/* ── Liste des avis (réels) ── */}
        <div className={`${shared.card} ${shared.cardLast}`}>
          <div className={shared.ch}><div className={shared.chT}><i className="fas fa-comment" /> Avis des clients</div></div>
          <div className={shared.cb}>
            {loading && (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--t3)' }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: 20, display: 'block', marginBottom: 8 }} />
                Chargement…
              </div>
            )}

            {!loading && avis.length === 0 && (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--t3)', fontSize: 12.5 }}>
                Vous n'avez reçu aucun avis pour le moment.
              </div>
            )}

            {!loading && avis.map((a, i) => (
              <div key={a.id} style={{ paddingBottom: 14, borderBottom: i < avis.length - 1 ? '1px solid var(--bdr)' : 'none', paddingTop: i > 0 ? 14 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--g100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fd)', fontSize: 14, fontWeight: 700, color: 'var(--navy)', flexShrink: 0 }}>
                    {a.clientInitiales ?? initiales(a.clientNom)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{a.clientNom}</div>
                    <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 1 }}>{a.commandeRef} · {a.date}</div>
                  </div>
                  <div style={{ color: 'var(--amber)', fontSize: 12, marginLeft: 'auto', letterSpacing: -1 }}>
                    {'★'.repeat(a.note)}{'☆'.repeat(5 - a.note)}
                  </div>
                </div>

                {a.commentaire && (
                  <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6, background: 'var(--g50)', borderRadius: 'var(--r-md)', padding: '9px 12px', marginBottom: 7 }}>
                    "{a.commentaire}"
                  </div>
                )}

                {a.reponse && replyBoxId !== a.id && (
                  <div style={{ padding: '9px 12px', background: 'var(--g100)', border: '1px solid var(--bdr2)', borderRadius: 'var(--r-md)', marginBottom: 7 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t2)', marginBottom: 3 }}>
                      <i className="fas fa-motorcycle" /> Votre réponse
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--t2)', lineHeight: 1.55 }}>{a.reponse}</div>
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
                        width: '100%', border: '1.5px solid var(--bdrb)', borderRadius: 'var(--r-md)',
                        padding: '9px 11px', fontSize: 12, color: 'var(--navy)', resize: 'vertical',
                        outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 7, marginTop: 6 }}>
                      <button disabled={replySaving} onClick={() => handleSendReply(a.id)} style={{
                        background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 'var(--pill)',
                        padding: '6px 14px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', opacity: replySaving ? .6 : 1,
                      }}>
                        {replySaving ? <><i className="fas fa-spinner fa-spin" /> Envoi…</> : 'Publier'}
                      </button>
                      <button onClick={() => { setReplyBoxId(null); setReplyText(''); }} style={{
                        background: 'var(--white)', color: 'var(--t2)', border: '1px solid var(--bdr2)',
                        borderRadius: 'var(--pill)', padding: '6px 12px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                      }}>
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  !a.reponse ? (
                    <button onClick={() => { setReplyBoxId(a.id); setReplyText(''); }} style={{
                      background: 'var(--g100)', color: 'var(--navy)', border: '1px solid var(--bdr2)',
                      borderRadius: 'var(--pill)', padding: '6px 13px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    }}>
                      <i className="fas fa-reply" /> Répondre
                    </button>
                  ) : (
                    <button onClick={() => { setReplyBoxId(a.id); setReplyText(a.reponse ?? ''); }} style={{
                      background: 'none', color: 'var(--t3)', border: 'none',
                      padding: 0, fontSize: 11, fontWeight: 600, cursor: 'pointer',
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
