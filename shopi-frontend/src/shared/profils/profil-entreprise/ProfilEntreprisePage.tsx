import { useRef, type ChangeEvent } from 'react';
import { useParametres } from '../../../dashboards/entreprise/hooks/useParametres';
import type { HoraireJour } from '../../../dashboards/entreprise/hooks/useParametres';
import type { EntreprisePage } from '../../../dashboards/entreprise/types';

interface Props {
  onNavigate: (page: EntreprisePage) => void;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'Boutique active', color: '#059669', bg: 'rgba(5,150,105,.1)'  },
  suspended: { label: 'En pause',        color: '#D97706', bg: 'rgba(217,119,6,.1)'  },
  private:   { label: 'Privée',          color: '#DC2626', bg: 'rgba(220,38,38,.08)' },
  pending:   { label: 'En attente',      color: '#6366F1', bg: 'rgba(99,102,241,.1)' },
};

const JOURS_FR: Record<string, string> = {
  monday:'Lundi', tuesday:'Mardi', wednesday:'Mercredi', thursday:'Jeudi',
  friday:'Vendredi', saturday:'Samedi', sunday:'Dimanche',
};

export default function ProfilEntreprisePage({ onNavigate }: Props) {
  const { data, loading, error, saving, uploadLogo, uploadCover, deleteLogo } = useParametres();

  const coverRef = useRef<HTMLInputElement>(null);
  const logoRef  = useRef<HTMLInputElement>(null);

  /* ── Handlers upload ── */
  async function handleCoverChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadCover(file);
    e.target.value = '';
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadLogo(file);
    e.target.value = '';
  }

  /* ── États ── */
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'var(--t3)' }}>
      <div style={{ textAlign:'center' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize:28, display:'block', marginBottom:12 }} />
        Chargement du profil…
      </div>
    </div>
  );

  if (error || !data) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'var(--red,#DC2626)' }}>
      <div style={{ textAlign:'center' }}>
        <i className="fas fa-triangle-exclamation" style={{ fontSize:28, display:'block', marginBottom:12 }} />
        Impossible de charger le profil.
      </div>
    </div>
  );

  const status   = STATUS_MAP[data.status] ?? STATUS_MAP['active'];
  /* TypeORM/MySQL retourne les decimaux comme des strings — on force en number */
  const avgRating = Number(data.averageRating) || 0;
  const initials = data.companyName.split(' ').slice(0,2).map((w: string) => w[0]?.toUpperCase() ?? '').join('');

  return (
    <div className="page on" style={{ padding:0 }}>

      {/* Inputs fichiers masqués */}
      <input ref={coverRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleCoverChange} />
      <input ref={logoRef}  type="file" accept="image/*" style={{ display:'none' }} onChange={handleLogoChange} />

      <div style={{ maxWidth:860, margin:'0 auto', padding:'24px 24px 48px' }}>

        {/* ── Cover + Logo ── */}
        <div style={{ position:'relative', marginBottom:64 }}>

          {/* Cover cliquable */}
          <div
            onClick={() => !saving && coverRef.current?.click()}
            style={{
              height:200, borderRadius:'var(--r-xl)', overflow:'hidden', cursor:'pointer',
              background: data.coverImage
                ? `url(${data.coverImage}) center/cover no-repeat`
                : 'linear-gradient(118deg,#06122A 0%,#0B2A5E 40%,#1549B8 100%)',
              position:'relative',
            }}
          >
            {/* grille déco */}
            <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px)', backgroundSize:'26px 26px' }} />

            {/* Overlay hover */}
            <div style={{
              position:'absolute', inset:0,
              background:'rgba(0,0,0,0)', transition:'background .2s',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,.32)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
            >
              <div style={{
                background:'rgba(255,255,255,.18)', backdropFilter:'blur(6px)',
                border:'1px solid rgba(255,255,255,.3)',
                borderRadius:10, padding:'8px 18px',
                color:'#fff', fontSize:12, fontWeight:700,
                display:'flex', alignItems:'center', gap:8, opacity:0, transition:'opacity .2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
              >
                {saving
                  ? <><i className="fas fa-spinner fa-spin" /> Envoi…</>
                  : <><i className="fas fa-camera" /> Changer la photo de couverture</>
                }
              </div>
            </div>

            {/* Badge permanent en bas à droite */}
            <div style={{
              position:'absolute', bottom:10, right:14,
              background:'rgba(255,255,255,.15)', backdropFilter:'blur(8px)',
              color:'#fff', border:'1px solid rgba(255,255,255,.25)',
              borderRadius:8, padding:'5px 12px',
              fontSize:11, fontWeight:700,
              display:'flex', alignItems:'center', gap:6,
              pointerEvents:'none',
            }}>
              <i className="fas fa-camera" /> Photo de couverture
            </div>
          </div>

          {/* Logo flottant cliquable */}
          <div
            onClick={() => !saving && logoRef.current?.click()}
            style={{
              position:'absolute', bottom:-48, left:28,
              width:96, height:96, borderRadius:20,
              border:'4px solid var(--white)',
              boxShadow:'0 4px 20px rgba(11,31,58,.2)',
              overflow:'hidden', background:'var(--white)',
              cursor:'pointer',
            }}
          >
            {data.logo
              ? <img src={data.logo} alt={data.companyName} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
              : <div style={{
                  width:'100%', height:'100%',
                  background:'linear-gradient(135deg,var(--blue),#5B8EF4)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:28, fontWeight:800, color:'#fff', fontFamily:'var(--fd)',
                }}>
                  {initials}
                </div>
            }

            {/* Overlay caméra sur logo */}
            <div style={{
              position:'absolute', inset:0, borderRadius:16,
              background:'rgba(0,0,0,0)', transition:'background .2s',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,.45)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
            >
              <i className="fas fa-camera" style={{ color:'#fff', fontSize:18, opacity:0, transition:'opacity .2s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0')}
              />
            </div>
          </div>

          {/* Supprimer logo (si présent) */}
          {data.logo && (
            <button
              onClick={e => { e.stopPropagation(); deleteLogo(); }}
              title="Supprimer le logo"
              style={{
                position:'absolute', bottom:-40, left:112,
                background:'var(--white)', border:'1px solid var(--bdr)',
                borderRadius:8, padding:'4px 10px',
                fontSize:11, color:'var(--t3)', cursor:'pointer',
                display:'flex', alignItems:'center', gap:5,
              }}
            >
              <i className="fas fa-trash" style={{ fontSize:10 }} /> Retirer
            </button>
          )}
        </div>

        {/* ── Identité + statut ── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:16, marginBottom:32 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:6 }}>
              <h1 style={{ fontSize:26, fontWeight:800, color:'var(--navy)', fontFamily:'var(--fd)', margin:0 }}>
                {data.companyName}
              </h1>
              <span style={{
                fontSize:11, fontWeight:700, borderRadius:'var(--pill)',
                padding:'3px 12px', color:status.color, background:status.bg,
              }}>
                {status.label}
              </span>
            </div>
            {data.slogan && (
              <p style={{ fontSize:14, color:'var(--t2)', margin:'0 0 8px', fontStyle:'italic' }}>
                "{data.slogan}"
              </p>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', fontSize:12, color:'var(--t3)' }}>
              {(data.ville || data.pays) && (
                <span><i className="fas fa-map-pin" style={{ color:'var(--blue)', marginRight:5 }} />
                  {[data.ville, data.pays].filter(Boolean).join(', ')}
                </span>
              )}
              {data.businessEmail && (
                <span><i className="fas fa-envelope" style={{ color:'var(--blue)', marginRight:5 }} />
                  {data.businessEmail}
                </span>
              )}
              {data.businessPhone && (
                <span><i className="fas fa-phone" style={{ color:'var(--blue)', marginRight:5 }} />
                  {data.businessPhone}
                </span>
              )}
              {data.website && (
                <a href={data.website} target="_blank" rel="noreferrer"
                  style={{ color:'var(--blue)', textDecoration:'none', display:'flex', alignItems:'center', gap:5 }}>
                  <i className="fas fa-globe" /> {data.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>

          {/* Stats rapides */}
          <div style={{ display:'flex', gap:24, flexShrink:0, alignItems:'flex-start' }}>
            {/* Commandes */}
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:800, color:'var(--navy)', fontFamily:'var(--fd)' }}>
                {data.totalOrders}
              </div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>Commandes</div>
            </div>

            {/* Note étoiles */}
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:800, color:'var(--navy)', fontFamily:'var(--fd)' }}>
                {avgRating.toFixed(1)}
              </div>
              <div style={{ display:'flex', gap:2, justifyContent:'center', margin:'3px 0' }}>
                {[1,2,3,4,5].map(v => {
                  const filled = v <= Math.floor(avgRating);
                  const half   = !filled && v === Math.ceil(avgRating) && avgRating % 1 >= 0.3;
                  return (
                    <span key={v} style={{
                      fontSize:13,
                      color: filled ? '#F59E0B' : half ? '#F59E0B' : '#D1D5DB',
                      opacity: half ? 0.55 : 1,
                    }}>★</span>
                  );
                })}
              </div>
              <div style={{ fontSize:11, color:'var(--t3)' }}>Note moyenne</div>
            </div>
          </div>
        </div>

        {/* ── Grille infos ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

          {data.description && (
            <div style={{ gridColumn:'span 2', background:'var(--white)', border:'1px solid var(--bdr)', borderRadius:'var(--r-xl)', padding:24 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>
                <i className="fas fa-align-left" style={{ color:'var(--blue)', marginRight:7 }} /> À propos
              </div>
              <p style={{ fontSize:13.5, color:'var(--t1)', lineHeight:1.7, margin:0 }}>{data.description}</p>
            </div>
          )}

          <div style={{ background:'var(--white)', border:'1px solid var(--bdr)', borderRadius:'var(--r-xl)', padding:24 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:14 }}>
              <i className="fas fa-address-card" style={{ color:'var(--blue)', marginRight:7 }} /> Contact & localisation
            </div>
            {[
              data.businessPhone && { i:'fa-phone',       v: data.businessPhone },
              data.businessEmail && { i:'fa-envelope',    v: data.businessEmail },
              data.whatsapp      && { i:'fa-whatsapp',    v: data.whatsapp      },
              data.adresse       && { i:'fa-location-dot',v: [data.adresse, data.commune, data.ville].filter(Boolean).join(', ') },
              data.repere        && { i:'fa-map',         v: data.repere        },
            ].filter(Boolean).map((row: any) => (
              <div key={row.v} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--bdr)' }}>
                <div style={{ width:32, height:32, borderRadius:9, background:'var(--sky)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <i className={`fas ${row.i}`} style={{ color:'var(--blue)', fontSize:13 }} />
                </div>
                <span style={{ fontSize:13, color:'var(--t1)' }}>{row.v}</span>
              </div>
            ))}
          </div>

          {data.horaires && data.horaires.length > 0 && (
            <div style={{ background:'var(--white)', border:'1px solid var(--bdr)', borderRadius:'var(--r-xl)', padding:24 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:14 }}>
                <i className="fas fa-clock" style={{ color:'var(--blue)', marginRight:7 }} /> Horaires d'ouverture
              </div>
              {data.horaires.map((h: HoraireJour) => (
                <div key={h.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--bdr)', fontSize:13 }}>
                  <span style={{ fontWeight:600, color:'var(--t1)' }}>{JOURS_FR[h.jour] ?? h.jour}</span>
                  {h.actif
                    ? <span style={{ color:'var(--t2)' }}>{h.ouverture} – {h.fermeture}</span>
                    : <span style={{ color:'var(--t4)', fontStyle:'italic' }}>Fermé</span>
                  }
                </div>
              ))}
            </div>
          )}

          {(data.companyType || data.tags) && (
            <div style={{ background:'var(--white)', border:'1px solid var(--bdr)', borderRadius:'var(--r-xl)', padding:24 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:14 }}>
                <i className="fas fa-tags" style={{ color:'var(--blue)', marginRight:7 }} /> Catégorie & tags
              </div>
              {data.companyType && (
                <div style={{ display:'inline-flex', alignItems:'center', gap:7, background:'var(--sky)', color:'var(--blue)', borderRadius:'var(--pill)', padding:'5px 14px', fontSize:12, fontWeight:700, marginBottom:12 }}>
                  {data.companyType.icone && <span>{data.companyType.icone}</span>}
                  {data.companyType.nom}
                </div>
              )}
              {data.tags && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                  {data.tags.split(',').map((t: string) => t.trim()).filter(Boolean).map((tag: string) => (
                    <span key={tag} style={{ background:'var(--g100)', color:'var(--t2)', borderRadius:'var(--pill)', padding:'4px 12px', fontSize:11, fontWeight:600 }}>
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ background:'var(--white)', border:'1px solid var(--bdr)', borderRadius:'var(--r-xl)', padding:24 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:14 }}>
              <i className="fas fa-motorcycle" style={{ color:'var(--blue)', marginRight:7 }} /> Options de livraison
            </div>
            {[
              { ok: data.livraisonShopi,    label: 'Livraison Shopi'    },
              { ok: data.livraisonStandard, label: 'Livraison standard' },
              { ok: data.livraisonCorresp,  label: 'Correspondants'     },
              { ok: data.clickCollect,      label: 'Click & Collect'    },
              { ok: data.livraisonExpress,  label: 'Livraison express'  },
            ].map(opt => (
              <div key={opt.label} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--bdr)', fontSize:13 }}>
                <i className={`fas ${opt.ok ? 'fa-circle-check' : 'fa-circle-xmark'}`}
                  style={{ color: opt.ok ? '#059669' : 'var(--t4)', fontSize:15, flexShrink:0 }} />
                <span style={{ color: opt.ok ? 'var(--t1)' : 'var(--t4)' }}>{opt.label}</span>
              </div>
            ))}
          </div>

        </div>

        {/* ── Boutons du bas ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, marginTop:36, flexWrap:'wrap' }}>
          <button
            onClick={() => onNavigate('boutique-preview')}
            style={{
              background:'var(--navy)', color:'#fff', border:'none',
              borderRadius:'var(--pill)', padding:'12px 32px',
              fontSize:13, fontWeight:700, cursor:'pointer',
              display:'inline-flex', alignItems:'center', gap:10,
            }}
          >
            <i className="fas fa-store" /> Voir ma boutique
          </button>
          <button
            onClick={() => onNavigate('parametres')}
            style={{
              background:'var(--white)', color:'var(--navy)', border:'1.5px solid var(--bdr)',
              borderRadius:'var(--pill)', padding:'12px 32px',
              fontSize:13, fontWeight:700, cursor:'pointer',
              display:'inline-flex', alignItems:'center', gap:10,
            }}
          >
            <i className="fas fa-gear" /> Paramètres
          </button>
        </div>

      </div>
    </div>
  );
}
