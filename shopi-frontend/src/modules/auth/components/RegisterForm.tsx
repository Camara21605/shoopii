/* ================================================================
 * src/modules/auth/components/RegisterForm.tsx
 * Formulaire d'inscription en 5 étapes.
 * ================================================================ */

import React, { useState, useEffect } from 'react';
import { RoleSelector }           from './RoleSelector';
import { FieldInput }             from '../../../shared/components/ui/FieldInput';
import { PhoneInput }             from './PhoneInput';
import { CodeBlock }              from './CodeBlock';
import { CorrespondantCodeBlock } from './CorrespondantCodeBlock';
import { PasswordStrengthBar }    from './PasswordStrengthBar';
import LocationPermission         from './LocationPermission';
import { usePasswordStrength }    from '../hooks/usePasswordStrength';
import { ROLE_CONFIGS }           from '../roleConfigs';
import { apiFetch }               from '../../../shared/services/apiFetch';
import type {
  RegisterFormData, FormErrors, UserRole,
  CorrespondantType, RegistrationLocation,
} from '../types';
import type { PhoneCountryMeta } from './PhoneInput';

const LOCATION_ROLES: UserRole[] = ['company', 'delivery', 'partner', 'correspondent'];

interface CompanyTypeOption { id: string; nom: string; icone: string | null; }
interface VilleOption       { id: string; nom: string; code: string; }

interface RegisterFormProps {
  data:            RegisterFormData;
  errors:          FormErrors;
  selectedRole:    UserRole;
  isLoading:       boolean;
  onDataChange:    (data: Partial<RegisterFormData>) => void;
  onRoleSelect:    (role: UserRole, icon: string) => void;
  onSubmit:        () => void;
  onSwitchToLogin: () => void;
  lockedRole?:     UserRole | null;
  prefilledCode?:  string;
  onlyClientRole?: boolean;
  onValidateStep:  (fields: (keyof RegisterFormData)[]) => boolean;
}

const TOTAL_STEPS = 5;

const STEP_META = [
  { label: 'Compte'   },
  { label: 'Identité' },
  { label: 'Profil'   },
  { label: 'Contact'  },
  { label: 'Sécurité' },
];

const STEP_INFO = [
  { title: 'Votre compte',       sub: 'Choisissez votre rôle et entrez votre email'   },
  { title: 'Votre identité',     sub: 'Prénom, nom et nom de votre structure'          },
  { title: 'Votre profil',       sub: 'Date de naissance et genre (optionnel)'         },
  { title: 'Vos coordonnées',    sub: "Numéro de téléphone et ville d'origine"         },
  { title: 'Votre mot de passe', sub: 'Sécurisez votre compte pour finaliser'          },
];

const STEP_FIELDS: Record<number, (keyof RegisterFormData)[]> = {
  1: ['activationCode', 'email'],
  2: ['firstName', 'lastName'],
  3: [],
  4: ['phone'],
  5: ['password', 'confirmPassword', 'terms'],
};

