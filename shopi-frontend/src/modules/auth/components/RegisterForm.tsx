/* ================================================================
 * src/modules/auth/components/RegisterForm.tsx
 *
 * MODIFICATION :
 *   CorrespondantCodeBlock reçoit maintenant prefilledCode
 *   → si lien d'invitation détecté, auto-sélectionne le type
 *     (entreprise ou livreur) et verrouille le code
 * ================================================================ */

import React, { useEffect, useState } from 'react';
import { RoleSelector }              from './RoleSelector';
import { FieldInput }                from '../../../shared/components/ui/FieldInput';
import { PhoneInput }                from './PhoneInput';
import { CodeBlock }                 from './CodeBlock';
import { CorrespondantCodeBlock }    from './CorrespondantCodeBlock';
import { PasswordStrengthBar }       from './PasswordStrengthBar';
import LocationPermission            from './LocationPermission';
import { usePasswordStrength }       from '../hooks/usePasswordStrength';
import { ROLE_CONFIGS }              from '../roleConfigs';
import { apiFetch }                  from '../../../shared/services/apiFetch';
import type { RegisterFormData, FormErrors, UserRole, CorrespondantType, RegistrationLocation } from '../types';
import type { PhoneCountryMeta }     from './PhoneInput';

/** Rôles pour lesquels la géolocalisation est proposée à l'inscription */
const LOCATION_ROLES: UserRole[] = ['company', 'delivery', 'partner', 'correspondent'];

