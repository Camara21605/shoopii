/* ============================================================
 * MIGRATION : 1721100000000-company-team-system
 * ROLE      : Crée les 4 tables du système de gestion d'équipe entreprise.
 *
 * TABLES CRÉÉES :
 *   company_team_members       — membres de l'équipe
 *   company_team_permissions   — permissions granulaires (JSON)
 *   company_team_activity_logs — journal d'activité des membres
 *   company_team_audit_logs    — journal d'audit des actions admin
 *
 * MODIFICATION :
 *   platform_settings — ajout de maxTeamMembersPerCompany (int, défaut 5)
 *
 * ROLLBACK : supprime les 4 tables et la colonne ajoutée.
 *
 * AUTEUR    : Shopi03
 * DATE      : 2026-07-18
 * ============================================================ */

import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CompanyTeamSystem1721100000000 implements MigrationInterface {

  name = 'CompanyTeamSystem1721100000000';

  // ════════════════════════════════════════════════════════════
  // UP
  // ════════════════════════════════════════════════════════════

  async up(queryRunner: QueryRunner): Promise<void> {

    /* ── 1. company_team_members ── */
    await queryRunner.createTable(new Table({
      name: 'company_team_members',
      columns: [
        { name: 'id',                  type: 'uuid',      isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'userId',              type: 'uuid',      isNullable: false },
        { name: 'companyId',           type: 'uuid',      isNullable: false },
        { name: 'status',              type: 'enum',      enum: ['active','suspended','pending','revoked'], default: "'active'" },
        { name: 'jobTitle',            type: 'varchar',   length: '100',  isNullable: true },
        { name: 'internalRole',        type: 'varchar',   length: '50',   isNullable: true },
        { name: 'lastLoginAt',         type: 'timestamp', isNullable: true },
        { name: 'lastLoginIp',         type: 'varchar',   length: '45',   isNullable: true },
        { name: 'suspendedAt',         type: 'timestamp', isNullable: true },
        { name: 'suspensionReason',    type: 'text',      isNullable: true },
        { name: 'temporaryPassword',   type: 'varchar',   length: '255',  isNullable: true },
        { name: 'mustChangePassword',  type: 'boolean',   default: true },
        { name: 'createdAt',           type: 'timestamp', default: 'now()' },
        { name: 'updatedAt',           type: 'timestamp', default: 'now()' },
        { name: 'deletedAt',           type: 'timestamp', isNullable: true },
      ],
    }), true);

    /* Index sur company_team_members */
    await queryRunner.createIndex('company_team_members', new TableIndex({
      name: 'IDX_team_member_company',
      columnNames: ['companyId'],
    }));
    await queryRunner.createIndex('company_team_members', new TableIndex({
      name: 'IDX_team_member_user',
      columnNames: ['userId'],
    }));
    await queryRunner.createIndex('company_team_members', new TableIndex({
      name: 'IDX_team_member_status',
      columnNames: ['status'],
    }));
    await queryRunner.createIndex('company_team_members', new TableIndex({
      name: 'UNIQ_team_member_user_company',
      columnNames: ['userId', 'companyId'],
      isUnique: true,
    }));

    /* FK userId → users.id */
    await queryRunner.createForeignKey('company_team_members', new TableForeignKey({
      name:                  'FK_team_member_user',
      columnNames:           ['userId'],
      referencedColumnNames: ['id'],
      referencedTableName:   'users',
      onDelete:              'CASCADE',
    }));

    /* ── 2. company_team_permissions ── */
    await queryRunner.createTable(new Table({
      name: 'company_team_permissions',
      columns: [
        { name: 'id',          type: 'uuid',      isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'memberId',    type: 'uuid',      isNullable: false },
        { name: 'permissions', type: 'json',      isNullable: false },
        { name: 'updatedAt',   type: 'timestamp', default: 'now()' },
      ],
    }), true);

    await queryRunner.createForeignKey('company_team_permissions', new TableForeignKey({
      name:                  'FK_team_permission_member',
      columnNames:           ['memberId'],
      referencedColumnNames: ['id'],
      referencedTableName:   'company_team_members',
      onDelete:              'CASCADE',
    }));

    /* ── 3. company_team_activity_logs ── */
    await queryRunner.createTable(new Table({
      name: 'company_team_activity_logs',
      columns: [
        { name: 'id',          type: 'uuid',      isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'memberId',    type: 'uuid',      isNullable: false },
        { name: 'companyId',   type: 'uuid',      isNullable: false },
        { name: 'action',      type: 'varchar',   length: '100' },
        { name: 'description', type: 'varchar',   length: '500', isNullable: true },
        { name: 'metadata',    type: 'json',      isNullable: true },
        { name: 'ipAddress',   type: 'varchar',   length: '45',  isNullable: true },
        { name: 'createdAt',   type: 'timestamp', default: 'now()' },
      ],
    }), true);

    await queryRunner.createIndex('company_team_activity_logs', new TableIndex({ name: 'IDX_activity_member',  columnNames: ['memberId']  }));
    await queryRunner.createIndex('company_team_activity_logs', new TableIndex({ name: 'IDX_activity_company', columnNames: ['companyId'] }));
    await queryRunner.createIndex('company_team_activity_logs', new TableIndex({ name: 'IDX_activity_action',  columnNames: ['action']    }));
    await queryRunner.createIndex('company_team_activity_logs', new TableIndex({ name: 'IDX_activity_created', columnNames: ['createdAt'] }));

    /* ── 4. company_team_audit_logs ── */
    await queryRunner.createTable(new Table({
      name: 'company_team_audit_logs',
      columns: [
        { name: 'id',                  type: 'uuid',      isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'companyId',           type: 'uuid',      isNullable: false },
        { name: 'performedByUserId',   type: 'uuid',      isNullable: false },
        { name: 'targetMemberId',      type: 'uuid',      isNullable: true },
        { name: 'action',              type: 'varchar',   length: '100' },
        { name: 'before',              type: 'json',      isNullable: true },
        { name: 'after',               type: 'json',      isNullable: true },
        { name: 'ipAddress',           type: 'varchar',   length: '45',  isNullable: true },
        { name: 'userAgent',           type: 'varchar',   length: '500', isNullable: true },
        { name: 'success',             type: 'boolean',   default: true },
        { name: 'errorMessage',        type: 'text',      isNullable: true },
        { name: 'createdAt',           type: 'timestamp', default: 'now()' },
      ],
    }), true);

    await queryRunner.createIndex('company_team_audit_logs', new TableIndex({ name: 'IDX_audit_company',   columnNames: ['companyId']         }));
    await queryRunner.createIndex('company_team_audit_logs', new TableIndex({ name: 'IDX_audit_performer', columnNames: ['performedByUserId'] }));
    await queryRunner.createIndex('company_team_audit_logs', new TableIndex({ name: 'IDX_audit_target',    columnNames: ['targetMemberId']    }));
    await queryRunner.createIndex('company_team_audit_logs', new TableIndex({ name: 'IDX_audit_created',   columnNames: ['createdAt']         }));

    /* ── 5. Colonne maxTeamMembersPerCompany sur platform_settings ── */
    const hasPlatformTable = await queryRunner.hasTable('platform_settings');
    if (hasPlatformTable) {
      const hasColumn = await queryRunner.hasColumn('platform_settings', 'maxTeamMembersPerCompany');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE platform_settings ADD COLUMN "maxTeamMembersPerCompany" integer NOT NULL DEFAULT 5`,
        );
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  // DOWN
  // ════════════════════════════════════════════════════════════

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('company_team_audit_logs',    true);
    await queryRunner.dropTable('company_team_activity_logs', true);
    await queryRunner.dropTable('company_team_permissions',   true);
    await queryRunner.dropTable('company_team_members',       true);

    const hasPlatformTable = await queryRunner.hasTable('platform_settings');
    if (hasPlatformTable) {
      const hasColumn = await queryRunner.hasColumn('platform_settings', 'maxTeamMembersPerCompany');
      if (hasColumn) {
        await queryRunner.query(
          `ALTER TABLE platform_settings DROP COLUMN "maxTeamMembersPerCompany"`,
        );
      }
    }
  }
}
