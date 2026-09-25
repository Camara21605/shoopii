/* ================================================================
 * src/modules/home/components/settings/pages/components/SettingsMobileMenu.tsx
 *
 * Écran racine des paramètres en mode téléphone : liste groupée avec
 * icônes + libellés + chevrons/interrupteurs (même esprit qu'un écran
 * de réglages natif), affichée à la place de la barre d'onglets
 * horizontale (SettingsTabs) quand l'écran est étroit — voir
 * SettingsPage.tsx. Chaque ligne pointe vers une fonctionnalité RÉELLE
 * déjà branchée au backend ; rien n'a été inventé pour ressembler à la
 * maquette (pas de bascule clair/sombre : le site est en mode sombre
 * uniquement, voir ApparenceSection).
 * ================================================================ */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import type { PanelId } from './panels';
import { Toggle } from './Toggle';
import { useSecurityBadge } from '../hooks/useSecurityBadge';
import { settingsApi } from '../../api/settings.api';
import sCard from '../styles/SettingsCard.module.css';
import s from '../styles/SettingsMobileMenu.module.css';

interface Props {
  onOpen:      (id: PanelId) => void;
  onLogout:    () => void;
  onToast:     (msg: string) => void;
  displayName: string;
  email?:      string;
}

interface RowProps {
  icon:    string;
  iconCls: string;
  label:   string;
  desc?:   string;
  badge?:  number;
  danger?: boolean;
  onClick: () => void;
}

function Row({ icon, iconCls, label, desc, badge, danger, onClick }: RowProps) {
  return (
    <button type="button" className={`${s.row} ${danger ? s.dangerRow : ''}`} onClick={onClick}>
      <div className={`${s.icon} ${iconCls}`}><i className={`fas ${icon}`} /></div>
      <div className={s.labelBlock}>
        <div className={s.label}>{label}</div>
        {desc && <div className={s.desc}>{desc}</div>}
      </div>
      <div className={s.right}>
        {!!badge && <span className={s.badge}>{badge}</span>}
        <i className={`fas fa-chevron-right ${s.chevron}`} />
      </div>
    </button>
  );
}

