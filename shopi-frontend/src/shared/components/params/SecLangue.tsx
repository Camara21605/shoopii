/* ============================================================
 * FICHIER : src/shared/components/params/SecLangue.tsx
 *
 * RÔLE : Section "Langue" universelle — utilisable dans tous
 *        les dashboards (livreur, entreprise, correspondant…).
 *        Détecte la langue de l'appareil, liste toutes les
 *        langues du monde, sauvegarde dans localStorage.
 * ============================================================ */

import { useState, useMemo, useEffect } from 'react';

/* ── Clé localStorage ── */
const LANG_KEY = 'shopi_lang';

/* ── Types ── */
export interface WorldLang {
  code:   string;   // ISO 639-1
  fr:     string;   // Nom français
  native: string;   // Nom natif
  flag:   string;   // Emoji drapeau
  region: string;   // Région du monde
}

/* ── Données : ~180 langues du monde ── */
export const WORLD_LANGS: WorldLang[] = [
  /* ── Afrique ── */
  { code:'af', fr:'Afrikaans',          native:'Afrikaans',       flag:'🇿🇦', region:'Afrique'   },
  { code:'am', fr:'Amharique',          native:'አማርኛ',            flag:'🇪🇹', region:'Afrique'   },
  { code:'ar', fr:'Arabe',              native:'العربية',          flag:'🇸🇦', region:'Afrique / Moyen-Orient' },
  { code:'bm', fr:'Bambara',            native:'Bamanankan',      flag:'🇲🇱', region:'Afrique'   },
  { code:'ff', fr:'Peul (Fula)',        native:'Fulfulde',         flag:'🇬🇳', region:'Afrique'   },
  { code:'fr', fr:'Français',           native:'Français',         flag:'🇫🇷', region:'Europe'    },
  { code:'ha', fr:'Haoussa',            native:'Hausa',            flag:'🇳🇬', region:'Afrique'   },
  { code:'ig', fr:'Igbo',              native:'Igbo',             flag:'🇳🇬', region:'Afrique'   },
  { code:'ki', fr:'Kikuyu',            native:'Gĩkũyũ',           flag:'🇰🇪', region:'Afrique'   },
  { code:'kg', fr:'Kongo',             native:'Kikongo',           flag:'🇨🇩', region:'Afrique'   },
  { code:'ln', fr:'Lingala',           native:'Lingála',           flag:'🇨🇩', region:'Afrique'   },
  { code:'mg', fr:'Malgache',          native:'Malagasy',          flag:'🇲🇬', region:'Afrique'   },
  { code:'ms-MW', fr:'Chichewa',       native:'Chichewa',          flag:'🇲🇼', region:'Afrique'   },
  { code:'ny', fr:'Nyanja',            native:'Nyanja',            flag:'🇿🇲', region:'Afrique'   },
  { code:'om', fr:'Oromo',             native:'Oromoo',            flag:'🇪🇹', region:'Afrique'   },
  { code:'rn', fr:'Kirundi',           native:'Ikirundi',          flag:'🇧🇮', region:'Afrique'   },
  { code:'rw', fr:'Kinyarwanda',       native:'Ikinyarwanda',      flag:'🇷🇼', region:'Afrique'   },
  { code:'sg', fr:'Sango',             native:'Sängö',             flag:'🇨🇫', region:'Afrique'   },
  { code:'sn', fr:'Shona',             native:'chiShona',          flag:'🇿🇼', region:'Afrique'   },
  { code:'so', fr:'Somali',            native:'Soomaali',          flag:'🇸🇴', region:'Afrique'   },
  { code:'ss', fr:'Swati',             native:'siSwati',           flag:'🇸🇿', region:'Afrique'   },
  { code:'st', fr:'Sotho du Sud',      native:'Sesotho',           flag:'🇱🇸', region:'Afrique'   },
  { code:'sw', fr:'Swahili',           native:'Kiswahili',         flag:'🇰🇪', region:'Afrique'   },
  { code:'tn', fr:'Tswana',            native:'Setswana',          flag:'🇧🇼', region:'Afrique'   },
  { code:'ts', fr:'Tsonga',            native:'Xitsonga',          flag:'🇲🇿', region:'Afrique'   },
  { code:'tw', fr:'Twi',               native:'Twi',               flag:'🇬🇭', region:'Afrique'   },
  { code:'ve', fr:'Venda',             native:'Tshivenḓa',         flag:'🇿🇦', region:'Afrique'   },
  { code:'wo', fr:'Wolof',             native:'Wolof',             flag:'🇸🇳', region:'Afrique'   },
  { code:'xh', fr:'Xhosa',            native:'isiXhosa',           flag:'🇿🇦', region:'Afrique'   },
  { code:'yo', fr:'Yoruba',           native:'Yorùbá',             flag:'🇳🇬', region:'Afrique'   },
  { code:'zu', fr:'Zoulou',           native:'isiZulu',            flag:'🇿🇦', region:'Afrique'   },

  /* ── Europe ── */
  { code:'be', fr:'Biélorusse',        native:'Беларуская',        flag:'🇧🇾', region:'Europe'    },
  { code:'bg', fr:'Bulgare',           native:'Български',         flag:'🇧🇬', region:'Europe'    },
  { code:'bs', fr:'Bosnien',           native:'Bosanski',          flag:'🇧🇦', region:'Europe'    },
  { code:'ca', fr:'Catalan',           native:'Català',            flag:'🇪🇸', region:'Europe'    },
  { code:'cs', fr:'Tchèque',           native:'Čeština',           flag:'🇨🇿', region:'Europe'    },
  { code:'cy', fr:'Gallois',           native:'Cymraeg',           flag:'🏴󠁧󠁢󠁷󠁬󠁳󠁿', region:'Europe'    },
  { code:'da', fr:'Danois',            native:'Dansk',             flag:'🇩🇰', region:'Europe'    },
  { code:'de', fr:'Allemand',          native:'Deutsch',           flag:'🇩🇪', region:'Europe'    },
  { code:'el', fr:'Grec',              native:'Ελληνικά',          flag:'🇬🇷', region:'Europe'    },
  { code:'en', fr:'Anglais',           native:'English',           flag:'🇬🇧', region:'Europe'    },
  { code:'es', fr:'Espagnol',          native:'Español',           flag:'🇪🇸', region:'Europe / Amérique' },
  { code:'et', fr:'Estonien',          native:'Eesti',             flag:'🇪🇪', region:'Europe'    },
  { code:'eu', fr:'Basque',            native:'Euskara',           flag:'🇪🇸', region:'Europe'    },
  { code:'fi', fr:'Finnois',           native:'Suomi',             flag:'🇫🇮', region:'Europe'    },
  { code:'ga', fr:'Irlandais',         native:'Gaeilge',           flag:'🇮🇪', region:'Europe'    },
  { code:'gl', fr:'Galicien',          native:'Galego',            flag:'🇪🇸', region:'Europe'    },
  { code:'hr', fr:'Croate',            native:'Hrvatski',          flag:'🇭🇷', region:'Europe'    },
  { code:'hu', fr:'Hongrois',          native:'Magyar',            flag:'🇭🇺', region:'Europe'    },
  { code:'hy', fr:'Arménien',          native:'Հայերեն',           flag:'🇦🇲', region:'Europe / Asie' },
  { code:'is', fr:'Islandais',         native:'Íslenska',          flag:'🇮🇸', region:'Europe'    },
  { code:'it', fr:'Italien',           native:'Italiano',          flag:'🇮🇹', region:'Europe'    },
  { code:'ka', fr:'Géorgien',          native:'ქართული',           flag:'🇬🇪', region:'Europe / Asie' },
  { code:'lb', fr:'Luxembourgeois',    native:'Lëtzebuergesch',    flag:'🇱🇺', region:'Europe'    },
  { code:'lt', fr:'Lituanien',         native:'Lietuvių',          flag:'🇱🇹', region:'Europe'    },
  { code:'lv', fr:'Letton',            native:'Latviešu',          flag:'🇱🇻', region:'Europe'    },
  { code:'mk', fr:'Macédonien',        native:'Македонски',        flag:'🇲🇰', region:'Europe'    },
  { code:'mt', fr:'Maltais',           native:'Malti',             flag:'🇲🇹', region:'Europe'    },
  { code:'nl', fr:'Néerlandais',       native:'Nederlands',        flag:'🇳🇱', region:'Europe'    },
  { code:'no', fr:'Norvégien',         native:'Norsk',             flag:'🇳🇴', region:'Europe'    },
  { code:'pl', fr:'Polonais',          native:'Polski',            flag:'🇵🇱', region:'Europe'    },
  { code:'pt', fr:'Portugais',         native:'Português',         flag:'🇵🇹', region:'Europe / Amérique' },
  { code:'ro', fr:'Roumain',           native:'Română',            flag:'🇷🇴', region:'Europe'    },
  { code:'ru', fr:'Russe',             native:'Русский',           flag:'🇷🇺', region:'Europe / Asie' },
  { code:'sk', fr:'Slovaque',          native:'Slovenčina',        flag:'🇸🇰', region:'Europe'    },
  { code:'sl', fr:'Slovène',           native:'Slovenščina',       flag:'🇸🇮', region:'Europe'    },
  { code:'sq', fr:'Albanais',          native:'Shqip',             flag:'🇦🇱', region:'Europe'    },
  { code:'sr', fr:'Serbe',             native:'Српски',            flag:'🇷🇸', region:'Europe'    },
  { code:'sv', fr:'Suédois',           native:'Svenska',           flag:'🇸🇪', region:'Europe'    },
  { code:'tr', fr:'Turc',              native:'Türkçe',            flag:'🇹🇷', region:'Europe / Asie' },
  { code:'uk', fr:'Ukrainien',         native:'Українська',        flag:'🇺🇦', region:'Europe'    },

  /* ── Asie ── */
  { code:'az', fr:'Azerbaïdjanais',    native:'Azərbaycan',        flag:'🇦🇿', region:'Asie'      },
  { code:'bn', fr:'Bengali',           native:'বাংলা',             flag:'🇧🇩', region:'Asie'      },
  { code:'bo', fr:'Tibétain',          native:'བོད་ཡིག',            flag:'🇨🇳', region:'Asie'      },
  { code:'dz', fr:'Dzongkha',          native:'རྫོང་ཁ',             flag:'🇧🇹', region:'Asie'      },
  { code:'fa', fr:'Persan',            native:'فارسی',             flag:'🇮🇷', region:'Asie'      },
  { code:'gu', fr:'Gujarati',          native:'ગુજરાતી',            flag:'🇮🇳', region:'Asie'      },
  { code:'he', fr:'Hébreu',            native:'עברית',             flag:'🇮🇱', region:'Asie'      },
  { code:'hi', fr:'Hindi',             native:'हिन्दी',              flag:'🇮🇳', region:'Asie'      },
  { code:'id', fr:'Indonésien',        native:'Bahasa Indonesia',   flag:'🇮🇩', region:'Asie'      },
  { code:'ja', fr:'Japonais',          native:'日本語',              flag:'🇯🇵', region:'Asie'      },
  { code:'jv', fr:'Javanais',          native:'Basa Jawa',          flag:'🇮🇩', region:'Asie'      },
  { code:'kk', fr:'Kazakh',            native:'Қазақша',            flag:'🇰🇿', region:'Asie'      },
  { code:'km', fr:'Khmer',             native:'ភាសាខ្មែរ',           flag:'🇰🇭', region:'Asie'      },
  { code:'kn', fr:'Kannada',           native:'ಕನ್ನಡ',              flag:'🇮🇳', region:'Asie'      },
  { code:'ko', fr:'Coréen',            native:'한국어',              flag:'🇰🇷', region:'Asie'      },
  { code:'ky', fr:'Kirghiz',           native:'Кыргызча',           flag:'🇰🇬', region:'Asie'      },
  { code:'lo', fr:'Laotien',           native:'ລາວ',                flag:'🇱🇦', region:'Asie'      },
  { code:'mi', fr:'Maori',             native:'Māori',              flag:'🇳🇿', region:'Océanie'   },
  { code:'ml', fr:'Malayalam',         native:'മലയാളം',             flag:'🇮🇳', region:'Asie'      },
  { code:'mn', fr:'Mongol',            native:'Монгол',             flag:'🇲🇳', region:'Asie'      },
  { code:'mr', fr:'Marathi',           native:'मराठी',              flag:'🇮🇳', region:'Asie'      },
  { code:'ms', fr:'Malais',            native:'Bahasa Melayu',      flag:'🇲🇾', region:'Asie'      },
  { code:'my', fr:'Birman',            native:'မြန်မာဘာသာ',          flag:'🇲🇲', region:'Asie'      },
  { code:'ne', fr:'Népalais',          native:'नेपाली',              flag:'🇳🇵', region:'Asie'      },
  { code:'or', fr:'Odia',              native:'ଓଡ଼ିଆ',              flag:'🇮🇳', region:'Asie'      },
  { code:'pa', fr:'Panjabi',           native:'ਪੰਜਾਬੀ',             flag:'🇮🇳', region:'Asie'      },
  { code:'ps', fr:'Pachto',            native:'پښتو',               flag:'🇦🇫', region:'Asie'      },
  { code:'sd', fr:'Sindhi',            native:'سنڌي',               flag:'🇵🇰', region:'Asie'      },
  { code:'si', fr:'Cingalais',         native:'සිංහල',              flag:'🇱🇰', region:'Asie'      },
  { code:'su', fr:'Soundanais',        native:'Basa Sunda',         flag:'🇮🇩', region:'Asie'      },
  { code:'ta', fr:'Tamoul',            native:'தமிழ்',              flag:'🇮🇳', region:'Asie'      },
  { code:'te', fr:'Télougou',          native:'తెలుగు',             flag:'🇮🇳', region:'Asie'      },
  { code:'tg', fr:'Tadjik',            native:'Тоҷикӣ',             flag:'🇹🇯', region:'Asie'      },
  { code:'th', fr:'Thaï',              native:'ภาษาไทย',            flag:'🇹🇭', region:'Asie'      },
  { code:'tk', fr:'Turkmène',          native:'Türkmen',            flag:'🇹🇲', region:'Asie'      },
  { code:'tl', fr:'Filipino (Tagalog)',native:'Filipino',           flag:'🇵🇭', region:'Asie'      },
  { code:'ur', fr:'Ourdou',            native:'اردو',               flag:'🇵🇰', region:'Asie'      },
  { code:'uz', fr:'Ouzbek',            native:'Oʻzbekcha',          flag:'🇺🇿', region:'Asie'      },
  { code:'vi', fr:'Vietnamien',        native:'Tiếng Việt',         flag:'🇻🇳', region:'Asie'      },
  { code:'zh', fr:'Chinois (simplifié)',native:'中文 (简体)',         flag:'🇨🇳', region:'Asie'      },
  { code:'zh-TW', fr:'Chinois (traditionnel)', native:'中文 (繁體)', flag:'🇹🇼', region:'Asie'      },

  /* ── Amérique ── */
  { code:'ay', fr:'Aymara',            native:'Aymar aru',          flag:'🇧🇴', region:'Amérique'  },
  { code:'gn', fr:'Guaraní',           native:'Avañeʼẽ',            flag:'🇵🇾', region:'Amérique'  },
  { code:'qu', fr:'Quechua',           native:'Runa Simi',          flag:'🇵🇪', region:'Amérique'  },

  /* ── Océanie ── */
  { code:'fj', fr:'Fidjien',           native:'Vosa Vakaviti',      flag:'🇫🇯', region:'Océanie'   },
  { code:'sm', fr:'Samoan',            native:'Gagana Samoa',       flag:'🇼🇸', region:'Océanie'   },
  { code:'to', fr:'Tongien',           native:'Lea Faka-Tonga',     flag:'🇹🇴', region:'Océanie'   },
];

