/* ============================================================
 * FICHIER : src/database/entities/profiles/correspondant-profile.entity.ts
 *
 * ─── RÈGLE FONDAMENTALE ─────────────────────────────────────
 * Cette entité est liée à User via OneToOne.
 * AUCUN champ présent dans user.entity.ts ne doit être répété ici.
 *
 * Champs disponibles via user (NE PAS dupliquer) :
 *   User.firstName       → prénom
 *   User.lastName        → nom de famille
 *   User.email           → email unique
 *   User.phone           → téléphone principal / Orange Money
 *   User.profilePicture  → photo de profil
 *   User.password        → mot de passe (select:false)
 *   User.lastPasswordChangedAt → invalidation des JWT
 *   User.username, User.role, User.status → identité / auth
 *
 * Ce fichier contient UNIQUEMENT les champs propres au rôle :
 *
 *   §ident  Identité pro    → fullName(cache), bio, langues, typeCorrespondant
 *   §2      Point de dépôt  → depotNom, depotAdresse, depotCommune…
 *              ⚠️ depotPhone ≠ User.phone
 *                 depotPhone = numéro public du relais affiché aux clients
 *                 User.phone = numéro personnel pour Orange Money
 *   §3      Zone & Horaires → zonesActives(JSON) + OneToMany horaires
 *   §4      Entités         → codeBoutique, codeLivreur, colabSettings
 *   §5      Colis           → colisDelaiMax, colisCapaciteMax…
 *   §6      Paiement        → paiementMethodes, virementFrequence
 *   §7      Documents       → documentCni, documentBail… verificationStatus
 *   §8      Sécurité 2FA    → twoFaEnabled, twoFaMethod, twoFaSecret
 *   §9      Notifications   → notifSettings (JSON)
 *   §10     Confidentialité → privacySettings (JSON)
 *   §11     Zone sensible   → status (CorrespondantStatus enrichi)
 *   stats   Métriques       → totalMissions, averageRating
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToOne, OneToMany, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

import { User }         from '../user.entity';
import { CreationCode } from '../code-creation.entity';
import { Company }      from './entreprise-profile.entity';
import { Delivery }     from './livreur-profile.entity';
import { Partner }      from './partenaire-profile.entity';
import { CorrespondantHoraire } from './correspondant-horaire.entity';

// ─── ENUMS ────────────────────────────────────────────────────

/** Statut du compte correspondant */
export enum CorrespondantStatus {
  PENDING   = 'pending',    // en attente de validation Shopi
  ACTIVE    = 'active',     // compte actif
  SUSPENDED = 'suspended',  // suspendu par l'admin
  DISABLED  = 'disabled',   // désactivé par le correspondant (30 jours)
  DELETED   = 'deleted',    // suppression initiée (purge auto 30j)
}

/** Portée géographique du rôle correspondant */
export enum CorrespondantType {
  REGIONAL = 'regional',   // couvre une ville (ex : Conakry)
  ZONAL    = 'zonal',      // couvre une région
  NATIONAL = 'national',   // couvre tout le pays
}

/** Statut de vérification des documents officiels */
export enum VerificationStatus {
  UNVERIFIED = 'unverified', // aucun document soumis
  REVIEWING  = 'reviewing',  // en cours d'examen par Shopi
  VERIFIED   = 'verified',   // correspondant approuvé
  REJECTED   = 'rejected',   // documents refusés
}

/** Fréquence de virement des commissions */
export enum VirementFrequence {
  QUOTIDIEN    = 'quotidien',
  HEBDOMADAIRE = 'hebdomadaire', // défaut
  INSTANTANE   = 'instantane',   // à la demande, −1.5%
}

/** Méthode de double authentification */
export enum TwoFaMethod {
  SMS           = 'sms',
  AUTHENTICATOR = 'authenticator',
  EMAIL         = 'email',
}

// ─────────────────────────────────────────────────────────────

