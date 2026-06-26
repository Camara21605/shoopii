/* ============================================================
 * FICHIER : src/database/entities/profiles/entreprise-profile.entity.ts
 *
 * CHAMPS AJOUTÉS PAR RAPPORT À LA VERSION PRÉCÉDENTE
 * ────────────────────────────────────────────────────────────
 * Section Boutique    → slogan, tags
 * Section Contact     → whatsapp, adresse, commune, ville, pays, repere
 * Section Catalogue   → showOutOfStock, autoPublish, showStrikePrice,
 *                       allowReviews, devise, returnPolicy
 * Section Livraison   → livraisonStandard, livraisonShopi, livraisonCorresp,
 *                       clickCollect, livraisonExpress, zonesLivraison (JSON)
 * Section Paiement    → paymentMethods (JSON), receptionMethod, receptionNumber,
 *                       payoutFrequency, payoutMinAmount, nif, rccm, raisonSociale
 * Section Commissions → plan (enum)
 * Section Documents   → documentRccm, documentBancaire, documentPhoto,
 *                       documentNif, verificationStatus (enum)
 * Section Sécurité    → twoFaEnabled, twoFaMethod, twoFaSecret
 * Section Notifs      → notifSettings (JSON)
 * Section Confid.     → privacySettings (JSON)
 *
 * NOUVELLE TABLE     → company-horaire.entity.ts (horaires par jour)
 *   relation OneToMany → CompanyHoraire
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToOne, ManyToOne, OneToMany, ManyToMany,
  JoinColumn, JoinTable,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

import { User }           from '../user.entity';
import { Admin }          from './admin-profile.entity';
import { Partner }        from './partenaire-profile.entity';
import { Category }       from '../entreprise.table/category.entity';
import { CompanyType }    from '../entreprise.table/company-type.entity';
import { CompanyHoraire } from '../entreprise.table/company-horaire.entity'; // ← NOUVELLE TABLE
import { CreationCode }   from '../code-creation.entity';
import { Product }        from '../entreprise.table/product.entity';
import { Delivery }       from './livreur-profile.entity';
import { Correspondent }  from './correspondant-profile.entity';
import { ProductStory }   from '../entreprise.table/product-story.entity';
import { Promotion }      from '../entreprise.table/promotion.entity';

/* ── Statut boutique ──────────────────────────────────────── */
export enum CompanyStatus {
  PENDING   = 'pending',
  ACTIVE    = 'active',
  SUSPENDED = 'suspended',
}

/* ── Plan de commission ─────────────────────────────────── */
export enum CompanyPlan {
  STANDARD = 'standard',
  PRO      = 'pro',
  PREMIUM  = 'premium',
}

/* ── Statut vérification documents ───────────────────────── */
export enum VerificationStatus {
  PENDING   = 'pending',
  REVIEWING = 'reviewing',
  VERIFIED  = 'verified',
  REJECTED  = 'rejected',
}

/* ============================================================ */

@Entity('entreprises')
export class Company {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /* ══════════════════════════════════════════════════════════
   * RELATIONS EXISTANTES (inchangées)
   * ══════════════════════════════════════════════════════════ */

  @OneToOne(() => User, user => user.company, {
    nullable: false, onDelete: 'CASCADE',
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ name: 'userId', type: 'uuid', update: false })
  userId!: string;

  @OneToOne(() => CreationCode, code => code.company, {
    nullable: true, onDelete: 'SET NULL', lazy: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'creationCodeId' })
  creationCode!: Promise<CreationCode> | CreationCode | null;

  @Column({ name: 'creationCodeId', type: 'uuid', nullable: true })
  creationCodeId!: string | null;

  @ManyToOne(() => Partner, p => p.companies, {
    nullable: true, onDelete: 'SET NULL', lazy: true,
  })
  @JoinColumn({ name: 'partnerId' })
  partner!: Promise<Partner> | Partner | null;

  @Column({ name: 'partnerId', type: 'uuid', nullable: true })
  partnerId!: string | null;