/* ── Régions dans l'ordre d'affichage ── */
const REGION_ORDER = ['Afrique', 'Europe', 'Asie', 'Afrique / Moyen-Orient', 'Europe / Asie', 'Europe / Amérique', 'Amérique', 'Océanie'];

/* ── Détecter la langue du navigateur et l'associer à nos langues ── */
function detectDeviceLang(): WorldLang | null {
  const navLangs = navigator.languages ?? [navigator.language];
  for (const nl of navLangs) {
    const code = nl.split('-')[0].toLowerCase();
    const found = WORLD_LANGS.find(l => l.code === nl || l.code === code);
    if (found) return found;
  }
  return null;
}

/* ── Props ── */
interface Props {
  onPop?: (m: string, t?: string) => void;
}

/* ── Composant ── */
export default function SecLangue({ onPop }: Props) {
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<string>(() => localStorage.getItem(LANG_KEY) ?? '');
  const [saved,    setSaved]    = useState(false);
  const [groupBy,  setGroupBy]  = useState<'region' | 'alpha'>('region');

  const deviceLang = useMemo(() => detectDeviceLang(), []);

  /* Langue courante (objet complet) */
  const currentLang = useMemo(
    () => WORLD_LANGS.find(l => l.code === selected) ?? null,
    [selected],
  );

  /* Filtrage par recherche */
  const filtered = useMemo(() => {
    if (!search.trim()) return WORLD_LANGS;
    const q = search.toLowerCase();
    return WORLD_LANGS.filter(l =>
      l.fr.toLowerCase().includes(q) ||
      l.native.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q),
    );
  }, [search]);

  /* Groupement */
  const groups = useMemo(() => {
    if (groupBy === 'alpha') {
      return [{ region: 'Toutes les langues', langs: [...filtered].sort((a, b) => a.fr.localeCompare(b.fr, 'fr')) }];
    }
    const map = new Map<string, WorldLang[]>();
    for (const l of filtered) {
      const key = l.region;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return REGION_ORDER
      .filter(r => map.has(r))
      .map(r => ({ region: r, langs: map.get(r)! }));
  }, [filtered, groupBy]);

  function handleSelect(code: string) {
    setSelected(code);
    setSaved(false);
  }

  function handleSave() {
    if (!selected) return;
    localStorage.setItem(LANG_KEY, selected);
    setSaved(true);
    onPop?.(`✅ Langue "${currentLang?.fr}" enregistrée`, 's');
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── En-tête ── */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}><i className="fas fa-language" /> Langue de l'interface</h2>
          <p style={styles.sub}>Choisissez la langue d'affichage de Shopi. Toutes les langues du monde sont disponibles.</p>
        </div>
      </div>

      {/* ── Langue de l'appareil ── */}
      {deviceLang && (
        <div style={styles.deviceCard}>
          <div style={styles.deviceLeft}>
            <span style={styles.deviceFlag}>{deviceLang.flag}</span>
            <div>
              <div style={styles.deviceLabel}>Langue de votre appareil</div>
              <div style={styles.deviceName}>{deviceLang.fr}</div>
              <div style={styles.deviceNative}>{deviceLang.native}</div>
            </div>
          </div>
          <button
            style={{
              ...styles.deviceBtn,
              ...(selected === deviceLang.code ? styles.deviceBtnActive : {}),
            }}
            onClick={() => handleSelect(deviceLang.code)}
          >
            {selected === deviceLang.code
              ? <><i className="fas fa-check" /> Sélectionnée</>
              : <><i className="fas fa-mobile-screen" /> Utiliser</>
            }
          </button>
        </div>
      )}

      {/* ── Langue actuelle ── */}
      {currentLang && (
        <div style={styles.currentCard}>
          <span style={{ fontSize: 28 }}>{currentLang.flag}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(200,217,248,.5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>
              Langue sélectionnée
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{currentLang.fr}</div>
            <div style={{ fontSize: 12, color: 'rgba(200,217,248,.6)' }}>{currentLang.native} · {currentLang.region}</div>
          </div>
          <button onClick={handleSave} style={styles.saveBtn}>
            {saved
              ? <><i className="fas fa-check" /> Enregistré</>
              : <><i className="fas fa-floppy-disk" /> Enregistrer</>
            }
          </button>
        </div>
      )}

      {/* ── Barre de contrôle ── */}
      <div style={styles.controls}>
        <div style={styles.searchWrap}>
          <i className="fas fa-magnifying-glass" style={styles.searchIco} />
          <input
            style={styles.searchInput}
            placeholder="Rechercher une langue… (ex: Français, Swahili, 中文)"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button style={styles.searchClear} onClick={() => setSearch('')}>
              <i className="fas fa-xmark" />
            </button>
          )}
        </div>
        <div style={styles.groupBtns}>
          <button
            style={{ ...styles.groupBtn, ...(groupBy === 'region' ? styles.groupBtnActive : {}) }}
            onClick={() => setGroupBy('region')}
          >
            <i className="fas fa-globe" /> Régions
          </button>
          <button
            style={{ ...styles.groupBtn, ...(groupBy === 'alpha' ? styles.groupBtnActive : {}) }}
            onClick={() => setGroupBy('alpha')}
          >
            <i className="fas fa-arrow-down-a-z" /> A→Z
          </button>
        </div>
      </div>

      {/* ── Résultats ── */}
      {search && (
        <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>
          <i className="fas fa-filter" style={{ color: 'var(--blue)', marginRight: 5 }} />
          {filtered.length} langue{filtered.length > 1 ? 's' : ''} trouvée{filtered.length > 1 ? 's' : ''}
        </div>
      )}

      {/* ── Groupes ── */}
      {groups.length === 0 ? (
        <div style={styles.emptyState}>
          <i className="fas fa-face-frown" style={{ fontSize: 28, color: 'var(--t4)', marginBottom: 8 }} />
          <div style={{ fontSize: 13, color: 'var(--t3)', fontWeight: 600 }}>Aucune langue correspondante</div>
        </div>
      ) : (
        groups.map(group => (
          <div key={group.region}>
            <div style={styles.regionLabel}>
              <i className="fas fa-map-pin" style={{ color: 'var(--blue)', fontSize: 10 }} />
              {group.region}
              <span style={styles.regionCount}>{group.langs.length}</span>
            </div>
            <div style={styles.langGrid}>
              {group.langs.map(lang => {
                const isSelected = selected === lang.code;
                return (
                  <button
                    key={lang.code}
                    style={{ ...styles.langCard, ...(isSelected ? styles.langCardSelected : {}) }}
                    onClick={() => handleSelect(lang.code)}
                    title={`${lang.fr} — ${lang.native}`}
                  >
                    <span style={styles.langFlag}>{lang.flag}</span>
                    <div style={styles.langInfo}>
                      <div style={{ ...styles.langFr, ...(isSelected ? { color: 'var(--blue)' } : {}) }}>
                        {lang.fr}
                      </div>
                      <div style={styles.langNative}>{lang.native}</div>
                    </div>
                    {isSelected && (
                      <i className="fas fa-circle-check" style={styles.langCheck} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* ── Bouton flottant de sauvegarde ── */}
      {currentLang && !saved && (
        <div style={styles.footer}>
          <div style={{ fontSize: 12.5, color: 'var(--t2)' }}>
            <i className="fas fa-circle-info" style={{ color: 'var(--blue)', marginRight: 5 }} />
            Cliquez sur <strong>Enregistrer</strong> pour appliquer la langue.
          </div>
          <button onClick={handleSave} style={styles.footerBtn}>
            <i className="fas fa-floppy-disk" /> Enregistrer la langue
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Styles ── */
const styles = {
  header: {
    background:   'linear-gradient(135deg, #0B1F3A, #1A3A6B)',
    borderRadius: 16,
    padding:      '20px 24px',
  } as React.CSSProperties,
  title: {
    fontFamily: 'var(--fd,"Fraunces",serif)',
    fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 6px',
    display: 'flex', alignItems: 'center', gap: 10,
  } as React.CSSProperties,
  sub: {
    fontSize: 12.5, color: 'rgba(200,217,248,.6)', margin: 0, lineHeight: 1.5,
  } as React.CSSProperties,

  deviceCard: {
    background:   'var(--white)',
    border:       '1.5px solid var(--bdr)',
    borderRadius: 14,
    padding:      '14px 18px',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'space-between',
    gap:          12,
    boxShadow:    'var(--sh-xs)',
  } as React.CSSProperties,
  deviceLeft: {
    display: 'flex', alignItems: 'center', gap: 14,
  } as React.CSSProperties,
  deviceFlag: {
    fontSize: 36, lineHeight: 1,
  } as React.CSSProperties,
  deviceLabel: {
    fontSize: 10, fontWeight: 700, color: 'var(--t4)',
    textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2,
  } as React.CSSProperties,
  deviceName: {
    fontSize: 14, fontWeight: 800, color: 'var(--navy)', marginBottom: 1,
  } as React.CSSProperties,
  deviceNative: {
    fontSize: 11.5, color: 'var(--t3)',
  } as React.CSSProperties,
  deviceBtn: {
    padding: '8px 16px', borderRadius: 10, border: '1.5px solid var(--bdr2)',
    background: 'var(--g50)', color: 'var(--t2)', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    transition: 'all .18s',
    flexShrink: 0,
  } as React.CSSProperties,
  deviceBtnActive: {
    background: 'var(--em-bg)', color: 'var(--emerald)',
    borderColor: 'rgba(4,120,87,.2)',
  } as React.CSSProperties,

  currentCard: {
    background:   'linear-gradient(135deg, #0B1F3A, #1a3a6b)',
    borderRadius: 14,
    padding:      '14px 18px',
    display:      'flex',
    alignItems:   'center',
    gap:          14,
  } as React.CSSProperties,
  saveBtn: {
    padding: '9px 18px', borderRadius: 10, border: 'none',
    background: 'rgba(255,255,255,.15)', color: '#fff',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
    transition: 'background .18s', flexShrink: 0,
    backdropFilter: 'blur(4px)',
  } as React.CSSProperties,

  controls: {
    display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center',
  } as React.CSSProperties,
  searchWrap: {
    flex: 1, minWidth: 200,
    position: 'relative' as const,
    display: 'flex', alignItems: 'center',
  } as React.CSSProperties,
  searchIco: {
    position: 'absolute' as const, left: 13, color: 'var(--t3)', fontSize: 13, pointerEvents: 'none' as const,
  } as React.CSSProperties,
  searchInput: {
    width: '100%', padding: '10px 36px 10px 38px',
    border: '1.5px solid var(--bdr2)', borderRadius: 12,
    background: 'var(--white)', color: 'var(--navy)',
    fontSize: 13, fontFamily: 'var(--fb,"DM Sans",sans-serif)',
    outline: 'none', transition: 'border-color .18s',
  } as React.CSSProperties,
  searchClear: {
    position: 'absolute' as const, right: 10,
    width: 22, height: 22, borderRadius: 6,
    border: 'none', background: 'var(--g100)',
    color: 'var(--t3)', fontSize: 11, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as React.CSSProperties,
  groupBtns: {
    display: 'flex', gap: 6,
  } as React.CSSProperties,
  groupBtn: {
    padding: '8px 14px', borderRadius: 10,
    border: '1.5px solid var(--bdr2)', background: 'var(--g50)',
    color: 'var(--t2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 5, transition: 'all .18s',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  groupBtnActive: {
    background: 'var(--sky)', color: 'var(--blue)', borderColor: 'var(--sky-3)',
  } as React.CSSProperties,

  emptyState: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    justifyContent: 'center', padding: '48px 20px',
    background: 'var(--g50)', borderRadius: 14, border: '1px dashed var(--bdr2)',
  } as React.CSSProperties,

  regionLabel: {
    display: 'flex', alignItems: 'center', gap: 7,
    fontSize: 10.5, fontWeight: 800, color: 'var(--t3)',
    textTransform: 'uppercase' as const, letterSpacing: '.7px',
    marginBottom: 8, marginTop: 4,
  } as React.CSSProperties,
  regionCount: {
    marginLeft: 4,
    background: 'var(--sky)', color: 'var(--blue)',
    borderRadius: 999, padding: '1px 7px',
    fontSize: 9.5, fontWeight: 800,
  } as React.CSSProperties,

  langGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 8,
    marginBottom: 8,
  } as React.CSSProperties,
  langCard: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px',
    background: 'var(--white)', border: '1.5px solid var(--bdr)',
    borderRadius: 12, cursor: 'pointer',
    transition: 'all .18s', textAlign: 'left' as const,
    position: 'relative' as const,
  } as React.CSSProperties,
  langCardSelected: {
    background: 'var(--sky)', borderColor: 'var(--blue)',
    boxShadow: '0 0 0 3px rgba(26,79,196,.12)',
  } as React.CSSProperties,
  langFlag: {
    fontSize: 22, lineHeight: 1, flexShrink: 0,
  } as React.CSSProperties,
  langInfo: {
    flex: 1, minWidth: 0,
  } as React.CSSProperties,
  langFr: {
    fontSize: 12, fontWeight: 700, color: 'var(--navy)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  langNative: {
    fontSize: 10.5, color: 'var(--t3)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  langCheck: {
    color: 'var(--blue)', fontSize: 14, flexShrink: 0,
  } as React.CSSProperties,

  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const,
    gap: 12, padding: '14px 18px',
    background: 'var(--sky)', border: '1.5px solid var(--sky-3)',
    borderRadius: 14,
  } as React.CSSProperties,
  footerBtn: {
    padding: '10px 22px', borderRadius: 10, border: 'none',
    background: 'var(--blue)', color: '#fff',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 7,
    transition: 'background .18s',
    flexShrink: 0,
  } as React.CSSProperties,
};
