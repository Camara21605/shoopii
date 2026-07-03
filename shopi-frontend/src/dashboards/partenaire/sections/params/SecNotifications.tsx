/* ================================================================
 * FICHIER : sections/params/SecNotifications.tsx
 * Section "Notifications" — alertes et canaux de communication.
 * API : onSave(dto) → PATCH /partenaire/parametres/notifications
 * ================================================================ */

import { useState, useEffect } from 'react';
import s from '../../styles/ParamsShared.module.css';
import type { PartenaireData } from '../../hooks/usePartenaireParametres';

interface Props {
  data:        PartenaireData | null;
  saving:      boolean;
  dirty:       () => void;
  markClean:   () => void;
  saveTrigger: number;
  onSave:      (body: Partial<PartenaireData>) => Promise<void>;
  onToast:     (msg: string, type?: 's' | 'i' | 'w') => void;
}

export default function SecNotifications({
  data, saving, dirty, markClean, saveTrigger, onSave, onToast
}: Props) {
  const [notifActeur, setNotifActeur] = useState(true);
  const [notifComm,   setNotifComm]   = useState(true);
  const [notifSig,    setNotifSig]    = useState(true);
  const [notifPalier, setNotifPalier] = useState(true);
  const [notifNews,   setNotifNews]   = useState(false);
  const [cEmail,      setCEmail]      = useState(true);
  const [cSms,        setCSms]        = useState(true);
  const [cWa,         setCWa]         = useState(true);
  const [cPush,       setCPush]       = useState(false);

  useEffect(() => {
    if (!data) return;
    setNotifActeur(data.notifActeurActive ?? true);
    setNotifComm(data.notifCommission     ?? true);
    setNotifSig(data.notifSignalement     ?? true);
    setNotifPalier(data.notifPalier       ?? true);
    setNotifNews(data.notifNews           ?? false);
    setCEmail(data.canalEmail             ?? true);
    setCSms(data.canalSms                 ?? true);
    setCWa(data.canalWhatsapp             ?? true);
    setCPush(data.canalPush               ?? false);
  }, [data]);

  useEffect(() => {
    if (saveTrigger > 0) handleSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTrigger]);

  async function handleSave() {
    try {
      await onSave({
        notifActeurActive: notifActeur, notifCommission: notifComm,
        notifSignalement: notifSig, notifPalier, notifNews,
        canalEmail: cEmail, canalSms: cSms, canalWhatsapp: cWa, canalPush: cPush,
      });
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
    { ic: 'fa-bullhorn',        t: 'Offres & nouveautés Shopi',d: 'Conseils, programmes et actualités partenaires.',          val: notifNews,   set: setNotifNews   },
  ];
  const CANAUX: TRow[] = [
    { ic: 'fa-envelope',      t: 'Email',              d: '', val: cEmail, set: setCEmail },
    { ic: 'fa-comment-sms',   t: 'SMS',                d: '', val: cSms,   set: setCSms   },
    { ic: 'fab fa-whatsapp',  t: 'WhatsApp',           d: '', val: cWa,    set: setCWa    },
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
          {CANAUX.map(r => <TogRow key={r.t} row={r} />)}
        </div>
      </div>
    </>
  );
}
