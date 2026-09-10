/*
 * FICHIER : src/dashboards/livreur/pages/params/SecConfidentialite.tsx
 * ✅ CONNECTÉ — Confidentialité & données livreur
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

interface Props {
  data:        LivreurData | null;
  saving:      boolean;
  dirty:       () => void;
  onPop:       (m: string, t?: string) => void;
  savePrivacy: (body: Record<string, boolean>) => Promise<void>;
}

/* BUG CORRIGÉ — 3 des 6 clés (showPhone, showHistory, personalizedAds)
 * n'existaient sur AUCUNE colonne backend (voir NotifsLivreurService.
 * DEFAULT_PRIVACY / UpdateLivreurPrivacyDto) : le ValidationPipe global
 * (whitelist) les supprimait silencieusement avant même d'atteindre le
 * service — ces 3 toggles avaient l'air fonctionnels (bascule, badge
 * "Actif"/"Inactif") mais ne persistaient jamais rien. À l'inverse, 3
 * vraies colonnes backend (showRating, showDeliveryCount, improveAlgo)
 * n'étaient accessibles depuis aucune UI. Clés désormais alignées 1:1
 * avec le DTO réel. */
const PRIVACY_KEYS = [
  'showRating',
  'showDeliveryCount',
  'showInSearch',
  'shareLocation',
  'anonymizedStats',
  'improveAlgo',
];

/* Traduit via `livreurSecConfidentialite.items.<key>.*` — voir
 * locales/{fr,en}/livreur/secConfidentialite.json. Ordre = PRIVACY_KEYS
 * ci-dessus. Seul consommateur : cette page. */
function buildPrivacyItems(t: (key: string) => string) {
  return [
    { l: t('livreurSecConfidentialite.items.showRating.l'),        sub: t('livreurSecConfidentialite.items.showRating.sub'),        on:true  },
    { l: t('livreurSecConfidentialite.items.showDeliveryCount.l'), sub: t('livreurSecConfidentialite.items.showDeliveryCount.sub'), on:true  },
    { l: t('livreurSecConfidentialite.items.showInSearch.l'),      sub: t('livreurSecConfidentialite.items.showInSearch.sub'),      on:true  },
    { l: t('livreurSecConfidentialite.items.shareLocation.l'),     sub: t('livreurSecConfidentialite.items.shareLocation.sub'),     on:true  },
    { l: t('livreurSecConfidentialite.items.anonymizedStats.l'),   sub: t('livreurSecConfidentialite.items.anonymizedStats.sub'),   on:true  },
    { l: t('livreurSecConfidentialite.items.improveAlgo.l'),       sub: t('livreurSecConfidentialite.items.improveAlgo.sub'),       on:true  },
  ];
}

/* Métadonnées visuelles enrichies pour chaque item */
const ITEM_META = [
  { icon: 'fa-star',                iconColor: 'var(--teal)',    iconBg: 'var(--tl-bg)'          },
  { icon: 'fa-box',                  iconColor: 'var(--blue)',    iconBg: 'rgba(0,0,0,.08)'       },
  { icon: 'fa-magnifying-glass',   iconColor: 'var(--teal)',    iconBg: 'var(--tl-bg)'              },
  { icon: 'fa-location-dot',       iconColor: 'var(--amber)',   iconBg: 'rgba(0,0,0,.09)'       },
  { icon: 'fa-chart-bar',          iconColor: 'var(--blue)',    iconBg: 'rgba(0,0,0,.08)'       },
  { icon: 'fa-robot',               iconColor: 'var(--t3)',      iconBg: 'var(--g100)'               },
];

/* Groupes thématiques — traduit via `livreurSecConfidentialite.groups.<id>.*` */
function buildGroups(t: (key: string) => string) {
  return [
    {
      id:    'visibilite',
      icon:  'fa-eye',
      title: t('livreurSecConfidentialite.groups.visibilite.title'),
      desc:  t('livreurSecConfidentialite.groups.visibilite.desc'),
      range: [0, 1, 2] as const,
    },
    {
      id:    'donnees',
      icon:  'fa-database',
      title: t('livreurSecConfidentialite.groups.donnees.title'),
      desc:  t('livreurSecConfidentialite.groups.donnees.desc'),
      range: [3, 4, 5] as const,
    },
  ];
}