interface CompanyTypeOption {
  id: string; nom: string; icone: string | null;
}

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
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  data, errors, selectedRole, isLoading,
  onDataChange, onRoleSelect, onSubmit, onSwitchToLogin,
  lockedRole = null, prefilledCode = '', onlyClientRole = false,
}) => {
  const { strength, show: showStrength, checkStrength } = usePasswordStrength();
  const roleConfig = ROLE_CONFIGS[selectedRole];

  /* ── Localisation : afficher ou non le composant ── */
  const [locationDone, setLocationDone] = useState(false);
  const needsLocation = LOCATION_ROLES.includes(selectedRole) && !lockedRole;

  /* Réinitialise l'état localisation si le rôle change */
  useEffect(() => { setLocationDone(false); }, [selectedRole]);

  /* ── Types d'entreprise ── */
  const [companyTypes,        setCompanyTypes]        = useState<CompanyTypeOption[]>([]);
  const [companyTypesLoading, setCompanyTypesLoading] = useState(false);

  useEffect(() => {
    if (selectedRole !== 'company') return;
    setCompanyTypesLoading(true);
    apiFetch<CompanyTypeOption[]>('/company-types')
      .then(d => setCompanyTypes(d ?? []))
      .catch(() => setCompanyTypes([]))
      .finally(() => setCompanyTypesLoading(false));
  }, [selectedRole]);

  /* ── Email verrouillé si invitation ── */
  const emailIsLocked = Boolean(lockedRole !== null && data.email?.trim().length > 0);

  /* ── Pré-sélection du rôle ── */
  useEffect(() => {
    if (lockedRole && lockedRole !== selectedRole) {
      const config = ROLE_CONFIGS[lockedRole];
      if (config) onRoleSelect(lockedRole, config.icon);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedRole]);

  /* ── Pré-remplissage du code pour les rôles non-correspondant ── */
  useEffect(() => {
    if (prefilledCode && prefilledCode !== data.activationCode && selectedRole !== 'correspondent') {
      onDataChange({ activationCode: prefilledCode });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledCode]);

  const handlePasswordChange = (val: string) => {
    onDataChange({ password: val });
    checkStrength(val);
  };

  /*
   * CorrespondantCodeBlock callback — reçoit le type détecté ET le code.
   * On les stocke dans le formulaire pour la soumission.
   */
  const handleCorrespondantCode = (type: CorrespondantType, code: string) => {
    onDataChange({
      activationCode:   code,
      correspondantType: type,   // 'company' ou 'delivery'
    } as any);
  };

  const handleCodeComplete = (code: string) => onDataChange({ activationCode: code });

  /** Détection automatique du pays via l'indicatif du téléphone */
  const handleCountryChange = (meta: PhoneCountryMeta) => {
    onDataChange({
      countryCode: meta.countryCode,
      countryName: meta.countryName,
      dialCode:    meta.dialCode,
    });
  };

  /** Résultat du composant LocationPermission (GPS ou manuel ou null) */
  const handleLocationComplete = (loc: RegistrationLocation | null) => {
    if (loc) {
      onDataChange({
        latitude:         loc.latitude         ?? undefined,
        longitude:        loc.longitude        ?? undefined,
        locationAccuracy: loc.locationAccuracy ?? undefined,
        address:          loc.address          ?? undefined,
        city:             loc.city             ?? undefined,
        district:         loc.district         ?? undefined,
        region:           loc.region           ?? undefined,
        country:          loc.country          ?? undefined,
        postalCode:       loc.postalCode       ?? undefined,
        gpsEnabled:       loc.gpsEnabled       ?? false,
      } as any);
    }
    setLocationDone(true);
  };

  const handleSubmit = () => {
    if (!data.terms) onDataChange({ terms: false });
    onSubmit();
  };

  /* ── URL de base de l'API (pour le redirect Google) ── */
  const apiBase = ((import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001/api') as string;

  const handleGoogleSignIn = () => {
    window.location.href = `${apiBase}/auth/google`;
  };

  return (
    <div id="registerForm">

      {/* ── Bouton Google — visible uniquement pour le rôle client sans invitation ── */}
      {selectedRole === 'client' && !lockedRole && (
        <>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', padding: '11px 16px', marginBottom: 4,
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
            {/* SVG officiel Google */}
            <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Continuer avec Google
          </button>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            margin: '10px 0 14px', color: 'var(--t3)', fontSize: 12,
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border, #e5e7eb)' }} />
            <span>ou créer un compte manuellement</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border, #e5e7eb)' }} />
          </div>
        </>
      )}

      {/* ── Sélecteur de rôle ── */}
      <RoleSelector
        selected={selectedRole}
        onSelect={onRoleSelect}
        showSub
        label="Je m'inscris en tant que"
        lockedRole={lockedRole}
        onlyClientRole={!lockedRole && onlyClientRole}
      />

      {/* ── Info-box du rôle ── */}
      <div className={`role-info${selectedRole !== 'client' ? ' show' : ''}`}>
        <div className="role-info-icon">{roleConfig.icon}</div>
        <div className="role-info-text" dangerouslySetInnerHTML={{ __html: roleConfig.info }} />
      </div>

      {/* ── Code d'activation ── */}
      {roleConfig.code && (
        <div className="code-field show" style={{ marginBottom: 16 }}>
          {roleConfig.codeType === 'choice' ? (

            /*
             * ✅ CORRESPONDANT — CorrespondantCodeBlock avec prefilledCode
             *
             * Si prefilledCode est présent (lien d'invitation) :
             *   → appel GET /codes/info/:code
             *   → détecte si envoyé par entreprise ou livreur
             *   → verrouille le type ET le code automatiquement
             *
             * Sinon :
             *   → l'utilisateur choisit entreprise ou livreur
             *   → puis saisit son code manuellement
             */
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
        <div style={{ color: 'var(--rose, red)', fontSize: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="fas fa-circle-exclamation" /> {errors.activationCode}
        </div>
      )}

      {/* ── Champs ── */}
      <div className="fields" id="regFields">

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

        {/* Type d'entreprise */}
        {selectedRole === 'company' && (
          <div className="field-group">
            <div className="field-label">
              Type d'entreprise <span style={{ color: 'var(--rose, red)' }}>*</span>
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
                <option value="">
                  {companyTypesLoading ? 'Chargement…' : 'Choisir un type d\'entreprise…'}
                </option>
                {companyTypes.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.icone ? `${t.icone} ` : ''}{t.nom}
                  </option>
                ))}
              </select>
              <i className="fas fa-chevron-down" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', fontSize: 11, pointerEvents: 'none' }} />
            </div>
          </div>
        )}

        {/* Email */}
        {emailIsLocked ? (
          <div className="field-group">
            <div className="field-label">Email</div>
            <div className="field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <i className="fas fa-envelope" style={{ position: 'absolute', left: 12, color: 'var(--blue)', fontSize: 13, zIndex: 1 }} />
              <input
                className="field-input" type="email" value={data.email} readOnly
                style={{ paddingLeft: 36, paddingRight: 38, background: 'var(--sky-2, #EEF3FD)', color: 'var(--navy)', cursor: 'not-allowed', border: '1.5px solid var(--blue)', fontWeight: 600 }}
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

        <PhoneInput
          label="Téléphone" placeholder="620 000 000"
          value={data.phone ?? ''}
          onChange={val => onDataChange({ phone: val })}
          onCountryChange={handleCountryChange}
          error={errors.phone}
        />

        {/* ── Détection pays confirmée ── */}
        {data.countryCode && (
          <div style={{
            display:'flex', alignItems:'center', gap:7,
            fontSize:12, color:'var(--blue)', marginTop:-6, marginBottom:4,
          }}>
            <i className="fas fa-circle-check" style={{ fontSize:10 }} />
            Pays détecté : <strong>{data.countryName}</strong> ({data.dialCode})
          </div>
        )}

        {/* ── Localisation GPS (rôles professionnels uniquement) ── */}
        {needsLocation && !locationDone && (
          <LocationPermission
            defaultCountryName={data.countryName}
            onComplete={handleLocationComplete}
          />
        )}

        {/* ── Confirmation localisation ── */}
        {needsLocation && locationDone && (
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'9px 13px',
            background: data.latitude ? '#ecfdf5' : 'var(--sky-2,#f0f4ff)',
            border:`1.5px solid ${data.latitude ? '#a7f3d0' : 'var(--sky-3,#c7d9f8)'}`,
            borderRadius:10, fontSize:12.5,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <i className={`fas ${data.latitude ? 'fa-location-dot' : 'fa-location-slash'}`}
                style={{ color: data.latitude ? '#047857' : 'var(--t3)' }} />
              {data.latitude
                ? <span style={{ color:'#065f46', fontWeight:600 }}>
                    Position enregistrée{data.city ? ` — ${data.city}` : ''}
                  </span>
                : <span style={{ color:'var(--t2)' }}>Position ignorée</span>
              }
            </div>
            <button
              type="button"
              onClick={() => setLocationDone(false)}
              style={{ background:'none', border:'none', color:'var(--blue)', fontSize:11.5, cursor:'pointer', fontWeight:600 }}
            >
              Modifier
            </button>
          </div>
        )}

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
          <div style={{ color: 'var(--rose, red)', fontSize: 12, padding: '8px 12px', background: 'var(--rose-dim, #fff0f0)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fas fa-circle-exclamation" /> {errors.general}
          </div>
        )}

        <div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: errors.terms ? 'var(--rose, red)' : 'var(--t2)', cursor: 'pointer', lineHeight: 1.5 }}>
            <input
              type="checkbox" required
              checked={data.terms ?? false}
              onChange={e => onDataChange({ terms: e.target.checked })}
              style={{ marginTop: 2, flexShrink: 0, accentColor: errors.terms ? 'var(--rose)' : 'var(--blue)', width: 15, height: 15, cursor: 'pointer' }}
            />
            <span>
              J'accepte les{' '}
              <a href="#" style={{ color: 'var(--blue)', fontWeight: 700 }} onClick={e => e.preventDefault()}>conditions d'utilisation</a>
              {' '}et la{' '}
              <a href="#" style={{ color: 'var(--blue)', fontWeight: 700 }} onClick={e => e.preventDefault()}>politique de confidentialité</a>
              {' '}de Shopi. <span style={{ color: 'var(--rose, red)', fontWeight: 700 }}>*</span>
            </span>
          </label>
          {errors.terms && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--rose, red)', fontSize: 11, marginTop: 5, marginLeft: 25 }}>
              <i className="fas fa-circle-exclamation" style={{ fontSize: 10 }} />
              Vous devez accepter les conditions d'utilisation pour continuer.
            </div>
          )}
        </div>
      </div>

      <button
        className={`btn-submit${isLoading ? ' loading' : ''}`}
        onClick={handleSubmit}
        disabled={isLoading}
        style={{ marginTop: 20 }}
      >
        {isLoading
          ? <><i className="fas fa-circle-notch spin" />{' '}Création du compte…</>
          : <><i className="fas fa-user-plus" />{' '}Créer mon compte</>
        }
      </button>

      <div className="form-bottom">
        Déjà un compte ?{' '}
        <a href="#" onClick={e => { e.preventDefault(); onSwitchToLogin(); }}>Se connecter</a>
      </div>
    </div>
  );
};