export default function SettingsMobileMenu({ onOpen, onLogout, onToast, displayName, email }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const secBadge = useSecurityBadge();

  /* Interrupteur rapide "Notifications" — reflète et modifie le même réglage
   * global.push que NotifsSection (GET/PATCH /client/parametres/notifs).
   * Le reste des préférences (catégories, e-mail, Ne pas déranger) reste
   * accessible en tapant sur le libellé, qui ouvre le panneau complet. */
  const [notifPush, setNotifPush] = useState<boolean | null>(null);
  const [notifEmail, setNotifEmail] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  useEffect(() => {
    settingsApi.getNotifs()
      .then(v => { setNotifPush(v.global.push); setNotifEmail(v.global.email); })
      .catch(() => { /* l'interrupteur reste masqué (null) si le chargement échoue */ });
  }, []);

  async function toggleNotifPush(next: boolean) {
    if (notifSaving) return;
    setNotifSaving(true);
    setNotifPush(next);
    try {
      const v = await settingsApi.updateNotifs({ global: { push: next, email: notifEmail } });
      setNotifPush(v.global.push);
      setNotifEmail(v.global.email);
    } catch (err) {
      setNotifPush(!next);
      const message = err instanceof Error ? err.message : String(err);
      onToast(`❌ ${message}`);
    } finally {
      setNotifSaving(false);
    }
  }

  async function handleShare() {
    const url   = `${window.location.origin}/home`;
    const title = t('settingsPage.mobileMenu.share.title');
    const text  = t('settingsPage.mobileMenu.share.text');

    if (navigator.share) {
      try { await navigator.share({ title, text, url }); }
      catch (err) {
        /* AbortError = l'utilisateur a fermé la boîte de partage — pas une erreur à signaler. */
        const aborted = err instanceof DOMException && err.name === 'AbortError';
        if (!aborted) onToast(t('settingsPage.mobileMenu.share.failed'));
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      onToast(t('settingsPage.mobileMenu.share.copied'));
    } catch {
      onToast(t('settingsPage.mobileMenu.share.failed'));
    }
  }

  const comingSoon = () => onToast(t('settingsPage.mobileMenu.comingSoon'));
  const initials = (displayName.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')) || '?';

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <span className={s.headerTitle}>{t('settingsPage.mobileMenu.title')}</span>
      </div>

      {/* ── Résumé profil ── */}
      <button type="button" className={s.profileRow} onClick={() => onOpen('profil')}>
        <div className={s.profileAvatar}>{initials}</div>
        <div className={s.profileInfo}>
          <div className={s.profileName}>{displayName || t('settingsPage.mobileMenu.accountFallback')}</div>
          {email && <div className={s.profileSub}>{email}</div>}
        </div>
        <i className={`fas fa-chevron-right ${s.chevron}`} />
      </button>

      {/* ── Général ── */}
      <div className={s.group}>
        <div className={s.groupLabel}>{t('settingsPage.mobileMenu.groups.general')}</div>
        <div className={s.card}>
          <div className={s.row} style={{ cursor: 'default' }}>
            <button type="button" className={s.rowMain} onClick={() => onOpen('notifs')}>
              <div className={`${s.icon} ${sCard.icoAmber}`}><i className="fas fa-bell" /></div>
              <div className={s.labelBlock}>
                <div className={s.label}>{t('settingsPage.mobileMenu.rows.notifications')}</div>
                <div className={s.desc}>{t('settingsPage.mobileMenu.rows.notificationsDesc')}</div>
              </div>
            </button>
            <div className={s.right}>
              <Toggle checked={notifPush ?? false} disabled={notifPush === null || notifSaving} onChange={toggleNotifPush} />
            </div>
          </div>
          <Row icon="fa-palette" iconCls={sCard.icoViolet} label={t('settingsPage.mobileMenu.rows.apparence')} onClick={() => onOpen('apparence')} />
          <Row icon="fa-globe"   iconCls={sCard.icoTeal}   label={t('settingsPage.mobileMenu.rows.langue')}    onClick={() => onOpen('langue')} />
        </div>
      </div>

      {/* ── Mon compte ── */}
      <div className={s.group}>
        <div className={s.groupLabel}>{t('settingsPage.mobileMenu.groups.compte')}</div>
        <div className={s.card}>
          <Row icon="fa-location-dot" iconCls={sCard.icoBlue}    label={t('settingsPage.mobileMenu.rows.adresses')} onClick={() => onOpen('adresses')} />
          <Row icon="fa-credit-card"  iconCls={sCard.icoEmerald} label={t('settingsPage.mobileMenu.rows.paiement')} onClick={() => onOpen('paiement')} />
          <Row icon="fa-star"         iconCls={sCard.icoAmber}   label={t('settingsPage.mobileMenu.rows.points')}   onClick={() => onOpen('points')} />
        </div>
      </div>

      {/* ── Sécurité ── */}
      <div className={s.group}>
        <div className={s.groupLabel}>{t('settingsPage.mobileMenu.groups.securite')}</div>
        <div className={s.card}>
          <Row icon="fa-shield-halved"      iconCls={sCard.icoNavy}  label={t('settingsPage.mobileMenu.rows.confidentialiteSecurite')} badge={secBadge || undefined} onClick={() => onOpen('confidentialiteSecurite')} />
          <Row icon="fa-desktop"            iconCls={sCard.icoBlue}  label={t('settingsPage.mobileMenu.rows.sessions')}                 onClick={() => onOpen('sessions')} />
          <Row icon="fa-clock-rotate-left"  iconCls={sCard.icoTeal}  label={t('settingsPage.mobileMenu.rows.activite')}                 onClick={() => onOpen('activite')} />
          <Row icon="fa-database"           iconCls={sCard.icoNavy}  label={t('settingsPage.mobileMenu.rows.donnees')}                  onClick={() => onOpen('donnees')} />
        </div>
      </div>

      {/* ── Assistance ── */}
      <div className={s.group}>
        <div className={s.groupLabel}>{t('settingsPage.mobileMenu.groups.assistance')}</div>
        <div className={s.card}>
          <Row icon="fa-book-open"    iconCls={sCard.icoViolet}  label={t('settingsPage.mobileMenu.rows.aide')}     onClick={() => navigate('/aide')} />
          <Row icon="fa-envelope"     iconCls={sCard.icoEmerald} label={t('settingsPage.mobileMenu.rows.contact')}  onClick={() => navigate('/contact')} />
          <Row icon="fa-share-nodes"  iconCls={sCard.icoBlue}    label={t('settingsPage.mobileMenu.rows.partager')} onClick={handleShare} />
          <Row icon="fa-star"         iconCls={sCard.icoAmber}   label={t('settingsPage.mobileMenu.rows.noter')}    onClick={comingSoon} />
        </div>
      </div>

      {/* ── Zone de danger ── */}
      <div className={s.group}>
        <div className={s.groupLabel}>{t('settingsPage.mobileMenu.groups.danger')}</div>
        <div className={`${s.card} ${s.danger}`}>
          <Row icon="fa-triangle-exclamation" iconCls={sCard.icoRed} danger label={t('settingsPage.mobileMenu.rows.danger')} onClick={() => onOpen('danger')} />
        </div>
      </div>

      {/* ── Déconnexion ── */}
      <div className={s.logoutGroup}>
        <div className={s.card}>
          <button type="button" className={`${s.row} ${s.logoutRow}`} onClick={onLogout}>
            <div className={s.icon}><i className="fas fa-right-from-bracket" /></div>
            <div className={s.labelBlock}><div className={s.label}>{t('settingsPage.mobileMenu.logout')}</div></div>
          </button>
        </div>
      </div>
    </div>
  );
}
