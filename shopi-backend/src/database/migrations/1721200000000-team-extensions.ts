/* ============================================================
 * MIGRATION    : 1721200000000-team-extensions
 * ROLE         : Extensions du système de gestion d'équipe (Phase 2).
 *
 * TABLES CRÉÉES :
 *   team_plan_configs           — configurations de limite par plan
 *   company_plan_assignments    — assignation d'un plan à une entreprise
 *   company_team_invitations    — invitations de collaborateurs
 *   team_permission_categories  — catégories de permissions (dynamique)
 *   team_permission_definitions — définitions d'actions (dynamique)
 *   team_permission_templates   — modèles de permissions réutilisables
 *
 * MODIFICATIONS :
 *   company_team_members — ajout de branchId et metadata (Extension 9)
 *
 * DONNÉES INITIALES :
 *   - 5 plans d'abonnement (free, standard, business, premium, enterprise)
 *   - 12 catégories de permissions
 *   - 44 définitions d'actions
 *   - 5 modèles système de permissions
 *
 * ROLLBACK : supprime toutes les tables créées dans cet ordre inversé.
 *
 * AUTEUR       : Shopi03
 * DATE         : 2026-07-18
 * ============================================================ */

import {
  MigrationInterface, QueryRunner,
  Table, TableIndex, TableForeignKey,
} from 'typeorm';

/** Données de seed — plans */
const PLAN_SEEDS = [
  { planSlug: 'free',       name: 'Plan Gratuit',    maxMembers: 2,   description: 'Pour les micro-entreprises.' },
  { planSlug: 'standard',   name: 'Plan Standard',   maxMembers: 5,   description: 'Pour les PME en démarrage.' },
  { planSlug: 'business',   name: 'Plan Business',   maxMembers: 15,  description: 'Pour les entreprises actives.' },
  { planSlug: 'premium',    name: 'Plan Premium',    maxMembers: 50,  description: 'Pour les grandes équipes.' },
  { planSlug: 'enterprise', name: 'Plan Enterprise', maxMembers: -1,  description: 'Illimité — pour les grandes structures.' },
];

/** Catégories de permissions */
const CATEGORY_SEEDS = [
  { slug: 'products',      label: 'Produits',       icon: 'fa-tag',                  sortOrder: 1  },
  { slug: 'orders',        label: 'Commandes',       icon: 'fa-box',                  sortOrder: 2  },
  { slug: 'deliveries',    label: 'Livraisons',      icon: 'fa-motorcycle',           sortOrder: 3  },
  { slug: 'payments',      label: 'Paiements',       icon: 'fa-coins',                sortOrder: 4  },
  { slug: 'messaging',     label: 'Messagerie',      icon: 'fa-comment',              sortOrder: 5  },
  { slug: 'statistics',    label: 'Statistiques',    icon: 'fa-chart-line',           sortOrder: 6  },
  { slug: 'settings',      label: 'Paramètres',      icon: 'fa-gear',                 sortOrder: 7  },
  { slug: 'team',          label: 'Équipe',          icon: 'fa-users-gear',           sortOrder: 8  },
  { slug: 'promotions',    label: 'Promotions',      icon: 'fa-percent',              sortOrder: 9  },
  { slug: 'returns',       label: 'Retours & SAV',   icon: 'fa-rotate-left',          sortOrder: 10 },
  { slug: 'wallet',        label: 'Portefeuille',    icon: 'fa-wallet',               sortOrder: 11 },
  { slug: 'notifications', label: 'Notifications',   icon: 'fa-bell',                 sortOrder: 12 },
];

