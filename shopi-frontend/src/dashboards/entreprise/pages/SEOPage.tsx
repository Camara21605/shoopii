/*
 * FICHIER: src/dashboards/entreprise/pages/SEOPage.tsx
 * Page SEO & Marketing — score SEO, recommandations, campagnes
 */

import React from 'react';
import { useToast } from '../../../shared/context/ToastContext';
import './SEOPage.css';

const SEO_CHECKS: { icon: string; status: 'ok'|'warn'|'bad'; label: string }[] = [
  { icon:'fa-circle-check', status:'ok',   label:'Titre boutique optimisé (58 caractères)' },
  { icon:'fa-circle-check', status:'ok',   label:'Description méta présente et pertinente' },
  { icon:'fa-triangle-exclamation', status:'warn', label:'12 produits sans description complète' },
  { icon:'fa-circle-check', status:'ok',   label:'Images optimisées (WebP · < 200 KB)' },
  { icon:'fa-triangle-exclamation', status:'warn', label:'Vitesse page : 2.4s — Amélioration conseillée' },
  { icon:'fa-circle-xmark', status:'bad',  label:'Schema.org produit non configuré' },
  { icon:'fa-circle-check', status:'ok',   label:'URL canoniques correctement définies' },
  { icon:'fa-circle-check', status:'ok',   label:'Sitemap XML soumis à Google' },
];

const CAMPAIGNS = [
  { nm:'Soldes Janvier 2025', status:'active', budget:'500 000', spend:'312 000', conv:'2.8%', roas:'4.2x' },
  { nm:'Apple Premium',       status:'active', budget:'800 000', spend:'540 000', conv:'3.4%', roas:'5.8x' },
  { nm:'Gaming Week',         status:'paused', budget:'300 000', spend:'180 000', conv:'1.9%', roas:'2.9x' },
];

export default function SEOPage() {
  const { pop } = useToast();

  return (
    <div className="page on" id="p-seo">
      <div className="g2" style={{ marginBottom:14 }}>

        {/* Score SEO */}
        <div className="card">
          <div className="ch"><div className="ch-t"><i className="fas fa-magnifying-glass-chart"></i> Score SEO boutique</div></div>
          <div className="cb">
            <div className="seo-score">
              <div className="seo-ring">
                <span>78</span>
              </div>
              <div className="seo-inf">
                <h4>Score SEO : 78 / 100</h4>
                <p>Bon niveau · 3 points à corriger pour atteindre Excellent</p>
              </div>
            </div>
            <div className="seo-items">
              {SEO_CHECKS.map((c, i) => (
                <div key={i} className="seo-item">
                  <i className={`fas ${c.icon} ${c.status}`}></i>
                  <span style={{ color: c.status === 'bad' ? 'var(--red)' : c.status === 'warn' ? 'var(--amber)' : 'var(--t2)', fontSize:12 }}>
                    {c.label}
                  </span>
                  {(c.status === 'warn' || c.status === 'bad') && (
                    <button
                      style={{ marginLeft:'auto', background:'var(--sky)', color:'var(--blue)', border:'1px solid var(--sky-3)', borderRadius:'var(--pill)', padding:'3px 10px', fontSize:10, fontWeight:700, cursor:'pointer', flexShrink:0 }}
                      onClick={() => pop('🔧 Correction lancée', 's')}
                    >
                      Corriger
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mots-clés */}
        <div className="card">
          <div className="ch">
            <div className="ch-t"><i className="fas fa-key"></i> Mots-clés performants</div>
            <span className="ch-badge">Top 7</span>
          </div>
          <div className="cb">
            {[
              { kw:'iphone 15 pro conakry',    pos:1,  vol:2400, trend:'up' },
              { kw:'macbook air m3 guinée',     pos:2,  vol:1800, trend:'up' },
              { kw:'ps5 standard prix guinée',  pos:3,  vol:1200, trend:'stable' },
              { kw:'apple watch s9 conakry',    pos:4,  vol:980,  trend:'up' },
              { kw:'sony wh xm5 guinée',        pos:6,  vol:720,  trend:'down' },
              { kw:'acheter iphone en ligne',   pos:8,  vol:3400, trend:'up' },
              { kw:'boutique tech conakry',     pos:11, vol:890,  trend:'stable' },
            ].map((k, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid var(--bdr)' }}>
                <div style={{
                  width:28, height:28, borderRadius:8, flexShrink:0,
                  background: k.pos <= 3 ? 'var(--em-bg)' : k.pos <= 10 ? 'var(--sky-2)' : 'var(--am-bg)',
                  color: k.pos <= 3 ? 'var(--emerald)' : k.pos <= 10 ? 'var(--blue)' : 'var(--amber)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:800, fontFamily:'var(--fd)',
                }}>
                  #{k.pos}
                </div>
                <div style={{ flex:1, fontSize:12, color:'var(--navy)', fontWeight:500 }}>{k.kw}</div>
                <div style={{ fontSize:11, color:'var(--t3)' }}>{k.vol.toLocaleString('fr-FR')}/mo</div>
                <span style={{ fontSize:13, color: k.trend==='up'?'var(--green)':k.trend==='down'?'var(--red)':'var(--t3)' }}>
                  {k.trend==='up'?'↑':k.trend==='down'?'↓':'—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Campagnes publicitaires */}
      <div className="card">
        <div className="ch">
          <div className="ch-t"><i className="fas fa-bullhorn"></i> Campagnes marketing</div>
          <button className="sh-action" onClick={() => pop('➕ Nouvelle campagne', 'i')}>
            <i className="fas fa-plus"></i> Créer campagne
          </button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Campagne</th><th>Statut</th><th>Budget</th><th>Dépensé</th>
                <th>Taux conv.</th><th>ROAS</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {CAMPAIGNS.map((c, i) => (
                <tr key={i}>
                  <td><div className="td-nm">{c.nm}</div></td>
                  <td>
                    {c.status === 'active'
                      ? <span className="s-pill s-del">● Actif</span>
                      : <span className="s-pill" style={{ background:'var(--g100)', color:'var(--t3)' }}>⏸ Pausé</span>
                    }
                  </td>
                  <td style={{ fontSize:12, color:'var(--t2)' }}>{c.budget} GNF</td>
                  <td style={{ fontSize:12, color:'var(--t2)' }}>{c.spend} GNF</td>
                  <td><span style={{ fontSize:12, fontWeight:700, color:'var(--emerald)' }}>{c.conv}</span></td>
                  <td><span style={{ fontSize:12, fontWeight:700, color:'var(--blue)' }}>{c.roas}</span></td>
                  <td>
                    <div className="td-action">
                      <button className="ta-btn primary" onClick={() => pop('📊 Stats campagne', 'i')}>Stats</button>
                      <button className="ta-btn" onClick={() => pop('✏️ Édition campagne', 'i')}>Modifier</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}