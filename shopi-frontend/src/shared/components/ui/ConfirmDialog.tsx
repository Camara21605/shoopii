/* ============================================================
 * FICHIER : src/shared/components/ui/ConfirmDialog.tsx
 *
 * RÔLE : Fenêtre de confirmation Shoneya — remplace window.confirm() du
 * navigateur (boîte grise, texte « localhost indique », non traduisible,
 * non stylable, bloquante) sur tout le site.
 *
 * UTILISATION (n'importe où, sans prop ni contexte) :
 *   if (!(await confirmDialog({ message: 'Supprimer cette adresse ?', danger: true }))) return;
 *
 * <ConfirmDialogHost /> est monté une seule fois (main.tsx). Échap / clic à
 * l'extérieur / bouton Retour du téléphone = Annuler ; Entrée = Confirmer.
 * ============================================================ */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackDismiss } from '../../hooks/useBackDismiss';
import s from './ConfirmDialog.module.css';

export interface ConfirmOptions {
  /** Texte principal (la question). */
  message:       string;
  /** Titre en gras au-dessus du message (facultatif). */
  title?:        string;
  /** Libellé du bouton de confirmation (défaut : « Confirmer », ou « Supprimer » si danger). */
  confirmLabel?: string;
  cancelLabel?:  string;
  /** Action destructrice (suppression, lecture seule…) : bouton rouge. */
  danger?:       boolean;
  /** Icône Font Awesome (ex. 'fa-trash'). */
  icon?:         string;
}

interface Pending extends ConfirmOptions { resolve: (ok: boolean) => void }

/* ── File d'attente globale (une seule fenêtre à la fois) ── */
let queue: Pending[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

/** Ouvre la fenêtre de confirmation. Renvoie true si l'utilisateur confirme. */
export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === 'string' ? { message: options } : options;
  return new Promise<boolean>(resolve => {
    queue = [...queue, { ...opts, resolve }];
    emit();
  });
}

function settle(ok: boolean) {
  const [current, ...rest] = queue;
  if (!current) return;
  queue = rest;
  emit();
  current.resolve(ok);
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot  = () => queue[0] ?? null;

/* Libellés par défaut — la fenêtre sert dans tous les espaces (accueil, tableaux de bord). */
const LABELS: Record<string, { confirm: string; cancel: string; delete: string }> = {
  fr: { confirm: 'Confirmer', cancel: 'Annuler', delete: 'Supprimer' },
  en: { confirm: 'Confirm',   cancel: 'Cancel',  delete: 'Delete' },
  pt: { confirm: 'Confirmar', cancel: 'Cancelar', delete: 'Eliminar' },
  ar: { confirm: 'تأكيد',     cancel: 'إلغاء',   delete: 'حذف' },
  zh: { confirm: '确认',       cancel: '取消',     delete: '删除' },
};

export function ConfirmDialogHost() {
  const { i18n } = useTranslation();
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  const confirmRef = useRef<HTMLButtonElement>(null);

  /* Bouton Retour du téléphone = Annuler */
  useBackDismiss(!!current, () => settle(false));

  useEffect(() => {
    if (!current) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); settle(false); }
      if (e.key === 'Enter')  { e.preventDefault(); settle(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prevFocus?.focus?.(); };
  }, [current]);

  if (!current) return null;

  const lang = (i18n.language || 'fr').slice(0, 2);
  const L = LABELS[lang] ?? LABELS.fr;
  const confirmLabel = current.confirmLabel ?? (current.danger ? L.delete : L.confirm);
  const icon = current.icon ?? (current.danger ? 'fa-triangle-exclamation' : 'fa-circle-question');

  return (
    <div className={s.backdrop} onMouseDown={e => { if (e.target === e.currentTarget) settle(false); }}>
      <div
        className={s.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={current.title ? 'confirm-title' : undefined}
        aria-describedby="confirm-message"
      >
        <div className={`${s.icon} ${current.danger ? s.iconDanger : ''}`} aria-hidden="true"><i className={`fas ${icon}`} /></div>
        {current.title && <h2 id="confirm-title" className={s.title}>{current.title}</h2>}
        <p id="confirm-message" className={s.message}>{current.message}</p>
        <div className={s.actions}>
          <button type="button" className={s.cancel} onClick={() => settle(false)}>
            {current.cancelLabel ?? L.cancel}
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={`${s.confirm} ${current.danger ? s.confirmDanger : ''}`}
            onClick={() => settle(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