/** Actions par catégorie — format: { categorySlug, slug, label, sortOrder } */
const DEFINITION_SEEDS = [
  /* Produits */
  { cat: 'products',   slug: 'products.view',    label: 'Voir les produits',          sort: 1 },
  { cat: 'products',   slug: 'products.create',  label: 'Créer des produits',         sort: 2 },
  { cat: 'products',   slug: 'products.edit',    label: 'Modifier des produits',      sort: 3 },
  { cat: 'products',   slug: 'products.delete',  label: 'Supprimer des produits',     sort: 4 },
  /* Commandes */
  { cat: 'orders',     slug: 'orders.view',      label: 'Voir les commandes',         sort: 1 },
  { cat: 'orders',     slug: 'orders.validate',  label: 'Valider des commandes',      sort: 2 },
  { cat: 'orders',     slug: 'orders.cancel',    label: 'Annuler des commandes',      sort: 3 },
  { cat: 'orders',     slug: 'orders.edit',      label: 'Modifier des commandes',     sort: 4 },
  /* Livraisons */
  { cat: 'deliveries', slug: 'deliveries.view',  label: 'Voir les livraisons',        sort: 1 },
  { cat: 'deliveries', slug: 'deliveries.assign',label: 'Affecter un livreur',        sort: 2 },
  { cat: 'deliveries', slug: 'deliveries.edit',  label: 'Modifier les livraisons',    sort: 3 },
  /* Paiements */
  { cat: 'payments',   slug: 'payments.view',         label: 'Voir les paiements',        sort: 1 },
  { cat: 'payments',   slug: 'payments.viewTransactions', label: 'Voir les transactions',  sort: 2 },
  { cat: 'payments',   slug: 'payments.manageRefunds', label: 'Gérer les remboursements', sort: 3 },
  /* Messagerie */
  { cat: 'messaging',  slug: 'messaging.read',   label: 'Lire les messages',          sort: 1 },
  { cat: 'messaging',  slug: 'messaging.send',   label: 'Envoyer des messages',       sort: 2 },
  /* Statistiques */
  { cat: 'statistics', slug: 'statistics.view',  label: 'Consulter les statistiques', sort: 1 },
  /* Paramètres */
  { cat: 'settings',   slug: 'settings.view',    label: 'Voir les paramètres',        sort: 1 },
  { cat: 'settings',   slug: 'settings.edit',    label: 'Modifier les paramètres',    sort: 2 },
  /* Équipe */
  { cat: 'team',       slug: 'team.view',        label: 'Voir l\'équipe',             sort: 1 },
  { cat: 'team',       slug: 'team.create',      label: 'Inviter des membres',        sort: 2 },
  { cat: 'team',       slug: 'team.edit',        label: 'Modifier des membres',       sort: 3 },
  { cat: 'team',       slug: 'team.suspend',     label: 'Suspendre des membres',      sort: 4 },
  { cat: 'team',       slug: 'team.delete',      label: 'Supprimer des membres',      sort: 5 },
  /* Promotions */
  { cat: 'promotions', slug: 'promotions.view',   label: 'Voir les promotions',       sort: 1 },
  { cat: 'promotions', slug: 'promotions.create', label: 'Créer des promotions',      sort: 2 },
  { cat: 'promotions', slug: 'promotions.edit',   label: 'Modifier des promotions',   sort: 3 },
  { cat: 'promotions', slug: 'promotions.delete', label: 'Supprimer des promotions',  sort: 4 },
  /* Retours */
  { cat: 'returns',    slug: 'returns.view',     label: 'Voir les retours',           sort: 1 },
  { cat: 'returns',    slug: 'returns.process',  label: 'Traiter les retours & SAV',  sort: 2 },
  /* Portefeuille */
  { cat: 'wallet',     slug: 'wallet.view',      label: 'Voir le portefeuille',       sort: 1 },
  { cat: 'wallet',     slug: 'wallet.withdraw',  label: 'Initier un retrait',         sort: 2 },
  /* Notifications */
  { cat: 'notifications', slug: 'notifications.view', label: 'Voir les notifications', sort: 1 },
  { cat: 'notifications', slug: 'notifications.manage', label: 'Gérer les notifications', sort: 2 },
];

