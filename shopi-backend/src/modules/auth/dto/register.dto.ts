/* ============================================================
 * FICHIER : src/modules/auth/dto/register.dto.ts
 * ============================================================ */

import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsUUID,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UserRole }  from '../../../common/enums/user-role.enum';
import { MinAgeForRole } from '../../../common/validators/min-age-for-role.validator';
import { CompanyBusinessModel } from '../../../database/entities/profiles/entreprise-profile.entity';

/* Rôles dont la localisation est détectée automatiquement (GPS, avec
 * repli sur pointage manuel carte) plutôt que choisie manuellement dans
 * le référentiel géo — voir la section "Localisation" plus bas. */
const AUTO_LOCATION_ROLES: UserRole[] = [
  UserRole.CLIENT, UserRole.DELIVERY, UserRole.PARTNER, UserRole.CORRESPONDENT,
];

export class RegisterDto {

  /* Une entreprise n'a pas de "prénom"/"nom" — seul shopName est demandé
   * pour ce rôle (voir plus bas). RegisterDto n'est de toute façon jamais
   * utilisé par le parcours "collaborateur invité" (rejoint une entreprise
   * EXISTANTE via POST /company-team/invitations/accept/:token, un DTO
   * entièrement différent) : ici, role===COMPANY signifie toujours
   * "création d'une nouvelle entreprise", jamais un collaborateur. Voir
   * AuthService.register() pour la valeur de repli (dérivée de shopName)
   * quand ces champs sont absents. */
  @ValidateIf(o => o.role !== UserRole.COMPANY)
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire.' })
  @MinLength(2,  { message: 'Le prénom doit contenir au moins 2 caractères.' })
  @MaxLength(50, { message: 'Le prénom ne peut pas dépasser 50 caractères.' })
  @Transform(({ value }) => (value as string | undefined)?.trim())
  firstName?: string;

  @ValidateIf(o => o.role !== UserRole.COMPANY)
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  @MinLength(2,  { message: 'Le nom doit contenir au moins 2 caractères.' })
  @MaxLength(50, { message: 'Le nom ne peut pas dépasser 50 caractères.' })
  @Transform(({ value }) => (value as string | undefined)?.trim())
  lastName?: string;

