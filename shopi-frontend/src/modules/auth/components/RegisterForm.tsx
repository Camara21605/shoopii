/* ================================================================
 * src/modules/auth/components/RegisterForm.tsx
 * Formulaire d'inscription — 5 étapes (6 pour une entreprise, avec le
 * logo de la boutique en étape dédiée). Voir `steps` plus bas.
 * ================================================================ */

import React, { useState, useEffect, useRef } from 'react';
import { RoleSelector }           from './RoleSelector';
import { FieldInput }             from '../../../shared/components/ui/FieldInput';
import { PhoneInput }             from './PhoneInput';
import { CodeBlock }              from './CodeBlock';
import { CorrespondantCodeBlock } from './CorrespondantCodeBlock';
import { PasswordStrengthBar }    from './PasswordStrengthBar';
import LocationPermission         from './LocationPermission';
import CompanyLocationSelect, { type CompanyLocationValue } from './CompanyLocationSelect';
import { usePasswordStrength }    from '../hooks/usePasswordStrength';
import { ROLE_CONFIGS }           from '../roleConfigs';
import { apiFetch }               from '../../../shared/services/apiFetch';
import type {
  RegisterFormData, FormErrors, UserRole,
  CorrespondantType, RegistrationLocation,
} from '../types';
import type { PhoneCountryMeta } from './PhoneInput';

/*
 * BUG CORRIGÉ — la localisation était optionnelle pour tous (boutons
 * "Ignorer" dans LocationPermission) et 'client' en était même exclu.
 * Obligatoire désormais pour tous les rôles ci-dessous : détection
 * automatique (GPS + repli carte manuelle) pour client/delivery/
 * partner/correspondent, sélection manuelle dans le référentiel géo
 * (Pays → Région → Préfecture → Commune) pour company — voir
 * CompanyLocationSelect.tsx, une entreprise n'est pas forcément à
 * l'endroit où elle s'inscrit.
 */
const LOCATION_ROLES: UserRole[] = ['client', 'company', 'delivery', 'partner', 'correspondent'];

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
  /** PlatformSettings.openSignup désactivé — voir RoleSelector. */
  clientRegistrationClosed?: boolean;
  /** PlatformSettings.codeRequiredForCompany — quand false, "Entreprise"
   *  devient sélectionnable sans invitation et le code n'est plus exigé.
   *  true par défaut (comportement historique) tant que la politique
   *  publique n'a pas encore répondu. */
  codeRequiredForCompany?: boolean;
  onValidateStep:  (fields: (keyof RegisterFormData)[]) => boolean;
  /** Invitation collaborateur (company-team) : rejoint une entreprise
   *  EXISTANTE — pas de code d'activation ni de nom de boutique à
   *  demander (contrairement à une inscription 'company' normale, qui
   *  CRÉE une nouvelle entreprise). Voir Login.tsx, useCollabInviteParams. */
  isCollabInvite?: boolean;
  /** Poste renseigné par l'entreprise à l'invitation — affiché en lecture
   *  seule (n'est jamais saisi par le collaborateur lui-même). */
  collabJobTitle?: string;
  /** Feedback léger (toast) — utilisé pour les liens CGU/confidentialité
   *  de l'étape Sécurité : aucune de ces pages légales n'existe encore
   *  (vérifié dans router.tsx, même constat que Footer.tsx), donc un
   *  clic ne doit ni fabriquer un faux texte légal ni rester muet. */
  onToast?: (msg: string) => void;
  /** Logo choisi pour la boutique (role='company' uniquement) — jamais
   *  envoyé dans POST /auth/register (ce n'est pas du JSON) : conservé
   *  ici pour être uploadé séparément juste après une inscription
   *  réussie, une fois authentifié (voir useLoginPage::
   *  maybeUploadRegisterLogo). Optionnel — une entreprise peut toujours
   *  l'ajouter plus tard depuis Paramètres > Boutique. */
  logoFile?:      File | null;
  onLogoChange?:  (file: File | null) => void;
}

/* Étape "Logo" : uniquement pour une inscription entreprise (jamais pour
 * un collaborateur invité, qui rejoint une boutique EXISTANTE — voir
 * isCollabInvite). Le nombre total d'étapes et leur ordre dépendent donc
 * du rôle : voir `steps` (calculé dans le composant, ci-dessous), qui
 * remplace TOTAL_STEPS/STEP_INFO/STEP_FIELDS indexés par numéro fixe. */