/** Modèles système de permissions */
const TEMPLATE_SEEDS = [
  {
    name: 'Gestionnaire',
    description: 'Accès complet à la gestion quotidienne de la boutique.',
    permissions: {
      products:      { view: true,  create: true,  edit: true,  delete: false },
      orders:        { view: true,  validate: true, cancel: false, edit: true },
      deliveries:    { view: true,  assign: true,  edit: true  },
      payments:      { view: true,  viewTransactions: true, manageRefunds: false },
      messaging:     { read: true,  send: true  },
      statistics:    { view: true  },
      settings:      { view: true,  edit: false },
      team:          { view: true,  create: false, edit: false, suspend: false, delete: false },
      promotions:    { view: true,  create: true,  edit: true,  delete: false },
      returns:       { view: true,  process: true  },
      wallet:        { view: true,  withdraw: false },
      notifications: { view: true,  manage: false  },
    },
  },
  {
    name: 'Commercial',
    description: 'Gestion des produits, promotions et clients.',
    permissions: {
      products:      { view: true,  create: true,  edit: true,  delete: false },
      orders:        { view: true,  validate: false, cancel: false, edit: false },
      deliveries:    { view: true,  assign: false, edit: false },
      payments:      { view: false, viewTransactions: false, manageRefunds: false },
      messaging:     { read: true,  send: true  },
      statistics:    { view: true  },
      settings:      { view: false, edit: false },
      team:          { view: false, create: false, edit: false, suspend: false, delete: false },
      promotions:    { view: true,  create: true,  edit: true,  delete: false },
      returns:       { view: true,  process: false },
      wallet:        { view: false, withdraw: false },
      notifications: { view: true,  manage: false  },
    },
  },
  {
    name: 'Service Client',
    description: 'Traitement des messages, commandes et retours clients.',
    permissions: {
      products:      { view: true,  create: false, edit: false, delete: false },
      orders:        { view: true,  validate: true, cancel: false, edit: false },
      deliveries:    { view: true,  assign: false, edit: false },
      payments:      { view: false, viewTransactions: false, manageRefunds: false },
      messaging:     { read: true,  send: true  },
      statistics:    { view: false },
      settings:      { view: false, edit: false },
      team:          { view: false, create: false, edit: false, suspend: false, delete: false },
      promotions:    { view: true,  create: false, edit: false, delete: false },
      returns:       { view: true,  process: true  },
      wallet:        { view: false, withdraw: false },
      notifications: { view: true,  manage: false  },
    },
  },
  {
    name: 'Logistique',
    description: 'Suivi et affectation des livraisons.',
    permissions: {
      products:      { view: true,  create: false, edit: false, delete: false },
      orders:        { view: true,  validate: false, cancel: false, edit: false },
      deliveries:    { view: true,  assign: true,  edit: true  },
      payments:      { view: false, viewTransactions: false, manageRefunds: false },
      messaging:     { read: true,  send: true  },
      statistics:    { view: false },
      settings:      { view: false, edit: false },
      team:          { view: false, create: false, edit: false, suspend: false, delete: false },
      promotions:    { view: false, create: false, edit: false, delete: false },
      returns:       { view: true,  process: false },
      wallet:        { view: false, withdraw: false },
      notifications: { view: true,  manage: false  },
    },
  },
  {
    name: 'Comptable',
    description: 'Accès en lecture aux finances, statistiques et portefeuille.',
    permissions: {
      products:      { view: true,  create: false, edit: false, delete: false },
      orders:        { view: true,  validate: false, cancel: false, edit: false },
      deliveries:    { view: false, assign: false, edit: false },
      payments:      { view: true,  viewTransactions: true, manageRefunds: false },
      messaging:     { read: false, send: false  },
      statistics:    { view: true  },
      settings:      { view: false, edit: false },
      team:          { view: false, create: false, edit: false, suspend: false, delete: false },
      promotions:    { view: true,  create: false, edit: false, delete: false },
      returns:       { view: true,  process: false },
      wallet:        { view: true,  withdraw: false },
      notifications: { view: false, manage: false  },
    },
  },
];

export class TeamExtensions1721200000000 implements MigrationInterface {

  name = 'TeamExtensions1721200000000';

  // ════════════════════════════════════════════════════════════
  // UP
  // ════════════════════════════════════════════════════════════

