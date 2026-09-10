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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      onToast(t('partenaireParametres.secNotifications.savedToast'), 's');
    } catch {
      onToast(t('partenaireParametres.secNotifications.errorToast'), 'w');
    }
  }

  type TRow = { key: string; ic: string; t: string; d: string; val: boolean; set: (v: boolean) => void };
  const ALERTES: TRow[] = [
    { key: 'acteur', ic: 'fa-user-plus',     t: t('partenaireParametres.secNotifications.alertes.acteur.t'), d: t('partenaireParametres.secNotifications.alertes.acteur.d'), val: notifActeur, set: setNotifActeur },
    { key: 'comm',   ic: 'fa-coins',         t: t('partenaireParametres.secNotifications.alertes.comm.t'),   d: t('partenaireParametres.secNotifications.alertes.comm.d'),   val: notifComm,   set: setNotifComm   },
    { key: 'sig',    ic: 'fa-shield-halved', t: t('partenaireParametres.secNotifications.alertes.sig.t'),    d: t('partenaireParametres.secNotifications.alertes.sig.d'),    val: notifSig,    set: setNotifSig    },
    { key: 'palier', ic: 'fa-award',         t: t('partenaireParametres.secNotifications.alertes.palier.t'), d: t('partenaireParametres.secNotifications.alertes.palier.d'), val: notifPalier, set: setNotifPalier },
    { key: 'news',   ic: 'fa-bullhorn',      t: t('partenaireParametres.secNotifications.alertes.news.t'),   d: t('partenaireParametres.secNotifications.alertes.news.d'),   val: notifNews,   set: setNotifNews   },
  ];
  const CANAUX: TRow[] = [
    { key: 'email', ic: 'fa-envelope',    t: t('partenaireParametres.secNotifications.canaux.email'), d: '', val: cEmail, set: setCEmail },
    { key: 'sms',   ic: 'fa-comment-sms', t: t('partenaireParametres.secNotifications.canaux.sms'),   d: '', val: cSms,   set: setCSms   },
    { key: 'push',  ic: 'fa-bell',        t: t('partenaireParametres.secNotifications.canaux.push'),  d: '', val: cPush,  set: setCPush  },
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
            <div className={s.fcTtl}><i className="fas fa-bell" /> {t('partenaireParametres.secNotifications.card1.title')}</div>
            <div className={s.fcSub}>{t('partenaireParametres.secNotifications.card1.sub')}</div>
          </div>
        </div>
        <div className={s.fcBody}>
          {ALERTES.map(r => <TogRow key={r.key} row={r} />)}
        </div>
      </div>

      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-paper-plane" /> {t('partenaireParametres.secNotifications.card2Title')}</div>
        </div>
        <div className={s.fcBody}>
          {prefsLoading
            ? <div style={{ padding: '10px 0', fontSize: 12.5, color: 'var(--t3)' }}>{t('partenaireParametres.secNotifications.chargement')}</div>
            : CANAUX.map(r => <TogRow key={r.key} row={r} />)}
        </div>
      </div>
    </>
  );
}
