/*
 * FICHIER : src/shared/messagerie/components/NewConvModal.tsx
 *
 * Recherche réelle d'utilisateurs via GET /api/messagerie/users/search.
 * Tous les acteurs sont inclus : client, vendeur, livreur,
 * correspondant (ajouté), partenaire, admin.
 */
import { useState, useEffect, useRef } from 'react';
import { apiFetch }    from '../../services/apiFetch';
import { ROLE_CONFIG } from '../data/messagerieTypes';
import type { NewConvUser } from '../data/messagerieTypes';
import s from '../styles/NewConvModal.module.css';

// ── Type retourné par l'API ───────────────────────────────────
interface ApiUser {
  id:       string;   // profileId
  type:     string;   // actor type (correspondent, company, …)
  name:     string;
  logo:     string | null;
  subtitle: string;
  online:   boolean;
}

// ── Mapping actorType → UserRole frontend ─────────────────────
const TYPE_TO_ROLE: Record<string, string> = {
  company:       'vendeur',
  delivery:      'livreur',
  partner:       'partenaire',
  correspondent: 'correspondant',
  client:        'client',
  admin:         'admin',
};

function toFrontRole(type: string) {
  return TYPE_TO_ROLE[type] ?? 'client';
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

// ── Skeleton ─────────────────────────────────────────────────
function UserSkeleton() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0' }}>
      <div style={{ width:40, height:40, borderRadius:'50%', flexShrink:0,
        background:'var(--g100)', animation:'shimmer 1.4s infinite' }} />
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
        <div style={{ height:11, borderRadius:4, background:'var(--g100)', width:'55%', animation:'shimmer 1.4s infinite' }} />
        <div style={{ height:9,  borderRadius:4, background:'var(--g50)',  width:'35%', animation:'shimmer 1.4s infinite' }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
  onStart: (user: NewConvUser) => void;
}

export default function NewConvModal({ open, onClose, onStart }: Props) {
  const [search,  setSearch]  = useState('');
  const [results, setResults] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch avec debounce 300ms ────────────────────────────
  useEffect(() => {
    if (!open) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLoading(true);
      apiFetch<ApiUser[]>(`/messagerie/users/search?q=${encodeURIComponent(search)}`)
        .then(data => setResults(Array.isArray(data) ? data : []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [search, open]);

  // ── Reset à la fermeture ─────────────────────────────────
  useEffect(() => {
    if (!open) { setSearch(''); setResults([]); }
  }, [open]);

  function handleStart(api: ApiUser) {
    const role = toFrontRole(api.type) as any;
    const rc   = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG];

    const user: NewConvUser = {
      /* On encode type:id pour que startNewConv sache les deux */
      id:   `${api.type}:${api.id}`,
      name: api.name,
      role,
      ava:  api.logo ?? initials(api.name) ?? rc?.icon ?? '?',
      sub:  api.subtitle,
    };
    onClose();
    setSearch('');
    onStart(user);
  }

  return (
    <div
      className={`${s.overlay} ${open ? s.open : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      <div className={s.modal}>
        <div className={s.hd}>
          <h3>
            <i className="fas fa-comment-dots" style={{ color:'var(--teal,#0E7490)', marginRight:8 }} />
            Nouvelle conversation
          </h3>
          <button className={s.close} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        <div className={s.body}>
          {/* Barre de recherche */}
          <div className={s.search}>
            <i className={`fas ${loading ? 'fa-circle-notch fa-spin' : 'fa-magnifying-glass'}`} />
            <input
              type="text"
              placeholder="Rechercher un utilisateur…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Liste des résultats */}
          <div className={s.userList}>

            {/* Skeletons pendant le chargement */}
            {loading && Array.from({ length: 4 }).map((_, i) => <UserSkeleton key={i} />)}

            {/* Résultats réels */}
            {!loading && results.map(api => {
              const role = toFrontRole(api.type) as any;
              const rc   = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG];
              return (
                <div key={`${api.type}:${api.id}`} className={s.userItem} onClick={() => handleStart(api)}>
                  {/* Avatar */}
                  <div className={s.userAva} style={{ position:'relative' }}>
                    {api.logo
                      ? <img src={api.logo} alt={api.name}
                          style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
                        />
                      : <span style={{ fontSize:18 }}>{rc?.icon ?? '👤'}</span>
                    }
                    {api.online && (
                      <span style={{
                        position:'absolute', bottom:0, right:0,
                        width:10, height:10, borderRadius:'50%',
                        background:'#10B981', border:'2px solid #fff',
                      }} />
                    )}
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div className={s.userName}>{api.name}</div>
                    <div className={s.userSub}>{api.subtitle}</div>
                  </div>

                  {rc && (
                    <span className={s.rolePill} style={{ background: rc.bg, color: rc.color }}>
                      {rc.icon} {rc.label}
                    </span>
                  )}
                </div>
              );
            })}

            {/* État vide */}
            {!loading && results.length === 0 && (
              <div className={s.emptySearch}>
                {search ? 'Aucun utilisateur trouvé' : 'Saisissez un nom pour rechercher'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