export default function SecConfidentialite({ data, saving, dirty, onPop, savePrivacy }: Props) {
  const { t } = useTranslation();
  const PRIVACY_ITEMS = buildPrivacyItems(t);
  const GROUPS = buildGroups(t);
  const [vals, setVals] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const defaults = Object.fromEntries(
      PRIVACY_ITEMS.map((item, i) => [PRIVACY_KEYS[i] ?? `p${i}`, item.on])
    );
    setVals({ ...defaults, ...(data?.privacySettings ?? {}) });
  }, [data]);

  function toggle(key: string, v: boolean) {
    setVals(prev => ({ ...prev, [key]: v }));
    dirty();
  }

  async function handleSave() {
    try {
      await savePrivacy(vals);
      onPop(t('livreurSecConfidentialite.toasts.saved'), 's');
    } catch (err: any) {
      onPop(err?.message ?? t('livreurSecConfidentialite.toasts.saveError'), 'e');
    }
  }

  /* Nombre total de paramètres actifs */
  const activeCount = Object.values(vals).filter(Boolean).length;
  const totalCount  = PRIVACY_KEYS.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* En-tête de section */}
      <div className={ps.psHd}>
        <h2><i className="fas fa-shield-halved" /> {t('livreurSecConfidentialite.header.titre')}</h2>
        <p>{t('livreurSecConfidentialite.header.sub')}</p>
      </div>

      {/* Bannière résumé */}
      <div style={{
        display:         'flex',
        alignItems:      'center',
        gap:             14,
        padding:         '14px 18px',
        background:      'linear-gradient(135deg, rgba(0,0,0,.07), rgba(0,0,0,.03))',
        border:          '1px solid rgba(0,0,0,.18)',
        borderRadius:    'var(--r-xl)',
        color:           'var(--t2)',
        fontSize:        12.5,
        lineHeight:      1.55,
      }}>
        <div style={{
          width:           40,
          height:          40,
          borderRadius:    '50%',
          background:      'linear-gradient(135deg, var(--teal), rgba(0,0,0,.6))',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          flexShrink:      0,
          boxShadow:       '0 4px 12px rgba(0,0,0,.25)',
        }}>
          <i className="fas fa-lock" style={{ color: '#fff', fontSize: 15 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>
            {t('livreurSecConfidentialite.banner.paramActifs', { count: activeCount, total: totalCount })}
          </div>
          <div>{t('livreurSecConfidentialite.banner.desc')}</div>
        </div>
        {/* Barre de progression */}
        <div style={{ flexShrink: 0, width: 56, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--teal)', fontFamily: 'var(--fd)' }}>
            {Math.round((activeCount / totalCount) * 100)}%
          </div>
          <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{t('livreurSecConfidentialite.banner.partage')}</div>
        </div>
      </div>

      {/* Cartes par groupe */}
      {GROUPS.map(group => {
        const groupItems = group.range.map(i => ({
          key:  PRIVACY_KEYS[i] ?? `p${i}`,
          item: PRIVACY_ITEMS[i],
          meta: ITEM_META[i],
        }));

        const groupActive = groupItems.filter(({ key, item }) => vals[key] ?? item.on).length;

        return (
          <div key={group.id} className={`${ps.card} ${ps.cardLast}`}>

            {/* En-tête de carte */}
            <div className={ps.ch}>
              <div className={ps.chT}>
                <i className={`fas ${group.icon}`} />
                {group.title}
              </div>
              {/* Badge récapitulatif du groupe */}
              <div style={{
                fontSize:     10,
                fontWeight:   700,
                padding:      '3px 10px',
                borderRadius: 'var(--pill)',
                background:   groupActive > 0 ? 'var(--tl-bg)' : 'var(--g100)',
                color:        groupActive > 0 ? 'var(--teal)' : 'var(--t3)',
                border:       `1px solid ${groupActive > 0 ? 'rgba(0,0,0,.2)' : 'var(--bdr2)'}`,
                flexShrink:   0,
              }}>
                {t('livreurSecConfidentialite.groupBadge', { count: groupActive, total: groupItems.length })}
              </div>
            </div>

            {/* Description du groupe */}
            <div style={{
              padding:    '10px 22px',
              fontSize:   12,
              color:      'var(--t3)',
              background: 'var(--g50)',
              borderBottom: '1px solid var(--bdr)',
            }}>
              {group.desc}
            </div>

            {/* Liste des items */}
            <div className={ps.cb} style={{ padding: '8px 22px' }}>
              {groupItems.map(({ key, item, meta }, idx) => {
                const isOn = vals[key] ?? item.on;
                return (
                  <div
                    key={key}
                    className={ps.setRow}
                    style={{ paddingTop: idx === 0 ? 14 : undefined }}
                  >
                    {/* Icône + texte */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, flex: 1, minWidth: 0 }}>
                      <div style={{
                        width:           36,
                        height:          36,
                        borderRadius:    10,
                        background:      meta.iconBg,
                        display:         'flex',
                        alignItems:      'center',
                        justifyContent:  'center',
                        flexShrink:      0,
                        marginTop:       1,
                        transition:      'background .2s',
                      }}>
                        <i
                          className={`fas ${meta.icon}`}
                          style={{ color: isOn ? meta.iconColor : 'var(--t4)', fontSize: 13, transition: 'color .2s' }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className={ps.srLbl}>{item.l}</span>
                          {/* Badge statut */}
                          <span style={{
                            fontSize:     9,
                            fontWeight:   800,
                            padding:      '2px 7px',
                            borderRadius: 'var(--pill)',
                            background:   isOn ? 'rgba(0,0,0,.12)' : 'var(--g100)',
                            color:        isOn ? '#000000' : 'var(--t3)',
                            border:       `1px solid ${isOn ? 'rgba(0,0,0,.22)' : 'var(--bdr2)'}`,
                            letterSpacing: '.3px',
                            textTransform: 'uppercase' as const,
                            transition:    'all .2s',
                          }}>
                            {isOn ? t('livreurSecConfidentialite.statusActif') : t('livreurSecConfidentialite.statusInactif')}
                          </span>
                        </div>
                        <div className={ps.srSub}>{item.sub}</div>
                      </div>
                    </div>

                    {/* Toggle */}
                    <label className={ps.tog} style={{ marginTop: 2 }}>
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={e => toggle(key, e.target.checked)}
                        aria-label={item.l}
                      />
                      <span className={ps.togs} />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Note légale */}
      <div style={{
        display:      'flex',
        alignItems:   'flex-start',
        gap:          10,
        padding:      '12px 16px',
        background:   'var(--g50)',
        border:       '1px solid var(--bdr)',
        borderRadius: 'var(--r-lg)',
        fontSize:     11.5,
        color:        'var(--t3)',
        lineHeight:   1.6,
      }}>
        <i className="fas fa-circle-info" style={{ color: 'var(--teal)', marginTop: 2, flexShrink: 0, fontSize: 12 }} />
        <span>{t('livreurSecConfidentialite.legalNote')}</span>
      </div>

      {/* Bouton sauvegarder */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display:       'inline-flex',
            alignItems:    'center',
            gap:           8,
            background:    saving ? 'var(--g300)' : 'linear-gradient(135deg, var(--teal), #18181B)',
            color:         '#fff',
            border:        'none',
            borderRadius:  'var(--pill)',
            padding:       '12px 28px',
            fontSize:      13,
            fontWeight:    700,
            cursor:        saving ? 'not-allowed' : 'pointer',
            opacity:       saving ? 0.7 : 1,
            boxShadow:     saving ? 'none' : '0 4px 16px rgba(0,0,0,.35)',
            transition:    'all .2s',
          }}
          onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
        >
          {saving
            ? <><i className="fas fa-circle-notch fa-spin" /> {t('livreurSecConfidentialite.saving')}</>
            : <><i className="fas fa-cloud-arrow-up" /> {t('livreurSecConfidentialite.saveButton')}</>
          }
        </button>
      </div>

    </div>
  );
}
