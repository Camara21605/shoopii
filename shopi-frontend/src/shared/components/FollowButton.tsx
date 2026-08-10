/* ================================================================
 * FICHIER : src/shared/components/FollowButton.tsx
 *
 * RÔLE : Bouton de suivi partagé pour les 3 types d'acteurs suivables
 *        (boutique/entreprise, livreur, correspondant), utilisé sur
 *        TOUTES les cartes/pages où un bouton "S'abonner" existe.
 *
 *   - Pas suivi   → bouton "S'abonner" (clic = suit), à l'endroit où le
 *                    composant est placé (généralement la rangée de
 *                    boutons de la carte).
 *   - Suivi       → badge non-cliquable "Suivi(e)" au même endroit,
 *                    PLUS un menu ⋮ ancré en haut à droite de la carte
 *                    (position: absolute par rapport à l'ancêtre le
 *                    plus proche en position:relative — la carte elle-
 *                    même dans la quasi-totalité des cas) avec :
 *       "Se désabonner" — désabonnement classique, la carte reste
 *                          affichée avec le bouton "S'abonner".
 *       "Masquer"/"Réafficher" — cache la carte des listes de
 *                          découverte SANS se désabonner (réversible
 *                          depuis "Mes abonnements" → onglet Masqués).
 *       "Supprimer"     — comme se désabonner, mais retire aussi
 *                          immédiatement la carte de la liste affichée.
 *
 * Le menu déroulant (pas le déclencheur ⋮) est rendu via un portail
 * dans document.body, positionné en JS depuis les coordonnées réelles
 * du bouton ⋮ — nécessaire car la plupart des cartes de l'app ont
 * `overflow: hidden` (coins arrondis + image de couverture), ce qui
 * couperait un simple dropdown en position:absolute imbriqué dedans.
 *
 * Composant auto-suffisant : fait lui-même les appels réseau (via
 * shared/services/follow.ts) et gère sa propre surcharge locale
 * optimiste (comme useBoutiqueFollow/CardCorrespondant le faisaient
 * chacun de leur côté) — évite de dupliquer ce state dans les ~18
 * cartes/pages qui l'utilisent. onChange reste utile au parent pour
 * synchroniser sa propre liste (surtout `removed` → retirer l'item).
 * ================================================================ */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import { tokenStorage } from '../services/apiFetch';
import { toggleFollow, setFollowHidden, type FollowActorType } from '../services/follow';

interface FollowButtonProps {
  actorType: FollowActorType;
  id:        string;
  name:      string;
  isSuivi:   boolean;
  /** true seulement dans "Mes abonnements" (onglet Masqués) — ailleurs
   *  un item masqué n'apparaît simplement pas dans les listes. */
  hidden?:   boolean;
  onToast:        (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  onRequireAuth:  () => void;
  onChange:       (next: { isSuivi: boolean; hidden?: boolean; removed?: boolean }) => void;
}

const LABELS: Record<FollowActorType, string> = {
  entreprise:    'cette boutique',
  livreur:       'ce livreur',
  correspondant: 'ce correspondant',
};

export default function FollowButton({
  actorType, id, name, isSuivi: isSuiviProp, hidden: hiddenProp = false,
  onToast, onRequireAuth, onChange,
}: FollowButtonProps) {
  const [pending,  setPending]  = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos,  setMenuPos]  = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef     = useRef<HTMLDivElement>(null);

  /* Surcharge locale optimiste — réinitialisée si le parent renvoie
   * une nouvelle valeur réelle (ex. rechargement complet de la liste). */
  const [override, setOverride] = useState<{ isSuivi: boolean; hidden: boolean } | null>(null);
  useEffect(() => { setOverride(null); }, [isSuiviProp, hiddenProp]);

  const isSuivi = override?.isSuivi ?? isSuiviProp;
  const hidden  = override?.hidden  ?? hiddenProp;