  @ManyToOne(() => Admin, a => a.companies, {
    nullable: true, onDelete: 'SET NULL', lazy: true,
  })
  @JoinColumn({ name: 'adminId' })
  admin!: Promise<Admin> | Admin | null;

  @Column({ name: 'adminId', type: 'uuid', nullable: true })
  adminId!: string | null;

  @ManyToOne(() => CompanyType, ct => ct.companies, {
    nullable: true, onDelete: 'SET NULL', eager: false,
  })
  @JoinColumn({ name: 'companyTypeId' })
  companyType!: CompanyType | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  companyTypeId!: string | null;

  @ManyToMany(() => Category, { eager: false, cascade: false })
  @JoinTable({
    name: 'company_categories',
    joinColumn:        { name: 'companyId',  referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoryId', referencedColumnName: 'id' },
  })
  categories!: Category[];

  @OneToMany(() => Product, p => p.company, { cascade: true })
  products!: Product[];

  @OneToMany(() => Delivery, d => d.company)
  deliveries!: Delivery[];

  @OneToMany(() => Correspondent, c => c.company)
  correspondants!: Correspondent[];

  @OneToMany(() => ProductStory, s => s.company)
  stories!: ProductStory[];

  @OneToMany(() => Promotion, promo => promo.company)
  promotions!: Promotion[];

  /**
   * ✅ NOUVEAU — Horaires d'ouverture par jour de la semaine.
   * Gérés dans la table company_horaires (7 lignes max par boutique).
   * Voir : src/database/entities/entreprise.table/company-horaire.entity.ts
   */
  @OneToMany(() => CompanyHoraire, h => h.company, { cascade: true })
  horaires!: CompanyHoraire[];

  /* ══════════════════════════════════════════════════════════
   * SECTION 1 — BOUTIQUE & IDENTITÉ
   * ══════════════════════════════════════════════════════════ */

  /** Nom public de la boutique — apparaît dans la recherche */
  @Index()
  @Column({ type: 'varchar', length: 255 })
  companyName!: string;

  /** Description publique de la boutique (500 chars max côté UI) */
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** URL Cloudinary du logo (dossier shopi/companies) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  logo!: string | null;

  /** URL Cloudinary de l'image de couverture 1200×400px */
  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImage!: string | null;

  /**
   * Statut de la boutique sur la plateforme.
   * pending   → en attente de validation admin
   * active    → visible par tous les clients
   * suspended → suspendue (admin ou zone sensible)
   */
  @Column({ type: 'enum', enum: CompanyStatus, default: CompanyStatus.PENDING })
  status!: CompanyStatus;

  /**
   * ✅ NOUVEAU — Slogan court affiché sous le nom.
   * Ex : "Fraîcheur garantie depuis 2019"
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  slogan!: string | null;

  /**
   * ✅ NOUVEAU — Tags SEO séparés par virgules.
   * Ex : "restaurant, plats guinéens, livraison rapide, Conakry"
   * Utilisé pour la recherche et le référencement interne.
   */
  @Column({ type: 'text', nullable: true })
  tags!: string | null;

  /** Site web externe (optionnel) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  website!: string | null;

  /* ══════════════════════════════════════════════════════════
   * SECTION 2 — CONTACT & LOCALISATION
   * ══════════════════════════════════════════════════════════ */

  /** Téléphone principal de la boutique */
  @Column({ type: 'varchar', length: 20, nullable: true })
  businessPhone!: string | null;

  /** Email professionnel public de la boutique */
  @Column({ type: 'varchar', length: 255, nullable: true })
  businessEmail!: string | null;

  /**
   * ✅ NOUVEAU — Numéro WhatsApp boutique.
   * Permet aux clients d'ouvrir WhatsApp directement depuis la fiche.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  whatsapp!: string | null;

  /**
   * ✅ NOUVEAU — Adresse physique complète.
   * Ex : "Avenue de la République, Kaloum, en face du Grand Marché"
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  adresse!: string | null;

  /**
   * ✅ NOUVEAU — Commune (arrondissement).
   * Ex : "Kaloum", "Dixinn", "Ratoma", "Matam", "Matoto"
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  commune!: string | null;

  /**
   * ✅ NOUVEAU — Ville.
   * Ex : "Conakry", "Kindia", "Labé", "Mamou", "Boké"
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  ville!: string | null;

  /**
   * ✅ NOUVEAU — Pays (code ISO-2 ou nom complet).
   * Default : "GN" = Guinée
   */
  @Column({ type: 'varchar', length: 100, default: 'GN' })
  pays!: string;

  /**
   * ✅ NOUVEAU — Repère / indication de localisation.
   * Aide les livreurs à trouver la boutique.
   * Ex : "Bâtiment rouge à côté de la pharmacie centrale"
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  repere!: string | null;

  /** Latitude GPS du siège / magasin principal */
  @Index()
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  latitude!: number | null;

  /** Longitude GPS du siège / magasin principal */
  @Index()
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  longitude!: number | null;

  /** Code postal */
  @Column({ type: 'varchar', length: 20, nullable: true })
  codePostal!: string | null;

  /** Région administrative */
  @Column({ type: 'varchar', length: 100, nullable: true })
  region!: string | null;

  /* ══════════════════════════════════════════════════════════
   * SECTION 3 — HORAIRES
   * Les horaires sont gérés dans la table company_horaires.
   * openTime / closeTime sont conservés pour rétrocompatibilité
   * mais ne sont plus utilisés dans la page paramètres.
   * ══════════════════════════════════════════════════════════ */

  /** @deprecated — Remplacé par la table company_horaires */
  @Column({ type: 'time', nullable: true })
  openTime!: string | null;

  /** @deprecated — Remplacé par la table company_horaires */
  @Column({ type: 'time', nullable: true })
  closeTime!: string | null;

  /* ══════════════════════════════════════════════════════════
   * SECTION 4 — CATALOGUE & RÈGLES DE PUBLICATION
   * ══════════════════════════════════════════════════════════ */

  /**
   * ✅ NOUVEAU — Afficher les produits hors stock dans le catalogue.
   * false → les produits épuisés sont masqués automatiquement.
   */
  @Column({ type: 'boolean', default: true })
  showOutOfStock!: boolean;

  /**
   * ✅ NOUVEAU — Publication automatique sans validation manuelle.
   * true → les nouveaux produits sont publiés immédiatement.
   * false (recommandé) → l'entreprise valide avant publication.
   */
  @Column({ type: 'boolean', default: false })
  autoPublish!: boolean;

  /**
   * ✅ NOUVEAU — Afficher le prix barré lors des promotions.
   * Affiche l'ancien prix en barré sur les fiches produits.
   */
  @Column({ type: 'boolean', default: true })
  showStrikePrice!: boolean;

  /**
   * ✅ NOUVEAU — Permettre les avis clients.
   * Seuls les acheteurs confirmés peuvent laisser un avis.
   */
  @Column({ type: 'boolean', default: true })
  allowReviews!: boolean;

  /**
   * ✅ NOUVEAU — Devise d'affichage des prix.
   * Ex : "GNF", "EUR", "USD"
   */
  @Column({ type: 'varchar', length: 10, default: 'GNF' })
  devise!: string;

  /**
   * ✅ NOUVEAU — Politique de retour affichée sur les fiches produits.
   * Ex : "Retour accepté sous 7 jours après réception, produit non ouvert."
   */
  @Column({ type: 'text', nullable: true })
  returnPolicy!: string | null;

  /* ══════════════════════════════════════════════════════════
   * SECTION 5 — LIVRAISON
   * ══════════════════════════════════════════════════════════ */

  /** ✅ NOUVEAU — Livraison gérée directement par l'équipe boutique */
  @Column({ type: 'boolean', default: true })
  livraisonStandard!: boolean;

  /** ✅ NOUVEAU — Faire appel aux livreurs partenaires Shopi */
  @Column({ type: 'boolean', default: true })
  livraisonShopi!: boolean;

  /** ✅ NOUVEAU — Utiliser le réseau de correspondants Shopi */
  @Column({ type: 'boolean', default: false })
  livraisonCorresp!: boolean;

  /** ✅ NOUVEAU — Click & Collect : le client récupère en boutique */
  @Column({ type: 'boolean', default: true })
  clickCollect!: boolean;

  /** ✅ NOUVEAU — Livraison express < 2h avec supplément tarifaire */
  @Column({ type: 'boolean', default: false })
  livraisonExpress!: boolean;

  /**
   * ✅ NOUVEAU — Zones géographiques desservies.
   * Tableau de noms de communes.
   * Ex : ["Kaloum", "Dixinn", "Matam", "Ratoma", "Matoto"]
   */
  @Column({ type: 'json', nullable: true })
  zonesLivraison!: string[] | null;

  /* ══════════════════════════════════════════════════════════
   * SECTION 6 — PAIEMENT & FACTURATION
   * ══════════════════════════════════════════════════════════ */

  /**
   * ✅ NOUVEAU — Méthodes de paiement acceptées par la boutique.
   * Format JSON : [{ id, nom, actif, principal }]
   * Ex : [{ id: "orange_money", nom: "Orange Money", actif: true, principal: true }]
   */
  @Column({ type: 'json', nullable: true })
  paymentMethods!: Record<string, unknown>[] | null;

  /**
   * ✅ NOUVEAU — Canal de réception des virements Shopi.
   * Valeurs : "orange_money" | "mtn_momo" | "wave" | "virement_bancaire"
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  receptionMethod!: string | null;

  /**
   * ✅ NOUVEAU — Numéro de réception des paiements Shopi.
   * Ex : "620102644"
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  receptionNumber!: string | null;

  /**
   * ✅ NOUVEAU — Fréquence des virements automatiques.
   * Valeurs : "daily" | "weekly" | "bimonthly" | "monthly"
   */
  @Column({ type: 'varchar', length: 30, default: 'weekly' })
  payoutFrequency!: string;

  /**
   * ✅ NOUVEAU — Montant minimum pour déclencher un virement (en GNF).
   * Default : 100 000 GNF.
   */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 100000 })
  payoutMinAmount!: number;

  /**
   * ✅ NOUVEAU — Numéro d'Identification Fiscale (NIF).
   * Ex : "123456789"
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  nif!: string | null;

  /**
   * ✅ NOUVEAU — Numéro RCCM (Registre du Commerce).
   * Ex : "GN-CNK-2024-B-00123"
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  rccm!: string | null;

  /**
   * ✅ NOUVEAU — Raison sociale officielle de l'entreprise.
   * Ex : "TechStore Conakry SARL"
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  raisonSociale!: string | null;

  /* ══════════════════════════════════════════════════════════
   * SECTION 7 — COMMISSIONS SHOPI
   * ══════════════════════════════════════════════════════════ */

  /**
   * ✅ NOUVEAU — Plan souscrit par la boutique.
   * standard = 3% / vente
   * pro      = 2% / vente
   * premium  = 1,5% / vente
   */
  @Column({ type: 'enum', enum: CompanyPlan, default: CompanyPlan.STANDARD })
  plan!: CompanyPlan;

  /* ══════════════════════════════════════════════════════════
   * SECTION 8 — DOCUMENTS & VÉRIFICATION
   * ══════════════════════════════════════════════════════════ */

  /** Pièce d'identité du responsable (CNI ou Passeport) — déjà présent */
  @Column({ type: 'varchar', length: 500, nullable: true })
  ownerIdDocument!: string | null;

  /** ✅ NOUVEAU — URL Cloudinary du document RCCM uploadé */
  @Column({ type: 'varchar', length: 500, nullable: true })
  documentRccm!: string | null;

  /** ✅ NOUVEAU — URL Cloudinary du justificatif bancaire / Mobile Money */
  @Column({ type: 'varchar', length: 500, nullable: true })
  documentBancaire!: string | null;

  /** ✅ NOUVEAU — URL Cloudinary de la photo de la boutique physique */
  @Column({ type: 'varchar', length: 500, nullable: true })
  documentPhoto!: string | null;

  /** ✅ NOUVEAU — URL Cloudinary de l'attestation fiscale / NIF */
  @Column({ type: 'varchar', length: 500, nullable: true })
  documentNif!: string | null;

  /**
   * ✅ NOUVEAU — Statut global de vérification du dossier.
   * pending   → non soumis
   * reviewing → en cours d'examen par l'équipe Shopi
   * verified  → boutique vérifiée ✅
   * rejected  → dossier refusé (motif à communiquer)
   */
  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verificationStatus!: VerificationStatus;

  /* ══════════════════════════════════════════════════════════
   * SECTION 9 — SÉCURITÉ
   * Le mot de passe est géré dans user.entity.ts
   * ══════════════════════════════════════════════════════════ */

  /** ✅ NOUVEAU — Double authentification activée */
  @Column({ type: 'boolean', default: false })
  twoFaEnabled!: boolean;

  /**
   * ✅ NOUVEAU — Méthode 2FA choisie.
   * "app" = Google Authenticator / Authy
   * "sms" = Code par SMS / WhatsApp
   * "email" = Code par email
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  twoFaMethod!: string | null;

  /**
   * ✅ NOUVEAU — Secret TOTP hashé (généré lors de l'activation 2FA).
   * select: false → jamais retourné par les requêtes normales.
   */
  @Column({ type: 'varchar', length: 500, nullable: true, select: false })
  twoFaSecret!: string | null;

  /* ══════════════════════════════════════════════════════════
   * SECTION 10 — NOTIFICATIONS (14 toggles en JSON)
   * ══════════════════════════════════════════════════════════ */

  /**
   * ✅ NOUVEAU — Préférences de notifications.
   * Stocké en JSON pour éviter 14 colonnes booléennes.
   *
   * Structure attendue :
   * {
   *   newOrder: true,           // nouvelle commande reçue
   *   orderCancelled: true,     // commande annulée
   *   orderDelivered: true,     // commande livrée
   *   paymentReceived: true,    // paiement reçu
   *   outOfStock: true,         // produit en rupture
   *   nearThreshold: true,      // stock proche du seuil
   *   productPublished: false,  // confirmation publication
   *   catalogRequest: true,     // demande MAJ catalogue
   *   newReview: true,          // nouvel avis client
   *   negativeReview: true,     // avis négatif < 3 étoiles
   *   weeklyReport: false,      // rapport réputation hebdo
   *   promoInvitations: true,   // invitations promotions Shopi
   *   monthlyReport: true,      // rapport performance mensuel
   *   shopNews: false,          // nouveautés Shopi
   * }
   */
  @Column({ type: 'json', nullable: true })
  notifSettings!: Record<string, boolean> | null;

  /* ══════════════════════════════════════════════════════════
   * SECTION 11 — CONFIDENTIALITÉ (7 toggles en JSON)
   * ══════════════════════════════════════════════════════════ */

  /**
   * ✅ NOUVEAU — Préférences de confidentialité.
   * Stocké en JSON pour éviter 7 colonnes booléennes.
   *
   * Structure attendue :
   * {
   *   showInSearch: true,          // apparaître dans la recherche
   *   showSalesStats: true,        // afficher stats de vente publiques
   *   allowFollow: true,           // permettre le suivi de boutique
   *   shareExactLocation: false,   // partager l'adresse exacte
   *   improveAlgorithm: true,      // améliorer les algos Shopi
   *   anonymizedStats: true,       // statistiques anonymisées
   *   advancedReports: false,      // rapports personnalisés avancés
   * }
   */
  @Column({ type: 'json', nullable: true })
  privacySettings!: Record<string, boolean> | null;

  /* ══════════════════════════════════════════════════════════
   * STATISTIQUES (inchangées)
   * ══════════════════════════════════════════════════════════ */

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating!: number;

  @Column({ type: 'int', default: 0 })
  totalRatings!: number;

  @Column({ type: 'int', default: 0 })
  totalOrders!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalRevenue!: number;

  /* ══════════════════════════════════════════════════════════
   * TIMESTAMPS
   * ══════════════════════════════════════════════════════════ */

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}