  async up(queryRunner: QueryRunner): Promise<void> {

    /* ── 1. team_plan_configs ── */
    await queryRunner.createTable(new Table({
      name: 'team_plan_configs',
      columns: [
        { name: 'id',          type: 'uuid',    isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'planSlug',    type: 'varchar', length: '30',  isUnique: true },
        { name: 'name',        type: 'varchar', length: '100' },
        { name: 'maxMembers',  type: 'int',     default: 5 },
        { name: 'description', type: 'text',    isNullable: true },
        { name: 'features',    type: 'json',    isNullable: true },
        { name: 'isActive',    type: 'boolean', default: true },
        { name: 'createdAt',   type: 'timestamp', default: 'now()' },
        { name: 'updatedAt',   type: 'timestamp', default: 'now()' },
      ],
    }), true);

    /* Seed plans */
    for (const plan of PLAN_SEEDS) {
      await queryRunner.query(
        `INSERT INTO team_plan_configs ("planSlug", name, "maxMembers", description) VALUES ($1, $2, $3, $4)`,
        [plan.planSlug, plan.name, plan.maxMembers, plan.description],
      );
    }

    /* ── 2. company_plan_assignments ── */
    await queryRunner.createTable(new Table({
      name: 'company_plan_assignments',
      columns: [
        { name: 'id',                  type: 'uuid',    isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'companyId',           type: 'uuid',    isUnique: true },
        { name: 'planSlug',            type: 'varchar', length: '30', default: "'standard'" },
        { name: 'assignedByAdminId',   type: 'uuid',    isNullable: true },
        { name: 'note',                type: 'text',    isNullable: true },
        { name: 'createdAt',           type: 'timestamp', default: 'now()' },
        { name: 'updatedAt',           type: 'timestamp', default: 'now()' },
      ],
    }), true);

    /* ── 3. company_team_invitations ── */
    await queryRunner.createTable(new Table({
      name: 'company_team_invitations',
      columns: [
        { name: 'id',                 type: 'uuid',      isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'companyId',          type: 'uuid' },
        { name: 'email',              type: 'varchar',   length: '255' },
        { name: 'firstName',          type: 'varchar',   length: '100', isNullable: true },
        { name: 'lastName',           type: 'varchar',   length: '100', isNullable: true },
        { name: 'jobTitle',           type: 'varchar',   length: '100', isNullable: true },
        { name: 'internalRole',       type: 'varchar',   length: '50',  isNullable: true },
        { name: 'token',              type: 'varchar',   length: '64',  isNullable: false },
        { name: 'expiresAt',          type: 'timestamp' },
        { name: 'status',             type: 'varchar',   length: '20',  default: "'pending'" },
        { name: 'initialPermissions', type: 'json',      isNullable: true },
        { name: 'templateId',         type: 'uuid',      isNullable: true },
        { name: 'createdByUserId',    type: 'uuid' },
        { name: 'acceptedAt',         type: 'timestamp', isNullable: true },
        { name: 'createdAt',          type: 'timestamp', default: 'now()' },
        { name: 'updatedAt',          type: 'timestamp', default: 'now()' },
      ],
    }), true);

    await queryRunner.createIndex('company_team_invitations', new TableIndex({ name: 'IDX_invitation_company', columnNames: ['companyId'] }));
    await queryRunner.createIndex('company_team_invitations', new TableIndex({ name: 'IDX_invitation_email',   columnNames: ['email']     }));
    await queryRunner.createIndex('company_team_invitations', new TableIndex({ name: 'IDX_invitation_token',   columnNames: ['token'], isUnique: true }));
    await queryRunner.createIndex('company_team_invitations', new TableIndex({ name: 'IDX_invitation_status',  columnNames: ['status']    }));

    /* ── 4. team_permission_categories ── */
    await queryRunner.createTable(new Table({
      name: 'team_permission_categories',
      columns: [
        { name: 'id',        type: 'uuid',    isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'slug',      type: 'varchar', length: '60', isUnique: true },
        { name: 'label',     type: 'varchar', length: '100' },
        { name: 'icon',      type: 'varchar', length: '60', isNullable: true },
        { name: 'sortOrder', type: 'int',     default: 0 },
        { name: 'isActive',  type: 'boolean', default: true },
      ],
    }), true);

    /* Seed catégories et récupérer les IDs */
    const categoryIds: Record<string, string> = {};
    for (const cat of CATEGORY_SEEDS) {
      const result = await queryRunner.query(
        `INSERT INTO team_permission_categories (slug, label, icon, "sortOrder") VALUES ($1, $2, $3, $4) RETURNING id`,
        [cat.slug, cat.label, cat.icon, cat.sortOrder],
      );
      categoryIds[cat.slug] = result[0].id;
    }

    /* ── 5. team_permission_definitions ── */
    await queryRunner.createTable(new Table({
      name: 'team_permission_definitions',
      columns: [
        { name: 'id',           type: 'uuid',    isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'categoryId',   type: 'uuid' },
        { name: 'slug',         type: 'varchar', length: '80', isUnique: true },
        { name: 'label',        type: 'varchar', length: '150' },
        { name: 'description',  type: 'text',    isNullable: true },
        { name: 'defaultValue', type: 'boolean', default: false },
        { name: 'sortOrder',    type: 'int',     default: 0 },
        { name: 'isActive',     type: 'boolean', default: true },
      ],
    }), true);

    await queryRunner.createForeignKey('team_permission_definitions', new TableForeignKey({
      name:                  'FK_perm_def_category',
      columnNames:           ['categoryId'],
      referencedColumnNames: ['id'],
      referencedTableName:   'team_permission_categories',
      onDelete:              'CASCADE',
    }));

    /* Seed définitions */
    for (const def of DEFINITION_SEEDS) {
      const catId = categoryIds[def.cat];
      if (!catId) continue;
      await queryRunner.query(
        `INSERT INTO team_permission_definitions ("categoryId", slug, label, "sortOrder") VALUES ($1, $2, $3, $4)`,
        [catId, def.slug, def.label, def.sort],
      );
    }

    /* ── 6. team_permission_templates ── */
    await queryRunner.createTable(new Table({
      name: 'team_permission_templates',
      columns: [
        { name: 'id',              type: 'uuid',    isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'companyId',       type: 'uuid',    isNullable: true },
        { name: 'name',            type: 'varchar', length: '100' },
        { name: 'description',     type: 'text',    isNullable: true },
        { name: 'permissions',     type: 'json' },
        { name: 'isSystem',        type: 'boolean', default: false },
        { name: 'createdByUserId', type: 'uuid',    isNullable: true },
        { name: 'createdAt',       type: 'timestamp', default: 'now()' },
        { name: 'updatedAt',       type: 'timestamp', default: 'now()' },
      ],
    }), true);

    await queryRunner.createIndex('team_permission_templates', new TableIndex({ name: 'IDX_tpl_company', columnNames: ['companyId'] }));
    await queryRunner.createIndex('team_permission_templates', new TableIndex({ name: 'IDX_tpl_system',  columnNames: ['isSystem']  }));

    /* Seed modèles système */
    for (const tpl of TEMPLATE_SEEDS) {
      await queryRunner.query(
        `INSERT INTO team_permission_templates (name, description, permissions, "isSystem") VALUES ($1, $2, $3, true)`,
        [tpl.name, tpl.description, JSON.stringify(tpl.permissions)],
      );
    }

    /* ── 7. Colonnes d'évolution future sur company_team_members (Extension 9) ── */
    const hasMembersTable = await queryRunner.hasTable('company_team_members');
    if (hasMembersTable) {
      const hasBranchId  = await queryRunner.hasColumn('company_team_members', 'branchId');
      const hasMetadata  = await queryRunner.hasColumn('company_team_members', 'metadata');

      if (!hasBranchId) {
        /* branchId nullable — prépare le support multi-succursales (Extension 9) */
        await queryRunner.query(
          `ALTER TABLE company_team_members ADD COLUMN "branchId" uuid`,
        );
      }
      if (!hasMetadata) {
        /* metadata JSON nullable — champ extensible sans future migration */
        await queryRunner.query(
          `ALTER TABLE company_team_members ADD COLUMN metadata json`,
        );
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  // DOWN
  // ════════════════════════════════════════════════════════════

  async down(queryRunner: QueryRunner): Promise<void> {
    /* Ordre inversé des créations */
    await queryRunner.dropTable('team_permission_templates',  true);
    await queryRunner.dropTable('team_permission_definitions', true);
    await queryRunner.dropTable('team_permission_categories', true);
    await queryRunner.dropTable('company_team_invitations',   true);
    await queryRunner.dropTable('company_plan_assignments',   true);
    await queryRunner.dropTable('team_plan_configs',          true);

    /* Supprimer les colonnes ajoutées sur company_team_members */
    const hasMembersTable = await queryRunner.hasTable('company_team_members');
    if (hasMembersTable) {
      for (const col of ['branchId', 'metadata']) {
        if (await queryRunner.hasColumn('company_team_members', col)) {
          await queryRunner.query(`ALTER TABLE company_team_members DROP COLUMN "${col}"`);
        }
      }
    }
  }
}
