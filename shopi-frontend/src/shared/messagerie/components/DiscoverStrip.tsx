/*
 * FICHIER : src/shared/messagerie/components/DiscoverStrip.tsx
 * En-tête « découverte » de la liste des discussions — 4 boutons :
 *   🏪 Entreprises proches · 🛵 Livreurs proches · 🟢 En ligne · ▶ Stories
 * Sous les boutons, une bande de photos selon le bouton choisi :
 *   - proches : GET /location/map/search (même service que la carte),
 *     trié du plus proche au plus loin dans un rayon de 25 km, distance
 *     sous chaque photo (point vert : livreur disponible) ;
 *   - en ligne : mes conversations dont le contact est en ligne ;
 *   - stories : bouton seul pour l'instant (« bientôt disponible »).
 * Cliquer une photo ouvre la discussion (ou la démarre). La position n'est
 * demandée qu'au clic sur « Activer ma position » (ou reprise si le
 * navigateur l'a déjà autorisée).
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ChatUser, Conversation, NewConvUser } from '../data/messagerieTypes';
import { apiSearchUserToNewConvUser } from '../data/messagerieTypes';
import { cldAvatar } from '../utils/chatUtils';
import { searchMapActors, type MapActor } from '../../location/services/mapSearchApi';
import { publishClientPosition, useClientPosition } from '../../location/hooks/useClientPosition';
import s from '../styles/DiscoverStrip.module.css';

type Tab = 'company' | 'delivery' | 'online' | 'stories';
type Geo = 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable';
const RADIUS_KM = 25;

interface Props {
  conversations: Conversation[];
  usersMap:      Map<string, ChatUser>;
  onSelect:      (convId: string) => void;
  onStartConversation: (user: NewConvUser) => void;
}

const distLabel = (km: number) => (km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`);

export default function DiscoverStrip({ conversations, usersMap, onSelect, onStartConversation }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('company');
  const clientPos = useClientPosition();
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<Geo>('idle');
  const pos = myPos ?? clientPos;
  /* Résultats par onglet et par position arrondie (~1 km) */
  const [cache, setCache] = useState<Record<string, MapActor[]>>({});
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const locate = () => {
    if (!('geolocation' in navigator)) { setGeo('unavailable'); return; }
    setGeo('locating');
    navigator.geolocation.getCurrentPosition(
      p => {
        setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        publishClientPosition(p.coords.latitude, p.coords.longitude);
        setGeo('ok');
      },
      err => setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  /* Position déjà autorisée par le navigateur : on la reprend sans rien demander */
  useEffect(() => {
    let alive = true;
    navigator.permissions?.query({ name: 'geolocation' as PermissionName })
      .then(st => { if (alive && st.state === 'granted') locate(); })
      .catch(() => { /* API absente : on attend le clic */ });
    return () => { alive = false; };
  }, []);

  const nearbyTab = tab === 'company' || tab === 'delivery' ? tab : null;
  const key = pos && nearbyTab ? `${nearbyTab}:${pos.lat.toFixed(2)},${pos.lng.toFixed(2)}` : null;
  const results = key ? cache[key] : undefined;

  useEffect(() => {
    if (!key || !pos || !nearbyTab || cache[key]) return;
    const ctrl = new AbortController();
    searchMapActors({ lat: pos.lat, lng: pos.lng, radiusKm: RADIUS_KM, limit: 20, types: [nearbyTab === 'company' ? 'vendor' : 'delivery'] }, ctrl.signal)
      .then(r => setCache(c => ({ ...c, [key]: r.results ?? [] })))
      .catch(e => { if ((e as Error)?.name !== 'AbortError') setFailedKey(key); });
    return () => ctrl.abort();
  }, [key, pos, nearbyTab, cache]);

  /* Mes conversations dont le contact est en ligne */
  const online = useMemo(() => conversations.filter(c => {
    const u = usersMap.get(c.userId);
    return u && u.role !== 'groupe' && (u.presence ? u.presence === 'online' : u.online);
  }), [conversations, usersMap]);

  const openActor = (a: MapActor) => {
    const type = a.role === 'vendor' ? 'company' : a.role === 'delivery' ? 'delivery' : 'correspondent';
    onStartConversation(apiSearchUserToNewConvUser({ id: a.id, type, name: a.name, logo: a.image, subtitle: a.localisation ?? '', online: false }));
  };

  const tabs: { k: Tab; icon: string; label: string; count?: number }[] = [
    { k: 'company',  icon: 'fa-store',        label: t('messagerie.discover.entreprises') },
    { k: 'delivery', icon: 'fa-motorcycle',   label: t('messagerie.discover.livreurs') },
    { k: 'online',   icon: 'fa-circle',       label: t('messagerie.discover.enLigne'), count: online.length },
    { k: 'stories',  icon: 'fa-circle-play',  label: t('messagerie.discover.stories') },
  ];

  let body: React.ReactNode;
  if (tab === 'stories') {
    body = (
      <div className={s.info}>
        <i className="fas fa-circle-play" />
        <div><strong>{t('messagerie.discover.storiesTitre')}</strong><span>{t('messagerie.discover.storiesTexte')}</span></div>
      </div>
    );
  } else if (tab === 'online') {
    body = online.length ? (
      <div className={s.strip}>
        {online.map(c => {
          const u = usersMap.get(c.userId)!;
          return <Bubble key={c.id} name={u.name} photo={u.ava.startsWith('http') ? u.ava : null} initials={u.ava} online onClick={() => onSelect(c.id)} />;
        })}
      </div>
    ) : <div className={s.empty}>{t('messagerie.discover.personneEnLigne')}</div>;
  } else if (!pos) {
    body = (
      <button className={`${s.info} ${s.infoBtn}`} onClick={locate} disabled={geo === 'locating'}>
        <i className={`fas ${geo === 'locating' ? 'fa-circle-notch fa-spin' : 'fa-location-crosshairs'}`} />
        <div>
          <strong>{geo === 'denied' ? t('messagerie.discover.positionRefusee') : t('messagerie.discover.activerPosition')}</strong>
          <span>{geo === 'denied' ? t('messagerie.discover.positionRefuseeTexte') : t(tab === 'company' ? 'messagerie.discover.pourEntreprises' : 'messagerie.discover.pourLivreurs')}</span>
        </div>
      </button>
    );
  } else if (!results && failedKey === key) {
    body = (
      <button className={`${s.info} ${s.infoBtn}`} onClick={() => setFailedKey(null)}>
        <i className="fas fa-rotate-right" />
        <div><span>{t('messagerie.discover.erreur')}</span></div>
      </button>
    );
  } else if (!results) {
    body = <div className={s.empty}><i className="fas fa-circle-notch fa-spin" /> {t('messagerie.discover.recherche')}</div>;
  } else if (!results.length) {
    body = <div className={s.empty}>{t(tab === 'company' ? 'messagerie.discover.aucuneEntreprise' : 'messagerie.discover.aucunLivreur', { km: RADIUS_KM })}</div>;
  } else {
    body = (
      <div className={s.strip}>
        {results.map(a => (
          <Bubble key={`${a.role}:${a.id}`} name={a.name} photo={a.image} initials={a.name.slice(0, 2).toUpperCase()}
            online={a.available === true} dist={a.distanceKm} onClick={() => openActor(a)} />
        ))}
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <div className={s.tabs} role="tablist">
        {tabs.map(tb => (
          <button key={tb.k} role="tab" aria-selected={tab === tb.k}
            className={`${s.tab} ${tab === tb.k ? s.on : ''} ${tb.k === 'online' ? s.tabOnline : ''}`}
            onClick={() => setTab(tb.k)}>
            <i className={`fas ${tb.icon}`} />
            {tb.label}
            {!!tb.count && <span className={s.count}>{tb.count}</span>}
          </button>
        ))}
      </div>
      <div className={s.body}>{body}</div>
    </div>
  );
}

function Bubble({ name, photo, initials, online, dist, onClick }: {
  name: string; photo: string | null; initials: string; online?: boolean; dist?: number | null; onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button className={s.person} onClick={onClick} title={t('messagerie.discover.ecrireA', { name })}>
      <span className={s.ava}>
        {photo ? <img src={cldAvatar(photo, 112)!} alt="" loading="lazy" /> : <span>{initials.slice(0, 2)}</span>}
        {online && <span className={s.dot} />}
        {dist != null && <span className={s.dist}>{distLabel(dist)}</span>}
      </span>
      <span className={s.name}>{name}</span>
    </button>
  );
}
