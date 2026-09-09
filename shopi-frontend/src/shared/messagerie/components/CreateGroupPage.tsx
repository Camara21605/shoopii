/**
 * src/shared/messagerie/components/CreateGroupPage.tsx
 *
 * "⋮ > Paramètres > Ajouter un groupe" — crée un groupe LIBRE (voir
 * DeliveryGroupKind.CUSTOM côté backend), indépendant de toute commande :
 * titre choisi par le créateur + membres choisis à la main parmi les
 * contacts réels (même recherche que GET /messagerie/users/search).
 *
 * Remplace ChatWindow dans la colonne centrale (voir MessagerieCore.tsx) —
 * PAS une fenêtre modale centrée : même traitement "page plein-cadre" que
 * l'écran "Nouveau groupe" de WhatsApp (flèche retour, formulaire, barre
 * d'actions en bas), demandé explicitement après SettingsPanel/InfoPanel.
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../services/apiFetch';
import { cldAvatar } from '../utils/chatUtils';
import type { ApiSearchUser } from '../data/messagerieTypes';
import s from '../styles/CreateGroupPage.module.css';

interface Props {
  onClose:   () => void;
  onCreate:  (name: string, members: { type: string; id: string }[]) => Promise<string>;
  onCreated: (groupId: string) => void;
  onToast:   (msg: string, type?: string) => void;
}

export default function CreateGroupPage({ onClose, onCreate, onCreated, onToast }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiSearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ApiSearchUser[]>([]);
  const [creating, setCreating] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  /* Debounce — même délai (120ms) que la recherche globale du topbar entreprise.
   * BUG CORRIGÉ — la recherche ne se déclenchait qu'à partir d'un caractère
   * tapé (retour anticipé ci-dessous, résultats vidés sinon) : la page
   * s'ouvrait donc sur une liste vide tant qu'on n'avait rien tapé. Le
   * backend (GET /messagerie/users/search) accepte déjà q='' et renvoie
   * alors tous les contacts liés (commande/abonnement/répertoire) sans
   * filtrer par nom — on l'appelle donc aussi avec une recherche vide,
   * dès le montage, comme la liste de contacts de WhatsApp. */
  useEffect(() => {
    const q = query.trim();
    setSearching(true);
    const timer = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      try {
        const list = await apiFetch<ApiSearchUser[]>('/messagerie/users/search', {
          params: { q },
          signal: controller.signal,
        });
        setResults(Array.isArray(list) ? list : []);
      } catch { /* silencieux — recherche annulée ou échouée */ }
      finally { setSearching(false); }
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);

  function toggleMember(u: ApiSearchUser) {
    setSelected(prev => {
      const exists = prev.some(m => m.type === u.type && m.id === u.id);
      if (exists) return prev.filter(m => !(m.type === u.type && m.id === u.id));
      return [...prev, u];
    });
  }

  function isSelected(u: ApiSearchUser): boolean {
    return selected.some(m => m.type === u.type && m.id === u.id);
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || selected.length === 0 || creating) return;
    setCreating(true);
    try {
      const groupId = await onCreate(trimmed, selected.map(m => ({ type: m.type, id: m.id })));
      onToast(t('messagerie.createGroup.succes'), 's');
      onCreated(groupId);
      onClose();
    } catch (err: any) {
      onToast(err?.message || t('messagerie.createGroup.echec'), 'e');
    } finally {
      setCreating(false);
    }
  }

  const canCreate = name.trim().length > 0 && selected.length > 0 && !creating;

  return (
    <div className={s.page}>
      <div className={s.hd}>
        <button className={s.hdBack} onClick={onClose}><i className="fas fa-arrow-left" /></button>
        <div className={s.hdTitle}><i className="fas fa-users" /> {t('messagerie.createGroup.titre')}</div>
      </div>

      <div className={s.body}>
        <div className={s.field}>
          <label className={s.label}>{t('messagerie.createGroup.nomLabel')}</label>
          <input
            className={s.nameInput}
            type="text"
            value={name}
            maxLength={100}
            placeholder={t('messagerie.createGroup.nomPlaceholder')}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>

        {selected.length > 0 && (
          <div className={s.chips}>
            {selected.map(m => (
              <span key={`${m.type}:${m.id}`} className={s.chip}>
                {m.name}
                <button className={s.chipX} onClick={() => toggleMember(m)}><i className="fas fa-xmark" /></button>
              </span>
            ))}
          </div>
        )}

        <div className={s.field}>
          <label className={s.label}>{t('messagerie.createGroup.membresLabel')}</label>
          <div className={s.searchWrap}>
            <i className="fas fa-magnifying-glass" />
            <input
              className={s.searchInput}
              type="text"
              value={query}
              placeholder={t('messagerie.createGroup.rechercherPlaceholder')}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className={s.results}>
          {searching ? (
            <div className={s.state}><i className="fas fa-spinner fa-spin" /></div>
          ) : results.length === 0 ? (
            <div className={s.state}>
              {query.trim().length > 0
                ? t('messagerie.createGroup.aucunResultat')
                : t('messagerie.createGroup.aucunContact')}
            </div>
          ) : (
            results.map(u => (
              <button
                key={`${u.type}:${u.id}`}
                className={`${s.resultItem} ${isSelected(u) ? s.resultItemActive : ''}`}
                onClick={() => toggleMember(u)}
              >
                {u.logo?.startsWith('http')
                  ? <img src={cldAvatar(u.logo, 64)!} alt="" className={s.resultAva} />
                  : <span className={s.resultAva}>{u.logo || u.name.charAt(0).toUpperCase()}</span>}
                <span className={s.resultInfo}>
                  <span className={s.resultName}>{u.name}</span>
                  <span className={s.resultSub}>{u.subtitle}</span>
                </span>
                {isSelected(u) && <i className={`fas fa-circle-check ${s.resultCheck}`} />}
              </button>
            ))
          )}
        </div>
      </div>

      <div className={s.footer}>
        <div className={s.footerInner}>
          <button className={s.btnSecondary} onClick={onClose}>{t('messagerie.createGroup.annuler')}</button>
          <button className={s.btnPrimary} disabled={!canCreate} onClick={handleCreate}>
            {creating ? <i className="fas fa-spinner fa-spin" /> : t('messagerie.createGroup.creer')}
          </button>
        </div>
      </div>
    </div>
  );
}
