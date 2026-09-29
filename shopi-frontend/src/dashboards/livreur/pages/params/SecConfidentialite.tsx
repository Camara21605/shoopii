/*
 * FICHIER : src/dashboards/livreur/pages/params/SecConfidentialite.tsx
 * ✅ CONNECTÉ — GET / PATCH /dashboard/livreur/parametres/confidentialite
 *
 * BUG CORRIGÉ — les 6 réglages étaient enregistrés sans qu'aucun service ne
 * les lise. Les 4 conservés sont appliqués côté serveur partout où le livreur
 * est visible publiquement :
 *   showInSearch      → liste « Livreurs », carte, recherche d'acteurs
 *   showRating        → note + nombre d'avis (liste, profil, carte, tri/filtre)
 *   showDeliveryCount → nombre de livraisons (liste, profil, tri)
 *   shareLocation     → carte / distances : zone approximative au lieu du GPS
 * « Statistiques anonymisées » et « Améliorer l'algorithme » retirés : aucun
 * traitement ne pouvait en tenir compte.
 * Chaque interrupteur s'enregistre aussitôt, un à la fois (jamais de retour en
 * arrière dû à une réponse en retard).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../../shared/services/apiFetch';
import { useSerialQueue } from '../../../../shared/hooks/useSerialQueue';
import ps from '../../styles/ParamsShared.module.css';

const URL_PRIVACY = '/dashboard/livreur/parametres/confidentialite';
type Cle = 'showInSearch' | 'showRating' | 'showDeliveryCount' | 'shareLocation';
type Privacy = Record<Cle, boolean>;

const ITEMS: { key: Cle; icon: string }[] = [
  { key: 'showInSearch',      icon: 'fa-magnifying-glass' },
  { key: 'showRating',        icon: 'fa-star' },
  { key: 'showDeliveryCount', icon: 'fa-box' },
  { key: 'shareLocation',     icon: 'fa-location-dot' },
];

interface Props { onPop: (m: string, t?: string) => void; }

export default function SecConfidentialite({ onPop }: Props) {
  const { t } = useTranslation();
  const [vals,   setVals]   = useState<Privacy | null>(null);
  const [erreur, setErreur] = useState(false);
  const queue = useSerialQueue();

  const charger = () => apiFetch<Privacy>(URL_PRIVACY).then(v => { setVals(v); setErreur(false); }).catch(() => setErreur(true));
  useEffect(() => { void charger(); }, []);

  function basculer(key: Cle, v: boolean) {
    if (!vals) return;
    setVals({ ...vals, [key]: v });
    const { promise, isLatest } = queue(() => apiFetch<Privacy>(URL_PRIVACY, { method: 'PATCH', body: { [key]: v } }));
    promise
      .then(res => { if (isLatest()) setVals(res); onPop(t('livreurSecConfidentialite.toasts.saved'), 's'); })
      .catch(() => { onPop(t('livreurSecConfidentialite.toasts.saveError'), 'e'); if (isLatest()) void charger(); });
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-shield-halved" /> {t('livreurSecConfidentialite.header.titre')}</h2>
        <p>{t('livreurSecConfidentialite.header.sub')}</p>
      </div>

      {erreur && (
        <div className={ps.card}><div className={ps.cb} style={{ fontSize:13, color:'var(--t3)' }}>
          {t('livreurSecConfidentialite.erreur')}{' '}
          <button type="button" onClick={() => void charger()} style={{ background:'none', border:'none', color:'var(--teal)', fontWeight:700, cursor:'pointer' }}>{t('livreurSecConfidentialite.reessayer')}</button>
        </div></div>
      )}
      {!vals && !erreur && <div style={{ textAlign:'center', color:'var(--t3)', padding:24 }}><i className="fas fa-spinner fa-spin" /></div>}

      {vals && (
        <div className={`${ps.card} ${ps.cardLast}`}>
          <div className={ps.ch}><div className={ps.chT}><i className="fas fa-eye" /> {t('livreurSecConfidentialite.groups.visibilite.title')}</div></div>
          <div className={ps.cb}>
            {ITEMS.map(it => {
              const label = t(`livreurSecConfidentialite.items.${it.key}.l`);
              return (
                <div key={it.key} className={ps.setRow}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className={ps.srLbl}><i className={`fas ${it.icon}`} style={{ width:16, color:'var(--teal)', marginRight:6 }} />{label}</div>
                    <div className={ps.srSub}>{t(`livreurSecConfidentialite.items.${it.key}.sub`)}</div>
                    <div className={ps.srSub} style={{ marginTop:3, fontStyle:'italic' }}>
                      {t(`livreurSecConfidentialite.items.${it.key}.${vals[it.key] ? 'on' : 'off'}`)}
                    </div>
                  </div>
                  <label className={ps.tog}>
                    <input type="checkbox" role="switch" aria-label={label} checked={vals[it.key]} onChange={e => basculer(it.key, e.target.checked)} />
                    <span className={ps.togs} />
                  </label>
                </div>
              );
            })}
            <div className={ps.fiHint} style={{ marginTop:10 }}>
              <i className="fas fa-circle-info" /> {t('livreurSecConfidentialite.legalNote')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
