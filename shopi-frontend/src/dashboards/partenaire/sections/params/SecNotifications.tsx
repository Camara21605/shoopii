/* ================================================================
 * FICHIER : sections/params/SecNotifications.tsx
 * Section "Notifications" — alertes et canaux de communication.
 *
 * BUG CORRIGÉ — cette section lisait/écrivait exclusivement
 * Partner.notifSettings (PATCH /partenaire/parametres/notifications), un
 * blob JSON legacy que le moteur de notifications réel (NotificationService
 * .resolveExternalChannels(), voir notification.service.ts) ne lit JAMAIS :
 * activer/désactiver "Email"/"SMS"/"Push" ici n'avait donc AUCUN effet sur
 * les notifications effectivement envoyées. Le vrai réglage vit dans
 * NotificationPreference (GET/PATCH /notifications/preferences, déjà
 * utilisé par tous les rôles) — "Canaux" et "Commission créditée" sont
 * maintenant branchés dessus. Le canal "WhatsApp" a été retiré : il
 * n'existe tout simplement pas dans NotificationChannel (in_app/push/
 * email/sms uniquement) — c'était un bouton 100% décoratif.
 *
 * "Nouvel acteur activé" / "Suivi des signalements" / "Changement de
 * palier" restent stockés dans Partner.notifSettings : ce sont des
 * catégories, alors que le moteur réel ne filtre que par NotificationType
 * précis (un par événement) — les regrouper sous un type générique unique
 * les ferait se désactiver les uns les autres. "Nouvel acteur activé" a
 * désormais un vrai déclencheur côté backend (voir
 * NotificationEventService.notifyPartnerActeurActivated(), appelé depuis
 * AdminActeursService.approveValidation()) mais n'est pas encore filtrable
 * individuellement pour cette raison — reste toujours envoyé si les
 * canaux globaux ci-dessous sont activés.
 * ================================================================ */

import { useState, useEffect } from 'react';
import s from '../../styles/ParamsShared.module.css';
import type { PartenaireData } from '../../hooks/usePartenaireParametres';
import { apiFetch } from '../../../../shared/services/apiFetch';

interface Props {
  data:        PartenaireData | null;
  saving:      boolean;
  dirty:       () => void;
  markClean:   () => void;
  saveTrigger: number;
  onSave:      (body: Partial<PartenaireData>) => Promise<void>;
  onToast:     (msg: string, type?: 's' | 'i' | 'w') => void;
}

/* Réponse de GET /notifications/preferences (NotificationPreference) —
 * seuls les champs utilisés ici sont déclarés. */
interface NotificationPreferences {
  globalPushEnabled:  boolean;
  globalEmailEnabled: boolean;
  globalSmsEnabled:   boolean;
  preferences: Record<string, { in_app?: boolean; push?: boolean; email?: boolean; sms?: boolean }> | null;
}

/* Type réel utilisé par le backend quand une commission est créditée —
 * voir notifyCommissionReceived()/notifyWalletOperation() (CREDIT). */
const COMMISSION_TYPE = 'payment.sent';

