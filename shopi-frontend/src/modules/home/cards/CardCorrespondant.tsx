import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles          from './Cards.module.css';
import { apiFetch }    from '../../../shared/services/apiFetch';

export interface CorrespondantCardData {
  id: string; fullName: string; profilePicture: string|null;
  region: string; typeCorrespondant: 'regional'|'zonal'|'national';
  bio: string|null; totalMissions: number; averageRating: number;
  online: boolean; isSuivi: boolean;
}

const TYPE_LABEL: Record<string,string> = { regional:'Régional', zonal:'Zonal', national:'National' };
const TOKEN_KEY = 'shopi_access_token';

interface Props {
  c:         CorrespondantCardData | any;
  onToast:   (msg:string, type?:'s'|'i'|'w'|'e') => void;
  onToggle?: (id:string, val:boolean) => void;
}

export default function CardCorrespondant({ c, onToast, onToggle }: Props) {
  const navigate = useNavigate();

  const id       = c?.id ?? '';
  const name     = c?.fullName ?? c?.nom ?? '';
  const photo    = c?.profilePicture ?? null;
  const region   = c?.region ?? '';
  const type     = c?.typeCorrespondant ?? c?.type ?? 'regional';
  const bio      = c?.bio ?? c?.desc ?? null;
  const missions = Number(c?.totalMissions ?? c?.missions ?? 0);
  const rating   = Number(c?.averageRating ?? c?.note ?? 0);
  const online   = c?.online ?? false;

  /*
   * ✅ SIMPLIFIÉ :
   * Plus de cache localStorage complexe.
   * La prop c.isSuivi vient du backend (isSubscribed = true/false)
   * → source de vérité directe.
   */
  const [suivi,   setSuivi]   = useState<boolean>(c?.isSuivi ?? false);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);

  /* ✅ Sync quand la prop change (après fetch API complété) */
  useEffect(() => {
    setSuivi(c?.isSuivi ?? false);
  }, [c?.isSuivi]);

  const initials     = name.trim().split(/\s+/).slice(0,2).map((w:string)=>w[0]?.toUpperCase()??'').join('')||'?';
  const noteArrondie = Math.min(5, Math.max(0, Math.round(rating)));
  const etoiles      = '★'.repeat(noteArrondie)+'☆'.repeat(5-noteArrondie);

  async function handleToggle() {
    /* ✅ Non connecté → redirige vers login */
    if (!localStorage.getItem(TOKEN_KEY)) { navigate('/login'); return; }
    if (!id) { onToast('❌ ID manquant','e'); return; }

    setLoading(true);
    /* ✅ Optimistic update immédiat */
    const optimistic = !suivi;
    setSuivi(optimistic);

    try {
      /* ✅ Le serveur retourne { isSuivi: boolean } basé sur isSubscribed */
      const res = await apiFetch<{isSuivi:boolean; message:string}>(
        `/suivis/correspondants/${id}`, { method:'POST' }
      );
      /* ✅ Confirme avec la valeur réelle du serveur */
      const confirmed = res?.isSuivi ?? optimistic;
      setSuivi(confirmed);
      onToggle?.(id, confirmed);
      onToast(
        confirmed ? `✅ Abonné à ${name}` : `👋 Désabonné de ${name}`,
        confirmed ? 's' : 'i',
      );
    } catch (e:any) {
      /* ✅ Rollback en cas d'erreur */
      setSuivi(!optimistic);
      onToast(`❌ ${e?.message ?? 'Erreur réseau'}`, 'e');
    } finally { setLoading(false); setHovered(false); }
  }

  const btnStyle: React.CSSProperties = suivi ? {
    background: hovered
      ? 'linear-gradient(135deg,#DC2626,#B91C1C)'
      : 'linear-gradient(135deg,#059669,#047857)',
    color:'#fff',
    borderColor: hovered ? '#DC2626' : '#059669',
    transition:'all .2s',
  } : {};

  return (
    <div className={styles.crCard}>
      <div className={styles.crAw}>
        {photo && (
          <img src={photo} alt={name} className={styles.crAva}
            style={{ objectFit:'cover', borderRadius:'50%' }}
            onError={e => {
              e.currentTarget.style.display = 'none';
              const n = e.currentTarget.nextElementSibling as HTMLElement|null;
              if (n) n.style.display = 'flex';
            }}
          />
        )}
        <div className={styles.crAva} style={{
          display: photo?'none':'flex', alignItems:'center', justifyContent:'center',
          background:'linear-gradient(135deg,var(--cor,#B45309),var(--navy-2,#112648))',
          color:'#fff', fontFamily:'var(--fd)', fontWeight:800, fontSize:c?.emoji?28:20,
        }}>{c?.emoji ?? initials}</div>
        <div className={`${styles.crOl} ${online?styles.crOlOn:styles.crOlOff}`} title={online?'En ligne':'Hors ligne'} />
      </div>

      <div className={styles.crNm}>{name||'—'}</div>
      <div className={styles.crRegion}><i className="fas fa-map-pin" /> {region||'—'}</div>
      <span className={styles.crType}>{TYPE_LABEL[type]??type}</span>
      <div className={styles.crDesc}>{bio||'Aucune description disponible.'}</div>
      <div className={styles.crStats}>
        <span><i className="fas fa-box" /> {missions.toLocaleString('fr-FR')} mission{missions>1?'s':''}</span>
        <span><span className={styles.stars}>{etoiles}</span> {rating.toFixed(1)}</span>
      </div>

      <div className={styles.crBtns}>
        <button className={styles.crV}
          onClick={()=> id ? navigate(`/profil/correspondant/${id}`) : onToast(`📍 ${name}`,'i')}>
          <i className="fas fa-user" /> Voir profil
        </button>
        <button className={styles.crC} onClick={handleToggle} disabled={loading}
          style={btnStyle}
          onMouseEnter={()=>suivi&&setHovered(true)}
          onMouseLeave={()=>setHovered(false)}
          title={!localStorage.getItem(TOKEN_KEY) ? 'Connectez-vous pour suivre' : undefined}>
          {loading
            ? <><i className="fas fa-spinner fa-spin" /> …</>
            : !localStorage.getItem(TOKEN_KEY)
              ? <><i className="fas fa-right-to-bracket" /> Connexion requise</>
              : suivi && hovered
                ? <><i className="fas fa-user-minus" /> Se désabonner</>
                : suivi
                  ? <><i className="fas fa-user-check" /> Abonné(e)</>
                  : <><i className="fas fa-plus" /> Suivre</>
          }
        </button>
      </div>
    </div>
  );
}