type StepKey = 'account' | 'identity' | 'logo' | 'profile' | 'contact' | 'password';

const STEP_INFO: Record<StepKey, { title: string; sub: string }> = {
  account:  { title: 'Votre compte',       sub: 'Choisissez votre rôle et entrez votre email' },
  identity: { title: 'Votre identité',     sub: 'Prénom, nom et nom de votre structure'        },
  logo:     { title: 'Votre logo',         sub: 'Ajoutez le logo de votre entreprise (facultatif)'    },
  profile:  { title: 'Votre profil',       sub: 'Date de naissance et genre'                   },
  contact:  { title: 'Vos coordonnées',    sub: "Numéro de téléphone et ville d'origine"        },
  password: { title: 'Votre mot de passe', sub: 'Sécurisez votre compte pour finaliser'         },
};

const STEP_FIELDS: Record<StepKey, (keyof RegisterFormData)[]> = {
  account: ['activationCode', 'email'],
  /* shopName/companyTypeId : sans effet pour les rôles autres que
   * "company" (voir validateRegisterField dans useLoginPage.ts) —
   * inclus inconditionnellement ici, pas besoin de connaître le rôle. */
  identity: ['firstName', 'lastName', 'businessModel', 'shopName', 'companyTypeId'],
  logo:     [], // facultatif — rien à valider pour avancer
  profile:  ['birthDate', 'gender'],
  /* 'location' et 'city' sont mutuellement exclusifs en pratique (voir
   * validateRegisterField dans useLoginPage.ts) : 'location' ne s'applique
   * que hors invitation (GPS/carte), 'city' uniquement pour un utilisateur
   * invité par lien (lockedRole, champ "Ville d'origine" — voir
   * needsLocation ci-dessous). Les inclure tous les deux ici est sans
   * risque, chacun renvoie `undefined` (pas d'erreur) quand il ne
   * s'applique pas au parcours en cours. */
  contact:  ['phone', 'location', 'city'],
  password: ['password', 'confirmPassword', 'terms'],
};