@Entity('correspondants')
export class Correspondent {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ═══════════════════════════════════════════════════════════
  // RELATIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Compte utilisateur (auth + identité de base).
   * firstName, lastName, email, phone, profilePicture → User uniquement.
   */
  @OneToOne(() => User, user => user.correspondent, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ name: 'userId', type: 'varchar', length: 36, update: false })
  userId: string;

  /** Code d'invitation utilisé à l'inscription */
  @OneToOne(() => CreationCode, code => code.correspondent, {
    nullable: true, onDelete: 'SET NULL', lazy: true, createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'creationCodeId' })
  creationCode: Promise<CreationCode> | CreationCode | null;

  @Column({ name: 'creationCodeId', type: 'varchar', length: 36, nullable: true })
  creationCodeId: string | null;

  /** Entreprise superviseure (optionnel) */
  @Index()
  @ManyToOne(() => Company, company => company.correspondants, {
    nullable: true, onDelete: 'SET NULL', lazy: true,
  })
  @JoinColumn({ name: 'companyId' })
  company: Promise<Company> | Company | null;

  @Column({ name: 'companyId', type: 'varchar', length: 36, nullable: true })
  companyId: string | null;

  /** Livreur superviseur (optionnel) */
  @Index()
  @ManyToOne(() => Delivery, delivery => delivery.correspondants, {
    nullable: true, onDelete: 'SET NULL', lazy: true,
  })
  @JoinColumn({ name: 'deliveryId' })
  delivery: Promise<Delivery> | Delivery | null;

  @Column({ name: 'deliveryId', type: 'varchar', length: 36, nullable: true })
  deliveryId: string | null;

  /** Partenaire superviseur (optionnel) */
  @Index()
  @ManyToOne(() => Partner, partner => partner.correspondants, {
    nullable: true, onDelete: 'SET NULL', lazy: true,
  })
  @JoinColumn({ name: 'partnerId' })
  partner: Promise<Partner> | Partner | null;

  @Column({ name: 'partnerId', type: 'varchar', length: 36, nullable: true })
  partnerId: string | null;

  /**
   * Horaires d'ouverture du point de dépôt.
   * Table séparée : correspondant_horaires (7 lignes max, 1/jour).
   */
  @OneToMany(() => CorrespondantHoraire, h => h.correspondant, {
    cascade: true, eager: false,
  })
  horaires: CorrespondantHoraire[];

  // ═══════════════════════════════════════════════════════════
  // §ident — IDENTITÉ PROFESSIONNELLE (propre au rôle)
  //
  // ⚠️  NE PAS ajouter : firstName, lastName, email, phone,
  //     profilePicture → déjà dans User.
  // ═══════════════════════════════════════════════════════════

  /**
   * Nom d'affichage public du correspondant.
   * Cache recalculé = User.firstName + " " + User.lastName.
   * Mis à jour automatiquement par le service updateProfil().
   * Indexé pour la recherche.
   */
  @Index()
  @Column({ type: 'varchar', length: 255 })
  fullName: string;

  /**
   * Biographie publique (visible par boutiques et livreurs partenaires).
   * Propre au rôle correspondant — pas dans User.
   */
  @Column({ type: 'text', nullable: true })
  bio: string | null;

  /**
   * Langues parlées (ex : "Français, Pular, Malinké").
   * Propre au rôle — pas dans User.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  langues: string | null;

  /** Portée géographique du correspondant */
  @Column({
    type: 'enum',
    enum: CorrespondantType,
    default: CorrespondantType.REGIONAL,
  })
  typeCorrespondant: CorrespondantType;

  // ═══════════════════════════════════════════════════════════
  // §2 — POINT DE DÉPÔT
  // ═══════════════════════════════════════════════════════════

  /**
   * Nom affiché du relais dans les informations de livraison.
   * ex : "Relais Correspondant Kaloum — Amadou Bah"
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  depotNom: string | null;

  /** Adresse complète du local de dépôt */
  @Column({ type: 'text', nullable: true })
  depotAdresse: string | null;

  /** Commune / quartier (ex : "Kaloum") */
  @Column({ type: 'varchar', length: 100, nullable: true })
  depotCommune: string | null;

  /** Ville du dépôt (ex : "Conakry") */
  @Column({ type: 'varchar', length: 100, nullable: true })
  depotVille: string | null;

  /**
   * Repère de localisation.
   * ex : "À côté de l'entrée principale, panneau Shopi visible"
   */
  @Column({ type: 'text', nullable: true })
  depotRepere: string | null;

  /** Latitude GPS du point de dépôt */
  @Index()
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  depotLatitude: number | null;

  /** Longitude GPS du point de dépôt */
  @Index()
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  depotLongitude: number | null;

  /** Code postal du dépôt */
  @Column({ type: 'varchar', length: 20, nullable: true })
  depotCodePostal: string | null;

  /** Région administrative du dépôt */
  @Column({ type: 'varchar', length: 100, nullable: true })
  depotRegion: string | null;

  /**
   * ⚠️  DIFFÉRENT de User.phone
   *
   * depotPhone  = numéro public du point de dépôt, affiché aux
   *               clients et livreurs dans les infos de livraison.
   * User.phone  = numéro personnel du correspondant pour Orange Money
   *               et les contacts directs.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  depotPhone: string | null;

  /** Capacité max en libellé (ex : "Jusqu'à 50 colis") */
  @Column({ type: 'varchar', length: 50, nullable: true })
  depotCapacite: string | null;

  /** Type de local (ex : "Centre commercial", "Bureau professionnel") */
  @Column({ type: 'varchar', length: 100, nullable: true })
  depotTypeLocal: string | null;

  /** Niveau d'accès sécurisé (ex : "Oui — accès contrôlé") */
  @Column({ type: 'varchar', length: 100, nullable: true })
  depotAcces: string | null;

  /**
   * Options d'accès physique (JSON boolean map).
   * Clés : pmr | parking | videosurveillance | climatise
   */
  @Column({ type: 'json', nullable: true })
  depotAccessOptions: Record<string, boolean> | null;

  // ═══════════════════════════════════════════════════════════
  // §3 — ZONE & HORAIRES
  // Les horaires détaillés → table correspondant_horaires
  // ═══════════════════════════════════════════════════════════

  /**
   * IDs des zones actives (JSON string array).
   * ex : ["kaloum", "dixinn", "matam", "ratoma", "matoto"]
   */
  @Column({ type: 'json', nullable: true })
  zonesActives: string[] | null;

  /**
   * Règles automatiques de gestion des zones (JSON boolean map).
   * Clés : refusAutoCap | alerteRetard48h | urgenceWeekend | pauseFeries
   */
  @Column({ type: 'json', nullable: true })
  zoneAutoRules: Record<string, boolean> | null;

  // ═══════════════════════════════════════════════════════════
  // §4 — ENTITÉS PARTENAIRES
  // ═══════════════════════════════════════════════════════════

  /** Code d'invitation boutique (ex : "COR-AB7") — unique dans la table */
  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  codeBoutique: string | null;

  @Column({ type: 'datetime', nullable: true })
  codeBoutiqueExpiry: Date | null;

  @Column({ type: 'int', default: 0 })
  codeBoutiqueUsages: number;

  @Column({ type: 'int', default: 5 })
  codeBoutiqueMax: number;

  /** Code d'invitation livreur (ex : "LVR-AB3") — unique dans la table */
  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  codeLivreur: string | null;

  @Column({ type: 'datetime', nullable: true })
  codeLivreurExpiry: Date | null;

  @Column({ type: 'int', default: 0 })
  codeLivreurUsages: number;

  @Column({ type: 'int', default: 10 })
  codeLivreurMax: number;

  /**
   * Paramètres de collaboration avec les partenaires (JSON boolean map).
   * Clés : accepterNonVerifies | autoAssigner | notifierBoutique | partagerStats
   */
  @Column({ type: 'json', nullable: true })
  colabSettings: Record<string, boolean> | null;

  // ═══════════════════════════════════════════════════════════
  // §5 — GESTION DES COLIS
  // ═══════════════════════════════════════════════════════════

  /** Délai max de conservation (jours) avant alerte retour automatique */
  @Column({ type: 'int', default: 7 })
  colisDelaiMax: number;

  /** Nombre max de colis simultanément en dépôt */
  @Column({ type: 'int', default: 50 })
  colisCapaciteMax: number;

  /** Valeur max acceptée par colis (GNF) */
  @Column({ type: 'bigint', default: 30000000 })
  colisValeurMax: number;

  /** Poids max accepté (ex : "Jusqu'à 25 kg") */
  @Column({ type: 'varchar', length: 50, nullable: true })
  colisPoids: string | null;

  /**
   * Indices des types de colis acceptés (JSON int array).
   * Référence COLIS_TYPES = ['📱 Électronique', '👗 Vêtements', ...]
   */
  @Column({ type: 'json', nullable: true })
  colisTypesAcceptes: number[] | null;

  /**
   * Règles incidents (JSON boolean map).
   * Clés : retourAuto7j | alerteSupport | bloquerLivreur3 | photoObligatoire
   */
  @Column({ type: 'json', nullable: true })
  colisIncidentRules: Record<string, boolean> | null;

  // ═══════════════════════════════════════════════════════════
  // §6 — PAIEMENT & COMMISSIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Méthodes de réception des commissions (JSON array d'objets).
   * ex : [{ "em":"🏦", "nm":"Orange Money", "sub":"+224 622…", "def":true }]
   */
  @Column({ type: 'json', nullable: true })
  paiementMethodes: Record<string, unknown>[] | null;

  /** Fréquence des virements de commission */
  @Column({
    type: 'enum',
    enum: VirementFrequence,
    default: VirementFrequence.HEBDOMADAIRE,
  })
  virementFrequence: VirementFrequence;

  /** Seuil minimum pour déclencher un virement automatique (GNF) */
  @Column({ type: 'int', default: 100000 })
  virementSeuil: number;

  // ═══════════════════════════════════════════════════════════
  // §7 — DOCUMENTS & VÉRIFICATION
  // ═══════════════════════════════════════════════════════════

  /** URL Cloudinary — Carte nationale d'identité (recto-verso) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  documentCni: string | null;

  /** URL Cloudinary — Bail commercial ou attestation de local */
  @Column({ type: 'varchar', length: 500, nullable: true })
  documentBail: string | null;

  /** URL Cloudinary — Attestation d'assurance responsabilité civile */
  @Column({ type: 'varchar', length: 500, nullable: true })
  documentAssurance: string | null;

  /** URL Cloudinary — Casier judiciaire B3 (moins de 3 mois) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  documentCasier: string | null;

  /**
   * URLs Cloudinary des photos du point de dépôt (JSON string array).
   * Min 3 photos recommandées (intérieur + extérieur).
   */
  @Column({ type: 'json', nullable: true })
  documentPhotos: string[] | null;

  /** URL Cloudinary — Registre de commerce / NIF */
  @Column({ type: 'varchar', length: 500, nullable: true })
  documentRegistre: string | null;

  /** Statut de vérification des pièces justificatives */
  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.UNVERIFIED,
  })
  verificationStatus: VerificationStatus;

  // ═══════════════════════════════════════════════════════════
  // §8 — SÉCURITÉ (2FA)
  //
  // ⚠️  Le mot de passe est dans User.password (bcrypt, select:false).
  //     lastPasswordChangedAt est dans User.lastPasswordChangedAt.
  //     Ici = uniquement les paramètres 2FA propres au rôle.
  // ═══════════════════════════════════════════════════════════

  /** Double authentification activée */
  @Column({ type: 'boolean', default: false })
  twoFaEnabled: boolean;

  /** Méthode 2FA choisie */
  @Column({ type: 'enum', enum: TwoFaMethod, nullable: true, default: null })
  twoFaMethod: TwoFaMethod | null;

  /**
   * Secret 2FA (TOTP seed).
   * select: false → jamais retourné dans les réponses API.
   */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  twoFaSecret: string | null;

  // ═══════════════════════════════════════════════════════════
  // §9 — NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Préférences de notifications (JSON structuré).
   * {
   *   colis:    { nouveauColis, colisEnAttente48h, transfertLivreur,
   *               colisRecupere, saturation80 },
   *   finances: { commissionEncaissee, virementEffectue, bilanHebdo, seuilWallet },
   *   canaux:   { push, sms, whatsapp, email }
   * }
   */
  @Column({ type: 'json', nullable: true })
  notifSettings: Record<string, Record<string, boolean>> | null;

  // ═══════════════════════════════════════════════════════════
  // §10 — CONFIDENTIALITÉ
  // ═══════════════════════════════════════════════════════════

  /**
   * Paramètres de confidentialité (JSON structuré).
   * {
   *   visibilite: { afficherStats, afficherTelephone,
   *                 apparaitreRecherche, partagerLocalisation },
   *   donnees:    { ameliorerAlgo, statsAnonymisees, rapportsPerso }
   * }
   */
  @Column({ type: 'json', nullable: true })
  privacySettings: Record<string, Record<string, boolean>> | null;

  // ═══════════════════════════════════════════════════════════
  // CHAMPS GÉNÉRAUX HÉRITÉS + §11
  // ═══════════════════════════════════════════════════════════

  /**
   * Zone textuelle héritée de l'ancienne entité.
   * Conservée pour compatibilité ascendante.
   * Remplacée fonctionnellement par zonesActives (JSON).
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  zone: string | null;

  /**
   * Adresse héritée de l'ancienne entité.
   * Conservée pour compatibilité ascendante.
   * Remplacée fonctionnellement par depotAdresse.
   */
  @Column({ type: 'text', nullable: true })
  address: string | null;

  /** §11 — Statut du compte (zone sensible) */
  @Column({
    type: 'enum',
    enum: CorrespondantStatus,
    default: CorrespondantStatus.PENDING,
  })
  status: CorrespondantStatus;

  /** Nombre total de missions accomplies (incrémenté par le système) */
  @Column({ type: 'int', default: 0 })
  totalMissions: number;

  /** Note moyenne donnée par les partenaires (0.00–5.00) */
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}