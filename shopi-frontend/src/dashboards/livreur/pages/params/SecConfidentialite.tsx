/*
 * FICHIER : src/dashboards/livreur/pages/params/SecConfidentialite.tsx
 * ✅ CONNECTÉ — Confidentialité & données livreur
 */
import { useState, useEffect } from 'react';
import { PRIVACY_ITEMS } from '../../data/parametresData';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

interface Props {
  data:        LivreurData | null;
  saving:      boolean;
  dirty:       () => void;
  onPop:       (m: string, t?: string) => void;
  savePrivacy: (body: Record<string, boolean>) => Promise<void>;
}

/* Clés backend — l'ordre doit correspondre à PRIVACY_ITEMS */
const PRIVACY_KEYS = [
  'showPhone',
  'showHistory',
  'showInSearch',
  'shareLocation',
  'anonymizedStats',
  'personalizedAds',
];

/* Métadonnées visuelles enrichies pour chaque item */
const ITEM_META = [
  { icon: 'fa-phone',              iconColor: 'var(--teal)',    iconBg: 'var(--tl-bg)'              },
  { icon: 'fa-clock-rotate-left',  iconColor: 'var(--blue)',    iconBg: 'rgba(26,79,196,.08)'       },
  { icon: 'fa-magnifying-glass',   iconColor: 'var(--teal)',    iconBg: 'var(--tl-bg)'              },
  { icon: 'fa-location-dot',       iconColor: 'var(--amber)',   iconBg: 'rgba(217,119,6,.09)'       },
  { icon: 'fa-chart-bar',          iconColor: 'var(--blue)',    iconBg: 'rgba(26,79,196,.08)'       },
  { icon: 'fa-bullhorn',           iconColor: 'var(--t3)',      iconBg: 'var(--g100)'               },
];

/* Groupes thématiques */
const GROUPS = [
  {
    id:    'visibilite',
    icon:  'fa-eye',
    title: 'Visibilité publique',
    desc:  'Ce que les boutiques et clients voient sur votre profil.',
    range: [0, 1, 2] as const,
  },
  {
    id:    'donnees',
    icon:  'fa-database',
    title: 'Données & confidentialité',
    desc:  'Comment Shopi utilise vos données pour améliorer le service.',
    range: [3, 4, 5] as const,
  },
];

export default function SecConfidentialite({ data, saving, dirty, onPop, savePrivacy }: Props) {
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
      onPop('Paramètres de confidentialité sauvegardés', 's');
    } catch (err: any) {
      onPop(err?.message ?? 'Erreur lors de la sauvegarde', 'e');
    }
  }

  /* Nombre total de paramètres actifs */
  const activeCount = Object.values(vals).filter(Boolean).length;
  const totalCount  = PRIVACY_KEYS.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* En-tête de section */}
      <div className={ps.psHd}>
        <h2><i className="fas fa-shield-halved" /> Confidentialité</h2>
        <p>Contrôlez la visibilité de vos informations et l'utilisation de vos données sur la plateforme.</p>
      </div>

      {/* Bannière résumé */}
      <div style={{
        display:         'flex',
        alignItems:      'center',
        gap:             14,
        padding:         '14px 18px',
        background:      'linear-gradient(135deg, rgba(14,116,144,.07), rgba(14,116,144,.03))',
        border:          '1px solid rgba(14,116,144,.18)',
        borderRadius:    'var(--r-xl)',
        color:           'var(--t2)',
        fontSize:        12.5,
        lineHeight:      1.55,
      }}>
        <div style={{
          width:           40,
          height:          40,
          borderRadius:    '50%',
          background:      'linear-gradient(135deg, var(--teal), rgba(14,116,144,.6))',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          flexShrink:      0,
          boxShadow:       '0 4px 12px rgba(14,116,144,.25)',
        }}>
          <i className="fas fa-lock" style={{ color: '#fff', fontSize: 15 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>
            {activeCount} paramètre{activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''} sur {totalCount}
          </div>
          <div>Vos données ne sont jamais vendues à des tiers. Shopi respecte votre vie privée.</div>
        </div>
        {/* Barre de progression */}
        <div style={{ flexShrink: 0, width: 56, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--teal)', fontFamily: 'var(--fd)' }}>
            {Math.round((activeCount / totalCount) * 100)}%
          </div>
          <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>partagé</div>
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
                border:       `1px solid ${groupActive > 0 ? 'rgba(14,116,144,.2)' : 'var(--bdr2)'}`,
                flexShrink:   0,
              }}>
                {groupActive}/{groupItems.length} actif{groupActive > 1 ? 's' : ''}
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
                            background:   isOn ? 'rgba(16,185,129,.12)' : 'var(--g100)',
                            color:        isOn ? '#059669' : 'var(--t3)',
                            border:       `1px solid ${isOn ? 'rgba(16,185,129,.22)' : 'var(--bdr2)'}`,
                            letterSpacing: '.3px',
                            textTransform: 'uppercase' as const,
                            transition:    'all .2s',
                          }}>
                            {isOn ? 'Actif' : 'Inactif'}
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
        <span>
          Conformément au RGPD et aux lois locales sur la protection des données, vous pouvez modifier
          ces préférences à tout moment. La localisation en temps réel est toujours désactivée hors
          missions actives, quel que soit ce paramètre.
        </span>
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
            background:    saving ? 'var(--g300)' : 'linear-gradient(135deg, var(--teal), #0a5570)',
            color:         '#fff',
            border:        'none',
            borderRadius:  'var(--pill)',
            padding:       '12px 28px',
            fontSize:      13,
            fontWeight:    700,
            cursor:        saving ? 'not-allowed' : 'pointer',
            opacity:       saving ? 0.7 : 1,
            boxShadow:     saving ? 'none' : '0 4px 16px rgba(14,116,144,.35)',
            transition:    'all .2s',
          }}
          onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
        >
          {saving
            ? <><i className="fas fa-circle-notch fa-spin" /> Sauvegarde en cours…</>
            : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder les préférences</>
          }
        </button>
      </div>

    </div>
  );
}
