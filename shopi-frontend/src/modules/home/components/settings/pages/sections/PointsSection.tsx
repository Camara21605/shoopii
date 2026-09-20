
/* ================================================================
 * src/modules/home/components/settings/sections/PointsSection.tsx
 * CONNECTÉ — GET /client/parametres/points
 * ================================================================ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { settingsApi, type PointsData } from '../../api/settings.api';

export function PointsSection() {
  const { t, i18n } = useTranslation();
  const [pts,     setPts]     = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const fillRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setError(false);
    settingsApi.getPoints()
      .then(data => {
        setPts(data);
        setTimeout(() => {
          if (fillRef.current) fillRef.current.style.width = `${data.progression}%`;
        }, 300);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Erreur : message + « Réessayer » (avant : roue de chargement infinie) */
  if (!loading && error) return (
    <div style={{ background:'var(--white)', border:'1.5px solid var(--bdr)', borderRadius:'var(--r-xl)', padding:28, marginBottom:20, textAlign:'center', color:'var(--t3)', fontSize:13 }}>
      {t('settingsPage.points.loadError')}{' '}
      <button type="button" onClick={() => { setLoading(true); load(); }} style={{ background:'none', border:'none', cursor:'pointer', fontWeight:700, color:'var(--blue)' }}>{t('settingsPage.points.reessayer')}</button>
    </div>
  );

  if (loading || !pts) return (
    <div style={{ background:'var(--white)', border:'1.5px solid var(--bdr)', borderRadius:'var(--r-xl)', padding:28, marginBottom:20 }}>
      <div style={{ color:'var(--t3)', textAlign:'center', padding:24 }}>
        <i className="fas fa-circle-notch fa-spin" style={{ fontSize:24 }} />
      </div>
    </div>
  );

  return (
    <div style={{
      background:'var(--white)', border:'1.5px solid var(--bdr)',
      borderRadius:'var(--r-xl)', padding:28, marginBottom:20,
      position:'relative', overflow:'hidden',
    }}>
      <div style={{ position:'relative', zIndex:1 }}>
        <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'1.2px', color:'var(--t2)', marginBottom:8 }}>{t('settingsPage.points.titre')}</div>
        <div style={{ fontFamily:'var(--fd)', fontSize:48, fontWeight:800, color:'var(--t1)', lineHeight:1, marginBottom:4 }}>
          {pts.points.toLocaleString('fr-FR')} <span style={{ fontSize:18, fontWeight:400, color:'var(--t2)' }}>{t('settingsPage.points.pts')}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--t2)', marginBottom:7 }}>
          <span>{t('settingsPage.points.niveauLabel')} {pts.niveau} · {pts.points.toLocaleString('fr-FR')} {t('settingsPage.points.pts')}</span>
          {pts.prochainNiveau && <span>{pts.prochainNiveau} {t('settingsPage.points.prochainA')} {pts.seuilProchain?.toLocaleString('fr-FR')} {t('settingsPage.points.prochainPts')}</span>}
        </div>
        <div style={{ height:6, background:'var(--g200)', borderRadius:3, overflow:'hidden', marginBottom:18 }}>
          <div ref={fillRef} style={{ height:'100%', background:'linear-gradient(90deg,var(--blue-2),var(--blue-lt))', borderRadius:3, width:0, transition:'width .8s var(--ease)' }} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
          {[
            { v: pts.pointsGagnes,   l: t('settingsPage.points.pointsGagnes') },
            { v: pts.pointsUtilises, l: t('settingsPage.points.pointsUtilises') },
            { v: pts.expirationProchaine ? new Date(pts.expirationProchaine).toLocaleDateString(i18n.language, { dateStyle: 'medium' }) : '—', l: t('settingsPage.points.expirationProchaine') },
          ].map((st, i) => (
            <div key={i} style={{ background:'var(--g50)', border:'1px solid var(--bdr)', borderRadius:'var(--r-md)', padding:12 }}>
              <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:700, color:'var(--t1)' }}>{typeof st.v === 'number' ? st.v.toLocaleString('fr-FR') : st.v}</div>
              <div style={{ fontSize:10, color:'var(--t3)', marginTop:1 }}>{st.l}</div>
            </div>
          ))}
        </div>
        {!pts.actif && (
          <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginTop:16, padding:'12px 14px', borderRadius:'var(--r-md)', background:'var(--sky)', border:'1px solid var(--sky-3)', fontSize:12, color:'var(--t2)', lineHeight:1.6 }}>
            <i className="fas fa-circle-info" style={{ color:'var(--blue)', marginTop:2 }} />
            <div>{t('settingsPage.points.inactif')}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PointsSection;