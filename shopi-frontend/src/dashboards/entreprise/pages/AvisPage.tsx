import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../shared/context/ToastContext';
import { fetchEntrepriseAvis, repondreAvis } from '../services/avisApi';
import type { AvisApi, AvisStatsApi } from '../services/avisApi';

/* ── Étoiles dynamiques ── */
function Stars({ n }: { n: number }) {
  return (
    <span>
      {[1,2,3,4,5].map(v => (
        <span key={v} style={{
          color: v <= Math.round(n) ? 'var(--amber)' : 'var(--g300)',
          fontSize: 13, letterSpacing: 1,
        }}>★</span>
      ))}
    </span>
  );
}

/* ── Initiales depuis le nom ── */
function initiales(nom: string): string {
  return nom.split(' ').slice(0,2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

/* ── Couleurs avatar par initiale ── */
const AVA_COLORS = [
  'linear-gradient(135deg,var(--g100),var(--g200))',
  'linear-gradient(135deg,var(--g100),var(--g100))',
  'linear-gradient(135deg,var(--g100),var(--g100))',
  'linear-gradient(135deg,var(--g100),var(--g200))',
  'linear-gradient(135deg,var(--g100),var(--g200))',
];
function avatarBg(nom: string): string {
  const code = nom.charCodeAt(0) ?? 0;
  return AVA_COLORS[code % AVA_COLORS.length];
}

type Filtre = 'all' | 'replied' | 'pending';

export default function AvisPage() {
  const { t } = useTranslation();
  const { pop } = useToast();

  const [avis,    setAvis]    = useState<AvisApi[]>([]);
  const [stats,   setStats]   = useState<AvisStatsApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtre,  setFiltre]  = useState<Filtre>('all');

  const [replyBoxId,  setReplyBoxId]  = useState<string | null>(null);
  const [replyText,   setReplyText]   = useState('');
  const [replySaving, setReplySaving] = useState(false);

  /* ── Chargement API ── */
  useEffect(() => {
    setLoading(true);
    fetchEntrepriseAvis()
      .then(res => { setAvis(res.avis); setStats(res.stats); })
      .catch(() => pop(t('avis.loadError'), 'e'))
      .finally(() => setLoading(false));
  }, []);

  /* ── Filtre ── */
  const filtered = avis.filter(r => {
    if (filtre === 'replied') return !!r.reponse;
    if (filtre === 'pending') return !r.reponse;
    return true;
  });

  /* ── Répondre ── */
  async function handleSendReply(avisId: string) {
    if (!replyText.trim()) return;
    setReplySaving(true);
    try {
      await repondreAvis(avisId, replyText.trim());
      setAvis(prev => prev.map(a =>
        a.id === avisId ? { ...a, reponse: replyText.trim() } : a
      ));
      pop(t('avis.reponsePublieeToast'), 's');
    } catch {
      pop(t('avis.reponseErrorToast'), 'e');
    } finally {
      setReplySaving(false);
      setReplyBoxId(null);
      setReplyText('');
    }
  }

  /* ── Distribution étoiles ── */
  const dist: [number, number, string][] = [5,4,3,2,1].map(star => {
    const pct  = stats?.distribution?.[String(star)] ?? 0;
    const col  = star >= 4 ? 'var(--emerald)' : star === 3 ? 'var(--amber)' : 'var(--red)';
    return [star, pct, col];
  });

  const moyenne  = stats?.moyenne  ?? 0;
  const totalAvis = stats?.total   ?? avis.length;
  const nbSansReponse = avis.filter(a => !a.reponse).length;

  return (
    <div className="page on" id="p-avis">

      {/* ── KPIs ── */}
      <div className="kpi-grid">
        {[
          { ic:'⭐', v: loading ? '…' : moyenne.toFixed(1), l:t('avis.kpi.noteGlobale'),        sub:t('avis.kpi.sur5Etoiles') },
          { ic:'💬', v: loading ? '…' : String(totalAvis),  l:t('avis.kpi.avisAuTotal'),        sub:t('avis.kpi.clientsVerifies') },
          { ic:'✅', v: loading ? '…' : (
              totalAvis > 0
                ? `${Math.round(((stats?.distribution?.['4'] ?? 0) + (stats?.distribution?.['5'] ?? 0)) / (totalAvis || 1) * 100)}%`
                : '—'
            ),                                               l:t('avis.kpi.satisfaction'),          sub:t('avis.kpi.quatreEtCinqEtoiles') },
          { ic:'⏳', v: loading ? '…' : String(nbSansReponse), l:t('avis.kpi.sansReponse'),      sub:t('avis.kpi.aTraiter') },
        ].map((s, i) => (
          <div key={i} className={`kpi k${i+1}`}>
            <div className="kpi-stripe" />
            <div className="kpi-top">
              <div className="kpi-icon">{s.ic}</div>
              <span className="kpi-badge neu">{s.sub}</span>
            </div>
            <div className="kpi-val">{s.v}</div>
            <div className="kpi-lbl">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="g3">

        {/* ── Colonne principale ── */}
        <div>
          {/* Filtres */}
          <div style={{ display:'flex', gap:7, marginBottom:14, flexWrap:'wrap' }}>
            {([
              { label:t('avis.filters.tous'), value:'all'     as Filtre },
              { label:t('avis.filters.avecReponse'), value:'replied' as Filtre },
              { label:t('avis.filters.sansReponse'), value:'pending' as Filtre },
            ]).map(f => (
              <button key={f.value} onClick={() => setFiltre(f.value)} style={{
                background:  filtre === f.value ? 'var(--navy)' : 'var(--white)',
                color:       filtre === f.value ? '#fff'        : 'var(--t2)',
                borderColor: filtre === f.value ? 'var(--navy)' : 'var(--bdr2)',
                border:'1.5px solid', borderRadius:'var(--pill)',
                padding:'8px 14px', fontSize:12, fontWeight:600,
                cursor:'pointer', transition:'all .2s',
              }}>
                {f.label} ({
                  f.value === 'all'     ? avis.length :
                  f.value === 'replied' ? avis.filter(a => !!a.reponse).length :
                                         avis.filter(a => !a.reponse).length
                })
              </button>
            ))}
          </div>

          {/* Chargement */}
          {loading && (
            <div style={{ padding:'48px 0', textAlign:'center', color:'var(--t3)' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize:24, display:'block', marginBottom:10 }} />
              {t('avis.loading')}
            </div>
          )}

          {/* Vide */}
          {!loading && filtered.length === 0 && (
            <div style={{ padding:'48px 0', textAlign:'center', color:'var(--t3)' }}>
              <i className="fas fa-star" style={{ fontSize:32, display:'block', marginBottom:12, color:'var(--t4)' }} />
              <div style={{ fontWeight:700, marginBottom:6 }}>{t('avis.empty.title')}</div>
              <div style={{ fontSize:12 }}>
                {filtre === 'pending' ? t('avis.empty.subPending') :
                 filtre === 'replied' ? t('avis.empty.subReplied') :
                 t('avis.empty.subDefault')}
              </div>
            </div>
          )}

          {/* Cartes avis */}
          {!loading && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {filtered.map(r => (
                <div key={r.id} className="card" style={{ padding:18 }}>

                  {/* En-tête */}
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
                    <div style={{
                      width:42, height:42, borderRadius:'50%',
                      background: avatarBg(r.clientNom),
                      border:'2px solid var(--bdr)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:15, fontWeight:800, color:'var(--navy)',
                      flexShrink:0, fontFamily:'var(--fd)',
                    }}>
                      {r.clientInitiales ?? initiales(r.clientNom)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:6 }}>
                        <div>
                          <div style={{ fontSize:13.5, fontWeight:800, color:'var(--navy)', fontFamily:'var(--fd)' }}>
                            {r.clientNom}
                          </div>
                          <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>
                            {t('avis.sur')} <span style={{ color:'var(--t2)', fontWeight:600 }}>{r.produitNom}</span>
                          </div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <Stars n={r.note} />
                          <div style={{ fontSize:10, color:'var(--t4)', marginTop:3 }}>{r.date}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Commentaire */}
                  {r.commentaire && (
                    <div style={{
                      fontSize:12.5, color:'var(--t2)', lineHeight:1.65,
                      padding:'11px 14px', background:'var(--g50)',
                      border:'1px solid var(--bdr)', borderRadius:'var(--r-md)',
                      marginBottom:10, fontStyle:'italic',
                    }}>
                      «&nbsp;{r.commentaire}&nbsp;»
                    </div>
                  )}

                  {/* Réponse existante — masquée pendant l'édition (voir zone réponse ci-dessous) */}
                  {r.reponse && replyBoxId !== r.id && (
                    <div style={{
                      padding:'10px 14px', background:'var(--g100)',
                      border:'1px solid var(--bdr2)', borderRadius:'var(--r-md)', marginBottom:10,
                    }}>
                      <div style={{ fontSize:10.5, fontWeight:700, color:'var(--t2)', marginBottom:4 }}>
                        <i className="fas fa-store" /> {t('avis.votreReponse')}
                      </div>
                      <div style={{ fontSize:12, color:'var(--t2)', lineHeight:1.55 }}>{r.reponse}</div>
                    </div>
                  )}

                  {/* Zone réponse (nouvelle réponse OU modification d'une réponse existante) */}
                  {replyBoxId === r.id && (
                    <div style={{ marginBottom:10 }}>
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder={t('avis.replyPlaceholder')}
                        rows={3}
                        style={{
                          width:'100%', border:'1.5px solid var(--bdrb)',
                          borderRadius:'var(--r-md)', padding:'10px 12px',
                          fontSize:12, color:'var(--navy)', resize:'vertical',
                          outline:'none', fontFamily:'inherit', boxSizing:'border-box',
                        }}
                      />
                      <div style={{ display:'flex', gap:7, marginTop:7 }}>
                        <button
                          disabled={replySaving}
                          onClick={() => handleSendReply(r.id)}
                          style={{
                            background:'var(--navy)', color:'#fff', border:'none',
                            borderRadius:'var(--pill)', padding:'7px 16px',
                            fontSize:12, fontWeight:700, cursor:'pointer',
                            opacity: replySaving ? .6 : 1,
                          }}>
                          {replySaving ? <><i className="fas fa-spinner fa-spin" /> {t('avis.envoiEnCours')}</> : t('avis.publier')}
                        </button>
                        <button onClick={() => { setReplyBoxId(null); setReplyText(''); }} style={{
                          background:'var(--white)', color:'var(--t2)',
                          border:'1px solid var(--bdr2)', borderRadius:'var(--pill)',
                          padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer',
                        }}>
                          {t('avis.annuler')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {replyBoxId !== r.id && (
                    <div style={{ display:'flex', gap:7 }}>
                      {!r.reponse ? (
                        <button className="ta-btn primary"
                          onClick={() => { setReplyBoxId(r.id); setReplyText(''); }}>
                          <i className="fas fa-reply" /> {t('avis.repondre')}
                        </button>
                      ) : (
                        <button className="ta-btn"
                          onClick={() => { setReplyBoxId(r.id); setReplyText(r.reponse ?? ''); }}>
                          <i className="fas fa-pen" /> {t('avis.modifierReponse')}
                        </button>
                      )}
                      <button className="ta-btn"
                        onClick={() => pop(t('avis.signalerToast'), 'w')}>
                        <i className="fas fa-flag" /> {t('avis.signaler')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Panneau latéral stats ── */}
        <div>
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-star" /> {t('avis.sidePanel.distributionNotes')}</div></div>
            <div className="cb">
              {/* Score global */}
              <div style={{ textAlign:'center', marginBottom:18 }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:46, fontWeight:900, color:'var(--navy)', lineHeight:1 }}>
                  {loading ? '…' : moyenne.toFixed(1)}
                </div>
                <div style={{ display:'flex', gap:3, justifyContent:'center', margin:'6px 0' }}>
                  {[1,2,3,4,5].map(v => (
                    <span key={v} style={{ fontSize:20, color: v <= Math.round(moyenne) ? 'var(--amber)' : 'var(--g300)' }}>★</span>
                  ))}
                </div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>
                  {loading ? '…' : t('avis.sidePanel.avisVerifies', { count: totalAvis })}
                </div>
              </div>

              {/* Barres par étoile */}
              {dist.map(([stars, pct, color]) => (
                <div key={stars} style={{ display:'flex', alignItems:'center', gap:9, marginBottom:8 }}>
                  <span style={{ fontSize:11, color:'var(--t2)', width:16, flexShrink:0 }}>
                    {'★'.repeat(stars as number)}
                  </span>
                  <div style={{ flex:1, background:'var(--g200)', borderRadius:'var(--pill)', height:8, overflow:'hidden' }}>
                    <div style={{
                      width:`${pct}%`, height:'100%', background:color,
                      borderRadius:'var(--pill)', transition:'width .8s var(--ease)',
                    }} />
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color, width:30, textAlign:'right', flexShrink:0, fontFamily:'var(--fd)' }}>
                    {pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Conseils */}
          <div className="card">
            <div className="ch"><div className="ch-t"><i className="fas fa-lightbulb" /> {t('avis.sidePanel.conseilsShopi')}</div></div>
            <div className="cb" style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { ic:'⚡', txt:t('avis.sidePanel.tip1') },
                { ic:'🎯', txt:t('avis.sidePanel.tip2') },
                { ic:'💬', txt:t('avis.sidePanel.tip3') },
              ].map((c, i) => (
                <div key={i} style={{
                  display:'flex', gap:9, padding:'10px 12px',
                  background:'var(--g100)', border:'1px solid var(--bdr2)',
                  borderRadius:'var(--r-md)', fontSize:11.5, color:'var(--t2)', lineHeight:1.5,
                }}>
                  <span style={{ flexShrink:0, fontSize:14 }}>{c.ic}</span>
                  {c.txt}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