export const RegisterForm: React.FC<RegisterFormProps> = ({
  data, errors, selectedRole, isLoading,
  onDataChange, onRoleSelect, onSubmit, onSwitchToLogin,
  lockedRole = null, prefilledCode = '', onlyClientRole = false,
  clientRegistrationClosed = false, codeRequiredForCompany = true,
  onValidateStep, isCollabInvite = false, collabJobTitle, onToast,
  logoFile = null, onLogoChange,
}) => {
  const [step,     setStep]     = useState(1);
  const [animDir,  setAnimDir]  = useState<'forward' | 'backward'>('forward');
  const [navCount, setNavCount] = useState(0);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  /* Prévisualisation locale — révoque l'URL objet précédente pour éviter
   * une fuite mémoire à chaque changement/démontage. */
  useEffect(() => {
    if (!logoFile) { setLogoPreview(null); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { onToast?.('❌ Le logo ne doit pas dépasser 5 Mo.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      onToast?.('❌ Formats acceptés : JPEG, PNG ou WebP.'); return;
    }
    onLogoChange?.(file);
  }

  const { strength, show: showStrength, checkStrength } = usePasswordStrength();
  const roleConfig = ROLE_CONFIGS[selectedRole];

  /* Étape "Logo" insérée uniquement pour une inscription entreprise (pas
   * pour un collaborateur invité, qui rejoint une boutique EXISTANTE).
   * Le rôle n'est modifiable qu'à l'étape 1 (RoleSelector, plus bas) :
   * `steps` ne peut donc changer de forme que quand `step === 1`, jamais
   * pendant qu'un utilisateur avance dans les étapes suivantes. */
  const steps: StepKey[] = [
    'account', 'identity',
    ...(selectedRole === 'company' && !isCollabInvite ? (['logo'] as const) : []),
    'profile', 'contact', 'password',
  ];
  const totalSteps = steps.length;
  /* BUG CORRIGÉ — roleConfig.code est statique (toujours true pour
   * 'company') : le bloc code s'affichait encore même quand le
   * super-admin avait désactivé PlatformSettings.codeRequiredForCompany.
   * Seul "company" a un réglage dynamique, les autres rôles à code
   * gardent leur comportement figé (code toujours obligatoire).
   * Exception : une entreprise qui arrive via un VRAI lien d'invitation
   * (lockedRole==='company') voit quand même le bloc code — ce code porte
   * un lien réel (quel partenaire/admin l'a invitée), le cacher lui ferait
   * perdre cette info même quand l'auto-inscription est ouverte. */
  const codeRequiredForSelectedRole = selectedRole === 'company'
    ? (codeRequiredForCompany || lockedRole === 'company')
    : roleConfig.code;

  /* BUG CORRIGÉ — quand le rôle sélectionné est fermé à l'inscription
   * (client : openSignup=false : entreprise : codeRequiredForCompany=true
   * sans invitation), seule la carte du RoleSelector était grisée : le
   * reste du formulaire (email, mot de passe…) restait normalement
   * saisissable, laissant croire que l'inscription pouvait aboutir alors
   * qu'elle sera de toute façon rejetée à la soumission. Un lien
   * d'invitation (lockedRole) rend toujours le rôle accessible, quel que
   * soit ce calcul. */
  const isSelectedRoleBlocked = !lockedRole && (
    (selectedRole === 'client'  && clientRegistrationClosed) ||
    (selectedRole === 'company' && onlyClientRole && codeRequiredForCompany)
  );

  const [locationDone,        setLocationDone]        = useState(false);
  const [companyTypes,        setCompanyTypes]        = useState<CompanyTypeOption[]>([]);
  const [companyTypesLoading, setCompanyTypesLoading] = useState(false);
  const [villes,              setVilles]              = useState<VilleOption[]>([]);
  const [villesLoading,       setVillesLoading]       = useState(false);

  const needsLocation = LOCATION_ROLES.includes(selectedRole) && !lockedRole;

  useEffect(() => { setLocationDone(false); }, [selectedRole]);

  /* Un logo choisi pour "entreprise" n'a plus de sens si l'utilisateur
   * change finalement de rôle — évite de l'uploader silencieusement
   * après coup pour un compte non-company. */
  useEffect(() => {
    if (selectedRole !== 'company') onLogoChange?.(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole]);

  /* Filtré par businessModel une fois choisi (?nature=) — le backend
   * renvoie ce type + les types 'neutral', jamais l'autre modèle (voir
   * CompanyTypesService.findAll). Tant que businessModel n'est pas
   * encore choisi, on ne charge rien : le dropdown reste vide/désactivé
   * (voir plus bas) pour éviter de proposer un type incohérent. */
  useEffect(() => {
    if (selectedRole !== 'company' || !data.businessModel) { setCompanyTypes([]); return; }
    setCompanyTypesLoading(true);
    apiFetch<CompanyTypeOption[]>(`/company-types?nature=${data.businessModel}`)
      .then(d => setCompanyTypes(d ?? []))
      .catch(() => setCompanyTypes([]))
      .finally(() => setCompanyTypesLoading(false));
  }, [selectedRole, data.businessModel]);

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

  /* BUG CORRIGÉ — marquait toujours locationDone=true, même quand loc
   * était null (bouton "Ignorer", désormais retiré de LocationPermission
   * — voir ce fichier). Ne complète l'étape que sur une position
   * effectivement fournie : la localisation est obligatoire. */
  const handleLocationComplete = (loc: RegistrationLocation | null) => {
    if (!loc) return;
    onDataChange({
      latitude: loc.latitude ?? undefined, longitude: loc.longitude ?? undefined,
      locationAccuracy: loc.locationAccuracy ?? undefined,
      address: loc.address ?? undefined, city: loc.city ?? undefined,
      district: loc.district ?? undefined, region: loc.region ?? undefined,
      country: loc.country ?? undefined, postalCode: loc.postalCode ?? undefined,
      gpsEnabled: loc.gpsEnabled ?? false,
    });
    setLocationDone(true);
  };

  /* Localisation manuelle entreprise — voir CompanyLocationSelect.tsx.
   * Alimente les mêmes champs "affichage" que handleLocationComplete
   * (city/district/region/country → loc.* côté backend, auth.service.ts)
   * + les références structurées companyPaysId/companyVilleId. */
  const handleCompanyLocationComplete = (loc: CompanyLocationValue) => {
    onDataChange({
      companyPaysId:  loc.paysId,
      companyVilleId: loc.prefectureId,
      country:  loc.paysNom,
      region:   loc.regionNom,
      city:     loc.prefectureNom,
      district: loc.communeNom,
    });
    setLocationDone(true);
  };

  const goNext = () => {
    const key = steps[step - 1];
    if (onValidateStep(STEP_FIELDS[key] ?? [])) {
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
      {isSelectedRoleBlocked && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '9px',
          padding: '10px 13px', marginBottom: '4px',
          background: 'rgba(220,38,38,.06)',
          border: '1.5px solid rgba(220,38,38,.2)',
          borderRadius: '10px', fontSize: '12px',
          color: 'var(--rose, #DC2626)', lineHeight: 1.5,
        }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>🚫</span>
          <span>
            <strong>Inscription {roleConfig.label} fermée pour le moment.</strong>{' '}
            Choisissez un autre rôle ci-dessus ou revenez plus tard.
          </span>
        </div>
      )}
      <RoleSelector
        selected={selectedRole} onSelect={onRoleSelect} showSub
        label="Je m'inscris en tant que"
        lockedRole={lockedRole}
        onlyClientRole={!lockedRole && onlyClientRole}
        clientRegistrationClosed={clientRegistrationClosed}
        companyCodeRequired={codeRequiredForCompany}
      />

      <div className={`role-info${selectedRole !== 'client' ? ' show' : ''}`}>
        <div className="role-info-icon">{roleConfig.icon}</div>
        <div className="role-info-text" dangerouslySetInnerHTML={{ __html: roleConfig.info }} />
      </div>

      {codeRequiredForSelectedRole && !isCollabInvite && (
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
          disabled={isSelectedRoleBlocked}
        />
      )}
    </div>
  );

  /* ── Step 2 : Identité ── */
  const renderStep2 = () => (
    <div className="fields">
      {/* Une entreprise n'a pas de "prénom"/"nom" — seul le nom de la
       * boutique (shopName, plus bas) est demandé. Un collaborateur
       * invité (isCollabInvite) rejoint une entreprise EXISTANTE en tant
       * que personne réelle : son propre prénom/nom reste demandé. */}
      {(selectedRole !== 'company' || isCollabInvite) && (
        <>
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
        </>
      )}
      {isCollabInvite && collabJobTitle && (
        <div className="field-group">
          <div className="field-label">Poste</div>
          <div className="field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <i className="fas fa-briefcase" style={{ position: 'absolute', left: 12, color: 'var(--blue)', fontSize: 13, zIndex: 1 }} />
            <input
              className="field-input" type="text" value={collabJobTitle} readOnly
              style={{ paddingLeft: 36, paddingRight: 38, background: 'var(--sky-2,#EEF3FD)', color: 'var(--navy)', cursor: 'not-allowed', border: '1.5px solid var(--blue)', fontWeight: 600 }}
            />
            <span style={{ position: 'absolute', right: 12, fontSize: 14, color: 'var(--blue)' }}>🔒</span>
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="fas fa-circle-info" style={{ fontSize: 10 }} />
            Défini par l'entreprise qui vous invite — non modifiable
          </p>
        </div>
      )}
      {roleConfig.shop && !isCollabInvite && (
        <FieldInput
          id="regShopName" label="Nom de la boutique / entreprise" icon="fas fa-store"
          placeholder="Nom de votre entreprise" value={data.shopName ?? ''}
          onChange={val => onDataChange({ shopName: val })} error={errors.shopName}
        />
      )}
      {selectedRole === 'company' && !isCollabInvite && (
        <div className="field-group">
          <div className="field-label">
            Que proposez-vous ? <span style={{ color: 'var(--rose,red)' }}>*</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              { value: 'products' as const, icon: 'fa-box', label: 'Produits physiques', sub: 'Biens en stock, livrés' },
              { value: 'services' as const, icon: 'fa-screwdriver-wrench', label: 'Services', sub: 'Prestations, rendez-vous' },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onDataChange({ businessModel: opt.value, companyTypeId: '' })}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '14px 10px', borderRadius: 12, cursor: 'pointer',
                  border: `2px solid ${data.businessModel === opt.value ? 'var(--blue)' : 'var(--bdr2, #E2E8F0)'}`,
                  background: data.businessModel === opt.value ? 'var(--sky-2, #EEF3FD)' : 'var(--white, #fff)',
                }}
              >
                <i className={`fas ${opt.icon}`} style={{ fontSize: 20, color: data.businessModel === opt.value ? 'var(--blue)' : 'var(--t3)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{opt.label}</span>
                <span style={{ fontSize: 10.5, color: 'var(--t3)' }}>{opt.sub}</span>
              </button>
            ))}
          </div>
          {errors.businessModel && (
            <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--rose,red)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <i className="fas fa-circle-exclamation" style={{ fontSize: 10 }} />
              {errors.businessModel}
            </p>
          )}
        </div>
      )}
      {selectedRole === 'company' && !isCollabInvite && (
        <div className="field-group">
          <div className="field-label">
            Type d&apos;entreprise <span style={{ color: 'var(--rose,red)' }}>*</span>
          </div>
          <div className="field-wrap" style={{ position: 'relative' }}>
            <i className="fas fa-store" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--blue)', fontSize: 13, zIndex: 1, pointerEvents: 'none' }} />
            <select
              className="field-input"
              style={{ paddingLeft: 36, appearance: 'none', cursor: data.businessModel ? 'pointer' : 'not-allowed' }}
              value={data.companyTypeId ?? ''}
              onChange={e => onDataChange({ companyTypeId: e.target.value })}
              disabled={companyTypesLoading || !data.businessModel}
            >
              <option value="">
                {!data.businessModel ? 'Choisissez d\'abord "Produits" ou "Services" ci-dessus'
                  : companyTypesLoading ? 'Chargement…' : "Choisir un type d'entreprise…"}
              </option>
              {companyTypes.map(t => (
                <option key={t.id} value={t.id}>{t.icone ? `${t.icone} ` : ''}{t.nom}</option>
              ))}
            </select>
            <i className="fas fa-chevron-down" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', fontSize: 11, pointerEvents: 'none' }} />
          </div>
          {errors.companyTypeId && (
            <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--rose,red)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <i className="fas fa-circle-exclamation" style={{ fontSize: 10 }} />
              {errors.companyTypeId}
            </p>
          )}
        </div>
      )}
    </div>
  );

  /* ── Step "Logo" (company uniquement) — sa propre étape, comme les
   * autres champs, plutôt que noyé dans l'étape Identité. ── */
  const renderStepLogo = () => (
    <div className="fields">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
        <div
          onClick={() => logoInputRef.current?.click()}
          title="Choisir un logo"
          style={{
            width: 120, height: 120, borderRadius: '50%', flexShrink: 0,
            border: '2px dashed var(--bdr2, #E2E8F0)', background: 'var(--sky-2, #EEF3FD)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', overflow: 'hidden',
          }}
        >
          {logoPreview
            ? <img src={logoPreview} alt="Logo de l'entreprise" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <i className="fas fa-store" style={{ fontSize: 40, color: 'var(--blue)' }} />}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            style={{ background: 'none', border: '1.5px solid var(--bdr2, #E2E8F0)', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, color: 'var(--navy)', cursor: 'pointer' }}
          >
            <i className="fas fa-upload" /> {logoPreview ? 'Changer le logo' : 'Choisir un logo'}
          </button>
          {logoPreview && (
            <button
              type="button"
              onClick={() => onLogoChange?.(null)}
              style={{ background: 'none', border: '1.5px solid var(--bdr2, #E2E8F0)', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, color: 'var(--rose,red)', cursor: 'pointer' }}
            >
              Retirer
            </button>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--t3)', textAlign: 'center' }}>
          JPEG, PNG ou WebP — 5 Mo max.<br />Facultatif — vous pourrez aussi l&apos;ajouter plus tard depuis Paramètres.
        </p>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleLogoSelect}
        />
      </div>
    </div>
  );

  /* ── Step 3 : Profil ── */
  const renderStep3 = () => (
    <div className="fields">
      <div className="field-group">
        <div className="field-label">
          Date de naissance <span style={{ color: 'var(--rose,red)' }}>*</span>
        </div>
        <div className="field-wrap">
          <i className="fas fa-calendar" style={{ position: 'absolute', left: 14, color: 'var(--t3)', fontSize: 13, pointerEvents: 'none', zIndex: 1 }} />
          <input
            type="date"
            className="field-input"
            value={data.birthDate ?? ''}
            onChange={e => onDataChange({ birthDate: e.target.value })}
            max={new Date(new Date().setFullYear(new Date().getFullYear() - 13)).toISOString().split('T')[0]}
            style={{ paddingLeft: 40 }}
          />
        </div>
        {errors.birthDate && (
          <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--rose,red)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="fas fa-circle-exclamation" style={{ fontSize: 10 }} />
            {errors.birthDate}
          </p>
        )}
      </div>

      <div className="field-group">
        <div className="field-label">
          Genre <span style={{ color: 'var(--rose,red)' }}>*</span>
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
              className={`gender-opt${data.gender === opt.value ? ' selected' : ''}`}
              onClick={() => onDataChange({ gender: opt.value })}
            >
              <span className="gender-opt-icon">{opt.icon}</span>
              <span className="gender-opt-lbl">{opt.label}</span>
            </button>
          ))}
        </div>
        {errors.gender && (
          <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--rose,red)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="fas fa-circle-exclamation" style={{ fontSize: 10 }} />
            {errors.gender}
          </p>
        )}
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
      {needsLocation && !locationDone && selectedRole === 'company' && (
        <CompanyLocationSelect onComplete={handleCompanyLocationComplete} />
      )}
      {needsLocation && !locationDone && selectedRole !== 'company' && (
        <LocationPermission defaultCountryName={data.countryName} onComplete={handleLocationComplete} />
      )}
      {needsLocation && locationDone && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 13px', background: '#ecfdf5', border: '1.5px solid #a7f3d0',
          borderRadius: 10, fontSize: 12.5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <i className="fas fa-location-dot" style={{ color: '#047857' }} />
            <span style={{ color: '#065f46', fontWeight: 600 }}>
              Position enregistrée{data.city ? ` — ${data.city}` : ''}
            </span>
          </div>
          <button type="button" onClick={() => setLocationDone(false)}
            style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 11.5, cursor: 'pointer', fontWeight: 600 }}>
            Modifier
          </button>
        </div>
      )}
      {needsLocation && errors.location && !locationDone && (
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--rose,red)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="fas fa-circle-exclamation" style={{ fontSize: 10 }} />
          {errors.location}
        </p>
      )}
      {!needsLocation && (
        <div className="field-group">
          <div className="field-label">Ville d'origine <span style={{ color: 'var(--rose,red)' }}>*</span></div>
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
          {errors.city && (
            <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--rose,red)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <i className="fas fa-circle-exclamation" style={{ fontSize: 10 }} />
              {errors.city}
            </p>
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
          autoComplete="new-password"
        />
        <PasswordStrengthBar strength={strength} show={showStrength} />
      </div>
      <FieldInput
        id="regPwd2" label="Confirmer le mot de passe" icon="fas fa-lock" type="password"
        placeholder="Répétez votre mot de passe" value={data.confirmPassword}
        onChange={val => onDataChange({ confirmPassword: val })} error={errors.confirmPassword}
        autoComplete="new-password"
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
            <a href="#" style={{ color: 'var(--blue)', fontWeight: 700 }}
              onClick={e => { e.preventDefault(); onToast?.('📄 Conditions d\'utilisation — page bientôt disponible.'); }}>
              conditions d&apos;utilisation
            </a>
            {' '}et la{' '}
            <a href="#" style={{ color: 'var(--blue)', fontWeight: 700 }}
              onClick={e => { e.preventDefault(); onToast?.('📄 Politique de confidentialité — page bientôt disponible.'); }}>
              politique de confidentialité
            </a>
            {' '}de Shoneya. <span style={{ color: 'var(--rose,red)', fontWeight: 700 }}>*</span>
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
    switch (steps[step - 1]) {
      case 'account':  return renderStep1();
      case 'identity': return renderStep2();
      case 'logo':     return renderStepLogo();
      case 'profile':  return renderStep3();
      case 'contact':  return renderStep4();
      case 'password': return renderStep5();
      default: return null;
    }
  };

  const info = STEP_INFO[steps[step - 1]];

  return (
    <div id="registerForm">

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
        {step < totalSteps ? (
          <button
            type="button"
            className="btn-next"
            onClick={goNext}
            disabled={isSelectedRoleBlocked}
            style={isSelectedRoleBlocked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
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
