/* ============================================================
 * FICHIER : src/database/migrations/[timestamp]-add-client-settings-fields.ts
 *
 * Ajoute tous les champs manquants à la table `clients`
 * pour supporter les paramètres client complets.
 * ============================================================ */

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddClientSettingsFields1700000000000 implements MigrationInterface {
  name = 'AddClientSettingsFields1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    /* ── Statut étendu ── */
    await queryRunner.query(`
      ALTER TABLE \`clients\`
      MODIFY \`status\` ENUM('active','inactive','suspended','deleted','banned')
      NOT NULL DEFAULT 'active'
    `);

    /* ── Profil étendu ── */
    const cols: TableColumn[] = [

      new TableColumn({ name:'dateNaissance',    type:'date',         isNullable:true  }),
      new TableColumn({ name:'genre',            type:'enum',         isNullable:true,
        enum:['homme','femme','autre','non_precise'] }),
      new TableColumn({ name:'bio',              type:'varchar',      length:'200',  isNullable:true }),

      /* Section 2 — Adresses */
      new TableColumn({ name:'adresses',         type:'json',         isNullable:true  }),

      /* Section 3 — Paiement */
      new TableColumn({ name:'paymentMethods',   type:'json',         isNullable:true  }),

      /* Section 4 — Points */
      new TableColumn({ name:'shopiPoints',      type:'int',          default:0        }),
      new TableColumn({ name:'pointsGagnesMois', type:'int',          default:0        }),
      new TableColumn({ name:'pointsUtilises',   type:'int',          default:0        }),
      new TableColumn({ name:'pointsExpiration', type:'date',         isNullable:true  }),

      /* Section 5 — Sécurité */
      new TableColumn({ name:'twoFaEnabled',         type:'boolean',  default:false    }),
      new TableColumn({ name:'twoFaMethod',           type:'varchar',  length:'10', isNullable:true }),
      new TableColumn({ name:'twoFaSecret',           type:'varchar',  length:'255',isNullable:true }),
      new TableColumn({ name:'questionsSecurite',     type:'json',     isNullable:true  }),
      new TableColumn({ name:'codesSecours',          type:'int',      default:0        }),
      new TableColumn({ name:'codesSecoursHashed',    type:'json',     isNullable:true  }),

      /* Section 6 — Sessions */
      new TableColumn({ name:'sessions',             type:'json',     isNullable:true  }),

      /* Section 7 — Activité */
      new TableColumn({ name:'activityLog',          type:'json',     isNullable:true  }),

      /* Section 8 — Appareils de confiance */
      new TableColumn({ name:'trustedDevices',       type:'json',     isNullable:true  }),

      /* Section 9 — Notifications */
      new TableColumn({ name:'notifSettings',        type:'json',     isNullable:true  }),

      /* Section 10 — Confidentialité */
      new TableColumn({ name:'privacySettings',      type:'json',     isNullable:true  }),

      /* Section 11 — Apparence */
      new TableColumn({ name:'theme',       type:'enum', isNullable:false, default:"'clair'",
        enum:['clair','sombre','auto'] }),
      new TableColumn({ name:'textSize',    type:'enum', isNullable:false, default:"'normal'",
        enum:['normal','grand','tres_grand'] }),
      new TableColumn({ name:'imageQuality',type:'enum', isNullable:false, default:"'haute'",
        enum:['haute','economique'] }),

      /* Section 12 — Langue */
      new TableColumn({ name:'langue',   type:'varchar', length:'5',  default:"'fr'"   }),
      new TableColumn({ name:'devise',   type:'varchar', length:'10', default:"'GNF'"  }),
      new TableColumn({ name:'timezone', type:'varchar', length:'20', default:"'GMT+0'"}),
    ];

    for (const col of cols) {
      const exists = await queryRunner.hasColumn('clients', col.name);
      if (!exists) await queryRunner.addColumn('clients', col);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const toRemove = [
      'dateNaissance','genre','bio',
      'adresses','paymentMethods',
      'shopiPoints','pointsGagnesMois','pointsUtilises','pointsExpiration',
      'twoFaEnabled','twoFaMethod','twoFaSecret',
      'questionsSecurite','codesSecours','codesSecoursHashed',
      'sessions','activityLog','trustedDevices',
      'notifSettings','privacySettings',
      'theme','textSize','imageQuality',
      'langue','devise','timezone',
    ];
    for (const col of toRemove) {
      const exists = await queryRunner.hasColumn('clients', col);
      if (exists) await queryRunner.dropColumn('clients', col);
    }
  }
}