  @IsEmail({}, { message: 'Adresse email invalide.' })
  @IsNotEmpty({ message: "L'email est obligatoire." })
  @MaxLength(255)
  @Transform(({ value }) => (value as string).trim().toLowerCase())
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => (value as string | undefined)?.replace(/\s/g, ''))
  phone?: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  @MinLength(8,   { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
    { message: 'Le mot de passe doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial.' },
  )
  password: string;

  @IsEnum(UserRole, {
    message: `Le rôle doit être l'une des valeurs suivantes : ${Object.values(UserRole).join(', ')}.`,
  })
  @IsNotEmpty({ message: 'Le rôle est obligatoire.' })
  role: UserRole;

  @IsOptional()
  @IsString()
  @MinLength(6,  { message: "Le code d'activation doit contenir au moins 6 caractères." })
  @MaxLength(64)
  @Transform(({ value }) => (value as string | undefined)?.trim().toUpperCase())
  activationCode?: string;

  /**
   * Slug du lien de parrainage personnel d'un partenaire (voir
   * partenaire-profile.entity.ts § LIEN DE PARRAINAGE). Alternative à
   * activationCode : rattache le nouvel acteur (company/delivery/
   * correspondent) au partenaire propriétaire du slug sans qu'aucun
   * code n'ait été saisi — voir AuthService.getReferralPartnerId().
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => (value as string | undefined)?.trim())
  referralSlug?: string;

  // Nom de la boutique — accepté sous les deux clés (shopName = clé frontend)
  @IsOptional()
  @IsString()
  @MinLength(2,   { message: 'Le nom de la boutique doit contenir au moins 2 caractères.' })
  @MaxLength(100, { message: 'Le nom de la boutique ne peut pas dépasser 100 caractères.' })
  @Transform(({ value }) => (value as string | undefined)?.trim())
  companyName?: string;

  /*
   * BUG CORRIGÉ — @IsOptional() rendait ce champ optionnel pour TOUS
   * les rôles, y compris "company" : une inscription entreprise sans
   * nom de boutique était acceptée silencieusement (AuthService
   * retombait alors sur fullName comme nom d'entreprise). @ValidateIf
   * remplace @IsOptional() : validé uniquement quand role === COMPANY,
   * ignoré (comme avant) pour tous les autres rôles.
   */
  @ValidateIf(o => o.role === UserRole.COMPANY)
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la boutique est obligatoire pour un compte entreprise.' })
  @MinLength(2,   { message: 'Le nom de la boutique doit contenir au moins 2 caractères.' })
  @MaxLength(100, { message: 'Le nom de la boutique ne peut pas dépasser 100 caractères.' })
  @Transform(({ value }) => (value as string | undefined)?.trim())
  shopName?: string;

  /*
   * BUG CORRIGÉ — @IsOptional() : le formulaire d'inscription affichait
   * "(optionnel)" pour ces deux champs, mais doivent en réalité être
   * obligatoires pour tous les rôles (décision explicite, y compris
   * pour le rôle client). Le parcours "collaborateur invité" (rejoint
   * une entreprise existante) n'est pas concerné : il passe par une
   * route et un DTO entièrement différents (POST /company-team/
   * invitations/accept/:token), jamais par RegisterDto.
   */
  // Date de naissance (format YYYY-MM-DD)
  @IsNotEmpty({ message: 'La date de naissance est obligatoire.' })
  @IsDateString({}, { message: 'La date de naissance doit être au format YYYY-MM-DD.' })
  /* Âge minimum différent selon le rôle choisi (livreur/entreprise/
   * correspondant : 18 ans, partenaire : 20 ans, administrateur : 25 ans,
   * aucune restriction pour un client) — voir MinAgeForRole. */
  @MinAgeForRole()
  birthDate: string;

  // Genre
  @IsNotEmpty({ message: 'Le genre est obligatoire.' })
  @IsString()
  @IsIn(['male', 'female', 'other', 'prefer_not'], {
    message: "Le genre doit être 'male', 'female', 'other' ou 'prefer_not'.",
  })
  gender: string;

  /* Modèle économique — exclusif et fixé à l'inscription (voir
   * Company.businessModel) : une entreprise vend soit des produits
   * physiques, soit propose des services, jamais les deux. Même
   * pattern @ValidateIf que shopName/companyTypeId ci-dessous. */
  @ValidateIf(o => o.role === UserRole.COMPANY)
  @IsEnum(CompanyBusinessModel, { message: "Le modèle d'activité doit être 'products' ou 'services'." })
  @IsNotEmpty({ message: "Le modèle d'activité est obligatoire pour un compte entreprise." })
  businessModel?: CompanyBusinessModel;

  /* BUG CORRIGÉ — même correctif que shopName ci-dessus : obligatoire
   * uniquement pour un compte "company". */
  @ValidateIf(o => o.role === UserRole.COMPANY)
  @IsString()
  @IsNotEmpty({ message: "Le type d'entreprise est obligatoire pour un compte entreprise." })
  @IsUUID('all', { message: 'companyTypeId doit être un UUID valide.' })
  companyTypeId?: string;

  /* Catégories choisies par l'entreprise APRÈS le choix de son type
   * (étape dédiée du formulaire d'inscription) : ce sont les SEULES
   * catégories qu'elle pourra ensuite utiliser pour ses produits/services.
   * Validées dans AuthService (existent, actives, appartiennent à
   * companyTypeId ; au moins une dès que le type en propose). Ignoré pour
   * tout rôle autre que "company". */
  @IsOptional()
  @IsArray({ message: 'categoryIds doit être une liste.' })
  @ArrayMaxSize(200, { message: 'Trop de catégories sélectionnées.' })
  @IsUUID('all', { each: true, message: 'Chaque catégorie doit être un UUID valide.' })
  categoryIds?: string[];

  // ── Informations pays (détectées via indicatif téléphonique) ──────────────

  /** Code pays ISO-2 détecté via l'indicatif (ex : "GN") */
  @IsOptional()
  @IsString()
  @MaxLength(3)
  countryCode?: string;

  /** Nom du pays (ex : "Guinée") */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  countryName?: string;

  /** Indicatif international (ex : "+224") */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  dialCode?: string;

  /*
   * ── Localisation ──────────────────────────────────────────────────────
   *
   * BUG CORRIGÉ — entièrement @IsOptional() : le formulaire d'inscription
   * proposait des boutons "Ignorer" à chaque étape de la demande de
   * position, et rien ne l'exigeait ici — n'importe quel compte pouvait
   * être créé sans aucune localisation.
   *
   * Désormais obligatoire, avec deux mécanismes selon le rôle :
   *   - AUTO_LOCATION_ROLES (client/delivery/partner/correspondent) :
   *     position détectée automatiquement (GPS ou pointage manuel sur
   *     carte en repli) — latitude/longitude requis.
   *   - COMPANY : l'admin choisit l'adresse de SON ENTREPRISE via une
   *     chaîne de sélection Pays → Région → Préfecture → Commune
   *     (référentiel géo existant), pas une position GPS du moment —
   *     companyPaysId/companyVilleId requis à la place.
   *
   * BUG CORRIGÉ (2) — un utilisateur inscrit via un lien d'invitation
   * (?role&code&email) ne voit JAMAIS l'étape GPS/carte côté frontend
   * (RegisterForm.tsx needsLocation=false quand lockedRole est défini) :
   * il ne renseigne qu'un champ "Ville d'origine" (city) à la place.
   * Comme latitude/longitude étaient exigés ici pour TOUS les
   * AUTO_LOCATION_ROLES sans exception, un partenaire/livreur/
   * correspondant invité ne pouvait JAMAIS finaliser son inscription —
   * le serveur rejetait systématiquement en 400 une requête qui ne
   * pouvait par construction jamais contenir ces deux champs. Le
   * backend n'a aucun moyen de savoir si CE rôle est actuellement "en
   * ligne" de saisie de l'un ou l'autre (c'est une décision du seul
   * frontend, lockedRole) : la validation accepte donc désormais l'UN
   * OU L'AUTRE (coordonnées GPS, ou ville d'origine), peu importe lequel
   * a effectivement été transmis — voir @ValidateIf sur `city` plus bas.
   */
  @ValidateIf(o => AUTO_LOCATION_ROLES.includes(o.role) && !o.city?.trim())
  @IsNumber({}, { message: 'La localisation est obligatoire.' })
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude?: number;

  @ValidateIf(o => AUTO_LOCATION_ROLES.includes(o.role) && !o.city?.trim())
  @IsNumber({}, { message: 'La localisation est obligatoire.' })
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude?: number;

  /* Choix manuel entreprise — UUID GeoPays / GeoPrefecture (voir
   * modules/geo). "Ville" désigne une GeoPrefecture dans ce référentiel,
   * convention déjà utilisée par Company.villeId (entreprise-profile
   * .entity.ts) et par le tunnel de commande (villesByIndicatif()). */
  @ValidateIf(o => o.role === UserRole.COMPANY)
  @IsString()
  @IsNotEmpty({ message: "La localisation de l'entreprise est obligatoire." })
  @IsUUID('all', { message: 'companyPaysId doit être un UUID valide.' })
  companyPaysId?: string;

  @ValidateIf(o => o.role === UserRole.COMPANY)
  @IsString()
  @IsNotEmpty({ message: "La localisation de l'entreprise est obligatoire." })
  @IsUUID('all', { message: 'companyVilleId doit être un UUID valide.' })
  companyVilleId?: string;

  /** Précision GPS en mètres */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  locationAccuracy?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  /* Requis pour AUTO_LOCATION_ROLES uniquement quand aucune coordonnée GPS
   * n'a été transmise (flux d'invitation par lien — voir le commentaire
   * détaillé au-dessus de `latitude`) : c'est l'un OU l'autre, jamais
   * aucun des deux. Toujours optionnel pour "company" (localisation gérée
   * via companyPaysId/companyVilleId) et pour les rôles hors
   * AUTO_LOCATION_ROLES. */
  @ValidateIf(o => AUTO_LOCATION_ROLES.includes(o.role) && (o.latitude == null || o.longitude == null))
  @IsString()
  @IsNotEmpty({ message: "Ville d'origine requise." })
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  /** Indique si l'utilisateur a accordé la permission GPS */
  @IsOptional()
  @IsBoolean()
  gpsEnabled?: boolean;

  /** Identifiant d'appareil — voir LoginDto.deviceId. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;
}