export const RegisterForm: React.FC<RegisterFormProps> = ({
  data, errors, selectedRole, isLoading,
  onDataChange, onRoleSelect, onSubmit, onSwitchToLogin,
  lockedRole = null, prefilledCode = '', onlyClientRole = false,
  onValidateStep,
}) => {
  const [step,     setStep]     = useState(1);
  const [animDir,  setAnimDir]  = useState<'forward' | 'backward'>('forward');
  const [navCount, setNavCount] = useState(0);

  const { strength, show: showStrength, checkStrength } = usePasswordStrength();
  const roleConfig = ROLE_CONFIGS[selectedRole];

  const [locationDone,        setLocationDone]        = useState(false);
  const [companyTypes,        setCompanyTypes]        = useState<CompanyTypeOption[]>([]);
  const [companyTypesLoading, setCompanyTypesLoading] = useState(false);
  const [villes,              setVilles]              = useState<VilleOption[]>([]);
  const [villesLoading,       setVillesLoading]       = useState(false);

  const needsLocation = LOCATION_ROLES.includes(selectedRole) && !lockedRole;

  useEffect(() => { setLocationDone(false); }, [selectedRole]);

  useEffect(() => {
    if (selectedRole !== 'company') return;
    setCompanyTypesLoading(true);
    apiFetch<CompanyTypeOption[]>('/company-types')
      .then(d => setCompanyTypes(d ?? []))
      .catch(() => setCompanyTypes([]))
      .finally(() => setCompanyTypesLoading(false));
  }, [selectedRole]);

  const emailIsLocked = Boolean(lockedRole !== null && data.email?.trim().length > 0);

  useEffect(() => {
    if (lockedRole && lockedRole !== selectedRole) {
      const config = ROLE_CONFIGS[lockedRole];
      if (config) onRoleSelect(lockedRole, config.icon);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedRole]);

  useEffect(() => {
    if (prefilledCode && prefilledCode !== data.activationCode && selectedRole !== 'correspondent') {
      onDataChange({ activationCode: prefilledCode });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledCode]);

  useEffect(() => {
    if (!data.dialCode || needsLocation) { setVilles([]); return; }
    let cancelled = false;
    setVillesLoading(true);
    apiFetch<VilleOption[]>(`/geo/villes?indicatif=${encodeURIComponent(data.dialCode)}`)
      .then(res => { if (!cancelled) setVilles(res ?? []); })
      .catch(() => { if (!cancelled) setVilles([]); })
      .finally(() => { if (!cancelled) setVillesLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.dialCode, needsLocation]);

  useEffect(() => {
    onDataChange({ city: '' } as any);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.dialCode]);

  const handlePasswordChange = (val: string) => {
    onDataChange({ password: val });
    checkStrength(val);
  };

  const handleCorrespondantCode = (type: CorrespondantType, code: string) => {
    onDataChange({ activationCode: code, correspondantType: type } as any);
  };

  const handleCodeComplete  = (code: string) => onDataChange({ activationCode: code });

  const handleCountryChange = (meta: PhoneCountryMeta) => {
    onDataChange({ countryCode: meta.countryCode, countryName: meta.countryName, dialCode: meta.dialCode });
  };

  const handleLocationComplete = (loc: RegistrationLocation | null) => {
    if (loc) {
      onDataChange({
        latitude: loc.latitude ?? undefined, longitude: loc.longitude ?? undefined,
        locationAccuracy: loc.locationAccuracy ?? undefined,
        address: loc.address ?? undefined, city: loc.city ?? undefined,
        district: loc.district ?? undefined, region: loc.region ?? undefined,
        country: loc.country ?? undefined, postalCode: loc.postalCode ?? undefined,
        gpsEnabled: loc.gpsEnabled ?? false,
      } as any);
    }
    setLocationDone(true);
  };

  const apiBase = ((import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001/api') as string;
  const handleGoogleSignIn = () => { window.location.href = `${apiBase}/auth/google`; };

  const goNext = () => {
    if (onValidateStep(STEP_FIELDS[step] ?? [])) {
      setAnimDir('forward');
      setNavCount(n => n + 1);
      setStep(s => s + 1);
    }
  };

  const goBack = () => {
    setAnimDir('backward');
    setNavCount(n => n + 1);
    setStep(s => s - 1);
  };

  const handleSubmit = () => {
    if (!data.terms) onDataChange({ terms: false });
    onSubmit();
  };

  /* ── Step 1 : Compte ── */
  const renderStep1 = () => (
    <div className="fields">
      {selectedRole === 'client' && !lockedRole && (
        <>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', padding: '11px 16px',
              background: '#fff', border: '1.5px solid #dadce0', borderRadius: 10,
              fontSize: 14, fontWeight: 600, color: '#3c4043', cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,.08)', transition: 'box-shadow .15s, border-color .15s',
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,.15)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#aaa';
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,.08)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#dadce0';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Continuer avec Google
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--t3)', fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--bdr2)' }} />
            <span>ou créer un compte</span>
            <div style={{ flex: 1, height: 1, background: 'var(--bdr2)' }} />
          </div>
        </>
      )}

      <RoleSelector
        selected={selectedRole} onSelect={onRoleSelect} showSub
        label="Je m'inscris en tant que"
        lockedRole={lockedRole}
        onlyClientRole={!lockedRole && onlyClientRole}
      />

      <div className={`role-info${selectedRole !== 'client' ? ' show' : ''}`}>
        <div className="role-info-icon">{roleConfig.icon}</div>
        <div className="role-info-text" dangerouslySetInnerHTML={{ __html: roleConfig.info }} />
      </div>

      {roleConfig.code && (
        <div className="code-field show">
          {roleConfig.codeType === 'choice' ? (
            <CorrespondantCodeBlock
              onComplete={handleCorrespondantCode}
              prefilledCode={prefilledCode || undefined}
            />
          ) : (
            <CodeBlock
              config={{ ...roleConfig, codeLength: 10 }}
              onComplete={handleCodeComplete}
              value={prefilledCode || data.activationCode}
            />
          )}
        </div>
      )}
      {errors.activationCode && (
        <div style={{ color: 'var(--rose,red)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="fas fa-circle-exclamation" /> {errors.activationCode}
        </div>
      )}

      {emailIsLocked ? (
        <div className="field-group">
          <div className="field-label">Email</div>
          <div className="field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <i className="fas fa-envelope" style={{ position: 'absolute', left: 12, color: 'var(--blue)', fontSize: 13, zIndex: 1 }} />
            <input
              className="field-input" type="email" value={data.email} readOnly
              style={{ paddingLeft: 36, paddingRight: 38, background: 'var(--sky-2,#EEF3FD)', color: 'var(--navy)', cursor: 'not-allowed', border: '1.5px solid var(--blue)', fontWeight: 600 }}
            />
            <span style={{ position: 'absolute', right: 12, fontSize: 14, color: 'var(--blue)' }}>🔒</span>
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="fas fa-circle-info" style={{ fontSize: 10 }} />
            Adresse email de votre invitation — non modifiable
          </p>
        </div>
      ) : (
        <FieldInput
          id="regEmail" label="Email" icon="fas fa-envelope" type="email"
          placeholder="votre@email.com" value={data.email}
          onChange={val => onDataChange({ email: val })} error={errors.email}
        />
      )}
    </div>
  );

  /* ── Step 2 : Identité ── */
  const renderStep2 = () => (
    <div className="fields">
      <FieldInput
        id="regFirstName" label="Prénom" icon="fas fa-user"
        placeholder="Votre prénom" value={data.firstName}
        onChange={val => onDataChange({ firstName: val })} error={errors.firstName}
      />
      <FieldInput
        id="regLastName" label="Nom" icon="fas fa-user"
        placeholder="Votre nom de famille" value={data.lastName}
        onChange={val => onDataChange({ lastName: val })} error={errors.lastName}
      />
      {roleConfig.shop && (
        <FieldInput
          id="regShopName" label="Nom de la boutique / entreprise" icon="fas fa-store"
          placeholder="Nom de votre entreprise" value={data.shopName ?? ''}
          onChange={val => onDataChange({ shopName: val })}
        />
      )}
      {selectedRole === 'company' && (
        <div className="field-group">
          <div className="field-label">
            Type d&apos;entreprise <span style={{ color: 'var(--rose,red)' }}>*</span>
          </div>
          <div className="field-wrap" style={{ position: 'relative' }}>
            <i className="fas fa-store" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--blue)', fontSize: 13, zIndex: 1, pointerEvents: 'none' }} />
            <select
              className="field-input"
              style={{ paddingLeft: 36, appearance: 'none', cursor: 'pointer' }}
              value={(data as any).companyTypeId ?? ''}
              onChange={e => onDataChange({ companyTypeId: e.target.value } as any)}
              disabled={companyTypesLoading}
            >
              <option value="">{companyTypesLoading ? 'Chargement…' : "Choisir un type d'entreprise…"}</option>
              {companyTypes.map(t => (
                <option key={t.id} value={t.id}>{t.icone ? `${t.icone} ` : ''}{t.nom}</option>
              ))}
            </select>
            <i className="fas fa-chevron-down" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', fontSize: 11, pointerEvents: 'none' }} />
          </div>
        </div>
      )}
    </div>
  );

  /* ── Step 3 : Profil ── */
  const renderStep3 = () => (
    <div className="fields">
      <div className="field-group">
        <div className="field-label">
          Date de naissance{' '}
          <span style={{ color: 'var(--t3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>
            (optionnel)
          </span>
        </div>
        <div className="field-wrap">
          <i className="fas fa-calendar" style={{ position: 'absolute', left: 14, color: 'var(--t3)', fontSize: 13, pointerEvents: 'none', zIndex: 1 }} />
          <input
            type="date"
            className="field-input"
            value={(data as any).birthDate ?? ''}
            onChange={e => onDataChange({ birthDate: e.target.value } as any)}
            max={new Date(new Date().setFullYear(new Date().getFullYear() - 13)).toISOString().split('T')[0]}
            style={{ paddingLeft: 40 }}
          />
        </div>
      </div>

      <div className="field-group">
        <div className="field-label">
          Genre{' '}
          <span style={{ color: 'var(--t3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>
            (optionnel)
          </span>
        </div>
        <div className="gender-grid">
          {[
            { value: 'male',       label: 'Homme',       icon: '👨' },
            { value: 'female',     label: 'Femme',       icon: '👩' },
            { value: 'other',      label: 'Autre',       icon: '🏳️‍🌈' },
            { value: 'prefer_not', label: 'Non précisé', icon: '🔒' },
          ].map(opt => (
            <button
              key={opt.value} type="button"
              className={`gender-opt${(data as any).gender === opt.value ? ' selected' : ''}`}
              onClick={() => onDataChange({ gender: opt.value } as any)}
            >
              <span className="gender-opt-icon">{opt.icon}</span>
              <span className="gender-opt-lbl">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── Step 4 : Contact ── */
  const renderStep4 = () => (
    <div className="fields">
      <PhoneInput
        label="Téléphone" placeholder="620 000 000"
        value={data.phone ?? ''}
        onChange={val => onDataChange({ phone: val })}
        onCountryChange={handleCountryChange}
        error={errors.phone}
      />
      {data.countryCode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--blue)', marginTop: -8 }}>
          <i className="fas fa-circle-check" style={{ fontSize: 10 }} />
          Pays détecté : <strong>{data.countryName}</strong> ({data.dialCode})
        </div>
      )}
      {needsLocation && !locationDone && (
        <LocationPermission defaultCountryName={data.countryName} onComplete={handleLocationComplete} />
      )}
      {needsLocation && locationDone && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 13px',
          background: data.latitude ? '#ecfdf5' : 'var(--sky-2,#f0f4ff)',
          border: `1.5px solid ${data.latitude ? '#a7f3d0' : 'var(--sky-3,#c7d9f8)'}`,
          borderRadius: 10, fontSize: 12.5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <i className={`fas ${data.latitude ? 'fa-location-dot' : 'fa-location-slash'}`}
              style={{ color: data.latitude ? '#047857' : 'var(--t3)' }} />
            {data.latitude
              ? <span style={{ color: '#065f46', fontWeight: 600 }}>
                  Position enregistrée{data.city ? ` — ${data.city}` : ''}
                </span>
              : <span style={{ color: 'var(--t2)' }}>Position ignorée</span>
            }
          </div>
          <button type="button" onClick={() => setLocationDone(false)}
            style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 11.5, cursor: 'pointer', fontWeight: 600 }}>
            Modifier
          </button>
        </div>
      )}
      {!needsLocation && (
        <div className="field-group">
          <div className="field-label">Ville d'origine</div>
          {villesLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t3)', padding: '10px 4px' }}>
              <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--blue)' }} />
              Chargement des villes…
            </div>
          ) : villes.length > 0 ? (
            <div className="field-wrap" style={{ position: 'relative' }}>
              <i className="fas fa-city" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', fontSize: 13, pointerEvents: 'none', zIndex: 1 }} />
              <select
                className="field-input"
                style={{ paddingLeft: 40, appearance: 'none', cursor: 'pointer' }}
                value={(data as any).city ?? ''}
                onChange={e => onDataChange({ city: e.target.value } as any)}
              >
                <option value="">Sélectionner une ville…</option>
                {villes.map(v => (
                  <option key={v.id} value={v.nom}>{v.nom}</option>
                ))}
              </select>
              <i className="fas fa-chevron-down" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', fontSize: 11, pointerEvents: 'none' }} />
            </div>
          ) : (
            <div className="field-wrap">
              <i className="fas fa-city" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', fontSize: 13, pointerEvents: 'none', zIndex: 1 }} />
              <input
                type="text"
                className="field-input"
                placeholder={data.dialCode ? 'Aucune ville trouvée — entrez manuellement' : 'Votre ville'}
                value={(data as any).city ?? ''}
                onChange={e => onDataChange({ city: e.target.value } as any)}
                style={{ paddingLeft: 40 }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  /* ── Step 5 : Sécurité ── */
  const renderStep5 = () => (
    <div className="fields">
      <div className="field-group">
        <FieldInput
          id="regPwd" label="Mot de passe" icon="fas fa-lock" type="password"
          placeholder="Créez un mot de passe fort" value={data.password}
          onChange={handlePasswordChange} error={errors.password}
        />
        <PasswordStrengthBar strength={strength} show={showStrength} />
      </div>
      <FieldInput
        id="regPwd2" label="Confirmer le mot de passe" icon="fas fa-lock" type="password"
        placeholder="Répétez votre mot de passe" value={data.confirmPassword}
        onChange={val => onDataChange({ confirmPassword: val })} error={errors.confirmPassword}
      />
      {errors.general && (
        <div style={{ color: 'var(--rose,red)', fontSize: 12, padding: '8px 12px', background: 'var(--rose-dim,#fff0f0)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-circle-exclamation" /> {errors.general}
        </div>
      )}
      <div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: errors.terms ? 'var(--rose,red)' : 'var(--t2)', cursor: 'pointer', lineHeight: 1.5 }}>
          <input
            type="checkbox" required
            checked={data.terms ?? false}
            onChange={e => onDataChange({ terms: e.target.checked })}
            style={{ marginTop: 2, flexShrink: 0, accentColor: errors.terms ? 'var(--rose)' : 'var(--blue)', width: 15, height: 15, cursor: 'pointer' }}
          />
          <span>
            J&apos;accepte les{' '}
            <a href="#" style={{ color: 'var(--blue)', fontWeight: 700 }} onClick={e => e.preventDefault()}>conditions d&apos;utilisation</a>
            {' '}et la{' '}
            <a href="#" style={{ color: 'var(--blue)', fontWeight: 700 }} onClick={e => e.preventDefault()}>politique de confidentialité</a>
            {' '}de Shopi. <span style={{ color: 'var(--rose,red)', fontWeight: 700 }}>*</span>
          </span>
        </label>
        {errors.terms && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--rose,red)', fontSize: 11, marginTop: 5, marginLeft: 25 }}>
            <i className="fas fa-circle-exclamation" style={{ fontSize: 10 }} />
            Vous devez accepter les conditions d&apos;utilisation pour continuer.
          </div>
        )}
      </div>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      default: return null;
    }
  };

  const info = STEP_INFO[step - 1];

  return (
    <div id="registerForm">

      {/* ── Indicateur d'étapes ── */}
      <div className="stepper">
        {STEP_META.map((sm, i) => {
          const n   = i + 1;
          const cls = n < step ? 'done' : n === step ? 'active' : '';
          return (
            <div key={n} className={`stepper-item ${cls}`}>
              <div className="stepper-dot">
                {n < step
                  ? <i className="fas fa-check" style={{ fontSize: 10 }} />
                  : n
                }
              </div>
              <div className="stepper-lbl">{sm.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Titre de l'étape ── */}
      <div className="step-subtitle">
        <h3>{info.title}</h3>
        <p>{info.sub}</p>
      </div>

      {/* ── Contenu animé ── */}
      <div key={navCount} className={navCount > 0 ? `step-anim-${animDir}` : ''}>
        {renderStep()}
      </div>

      {/* ── Navigation ── */}
      <div className="step-nav">
        {step > 1 && (
          <button type="button" className="btn-back" onClick={goBack}>
            <i className="fas fa-arrow-left" /> Retour
          </button>
        )}
        {step < TOTAL_STEPS ? (
          <button type="button" className="btn-next" onClick={goNext}>
            Suivant <i className="fas fa-arrow-right" />
          </button>
        ) : (
          <button
            type="button"
            className="btn-next"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading
              ? <><i className="fas fa-circle-notch fa-spin" />{' '}Création du compte…</>
              : <><i className="fas fa-user-plus" />{' '}Créer mon compte</>
            }
          </button>
        )}
      </div>

      <div className="form-bottom">
        Déjà un compte ?{' '}
        <a href="#" onClick={e => { e.preventDefault(); onSwitchToLogin(); }}>Se connecter</a>
      </div>
    </div>
  );
};