export default function SecNotifications({
  data, saving, dirty, markClean, saveTrigger, onSave, onToast
}: Props) {
  /* ── Catégories encore stockées dans Partner.notifSettings ── */
  const [notifActeur, setNotifActeur] = useState(true);
  const [notifSig,    setNotifSig]    = useState(true);
  const [notifPalier, setNotifPalier] = useState(true);
  const [notifNews,   setNotifNews]   = useState(false);

  /* ── Canaux + "Commission créditée" — moteur réel ── */
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [notifComm,    setNotifComm]    = useState(true);
  const [cEmail,       setCEmail]       = useState(true);
  const [cSms,         setCSms]         = useState(false);
  const [cPush,        setCPush]        = useState(true);

  useEffect(() => {
    if (!data) return;
    setNotifActeur(data.notifActeurActive ?? true);
    setNotifSig(data.notifSignalement     ?? true);
    setNotifPalier(data.notifPalier       ?? true);
    setNotifNews(data.notifNews           ?? false);
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<NotificationPreferences>('/notifications/preferences')
      .then(p => {
        if (cancelled) return;
        setCEmail(p.globalEmailEnabled);
        setCSms(p.globalSmsEnabled);
        setCPush(p.globalPushEnabled);
        const commissionPref = p.preferences?.[COMMISSION_TYPE];
        setNotifComm(commissionPref ? Object.values(commissionPref).some(Boolean) : true);
      })
      .catch(() => { /* réglages par défaut conservés en cas d'échec */ })
      .finally(() => { if (!cancelled) setPrefsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (saveTrigger > 0) handleSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTrigger]);

  async function handleSave() {
    try {
      await Promise.all([
        onSave({
          notifActeurActive: notifActeur,
          notifSignalement:  notifSig,
          notifPalier,
          notifNews,
        }),
        apiFetch('/notifications/preferences', {
          method: 'PATCH',
          body: {
            globalEmailEnabled: cEmail,
            globalSmsEnabled:   cSms,
            globalPushEnabled:  cPush,
            preferences: {
              [COMMISSION_TYPE]: {
                in_app: notifComm, push: notifComm, email: notifComm, sms: notifComm,
              },
            },
          },
        }),
      ]);
      markClean();
      onToast('✅ Notifications sauvegardées', 's');
    } catch {
      onToast('❌ Erreur lors de la sauvegarde', 'w');
    }
  }

  type TRow = { ic: string; t: string; d: string; val: boolean; set: (v: boolean) => void };
  const ALERTES: TRow[] = [
    { ic: 'fa-user-plus',       t: 'Nouvel acteur activé',    d: "Quand un acteur que vous avez recruté crée son compte.",     val: notifActeur, set: setNotifActeur },
    { ic: 'fa-coins',           t: 'Commission créditée',     d: 'À chaque commission ajoutée à votre solde.',               val: notifComm,   set: setNotifComm   },
    { ic: 'fa-shield-halved',   t: 'Suivi des signalements',  d: 'Mises à jour sur les signalements que vous avez envoyés.', val: notifSig,    set: setNotifSig    },
    { ic: 'fa-award',           t: 'Changement de palier',    d: 'Quand vous progressez vers un nouveau niveau partenaire.', val: notifPalier, set: setNotifPalier },
    { ic: 'fa-bullhorn',        t: 'Offres & nouveautés Shoneya',d: 'Conseils, programmes et actualités partenaires.',          val: notifNews,   set: setNotifNews   },
  ];
  const CANAUX: TRow[] = [
    { ic: 'fa-envelope',      t: 'Email',              d: '', val: cEmail, set: setCEmail },
    { ic: 'fa-comment-sms',   t: 'SMS',                d: '', val: cSms,   set: setCSms   },
    { ic: 'fa-bell',          t: 'Notifications push', d: '', val: cPush,  set: setCPush  },
  ];

  function TogRow({ row }: { row: TRow }) {
    return (
      <div className={s.trow}>
        <div className={s.trowIc}><i className={`fas ${row.ic}`} /></div>
        <div className={s.trowMain}>
          <div className={s.trowT}>{row.t}</div>
          {row.d && <div className={s.trowD}>{row.d}</div>}
        </div>
        <div
          className={`${s.toggle} ${row.val ? s.toggleOn : ''}`}
          onClick={() => { row.set(!row.val); dirty(); }}
          role="switch" aria-checked={row.val}
        />
      </div>
    );
  }

  return (
    <>
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div>
            <div className={s.fcTtl}><i className="fas fa-bell" /> Notifications</div>
            <div className={s.fcSub}>Choisissez ce dont vous voulez être informé.</div>
          </div>
        </div>
        <div className={s.fcBody}>
          {ALERTES.map(r => <TogRow key={r.t} row={r} />)}
        </div>
      </div>

      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-paper-plane" /> Canaux</div>
        </div>
        <div className={s.fcBody}>
          {prefsLoading
            ? <div style={{ padding: '10px 0', fontSize: 12.5, color: 'var(--t3)' }}>Chargement…</div>
            : CANAUX.map(r => <TogRow key={r.t} row={r} />)}
        </div>
      </div>
    </>
  );
}
