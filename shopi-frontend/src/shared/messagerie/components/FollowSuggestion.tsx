/*
 * FICHIER : src/shared/messagerie/components/FollowSuggestion.tsx
 *
 * Bandeau affiché en haut d'une conversation quand un CLIENT écrit à une
 * boutique / un livreur / un correspondant qu'il ne suit pas encore.
 * La messagerie est ouverte à tous (voir MessagingPermissionEngine côté
 * backend) : on ne bloque rien, on prévient et on propose de s'abonner.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatUser } from '../data/messagerieTypes';
import { getRoleFromToken } from '../../services/authUtils';
import { getFollowStatus, toggleFollow, type FollowActorType } from '../../services/follow';
import s from '../styles/FollowSuggestion.module.css';

const ROLE_TO_ACTOR: Partial<Record<ChatUser['role'], FollowActorType>> = {
  vendeur:       'entreprise',
  livreur:       'livreur',
  correspondant: 'correspondant',
};

const dismissKey = (actor: string, id: string) => `shopi_follow_suggestion_${actor}_${id}`;

function wasDismissed(actor: string, id: string): boolean {
  try { return sessionStorage.getItem(dismissKey(actor, id)) === '1'; } catch { return false; }
}

interface Props {
  user:    ChatUser;
  onToast: (msg: string, type?: string) => void;
}

export default function FollowSuggestion({ user, onToast }: Props) {
  const { t } = useTranslation();
  const actor = ROLE_TO_ACTOR[user.role];
  const isClient = getRoleFromToken() === 'client';
  const key = actor ? `${actor}:${user.id}` : '';
  /* Statut connu pour UNE cible (clé) — dérivé plutôt que remis à zéro dans l'effet. */
  const [status, setStatus] = useState<{ key: string; followed: boolean } | null>(null);
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!actor || !isClient || wasDismissed(actor, user.id)) return;
    let cancelled = false;
    getFollowStatus(actor, user.id)
      .then(followed => { if (!cancelled) setStatus({ key, followed }); })
      .catch(() => { /* statut inconnu : on n'affiche rien */ });
    return () => { cancelled = true; };
  }, [actor, isClient, user.id, key]);

  const visible = !!actor && isClient && status?.key === key && !status.followed && hiddenKey !== key;
  if (!visible || !actor) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(dismissKey(actor, user.id), '1'); } catch { /* ignore */ }
    setHiddenKey(key);
  };

  const subscribe = async () => {
    if (pending) return;
    setPending(true);
    try {
      let nowFollowing = await toggleFollow(actor, user.id);
      /* Le toggle a désabonné : l'abonnement existait déjà côté serveur — on rebascule pour finir abonné. */
      if (!nowFollowing) nowFollowing = await toggleFollow(actor, user.id);
      if (nowFollowing) {
        onToast(t('messagerie.followSuggestion.subscribed', { name: user.name }), 's');
        setStatus({ key, followed: true });
      }
    } catch {
      onToast(t('messagerie.followSuggestion.error'), 'e');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={s.bar} role="status">
      <i className={`fas fa-bell ${s.icon}`} aria-hidden="true" />
      <div className={s.text}>
        <strong>{t('messagerie.followSuggestion.title', { name: user.name })}</strong>
        <span>{t('messagerie.followSuggestion.text')}</span>
      </div>
      <button type="button" className={s.subscribe} onClick={subscribe} disabled={pending}>
        {pending ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-plus" />}
        {t('messagerie.followSuggestion.subscribe')}
      </button>
      <button type="button" className={s.close} onClick={dismiss} aria-label={t('messagerie.followSuggestion.close')}>
        <i className="fas fa-xmark" />
      </button>
    </div>
  );
}
