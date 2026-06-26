/* ================================================================
 * src/modules/home/components/settings/sections/OtherSections.tsx
 * DYNAMIQUE — Approbations, Notifs, Confidentialité, Apparence,
 *             Langue, Données, Danger — tous connectés au backend
 * ================================================================ */

import React, { useState, useEffect } from 'react';
import s from '../styles/SettingsCard.module.css';
import p from '../styles/SettingsPage.module.css';
import { Toggle } from '../components/Toggle';
import { settingsApi, type AppareilConfiance } from '../../api/settings.api';

interface Props { onToast: (msg: string) => void; }

/* ════════════════════════════════════════════════════════════
 * APPROBATIONS — GET + DELETE /client/parametres/approbations
 * ════════════════════════════════════════════════════════════ */
export function ApprobationsSection({ onToast }: Props) {
  const [appareils, setAppareils] = useState<AppareilConfiance[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [actionId,  setActionId]  = useState<string | null>(null);

  useEffect(() => {
    settingsApi.getApprobations()
      .then(setAppareils)
      .catch(() => onToast('❌ Impossible de charger les appareils'))
      .finally(() => setLoading(false));
  }, []);

  async function handleRemove(id: string) {
    setActionId(id);
    try {
      await settingsApi.removeAppareil(id);
      setAppareils(prev => prev.filter(a => a.id !== id));
      onToast('🔒 Appareil retiré de la liste de confiance');
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
            <div className={s.cardH}>Appareils de confiance</div>
            <div className={s.cardSub}>Ces appareils peuvent se connecter sans code 2FA supplémentaire</div>
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
            Aucun appareil de confiance enregistré
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
                <span className={s.trustedVerified}><i className="fas fa-check" /> Approuvé</span>
              </div>
              <div className={s.trustedMeta}>
                {a.location} · Dernière utilisation : {a.lastUsed} · Ajouté le {a.addedAt}
              </div>
            </div>
            <button
              className={s.sessionRevoke}
              onClick={() => handleRemove(a.id)}
              disabled={actionId === a.id}
            >
              {actionId === a.id
                ? <i className="fas fa-circle-notch fa-spin" />
                : 'Retirer'
              }
            </button>
          </div>
        ))}
        <div style={{ padding: '16px 24px 20px' }}>
          <div className={p.infoBanner} style={{ margin: 0 }}>
            <i className="fas fa-circle-info" />
            <div>
              <strong>Comment ça fonctionne</strong> — Les appareils de confiance sont mémorisés
              après une vérification 2FA réussie. Retirez un appareil si vous ne le reconnaissez
              pas ou si vous l'avez perdu.
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
      onToast('✅ Préférences de notifications enregistrées');
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  }

  const rows: { key: keyof typeof notifs; ico: string; icon: string; title: string; desc: string }[] = [
    { key:'commandes', ico:'icoEmerald', icon:'fa-bag-shopping', title:'Statut de commande',   desc:'Confirmation, expédition, livraison' },
    { key:'promos',    ico:'icoViolet',  icon:'fa-tag',          title:'Promotions & offres',  desc:'Soldes, codes promo, offres exclusives' },
    { key:'messages',  ico:'icoRose',    icon:'fa-comment-dots', title:'Messages',             desc:'Nouveaux messages des vendeurs ou du support' },
    { key:'points',    ico:'icoTeal',    icon:'fa-star',         title:'Points & récompenses', desc:'Gains de points, paliers atteints' },
  ];

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoAmber}`}><i className="fas fa-bell" /></div>
          <div><div className={s.cardH}>Notifications</div><div className={s.cardSub}>Choisissez quand et comment être notifié</div></div>
        </div>
        <button className={s.cardAction} onClick={save} disabled={saving || loading}>
          {saving ? <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</> : 'Enregistrer'}
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
                    <span>{ch === 'sms' ? 'SMS' : ch === 'email' ? 'Email' : 'Push'}</span>
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
      onToast('✅ Paramètres de confidentialité enregistrés');
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  }

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoViolet}`}><i className="fas fa-eye-slash" /></div>
          <div><div className={s.cardH}>Confidentialité du profil</div><div className={s.cardSub}>Contrôlez qui peut voir vos informations</div></div>
        </div>
        <button className={s.cardAction} onClick={save} disabled={saving || loading}>
          {saving ? <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</> : 'Enregistrer'}
        </button>
      </div>
      <div className={s.cardBody}>
        {loading
          ? <div style={{ padding:'32px', textAlign:'center', color:'var(--t3)' }}><i className="fas fa-circle-notch fa-spin" /></div>
          : <>
            <div className={s.privRow}>
              <div className={s.privLeft}><div className={`${s.privIco} ${s.icoBlue}`}><i className="fas fa-user" /></div><div><div className={s.privTitle}>Visibilité du profil</div><div className={s.privDesc}>Qui peut voir votre profil public</div></div></div>
              <select className={s.privSelect} defaultValue="public"><option value="public">Tout le monde</option><option value="members">Membres Shopi</option><option value="nobody">Personne</option></select>
            </div>
            {([
              { key:'historique' as const, ico:'icoTeal',    icon:'fa-bag-shopping',    title:'Historique des commandes',     desc:'Afficher vos achats récents sur votre profil' },
              { key:'wishlist' as const,   ico:'icoRose',    icon:'fa-heart',           title:'Liste de souhaits',            desc:'Rendre votre liste de souhaits visible aux autres' },
              { key:'perso' as const,      ico:'icoAmber',   icon:'fa-chart-simple',    title:'Données de personnalisation',  desc:'Utiliser votre comportement pour améliorer les recommandations' },
              { key:'localisation' as const,ico:'icoEmerald',icon:'fa-map-location-dot',title:'Localisation approximative',   desc:'Partager votre ville pour des offres locales' },
              { key:'pubs' as const,       ico:'icoViolet',  icon:'fa-bullhorn',        title:'Publicités personnalisées',    desc:'Recevoir des publicités basées sur vos intérêts' },
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
  const [form,    setForm]    = useState({ theme:'clair', textSize:'normal', imageQuality:'haute' });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    settingsApi.getApparence()
      .then(res => setForm(res))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await settingsApi.updateApparence(form);
      onToast('✅ Apparence mise à jour');
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  }

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoViolet}`}><i className="fas fa-palette" /></div>
          <div><div className={s.cardH}>Apparence</div><div className={s.cardSub}>Thème, taille de texte et affichage</div></div>
        </div>
        <button className={s.cardAction} onClick={save} disabled={saving || loading}>
          {saving ? <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</> : 'Enregistrer'}
        </button>
      </div>
      <div className={s.cardBody}>
        {loading
          ? <div style={{ padding:'32px', textAlign:'center', color:'var(--t3)' }}><i className="fas fa-circle-notch fa-spin" /></div>
          : <>
            <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoNavy}`}><i className="fas fa-moon" /></div><div><div className={s.privTitle}>Thème</div><div className={s.privDesc}>Clair, sombre ou automatique</div></div></div>
              <select className={s.privSelect} value={form.theme} onChange={e => setForm(f => ({...f, theme: e.target.value}))}>
                <option value="clair">Clair</option><option value="sombre">Sombre</option><option value="auto">Automatique</option>
              </select>
            </div>
            <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoBlue}`}><i className="fas fa-text-height" /></div><div><div className={s.privTitle}>Taille du texte</div><div className={s.privDesc}>Ajustez pour une meilleure lisibilité</div></div></div>
              <select className={s.privSelect} value={form.textSize} onChange={e => setForm(f => ({...f, textSize: e.target.value}))}>
                <option value="normal">Normal</option><option value="grand">Grand</option><option value="tres_grand">Très grand</option>
              </select>
            </div>
            <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoEmerald}`}><i className="fas fa-images" /></div><div><div className={s.privTitle}>Qualité des images</div><div className={s.privDesc}>Réduire pour économiser les données mobiles</div></div></div>
              <select className={s.privSelect} value={form.imageQuality} onChange={e => setForm(f => ({...f, imageQuality: e.target.value}))}>
                <option value="haute">Haute qualité</option><option value="economique">Économique</option>
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
  const [form,    setForm]    = useState({ langue:'fr', devise:'GNF', timezone:'GMT+0' });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    settingsApi.getLangue()
      .then(setForm)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await settingsApi.updateLangue(form);
      onToast('✅ Préférences régionales enregistrées');
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  }

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoTeal}`}><i className="fas fa-globe" /></div>
          <div><div className={s.cardH}>Langue & région</div><div className={s.cardSub}>Langue, devise et fuseau horaire</div></div>
        </div>
        <button className={s.cardAction} onClick={save} disabled={saving || loading}>
          {saving ? <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</> : 'Enregistrer'}
        </button>
      </div>
      <div className={s.cardBody}>
        {loading
          ? <div style={{ padding:'32px', textAlign:'center', color:'var(--t3)' }}><i className="fas fa-circle-notch fa-spin" /></div>
          : <>
            <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoTeal}`}><i className="fas fa-language" /></div><div><div className={s.privTitle}>Langue d'affichage</div><div className={s.privDesc}>Langue de l'interface Shopi</div></div></div>
              <select className={s.privSelect} value={form.langue} onChange={e => setForm(f=>({...f,langue:e.target.value}))}>
                <option value="fr">🇫🇷 Français</option><option value="en">🇬🇧 English</option>
                <option value="ar">🇸🇦 عربي</option><option value="pt">🇵🇹 Português</option>
              </select>
            </div>
            <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoEmerald}`}><i className="fas fa-coins" /></div><div><div className={s.privTitle}>Devise d'affichage</div><div className={s.privDesc}>Pour les prix et les transactions</div></div></div>
              <select className={s.privSelect} value={form.devise} onChange={e => setForm(f=>({...f,devise:e.target.value}))}>
                <option value="GNF">GNF — Franc Guinéen</option><option value="USD">USD — Dollar américain</option>
                <option value="EUR">EUR — Euro</option><option value="XOF">XOF — Franc CFA</option>
              </select>
            </div>
            <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoViolet}`}><i className="fas fa-clock" /></div><div><div className={s.privTitle}>Fuseau horaire</div><div className={s.privDesc}>Pour les délais de livraison et les dates</div></div></div>
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
    { key:'export',     ico:'icoBlue',    icon:'fa-file-export',       title:'Exporter toutes mes données',   desc:'Fichier ZIP — profil, commandes, messages, points',     label:'Exporter',  action:settingsApi.exportAll       },
    { key:'commandes',  ico:'icoTeal',    icon:'fa-clock-rotate-left', title:'Historique des commandes',      desc:'Toutes vos commandes — CSV ou PDF',                    label:'CSV',       action:settingsApi.exportCommandes  },
    { key:'factures',   ico:'icoViolet',  icon:'fa-file-invoice',      title:'Mes factures et reçus',         desc:'PDF de toutes vos factures',                          label:'PDF',       action:settingsApi.exportFactures   },
    { key:'rapport',    ico:'icoEmerald', icon:'fa-user-shield',       title:'Rapport de confidentialité',    desc:'Quelles données sont collectées et comment',          label:'Voir',      action:settingsApi.getRapport       },
    { key:'portabilite',ico:'icoAmber',   icon:'fa-right-from-bracket',title:'Portabilité RGPD',              desc:'Transférer vos données — délai légal 30 jours',       label:'Demander',  action:settingsApi.portabilite      },
  ];

  return (
    <>
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoNavy}`}><i className="fas fa-database" /></div>
            <div><div className={s.cardH}>Mes données personnelles</div><div className={s.cardSub}>Accédez, exportez ou supprimez vos données — conformité RGPD</div></div>
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
        <div><strong>Vos droits</strong> — Vous avez le droit d'accéder, de corriger, d'exporter et de supprimer vos données. Contactez notre DPO à <strong>privacy@shopi.gn</strong>.</div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
 * DANGER — routes danger avec confirmation
 * ════════════════════════════════════════════════════════════ */
export function DangerSection({ onToast }: Props) {
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
    { key:'desactiver',   title:'Désactiver temporairement le compte',  desc:'Votre profil sera masqué. Réactivation possible à tout moment.',            action:settingsApi.desactiver,    hard:false },
    { key:'revoquer',     title:'Révoquer tous les accès tiers',         desc:'Déconnecte toutes les applications et services liés à votre compte.',      action:settingsApi.revoquerTiers, hard:false },
    { key:'reinitialiser',title:'Réinitialiser toutes mes préférences',  desc:'Réinitialise notifications, apparence, langue aux valeurs par défaut.',    action:settingsApi.reinitialiser, hard:false },
    { key:'supprimer',    title:'Supprimer définitivement le compte',    desc:'Toutes vos données seront supprimées dans 30 jours. Action irréversible.', action:settingsApi.supprimer,     hard:true  },
  ];

  return (
    <div className={`${s.card} ${s.cardDanger}`}>
      <div className={`${s.cardHd} ${s.cardHdDanger}`}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoRed}`}><i className="fas fa-triangle-exclamation" /></div>
          <div>
            <div className={`${s.cardH} ${s.cardHRed}`}>Zone de danger</div>
            <div className={s.cardSub}>Ces actions sont irréversibles — réfléchissez avant d'agir</div>
          </div>
        </div>
      </div>
      <div className={s.cardBody}>
        {rows.map(({ key, title, desc, action, hard }) => (
          <div key={key} className={s.dangerRow}>
            <div>
              <div className={hard ? `${s.dangerTitle} ${s.dangerTitleRed}` : s.dangerTitle}>{title}</div>
              <div className={s.dangerDesc} dangerouslySetInnerHTML={{ __html: desc.replace('irréversible', '<strong>irréversible</strong>').replace('30 jours', '<strong>30 jours</strong>').replace('définitivement supprimées', '<strong>définitivement supprimées</strong>') }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end', flexShrink:0 }}>
              {confirm === key && (
                <div style={{ fontSize:11, fontWeight:600, color:'var(--red)', marginBottom:2, textAlign:'right' }}>
                  Cliquer à nouveau pour confirmer
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
                    ? <><i className="fas fa-triangle-exclamation" /> Confirmer</>
                    : key === 'desactiver' ? 'Désactiver'
                    : key === 'revoquer'   ? 'Révoquer les accès'
                    : key === 'reinitialiser' ? 'Réinitialiser'
                    : 'Supprimer mon compte'
                }
              </button>
              {confirm === key && (
                <button style={{ fontSize:10, color:'var(--t3)', background:'none', border:'none', cursor:'pointer', padding:'2px 0' }} onClick={() => setConfirm(null)}>
                  Annuler
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}