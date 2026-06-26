/* ============================================================
 * FICHIER : src/modules/auth/components/PhoneInput.tsx
 * RÔLE    : Champ téléphone avec sélecteur de code pays
 *           Liste déroulante avec drapeau + indicatif + nom du pays
 * ============================================================ */

import React, { useState, useRef, useEffect } from 'react';

/* ── Liste des pays avec indicatifs ── */
export const COUNTRY_CODES = [
  // Afrique de l'Ouest en premier (priorité Shopi)
  { code: 'GN',  dial: '+224', flag: '🇬🇳', name: 'Guinée' },
  { code: 'SN',  dial: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: 'ML',  dial: '+223', flag: '🇲🇱', name: 'Mali' },
  { code: 'CI',  dial: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: 'BF',  dial: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: 'NE',  dial: '+227', flag: '🇳🇪', name: 'Niger' },
  { code: 'TG',  dial: '+228', flag: '🇹🇬', name: 'Togo' },
  { code: 'BJ',  dial: '+229', flag: '🇧🇯', name: 'Bénin' },
  { code: 'MR',  dial: '+222', flag: '🇲🇷', name: 'Mauritanie' },
  { code: 'GW',  dial: '+245', flag: '🇬🇼', name: 'Guinée-Bissau' },
  { code: 'SL',  dial: '+232', flag: '🇸🇱', name: 'Sierra Leone' },
  { code: 'LR',  dial: '+231', flag: '🇱🇷', name: 'Liberia' },
  { code: 'GM',  dial: '+220', flag: '🇬🇲', name: 'Gambie' },
  { code: 'GH',  dial: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: 'NG',  dial: '+234', flag: '🇳🇬', name: 'Nigeria' },
  // Séparateur — Reste de l'Afrique
  { code: 'CM',  dial: '+237', flag: '🇨🇲', name: 'Cameroun' },
  { code: 'CD',  dial: '+243', flag: '🇨🇩', name: 'RD Congo' },
  { code: 'CG',  dial: '+242', flag: '🇨🇬', name: 'Congo' },
  { code: 'GA',  dial: '+241', flag: '🇬🇦', name: 'Gabon' },
  { code: 'SN',  dial: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: 'MG',  dial: '+261', flag: '🇲🇬', name: 'Madagascar' },
  { code: 'MA',  dial: '+212', flag: '🇲🇦', name: 'Maroc' },
  { code: 'DZ',  dial: '+213', flag: '🇩🇿', name: 'Algérie' },
  { code: 'TN',  dial: '+216', flag: '🇹🇳', name: 'Tunisie' },
  { code: 'EG',  dial: '+20',  flag: '🇪🇬', name: 'Égypte' },
  // Europe et reste
  { code: 'FR',  dial: '+33',  flag: '🇫🇷', name: 'France' },
  { code: 'BE',  dial: '+32',  flag: '🇧🇪', name: 'Belgique' },
  { code: 'CH',  dial: '+41',  flag: '🇨🇭', name: 'Suisse' },
  { code: 'CA',  dial: '+1',   flag: '🇨🇦', name: 'Canada' },
  { code: 'US',  dial: '+1',   flag: '🇺🇸', name: 'États-Unis' },
  { code: 'GB',  dial: '+44',  flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: 'DE',  dial: '+49',  flag: '🇩🇪', name: 'Allemagne' },
  { code: 'ES',  dial: '+34',  flag: '🇪🇸', name: 'Espagne' },
  { code: 'IT',  dial: '+39',  flag: '🇮🇹', name: 'Italie' },
  { code: 'PT',  dial: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: 'CN',  dial: '+86',  flag: '🇨🇳', name: 'Chine' },
];

// Dédupliquer par code pays
const UNIQUE_COUNTRIES = COUNTRY_CODES.filter(
  (c, i, arr) => arr.findIndex(x => x.code === c.code) === i
);

export interface PhoneCountryMeta {
  countryCode: string;   // "GN"
  countryName: string;   // "Guinée"
  dialCode:    string;   // "+224"
  flag:        string;   // "🇬🇳"
}

