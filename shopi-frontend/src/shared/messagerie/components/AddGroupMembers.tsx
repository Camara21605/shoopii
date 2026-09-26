/**
 * src/shared/messagerie/components/AddGroupMembers.tsx
 *
 * Panneau Informations d'un groupe libre → « Ajouter des membres »
 * (administrateur uniquement). Même recherche de contacts que la création
 * d'un groupe (GET /messagerie/users/search) ; les membres déjà présents
 * sont affichés mais non sélectionnables.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../services/apiFetch';
import { cldAvatar } from '../utils/chatUtils';
import type { ApiSearchUser, GroupMember } from '../data/messagerieTypes';
import s from '../styles/AddGroupMembers.module.css';

interface Props {
  members: GroupMember[];
  onAdd:   (refs: { type: string; id: string }[]) => Promise<void>;
  onDone:  () => void;
  onToast: (msg: string, type?: string) => void;
}

export default function AddGroupMembers({ members, onAdd, onDone, onToast }: Props) {
  const { t } = useTranslation();
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState<ApiSearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected,  setSelected]  = useState<ApiSearchUser[]>([]);
  const [saving,    setSaving]    = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const isMember = (u: ApiSearchUser) => members.some(m => m.actorType === u.type && m.actorId === u.id);
  const isPicked = (u: ApiSearchUser) => selected.some(m => m.type === u.type && m.id === u.id);

  /* Recherche (aussi à vide : liste des contacts, comme à la création d'un groupe) */
  useEffect(() => {
    setSearching(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const list = await apiFetch<ApiSearchUser[]>('/messagerie/users/search', { params: { q: query.trim() }, signal: controller.signal });
        setResults(Array.isArray(list) ? list : []);
      } catch { /* recherche annulée ou échouée */ }
      finally { setSearching(false); }
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const toggle = (u: ApiSearchUser) => {
    if (isMember(u)) return;
    setSelected(prev => isPicked(u) ? prev.filter(m => !(m.type === u.type && m.id === u.id)) : [...prev, u]);
  };

  const submit = async () => {
    if (selected.length === 0 || saving) return;
    setSaving(true);
    try {
      await onAdd(selected.map(m => ({ type: m.type, id: m.id })));
      onToast(t('messagerie.groupeGestion.membresAjoutes', { count: selected.length }), 's');
      onDone();
    } catch (err: any) {
      onToast(err?.message || t('messagerie.groupeGestion.ajoutEchec'), 'e');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={s.wrap}>
      <div className={s.searchWrap}>
        <i className="fas fa-magnifying-glass" aria-hidden="true" />
        <input
          className={s.search}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('messagerie.groupeGestion.rechercher')}
          autoFocus
        />
      </div>

      {selected.length > 0 && (
        <div className={s.chips}>
          {selected.map(m => (
            <span key={`${m.type}:${m.id}`} className={s.chip}>
              {m.name}
              <button type="button" onClick={() => toggle(m)} aria-label={t('messagerie.groupeGestion.retirer')}><i className="fas fa-xmark" /></button>
            </span>
          ))}
        </div>
      )}

      <div className={s.list}>
        {searching ? (
          <div className={s.state}><i className="fas fa-spinner fa-spin" /></div>
        ) : results.length === 0 ? (
          <div className={s.state}>{t('messagerie.groupeGestion.aucunContact')}</div>
        ) : results.map(u => {
          const already = isMember(u);
          return (
            <button
              type="button"
              key={`${u.type}:${u.id}`}
              className={`${s.item} ${isPicked(u) ? s.itemOn : ''}`}
              onClick={() => toggle(u)}
              disabled={already}
            >
              {u.logo?.startsWith('http')
                ? <img src={cldAvatar(u.logo, 64)!} alt="" className={s.ava} />
                : <span className={s.ava}>{u.logo || u.name.charAt(0).toUpperCase()}</span>}
              <span className={s.info}>
                <span className={s.name}>{u.name}</span>
                <span className={s.sub}>{already ? t('messagerie.groupeGestion.dejaMembre') : u.subtitle}</span>
              </span>
              {isPicked(u) && <i className={`fas fa-circle-check ${s.check}`} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <button type="button" className={s.submit} disabled={selected.length === 0 || saving} onClick={submit}>
        {saving
          ? <i className="fas fa-spinner fa-spin" />
          : <><i className="fas fa-user-plus" /> {t('messagerie.groupeGestion.ajouterN', { count: selected.length })}</>}
      </button>
    </div>
  );
}
