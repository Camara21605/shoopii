/* ================================================================
 * src/modules/home/components/settings/sections/DonneesSection.tsx
 * CONNECTÉ — GET /client/parametres/donnees/export?type=… et /rapport
 *
 * Export RÉEL et immédiat (avant : une « demande » consignée en base et un
 * e-mail promis « sous 24 h » que personne n'envoyait). Le serveur renvoie les
 * données du client en JSON ; le navigateur les télécharge. Jamais inclus :
 * mot de passe, secrets 2FA, jetons.
 * ================================================================ */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import { apiFetch } from '../../../../../../shared/services/apiFetch';

interface Props { onToast: (msg: string) => void; }

interface Rapport {
  donneesCollectees: string[]; partageeAvec: string[]; conservationDuree: string; droits: string[]; contact: string;
}

const ROWS = [
  { key: 'export',    type: 'all',       ico: 'icoBlue',   icon: 'fa-file-export'       },
  { key: 'commandes', type: 'commandes', ico: 'icoTeal',   icon: 'fa-clock-rotate-left' },
  { key: 'factures',  type: 'factures',  ico: 'icoViolet', icon: 'fa-file-invoice'      },
] as const;

function downloadJson(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DonneesSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [busy,    setBusy]    = useState<string | null>(null);
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [showRap, setShowRap] = useState(false);

  async function exportData(key: string, type: string) {
    setBusy(key);
    try {
      const data = await apiFetch<unknown>('/client/parametres/donnees/export', { params: { type } } as any);
      downloadJson(data, `shoneya-${type}-${new Date().toISOString().slice(0, 10)}.json`);
      onToast(t('settingsPage.donnees.exportOk'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setBusy(null); }
  }

  async function toggleRapport() {
    if (showRap) { setShowRap(false); return; }
    setBusy('rapport');
    try {
      if (!rapport) setRapport(await apiFetch<Rapport>('/client/parametres/donnees/rapport'));
      setShowRap(true);
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setBusy(null); }
  }

  return (
    <>
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoNavy}`}><i className="fas fa-database" /></div>
            <div><div className={s.cardH}>{t('settingsPage.donnees.titre')}</div><div className={s.cardSub}>{t('settingsPage.donnees.subtitle')}</div></div>
          </div>
        </div>
        <div className={s.cardBody}>
          {ROWS.map(({ key, type, ico, icon }) => (
            <div key={key} className={s.dexRow}>
              <div className={s.dexLeft}>
                <div className={`${s.dexIco} ${(s as any)[ico]}`}><i className={`fas ${icon}`} /></div>
                <div><div className={s.dexTitle}>{t(`settingsPage.donnees.rowsLive.${key}.title`)}</div><div className={s.dexDesc}>{t(`settingsPage.donnees.rowsLive.${key}.desc`)}</div></div>
              </div>
              <button className={s.dexBtn} onClick={() => exportData(key, type)} disabled={busy === key}>
                {busy === key ? <i className="fas fa-circle-notch fa-spin" /> : <><i className="fas fa-download" /> {t('settingsPage.donnees.telecharger')}</>}
              </button>
            </div>
          ))}

          <div className={s.dexRow}>
            <div className={s.dexLeft}>
              <div className={`${s.dexIco} ${s.icoEmerald}`}><i className="fas fa-user-shield" /></div>
              <div><div className={s.dexTitle}>{t('settingsPage.donnees.rowsLive.rapport.title')}</div><div className={s.dexDesc}>{t('settingsPage.donnees.rowsLive.rapport.desc')}</div></div>
            </div>
            <button className={s.dexBtn} onClick={toggleRapport} disabled={busy === 'rapport'} aria-expanded={showRap}>
              {busy === 'rapport' ? <i className="fas fa-circle-notch fa-spin" /> : (showRap ? t('settingsPage.donnees.masquer') : t('settingsPage.donnees.rowsLive.rapport.label'))}
            </button>
          </div>

          {showRap && rapport && (
            <div className={s.verifyBox} style={{ margin: '4px 24px 18px' }}>
              {([
                ['donneesCollectees', rapport.donneesCollectees], ['partageeAvec', rapport.partageeAvec], ['droits', rapport.droits],
              ] as const).map(([k, list]) => (
                <div key={k}>
                  <div className={s.verifyTxt}>{t(`settingsPage.donnees.rapport.${k}`)}</div>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.7 }}>
                    {list.map(x => <li key={x}>{x}</li>)}
                  </ul>
                </div>
              ))}
              <div>
                <div className={s.verifyTxt}>{t('settingsPage.donnees.rapport.conservation')}</div>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6 }}>{rapport.conservationDuree}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'flex-start', gap:12, background:'var(--sky)', border:'1px solid var(--sky-3)', borderRadius:'var(--r-md)', padding:'14px 16px', fontSize:12, color:'var(--t2)', lineHeight:1.6 }}>
        <i className="fas fa-circle-info" style={{ color:'var(--blue)', flexShrink:0, marginTop:2 }} />
        <div><strong>{t('settingsPage.donnees.droitsTitre')}</strong> — {t('settingsPage.donnees.droitsTexteShort')} <strong>{rapport?.contact ?? 'privacy@shopi.gn'}</strong>. {t('settingsPage.donnees.excluAvertissement')}</div>
      </div>
    </>
  );
}