interface PhoneInputProps {
  value:            string;          // ex: "+224620000000" ou "620000000"
  onChange:         (full: string) => void;  // retourne le numéro complet avec indicatif
  onCountryChange?: (meta: PhoneCountryMeta) => void; // métadonnées pays détectées
  error?:           string;
  label?:           string;
  placeholder?:     string;
  disabled?:        boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  onCountryChange,
  error,
  label       = 'Téléphone',
  placeholder = '620 000 000 ou +224620…',
  disabled   = false,
}) => {
  // Initialiser avec Guinée par défaut
  const [selectedCountry, setSelectedCountry] = useState(UNIQUE_COUNTRIES[0]);
  const [localNumber,     setLocalNumber]     = useState('');
  const [dropdownOpen,    setDropdownOpen]     = useState(false);
  const [search,          setSearch]           = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef   = useRef<HTMLInputElement>(null);

  // Initialiser depuis value existante
  useEffect(() => {
    if (value && value.startsWith('+')) {
      const match = UNIQUE_COUNTRIES.find(c => value.startsWith(c.dial));
      if (match) {
        setSelectedCountry(match);
        setLocalNumber(value.slice(match.dial.length).replace(/\s/g, ''));
      }
    } else if (value) {
      setLocalNumber(value.replace(/\s/g, ''));
    }
  }, []);

  // Fermer le dropdown si clic extérieur
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Focus sur search quand dropdown s'ouvre
  useEffect(() => {
    if (dropdownOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [dropdownOpen]);

  /** Émet les métadonnées pays vers le parent */
  const emitCountryMeta = (country: typeof UNIQUE_COUNTRIES[0]) => {
    onCountryChange?.({
      countryCode: country.code,
      countryName: country.name,
      dialCode:    country.dial,
      flag:        country.flag,
    });
  };

  const handleCountrySelect = (country: typeof UNIQUE_COUNTRIES[0]) => {
    setSelectedCountry(country);
    setDropdownOpen(false);
    setSearch('');
    onChange(`${country.dial}${localNumber}`);
    emitCountryMeta(country);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw      = e.target.value;
    // Autoriser chiffres, espaces et "+" pour la saisie internationale
    const cleaned  = raw.replace(/[^0-9+\s]/g, '');
    const compact  = cleaned.replace(/\s/g, '');

    // ── Détection automatique du pays via le préfixe international ──
    // Format accepté : "+224620..." ou "00224620..."
    if (compact.startsWith('+') || compact.startsWith('00')) {
      const normalized = compact.startsWith('00') ? '+' + compact.slice(2) : compact;

      // Trier par longueur décroissante pour éviter les faux positifs
      // (+1 vs +212 : on teste +212 avant +1)
      const sorted  = [...UNIQUE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
      const matched = sorted.find(c => normalized.startsWith(c.dial));

      if (matched) {
        const localPart = normalized.slice(matched.dial.length);
        setSelectedCountry(matched);
        setLocalNumber(localPart);
        onChange(`${matched.dial}${localPart}`);
        emitCountryMeta(matched);
        return;
      }

      // Préfixe en cours de saisie mais pays pas encore identifié → on garde tel quel
      setLocalNumber(cleaned);
      onChange(cleaned);
      return;
    }

    // ── Numéro local sans préfixe (comportement normal) ──
    const num = cleaned.replace(/[^0-9\s]/g, '');
    setLocalNumber(num);
    onChange(`${selectedCountry.dial}${num.replace(/\s/g, '')}`);
    emitCountryMeta(selectedCountry);
  };

  const filteredCountries = search.trim()
    ? UNIQUE_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : UNIQUE_COUNTRIES;

  return (
    <div className="field-group" style={{ position: 'relative' }}>
      {label && <div className="field-label">{label}</div>}

      <div
        className={`field-wrap${error ? ' error' : ''}`}
        style={{ display: 'flex', alignItems: 'center', gap: 0, padding: 0 }}
      >
        {/* ── Sélecteur de pays ── */}
        <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => !disabled && setDropdownOpen(v => !v)}
            disabled={disabled}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            '5px',
              padding:        '0 10px',
              height:         '44px',
              background:     'var(--g50, #F8FAFF)',
              border:         'none',
              borderRight:    '1.5px solid var(--bdr2, #CBD5E1)',
              borderRadius:   '10px 0 0 10px',
              cursor:         disabled ? 'not-allowed' : 'pointer',
              fontSize:       '13px',
              fontWeight:     600,
              color:          'var(--navy)',
              whiteSpace:     'nowrap',
              minWidth:       '90px',
              justifyContent: 'center',
              transition:     'background .15s',
            }}
            onMouseOver={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'var(--sky-2, #DCE8F8)'; }}
            onMouseOut={e =>  { (e.currentTarget as HTMLButtonElement).style.background = 'var(--g50, #F8FAFF)'; }}
          >
            <span style={{ fontSize: '18px' }}>{selectedCountry.flag}</span>
            <span style={{ fontSize: '12px', color: 'var(--t2)' }}>{selectedCountry.dial}</span>
            <span style={{ fontSize: '9px', color: 'var(--t3)' }}>▼</span>
          </button>

          {/* ── Dropdown ── */}
          {dropdownOpen && (
            <div style={{
              position:     'absolute',
              top:          '100%',
              left:         0,
              zIndex:       1000,
              width:        '240px',
              background:   'var(--white, #fff)',
              border:       '1.5px solid var(--bdr2)',
              borderRadius: '12px',
              boxShadow:    '0 8px 32px rgba(0,0,0,.12)',
              marginTop:    '4px',
              overflow:     'hidden',
            }}>
              {/* Recherche */}
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bdr)' }}>
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Rechercher un pays…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width:        '100%',
                    padding:      '7px 10px',
                    border:       '1.5px solid var(--bdr2)',
                    borderRadius: '8px',
                    fontSize:     '12.5px',
                    fontFamily:   'inherit',
                    outline:      'none',
                    background:   'var(--g50)',
                    color:        'var(--navy)',
                  }}
                />
              </div>

              {/* Liste */}
              <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {filteredCountries.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--t3)' }}>
                    Aucun pays trouvé
                  </div>
                ) : filteredCountries.map(country => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountrySelect(country)}
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      gap:            '10px',
                      width:          '100%',
                      padding:        '9px 14px',
                      background:     selectedCountry.code === country.code
                                        ? 'var(--sky-2, #DCE8F8)'
                                        : 'transparent',
                      border:         'none',
                      cursor:         'pointer',
                      fontSize:       '13px',
                      textAlign:      'left',
                      transition:     'background .1s',
                    }}
                    onMouseOver={e => {
                      if (selectedCountry.code !== country.code)
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--g50)';
                    }}
                    onMouseOut={e => {
                      if (selectedCountry.code !== country.code)
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{country.flag}</span>
                    <span style={{ flex: 1, color: 'var(--navy)', fontWeight: selectedCountry.code === country.code ? 700 : 400 }}>
                      {country.name}
                    </span>
                    <span style={{ color: 'var(--t3)', fontSize: '12px', flexShrink: 0 }}>
                      {country.dial}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Champ numéro ── */}
        <input
          type="tel"
          inputMode="tel"
          placeholder={placeholder}
          value={localNumber}
          onChange={handleNumberChange}
          disabled={disabled}
          style={{
            flex:         1,
            height:       '44px',
            padding:      '0 12px',
            border:       'none',
            outline:      'none',
            borderRadius: '0 10px 10px 0',
            fontSize:     '13.5px',
            fontFamily:   'inherit',
            color:        'var(--navy)',
            background:   'transparent',
            minWidth:     0,
          }}
        />
      </div>

      {/* Erreur */}
      {error && (
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '5px',
          color:      'var(--rose, #DC2626)',
          fontSize:   '11.5px',
          marginTop:  '5px',
        }}>
          <i className="fas fa-circle-exclamation" style={{ fontSize: '10px' }} />
          {error}
        </div>
      )}
    </div>
  );
};