  /* Ouvre le menu : calcule sa position à l'écran depuis le bouton ⋮
   * (rendu via portail — voir commentaire d'en-tête). */
  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  /* Ferme le menu au clic en dehors, au scroll ou au redimensionnement
   * (le menu étant en portail, il ne suit pas le scroll de la carte). */
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => {
      if (e.type === 'mousedown') {
        const t = e.target as Node;
        if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      }
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menuOpen]);

  async function handleFollow() {
    if (!tokenStorage.get()) { onRequireAuth(); return; }
    if (pending) return;
    /* Optimiste : le bouton "S'abonner" doit disparaître IMMÉDIATEMENT
     * (remplacé par le badge "Suivi(e)"), sans attendre la réponse
     * réseau — reconcilié/annulé ci-dessous si le serveur contredit. */
    setOverride({ isSuivi: true, hidden: false });
    onChange({ isSuivi: true });
    setPending(true);
    try {
      const confirmed = await toggleFollow(actorType, id);
      setOverride({ isSuivi: confirmed, hidden: false });
      onChange({ isSuivi: confirmed });
      onToast(confirmed ? `✅ Abonné à ${name}` : `👋 Désabonné de ${name}`, confirmed ? 's' : 'i');
    } catch (e: any) {
      setOverride({ isSuivi: false, hidden: false });
      onChange({ isSuivi: false });
      onToast(`❌ ${e?.message ?? 'Erreur lors du suivi.'}`, 'e');
    } finally {
      setPending(false);
    }
  }

  async function handleUnfollow(removeFromList: boolean) {
    if (pending) return;
    setMenuOpen(false);
    /* Optimiste — voir handleFollow. */
    setOverride({ isSuivi: false, hidden: false });
    onChange({ isSuivi: false, removed: removeFromList });
    setPending(true);
    try {
      const confirmed = await toggleFollow(actorType, id);
      setOverride({ isSuivi: confirmed, hidden: false });
      onChange({ isSuivi: confirmed, removed: removeFromList && !confirmed });
      onToast(`👋 Désabonné de ${name}`, 'i');
    } catch (e: any) {
      setOverride({ isSuivi: true, hidden: false });
      onChange({ isSuivi: true });
      onToast(`❌ ${e?.message ?? 'Erreur lors du désabonnement.'}`, 'e');
    } finally {
      setPending(false);
    }
  }

  async function handleToggleHidden() {
    if (pending) return;
    setMenuOpen(false);
    const next = !hidden;
    /* Optimiste — voir handleFollow. */
    setOverride({ isSuivi: true, hidden: next });
    onChange({ isSuivi: true, hidden: next });
    setPending(true);
    try {
      const confirmed = await setFollowHidden(actorType, id, next);
      setOverride({ isSuivi: true, hidden: confirmed });
      onChange({ isSuivi: true, hidden: confirmed });
      onToast(confirmed ? `🙈 ${LABELS[actorType]} masqué(e) des listes` : `👁️ ${LABELS[actorType]} réaffiché(e)`, 'i');
    } catch (e: any) {
      setOverride({ isSuivi: true, hidden: !next });
      onChange({ isSuivi: true, hidden: !next });
      onToast(`❌ ${e?.message ?? 'Erreur lors du masquage.'}`, 'e');
    } finally {
      setPending(false);
    }
  }

  /* ── Pas suivi : simple bouton "S'abonner" ── */
  if (!isSuivi) {
    return (
      <button
        onClick={e => { e.stopPropagation(); handleFollow(); }}
        disabled={pending}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 999,
          border: 'none', background: 'var(--blue, #1A4FC4)', color: '#fff',
          fontSize: 12.5, fontWeight: 700, cursor: pending ? 'not-allowed' : 'pointer',
          opacity: pending ? .7 : 1, whiteSpace: 'nowrap',
        }}
      >
        {pending
          ? <i className="fas fa-spinner fa-spin" />
          : <><i className="fas fa-plus" /> S'abonner</>}
      </button>
    );
  }

  /* ── Suivi : badge "Suivi(e)" ici + menu ⋮ ancré en haut à droite
   * de la carte ; le dropdown lui-même part en portail (voir en-tête). ── */
  return (
    <>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 999,
        background: 'rgba(5,150,105,.1)', color: '#059669',
        fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
      }}>
        <i className="fas fa-check" /> Suivi(e)
      </span>

      <button
        ref={triggerRef}
        onClick={e => { e.stopPropagation(); menuOpen ? setMenuOpen(false) : openMenu(); }}
        title="Options"
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, borderRadius: '50%',
          border: '1.5px solid rgba(255,255,255,.7)', background: 'rgba(255,255,255,.92)',
          boxShadow: '0 2px 8px rgba(0,0,0,.15)',
          color: 'var(--t2, #475569)', cursor: 'pointer',
        }}
      >
        <i className="fas fa-ellipsis-vertical" />
      </button>

      {menuOpen && menuPos && createPortal(
        <div
          ref={menuRef}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 10000,
            background: '#fff', border: '1.5px solid var(--bdr2, #E2E8F0)', borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,.18)', minWidth: 190, overflow: 'hidden',
          }}
        >
          <button onClick={() => handleUnfollow(false)} style={menuItemStyle}>
            <i className="fas fa-user-minus" style={{ width: 14, color: 'var(--t3)' }} /> Se désabonner
          </button>
          <button onClick={handleToggleHidden} style={menuItemStyle}>
            <i className={`fas ${hidden ? 'fa-eye' : 'fa-eye-slash'}`} style={{ width: 14, color: 'var(--t3)' }} />
            {hidden ? 'Réafficher' : 'Masquer'}
          </button>
          <button
            onClick={() => handleUnfollow(true)}
            style={{ ...menuItemStyle, color: '#DC2626', borderTop: '1px solid var(--g100, #F1F5F9)' }}
          >
            <i className="fas fa-trash-can" style={{ width: 14, color: '#DC2626' }} /> Supprimer
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

const menuItemStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
  padding: '10px 14px', border: 'none', background: 'none',
  fontSize: 12.5, fontWeight: 600, color: 'var(--t1, #0B1F3A)',
  cursor: 'pointer', textAlign: 'left',
};
