/* ============================================================
 * FICHIER      : src/modules/platform-security/services/backup-strategy.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Documentation et stratégie de sauvegarde de la plateforme Shopi.
 * Ce service ne DÉCLENCHE pas les sauvegardes (gérées par l'hébergeur
 * ou l'infrastructure), il documente la stratégie, les responsabilités
 * et le plan de reprise pour les équipes opérationnelles.
 *
 * STRATÉGIE SHOPI (RECOMMANDATIONS)
 * ─────────────────────────────────────────────────────────────
 * Base de données (PostgreSQL) :
 *   → Sauvegardes automatiques quotidiennes via Render/Supabase/Neon
 *   → Rétention : 30 jours
 *   → RPO : 24 heures
 *
 * Fichiers (Cloudinary) :
 *   → Cloudinary gère la réplication et la disponibilité
 *   → Exports périodiques via API Cloudinary
 *
 * Code source :
 *   → Git + hébergement (GitHub) = sauvegarde continue
 *
 * CONTACTS D'URGENCE
 * ─────────────────────────────────────────────────────────────
 * Les contacts réels sont configurés via PlatformSettings.supportEmail.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';

import { BackupStrategy, DisasterRecoveryPlan } from '../types/security.types';

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class BackupStrategyService {

  /* ==========================================================
   * STRATÉGIE DE SAUVEGARDE
   * ========================================================== */

  /**
   * Retourne la stratégie de sauvegarde documentée pour Shopi.
   * Ce document est destiné aux équipes technique et opérationnelle.
   */
  getStrategy(): BackupStrategy {
    return {
      database: {
        frequency:     'daily',
        type:          'full',
        retentionDays: 30,
        tool:          'Render / Supabase / Neon automated backups',
        location:      'Cloud hébergeur (région EU/West Africa) + S3-compatible',
        description:
          'La base de données PostgreSQL est sauvegardée automatiquement chaque jour ' +
          'par la plateforme d\'hébergement. Les sauvegardes sont chiffrées au repos. ' +
          'Les transactions financières (financial_audit_logs) nécessitent une ' +
          'conservation de 5 ans minimum (obligation légale). ' +
          'Commande de restauration test : pg_restore --clean --no-acl --no-owner -d $DATABASE_URL backup.dump',
      },
      files: {
        frequency:     'continuous',
        retentionDays: 365,
        tool:          'Cloudinary CDN',
        location:      'Cloudinary cloud storage (répliqué multi-région)',
        description:
          'Les médias (images produits, documents SAV, pièces justificatives de litiges) ' +
          'sont stockés sur Cloudinary qui assure la réplication et la disponibilité. ' +
          'Exports périodiques via l\'API Cloudinary Admin pour archivage long terme.',
      },
      rpoHours: 24,
      rtoHours: 4,
      contacts: [
        'super-admin@shopi.com (Super Admin)',
        'tech-lead@shopi.com (Lead Développeur)',
        'infra@shopi.com (Infrastructure)',
      ],
      lastUpdated: '2026-07-18',
    };
  }

  /* ==========================================================
   * PLAN DE REPRISE
   * ========================================================== */

  /**
   * Plan de reprise après incident documenté.
   * Décrit les étapes à suivre en cas d'indisponibilité majeure.
   */
  getDisasterRecoveryPlan(): DisasterRecoveryPlan {
    return {
      steps: [
        {
          order:            1,
          title:            'Évaluation de l\'impact',
          description:      'Identifier les services affectés, estimer le nombre d\'utilisateurs impactés, ' +
                            'vérifier les dashboards Render/hébergeur pour l\'état des instances.',
          responsible:      'Lead Développeur',
          estimatedMinutes: 15,
        },
        {
          order:            2,
          title:            'Activation du mode maintenance',
          description:      'Passer PlatformSettings.maintenanceMode = true via la console d\'admin. ' +
                            'Afficher un message de maintenance aux utilisateurs. ' +
                            'Suspend les nouvelles commandes et paiements.',
          responsible:      'Super Admin',
          estimatedMinutes: 5,
        },
        {
          order:            3,
          title:            'Isolation et diagnostic',
          description:      'Vérifier les logs applicatifs (Render/Railway logs), ' +
                            'identifier la cause racine (DB down, code bug, DDoS, etc.), ' +
                            'ouvrir un incident P1 dans la plateforme (/api/platform-security/incidents).',
          responsible:      'Lead Développeur',
          estimatedMinutes: 30,
        },
        {
          order:            4,
          title:            'Restauration de la base de données (si nécessaire)',
          description:      'Via le tableau de bord Render/Supabase/Neon : sélectionner la sauvegarde ' +
                            'la plus récente avant l\'incident. Commander une restauration PITR ' +
                            '(Point-In-Time Recovery). Vérifier l\'intégrité des financial_audit_logs.',
          responsible:      'Lead Développeur + Infrastructure',
          estimatedMinutes: 60,
        },
        {
          order:            5,
          title:            'Validation et tests',
          description:      'Exécuter les tests de santé complets (/api/platform-security/health), ' +
                            'vérifier les soldes de wallets critiques, tester un paiement de bout en bout ' +
                            'en environnement de staging.',
          responsible:      'Lead Développeur',
          estimatedMinutes: 30,
        },
        {
          order:            6,
          title:            'Réactivation progressive',
          description:      'Désactiver le mode maintenance (maintenanceMode = false). ' +
                            'Monitorer les métriques en temps réel (/api/platform-security/metrics). ' +
                            'Surveiller les alertes pendant 2 heures.',
          responsible:      'Super Admin + Lead Développeur',
          estimatedMinutes: 120,
        },
        {
          order:            7,
          title:            'Communication utilisateurs',
          description:      'Envoyer un email/notification aux utilisateurs affectés. ' +
                            'Publier un rapport d\'incident sur la page de statut. ' +
                            'Contacter les entreprises ayant des commandes en cours.',
          responsible:      'Super Admin',
          estimatedMinutes: 30,
        },
        {
          order:            8,
          title:            'Post-mortem',
          description:      'Dans les 48h : documenter la cause racine, les actions prises, ' +
                            'les leçons apprises et les mesures préventives. ' +
                            'Mettre à jour l\'incident avec rootCause + remediation + résolution.',
          responsible:      'Toute l\'équipe technique',
          estimatedMinutes: 120,
        },
      ],
      escalation: {
        level1: 'Lead Développeur (tech-lead@shopi.com)',
        level2: 'Super Admin + CTO (super-admin@shopi.com)',
        level3: 'Direction + Hébergeur support premium',
      },
      communicationTemplate:
        '[INCIDENT SHOPI] Le service est temporairement indisponible en raison d\'une ' +
        'maintenance d\'urgence. Nos équipes travaillent activement à la résolution. ' +
        'Vos données et transactions sont sécurisées. ' +
        'Statut en temps réel : status.shopi.com | Délai estimé de résolution : [RTO]. ' +
        'Nous nous excusons pour la gêne occasionnée.',
    };
  }

  /* ==========================================================
   * VÉRIFICATION
   * ========================================================== */

  /**
   * Génère un rapport de vérification de la stratégie de sauvegarde.
   * À utiliser lors des audits de conformité périodiques.
   */
  getVerificationChecklist(): Array<{ check: string; status: 'manual' | 'automated'; notes: string }> {
    return [
      {
        check:  'Sauvegardes DB automatiques activées',
        status: 'manual',
        notes:  'Vérifier dans le tableau de bord de l\'hébergeur que les sauvegardes automatiques sont actives.',
      },
      {
        check:  'Test de restauration mensuel',
        status: 'manual',
        notes:  'Restaurer la sauvegarde de la veille dans un environnement de staging et valider l\'intégrité des données.',
      },
      {
        check:  'Rétention des financial_audit_logs ≥ 5 ans',
        status: 'automated',
        notes:  'Vérifié automatiquement par ComplianceService.runRetentionCheck()',
      },
      {
        check:  'Accès aux sauvegardes restreint (MFA requis)',
        status: 'manual',
        notes:  'Vérifier que le compte hébergeur requiert la 2FA et que les accès sont nominatifs.',
      },
      {
        check:  'Chiffrement des sauvegardes au repos',
        status: 'manual',
        notes:  'Confirmer avec l\'hébergeur que les snapshots DB sont chiffrés (AES-256 ou équivalent).',
      },
      {
        check:  'Plan de reprise documenté et communiqué',
        status: 'automated',
        notes:  'Ce service retourne le plan — s\'assurer qu\'il est transmis à l\'équipe opérationnelle.',
      },
    ];
  }
}
