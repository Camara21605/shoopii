/* ================================================================
 * src/modules/home/components/settings/sections/OtherSections.tsx
 * DYNAMIQUE — Approbations, Notifs, Confidentialité, Apparence,
 *             Langue, Données, Danger — tous connectés au backend
 * ================================================================ */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import p from '../styles/SettingsPage.module.css';
import { Toggle } from '../components/Toggle';
import { settingsApi, type AppareilConfiance } from '../../api/settings.api';
import { isSupportedLangCode, SUPPORTED_LANG_CODES } from '../../../../../../shared/i18n/supportedLangs';

interface Props { onToast: (msg: string) => void; }

/* ════════════════════════════════════════════════════════════
 * APPROBATIONS — GET + DELETE /client/parametres/approbations
 * ════════════════════════════════════════════════════════════ */
export function ApprobationsSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [appareils, setAppareils] = useState<AppareilConfiance[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [actionId,  setActionId]  = useState<string | null>(null);

  useEffect(() => {
    settingsApi.getApprobations()
      .then(setAppareils)
      .catch(() => onToast(t('settingsPage.approbations.loadError')))
      .finally(() => setLoading(false));
  }, []);

  async function handleRemove(id: string) {
    setActionId(id);
    try {
      await settingsApi.removeAppareil(id);
      setAppareils(prev => prev.filter(a => a.id !== id));
      onToast(t('settingsPage.approbations.toastRetire'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setActionId(null); }
  }

  const DEV_ICO: Record<string, string> = {
    mobile: 'fa-mobile-screen', tablet: 'fa-tablet-screen-button',
    web: 'fa-laptop', desktop: 'fa-desktop',
  };
  const DEV_CLS: Record<string, string> = {
    mobile: s.icoBlue, tablet: s.icoViolet, web: s.icoEmerald, desktop: s.icoTeal,
  };

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoEmerald}`}><i className="fas fa-shield-check" /></div>
          <div>
            <div className={s.cardH}>{t('settingsPage.approbations.titre')}</div>
            <div className={s.cardSub}>{t('settingsPage.approbations.subtitle')}</div>
          </div>
        </div>
      </div>
      <div className={s.cardBody} style={{ paddingBottom: 4 }}>
        {loading && (
          <div style={{ padding:'48px 24px', textAlign:'center', color:'var(--t3)' }}>
            <i className="fas fa-circle-notch fa-spin" style={{ fontSize:24 }} />
          </div>
        )}
        {!loading && appareils.length === 0 && (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
            {t('settingsPage.approbations.aucunAppareil')}
          </div>
        )}
        {appareils.map(a => (
          <div key={a.id} className={s.trustedCard}>
            <div className={`${s.trustedIco} ${DEV_CLS[a.type] ?? s.icoBlue}`}>
              <i className={`fas ${DEV_ICO[a.type] ?? 'fa-desktop'}`} />
            </div>
            <div className={s.trustedInfo}>
              <div className={s.trustedName}>
                {a.name}
                <span className={s.trustedVerified}><i className="fas fa-check" /> {t('settingsPage.approbations.approuve')}</span>
              </div>
              <div className={s.trustedMeta}>
                {a.location} · {t('settingsPage.approbations.derniereUtilisation')} : {a.lastUsed} · {t('settingsPage.approbations.ajouteLe')} {a.addedAt}
              </div>
            </div>
            <button
              className={s.sessionRevoke}
              onClick={() => handleRemove(a.id)}
              disabled={actionId === a.id}
            >
              {actionId === a.id
                ? <i className="fas fa-circle-notch fa-spin" />
                : t('settingsPage.approbations.retirer')
              }
            </button>
          </div>
        ))}
        <div style={{ padding: '16px 24px 20px' }}>
          <div className={p.infoBanner} style={{ margin: 0 }}>
            <i className="fas fa-circle-info" />
            <div>
              <strong>{t('settingsPage.approbations.commentTitre')}</strong> — {t('settingsPage.approbations.commentTexte')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Props { onToast: (msg: string) => void; }

/* ════════════════════════════════════════════════════════════
 * NOTIFS — GET + PATCH /client/parametres/notifs
 * ════════════════════════════════════════════════════════════ */
export function NotifsSection({ onToast }: Props) {
  const { t } = useTranslation();
  const defaultNotifs = {
    commandes: { sms:true,  email:true,  push:true  },
    promos:    { sms:false, email:true,  push:true  },
    messages:  { sms:true,  email:true,  push:true  },
    points:    { sms:false, email:true,  push:true  },
  };
  const [notifs,  setNotifs]  = useState(defaultNotifs);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    settingsApi.getNotifs()
      .then(res => { if (res.notifSettings && Object.keys(res.notifSettings).length) setNotifs({ ...defaultNotifs, ...res.notifSettings }); })
      .finally(() => setLoading(false));
  }, []);

  const toggle = (k: keyof typeof notifs, ch: 'sms'|'email'|'push') => {
    setNotifs(prev => ({ ...prev, [k]: { ...prev[k], [ch]: !prev[k][ch] } }));
  };

  async function save() {
    setSaving(true);
    try {
      await settingsApi.updateNotifs({ notifSettings: JSON.stringify(notifs) });
      onToast(t('settingsPage.notifs.toastSaved'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  }

  const rows: { key: keyof typeof notifs; ico: string; icon: string; title: string; desc: string }[] = [
    { key:'commandes', ico:'icoEmerald', icon:'fa-bag-shopping', title: t('settingsPage.notifs.rows.commandes.title'), desc: t('settingsPage.notifs.rows.commandes.desc') },
    { key:'promos',    ico:'icoViolet',  icon:'fa-tag',          title: t('settingsPage.notifs.rows.promos.title'),    desc: t('settingsPage.notifs.rows.promos.desc') },
    { key:'messages',  ico:'icoRose',    icon:'fa-comment-dots', title: t('settingsPage.notifs.rows.messages.title'),  desc: t('settingsPage.notifs.rows.messages.desc') },
    { key:'points',    ico:'icoTeal',    icon:'fa-star',         title: t('settingsPage.notifs.rows.points.title'),    desc: t('settingsPage.notifs.rows.points.desc') },
  ];

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoAmber}`}><i className="fas fa-bell" /></div>
          <div><div className={s.cardH}>{t('settingsPage.notifs.titre')}</div><div className={s.cardSub}>{t('settingsPage.notifs.subtitle')}</div></div>
        </div>
        <button className={s.cardAction} onClick={save} disabled={saving || loading}>
          {saving ? <><i className="fas fa-circle-notch fa-spin" /> {t('settingsPage.notifs.enregistrement')}</> : t('settingsPage.notifs.enregistrer')}
        </button>
      </div>
      <div className={s.cardBody}>
        {loading
          ? <div style={{ padding:'32px', textAlign:'center', color:'var(--t3)' }}><i className="fas fa-circle-notch fa-spin" /></div>
          : rows.map(({ key, ico, icon, title, desc }) => (
            <div key={key} className={s.notifRow}>
              <div className={s.notifLeft}>
                <div className={`${s.notifIco} ${(s as any)[ico]}`}><i className={`fas ${icon}`} /></div>
                <div><div className={s.notifTitle}>{title}</div><div className={s.notifDesc}>{desc}</div></div>
              </div>
              <div className={s.notifChannels}>
                {(['sms','email','push'] as const).map(ch => (
                  <div key={ch} className={s.notifCh}>
                    <Toggle checked={notifs[key][ch]} onChange={() => toggle(key, ch)} />
                    <span>{ch === 'sms' ? t('settingsPage.notifs.sms') : ch === 'email' ? t('settingsPage.notifs.email') : t('settingsPage.notifs.push')}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
 * CONFIDENTIALITÉ — GET + PATCH /client/parametres/privacy
 * ════════════════════════════════════════════════════════════ */
export function ConfidentialiteSection({ onToast }: Props) {
  const { t } = useTranslation();
  const defaultPrivacy = { historique:false, wishlist:true, perso:true, localisation:true, pubs:false };
  const [prefs,   setPrefs]   = useState(defaultPrivacy);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    settingsApi.getPrivacy()
      .then(res => { if (res.privacySettings && Object.keys(res.privacySettings).length) setPrefs({ ...defaultPrivacy, ...res.privacySettings }); })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await settingsApi.updatePrivacy({ privacySettings: JSON.stringify(prefs) });
      onToast(t('settingsPage.confidentialite.toastSaved'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  }

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoViolet}`}><i className="fas fa-eye-slash" /></div>
          <div><div className={s.cardH}>{t('settingsPage.confidentialite.titre')}</div><div className={s.cardSub}>{t('settingsPage.confidentialite.subtitle')}</div></div>
        </div>
        <button className={s.cardAction} onClick={save} disabled={saving || loading}>
          {saving ? <><i className="fas fa-circle-notch fa-spin" /> {t('settingsPage.confidentialite.enregistrement')}</> : t('settingsPage.confidentialite.enregistrer')}
        </button>
      </div>
      <div className={s.cardBody}>
        {loading
          ? <div style={{ padding:'32px', textAlign:'center', color:'var(--t3)' }}><i className="fas fa-circle-notch fa-spin" /></div>
          : <>
            <div className={s.privRow}>
              <div className={s.privLeft}><div className={`${s.privIco} ${s.icoBlue}`}><i className="fas fa-user" /></div><div><div className={s.privTitle}>{t('settingsPage.confidentialite.visibiliteTitle')}</div><div className={s.privDesc}>{t('settingsPage.confidentialite.visibiliteDesc')}</div></div></div>
              <select className={s.privSelect} defaultValue="public"><option value="public">{t('settingsPage.confidentialite.visibiliteOptions.toutLeMonde')}</option><option value="members">{t('settingsPage.confidentialite.visibiliteOptions.membresShopi')}</option><option value="nobody">{t('settingsPage.confidentialite.visibiliteOptions.personne')}</option></select>
            </div>
            {([
              { key:'historique' as const, ico:'icoTeal',    icon:'fa-bag-shopping',    title: t('settingsPage.confidentialite.rows.historique.title'),   desc: t('settingsPage.confidentialite.rows.historique.desc') },
              { key:'wishlist' as const,   ico:'icoRose',    icon:'fa-heart',           title: t('settingsPage.confidentialite.rows.wishlist.title'),     desc: t('settingsPage.confidentialite.rows.wishlist.desc') },
              { key:'perso' as const,      ico:'icoAmber',   icon:'fa-chart-simple',    title: t('settingsPage.confidentialite.rows.perso.title'),        desc: t('settingsPage.confidentialite.rows.perso.desc') },
              { key:'localisation' as const,ico:'icoEmerald',icon:'fa-map-location-dot',title: t('settingsPage.confidentialite.rows.localisation.title'), desc: t('settingsPage.confidentialite.rows.localisation.desc') },
              { key:'pubs' as const,       ico:'icoViolet',  icon:'fa-bullhorn',        title: t('settingsPage.confidentialite.rows.pubs.title'),         desc: t('settingsPage.confidentialite.rows.pubs.desc') },
            ] as const).map(({ key, ico, icon, title, desc }) => (
              <div key={key} className={s.privRow}>
                <div className={s.privLeft}><div className={`${s.privIco} ${(s as any)[ico]}`}><i className={`fas ${icon}`} /></div><div><div className={s.privTitle}>{title}</div><div className={s.privDesc}>{desc}</div></div></div>
                <Toggle checked={prefs[key]} onChange={v => setPrefs(prev => ({ ...prev, [key]: v }))} />
              </div>
            ))}
          </>
        }
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
 * APPARENCE — GET + PATCH /client/parametres/apparence
 * ════════════════════════════════════════════════════════════ */
export function ApparenceSection({ onToast }: Props) {
  const { t } = useTranslation();
  // ✅ Le site n'a plus de mode clair : le champ "theme" reste fixé à
  // 'sombre' (envoyé tel quel à l'API pour compatibilité), et le
  // sélecteur Clair/Sombre/Automatique a été retiré de l'interface —
  // il n'existe donc plus aucun moyen, depuis cette page, de repasser
  // le site en mode clair. Le mode sombre est appliqué globalement
  // par useForceDarkTheme() (voir Header.tsx).
  const [form,    setForm]    = useState({ theme: 'sombre', textSize:'normal', imageQuality:'haute' });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    /* On récupère les préférences enregistrées (taille de texte, qualité
       image…) mais on ignore volontairement le "theme" renvoyé par l'API :
       il reste toujours 'sombre' côté interface. */
    settingsApi.getApparence()
      .then(res => setForm({ ...res, theme: 'sombre' }))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await settingsApi.updateApparence(form);
      onToast(t('settingsPage.apparence.toastSaved'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  }

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoViolet}`}><i className="fas fa-palette" /></div>
          <div><div className={s.cardH}>{t('settingsPage.apparence.titre')}</div><div className={s.cardSub}>{t('settingsPage.apparence.subtitle')}</div></div>
        </div>
        <button className={s.cardAction} onClick={save} disabled={saving || loading}>
          {saving ? <><i className="fas fa-circle-notch fa-spin" /> {t('settingsPage.apparence.enregistrement')}</> : t('settingsPage.apparence.enregistrer')}
        </button>
      </div>
      <div className={s.cardBody}>
        {loading
          ? <div style={{ padding:'32px', textAlign:'center', color:'var(--t3)' }}><i className="fas fa-circle-notch fa-spin" /></div>
          : <>
            <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoBlue}`}><i className="fas fa-text-height" /></div><div><div className={s.privTitle}>{t('settingsPage.apparence.tailleTitle')}</div><div className={s.privDesc}>{t('settingsPage.apparence.tailleDesc')}</div></div></div>
              <select className={s.privSelect} value={form.textSize} onChange={e => setForm(f => ({...f, textSize: e.target.value}))}>
                <option value="normal">{t('settingsPage.apparence.tailleOptions.normal')}</option><option value="grand">{t('settingsPage.apparence.tailleOptions.grand')}</option><option value="tres_grand">{t('settingsPage.apparence.tailleOptions.tresGrand')}</option>
              </select>
            </div>
            <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoEmerald}`}><i className="fas fa-images" /></div><div><div className={s.privTitle}>{t('settingsPage.apparence.qualiteTitle')}</div><div className={s.privDesc}>{t('settingsPage.apparence.qualiteDesc')}</div></div></div>
              <select className={s.privSelect} value={form.imageQuality} onChange={e => setForm(f => ({...f, imageQuality: e.target.value}))}>
                <option value="haute">{t('settingsPage.apparence.qualiteOptions.haute')}</option><option value="economique">{t('settingsPage.apparence.qualiteOptions.eco')}</option>
              </select>
            </div>
          </>
        }
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
 * LANGUE — GET + PATCH /client/parametres/langue
 * ════════════════════════════════════════════════════════════ */
export function LangueSection({ onToast }: Props) {
  const { t, i18n } = useTranslation();
  const [form,    setForm]    = useState({ langue: i18n.language, devise:'GNF', timezone:'GMT+0' });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    settingsApi.getLangue()
      .then(res => setForm(f => ({ ...f, ...res, langue: i18n.language })))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await settingsApi.updateLangue(form);
      if (isSupportedLangCode(form.langue)) {
        await i18n.changeLanguage(form.langue);
      }
      onToast(t('settingsPage.langue.toastSaved'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  }

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoTeal}`}><i className="fas fa-globe" /></div>
          <div><div className={s.cardH}>{t('settingsPage.langue.titre')}</div><div className={s.cardSub}>{t('settingsPage.langue.subtitle')}</div></div>
        </div>
        <button className={s.cardAction} onClick={save} disabled={saving || loading}>
          {saving ? <><i className="fas fa-circle-notch fa-spin" /> {t('settingsPage.langue.enregistrement')}</> : t('settingsPage.langue.enregistrer')}
        </button>
      </div>
      <div className={s.cardBody}>
        {loading
          ? <div style={{ padding:'32px', textAlign:'center', color:'var(--t3)' }}><i className="fas fa-circle-notch fa-spin" /></div>
          : <>
            <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoTeal}`}><i className="fas fa-language" /></div><div><div className={s.privTitle}>{t('settingsPage.langue.langueTitle')}</div><div className={s.privDesc}>{t('settingsPage.langue.langueDesc')}</div></div></div>
              <select className={s.privSelect} value={form.langue} onChange={e => setForm(f=>({...f,langue:e.target.value}))}>
                {SUPPORTED_LANG_CODES.includes('fr') && <option value="fr">🇫🇷 Français</option>}
                {SUPPORTED_LANG_CODES.includes('en') && <option value="en">🇬🇧 English</option>}
                {SUPPORTED_LANG_CODES.includes('ar') && <option value="ar">🇸🇦 عربي</option>}
                {SUPPORTED_LANG_CODES.includes('zh') && <option value="zh">🇨🇳 中文</option>}
                {SUPPORTED_LANG_CODES.includes('pt') && <option value="pt">🇵🇹 Português</option>}
              </select>
            </div>
            <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoEmerald}`}><i className="fas fa-coins" /></div><div><div className={s.privTitle}>{t('settingsPage.langue.deviseTitle')}</div><div className={s.privDesc}>{t('settingsPage.langue.deviseDesc')}</div></div></div>
              <select className={s.privSelect} value={form.devise} onChange={e => setForm(f=>({...f,devise:e.target.value}))}>
                <option value="GNF">GNF — Franc Guinéen</option><option value="USD">USD — Dollar américain</option>
                <option value="EUR">EUR — Euro</option><option value="XOF">XOF — Franc CFA</option>
              </select>
            </div>
            <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoViolet}`}><i className="fas fa-clock" /></div><div><div className={s.privTitle}>{t('settingsPage.langue.fuseauTitle')}</div><div className={s.privDesc}>{t('settingsPage.langue.fuseauDesc')}</div></div></div>
              <select className={s.privSelect} value={form.timezone} onChange={e => setForm(f=>({...f,timezone:e.target.value}))}>
                <option value="GMT+0">GMT+0 — Conakry</option><option value="GMT+1">GMT+1 — Lagos</option><option value="GMT+2">GMT+2 — Le Caire</option>
              </select>
            </div>
          </>
        }
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
 * DONNÉES — routes export/rapport/portabilite
 * ════════════════════════════════════════════════════════════ */
export function DonneesSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<string | null>(null);

  async function handle(action: () => Promise<{message:string}>, key: string) {
    setLoading(key);
    try {
      const res = await action();
      onToast(`✅ ${res.message}`);
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setLoading(null); }
  }

  const rows = [
    { key:'export',     ico:'icoBlue',    icon:'fa-file-export',       title: t('settingsPage.donnees.rowsLive.export.title'),      desc: t('settingsPage.donnees.rowsLive.export.desc'),      label: t('settingsPage.donnees.rowsLive.export.label'),      action:settingsApi.exportAll       },
    { key:'commandes',  ico:'icoTeal',    icon:'fa-clock-rotate-left', title: t('settingsPage.donnees.rowsLive.commandes.title'),   desc: t('settingsPage.donnees.rowsLive.commandes.desc'),   label: t('settingsPage.donnees.rowsLive.commandes.label'),   action:settingsApi.exportCommandes  },
    { key:'factures',   ico:'icoViolet',  icon:'fa-file-invoice',      title: t('settingsPage.donnees.rowsLive.factures.title'),    desc: t('settingsPage.donnees.rowsLive.factures.desc'),    label: t('settingsPage.donnees.rowsLive.factures.label'),    action:settingsApi.exportFactures   },
    { key:'rapport',    ico:'icoEmerald', icon:'fa-user-shield',       title: t('settingsPage.donnees.rowsLive.rapport.title'),     desc: t('settingsPage.donnees.rowsLive.rapport.desc'),     label: t('settingsPage.donnees.rowsLive.rapport.label'),     action:settingsApi.getRapport       },
    { key:'portabilite',ico:'icoAmber',   icon:'fa-right-from-bracket',title: t('settingsPage.donnees.rowsLive.portabilite2.title'),desc: t('settingsPage.donnees.rowsLive.portabilite2.desc'),label: t('settingsPage.donnees.rowsLive.portabilite2.label'),action:settingsApi.portabilite      },
  ];

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
          {rows.map(({ key, ico, icon, title, desc, label, action }) => (
            <div key={key} className={s.dexRow}>
              <div className={s.dexLeft}>
                <div className={`${s.dexIco} ${(s as any)[ico]}`}><i className={`fas ${icon}`} /></div>
                <div><div className={s.dexTitle}>{title}</div><div className={s.dexDesc}>{desc}</div></div>
              </div>
              <button className={s.dexBtn} onClick={() => handle(action, key)} disabled={loading === key}>
                {loading === key ? <i className="fas fa-circle-notch fa-spin" /> : label}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, background:'var(--sky)', border:'1px solid var(--sky-3)', borderRadius:'var(--r-md)', padding:'14px 16px', fontSize:12, color:'var(--t2)', lineHeight:1.6 }}>
        <i className="fas fa-circle-info" style={{ color:'var(--blue)', flexShrink:0, marginTop:2 }} />
        <div><strong>{t('settingsPage.donnees.droitsTitre')}</strong> — {t('settingsPage.donnees.droitsTexteShort')} <strong>privacy@shopi.gn</strong>.</div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
 * DANGER — routes danger avec confirmation
 * ════════════════════════════════════════════════════════════ */
export function DangerSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  async function handle(action: () => Promise<{message:string}>, key: string) {
    if (confirm !== key) { setConfirm(key); return; }
    setLoading(key);
    setConfirm(null);
    try {
      const res = await action();
      onToast(`✅ ${res.message}`);
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setLoading(null); }
  }

  const rows = [
    { key:'desactiver',    title: t('settingsPage.danger.rowsLive.desactiver.title'),    btn: t('settingsPage.danger.rowsLive.desactiver.btn'),    action:settingsApi.desactiver,    hard:false },
    { key:'revoquer',      title: t('settingsPage.danger.rowsLive.revoquer.title'),      btn: t('settingsPage.danger.rowsLive.revoquer.btn'),      action:settingsApi.revoquerTiers, hard:false },
    { key:'reinitialiser', title: t('settingsPage.danger.rowsLive.reinitialiser.title'), btn: t('settingsPage.danger.rowsLive.reinitialiser.btn'), action:settingsApi.reinitialiser, hard:false },
    { key:'supprimer',     title: t('settingsPage.danger.rowsLive.supprimer.titre'),     btn: t('settingsPage.danger.rowsLive.supprimer.btn'),     action:settingsApi.supprimer,     hard:true  },
  ];

  return (
    <div className={`${s.card} ${s.cardDanger}`}>
      <div className={`${s.cardHd} ${s.cardHdDanger}`}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoRed}`}><i className="fas fa-triangle-exclamation" /></div>
          <div>
            <div className={`${s.cardH} ${s.cardHRed}`}>{t('settingsPage.danger.titre')}</div>
            <div className={s.cardSub}>{t('settingsPage.danger.subtitle')}</div>
          </div>
        </div>
      </div>
      <div className={s.cardBody}>
        {rows.map(({ key, title, btn, action, hard }) => (
          <div key={key} className={s.dangerRow}>
            <div>
              <div className={hard ? `${s.dangerTitle} ${s.dangerTitleRed}` : s.dangerTitle}>{title}</div>
              <div className={s.dangerDesc}>
                {key === 'desactiver' && t('settingsPage.danger.rowsLive.desactiver.desc')}
                {key === 'revoquer' && t('settingsPage.danger.rowsLive.revoquer.desc')}
                {key === 'reinitialiser' && t('settingsPage.danger.rowsLive.reinitialiser.desc')}
                {key === 'supprimer' && (
                  <>
                    {t('settingsPage.danger.rowsLive.supprimer.descPart1')} <strong>{t('settingsPage.danger.rowsLive.supprimer.descStrong1')}</strong>{t('settingsPage.danger.rowsLive.supprimer.descPart2')} <strong>{t('settingsPage.danger.rowsLive.supprimer.descStrong2')}</strong>{t('settingsPage.danger.rowsLive.supprimer.descPart3')}
                  </>
                )}
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end', flexShrink:0 }}>
              {confirm === key && (
                <div style={{ fontSize:11, fontWeight:600, color:'var(--red)', marginBottom:2, textAlign:'right' }}>
                  {t('settingsPage.danger.clicAgain')}
                </div>
              )}
              <button
                className={hard ? `${s.dangerBtn} ${s.dangerBtnHard}` : s.dangerBtn}
                onClick={() => handle(action, key)}
                disabled={loading === key}
                style={{ opacity: confirm && confirm !== key ? 0.5 : 1 }}
              >
                {loading === key
                  ? <i className="fas fa-circle-notch fa-spin" />
                  : confirm === key
                    ? <><i className="fas fa-triangle-exclamation" /> {t('settingsPage.danger.confirmerBtn')}</>
                    : btn
                }
              </button>
              {confirm === key && (
                <button style={{ fontSize:10, color:'var(--t3)', background:'none', border:'none', cursor:'pointer', padding:'2px 0' }} onClick={() => setConfirm(null)}>
                  {t('settingsPage.danger.annulerBtn')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}