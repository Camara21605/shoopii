/* ================================================================
 * FICHIER : src/modules/dashboard/client/correspondant-profil.service.ts
 *   (à placer dans le dossier de ton ClientModule)
 *
 * RÔLE : Construit le profil public complet d'UN correspondant.
 *        Source : entité Correspondent + User + CorrespondantHoraire.
 *
 * Le frontend (profil-correspondant) consomme directement la forme
 * renvoyée ici (CorrespondantProfilResponse).
 * ================================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Correspondent, CorrespondantType, CorrespondantStatus }
  from '../../../database/entities/profiles/correspondant-profile.entity';
import { CorrespondantHoraire, JOURS_ORDER }
  from '../../../database/entities/profiles/correspondant-horaire.entity';
import { Follow, FollowStatus, TargetActorType, FollowerActorType }
  from '../../../database/entities/follow/follow.entity';
import { Client }       from '../../../database/entities/profiles/client-profile.entity';

import {
  CorrespondantProfilResponse, CorrTypeDto, BadgeDto, HoraireDto, InfoPratiqueDto,
} from './dto/correspondant-profil.response';

/* En ligne si dernière connexion < 15 minutes */
const ONLINE_DELAY_MS = 15 * 60 * 1000;

/* Libellé du type */
const TYPE_LABEL: Record<CorrespondantType, string> = {
  [CorrespondantType.REGIONAL]: 'Correspondant Régional',
  [CorrespondantType.ZONAL]:    'Correspondant Zonal',
  [CorrespondantType.NATIONAL]: 'Correspondant National',
};

/* Mapping jour court (enum) → libellé long */
const JOUR_LABEL: Record<string, string> = {
  Lun: 'Lundi', Mar: 'Mardi', Mer: 'Mercredi', Jeu: 'Jeudi',
  Ven: 'Vendredi', Sam: 'Samedi', Dim: 'Dimanche',
};
/* index JS getDay() (0=Dim) → enum court */
const JS_DAY_TO_ENUM = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

@Injectable()
export class CorrespondantProfilService {
  constructor(
    @InjectRepository(Correspondent)
    private readonly corrRepo: Repository<Correspondent>,
    @InjectRepository(CorrespondantHoraire)
    private readonly horaireRepo: Repository<CorrespondantHoraire>,
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  /* ──────────────────────────────────────────────────────────────
   * Point d'entrée : profil complet d'un correspondant.
   * @param id      id du correspondant
   * @param userId  id de l'utilisateur connecté (ou undefined si anonyme)
   * ────────────────────────────────────────────────────────────── */
  async getProfil(id: string, userId?: string): Promise<CorrespondantProfilResponse> {

    /* 1. Charger le correspondant + son user (jointure) */
    const cor = await this.corrRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!cor || cor.status === CorrespondantStatus.DELETED) {
      throw new NotFoundException('Correspondant introuvable');
    }

    /* 2. Charger ses horaires, triés dans l'ordre canonique des jours */
    const horairesRaw = await this.horaireRepo.find({
      where: { correspondantId: id },
    });
    const horaires = this.buildHoraires(horairesRaw);

    /* 3. Statut de suivi par l'utilisateur courant */
    const suivi = await this.isSuivi(id, userId);

    /* 4. Champs dérivés */
    const u           = cor.user;
    const nom         = cor.fullName || `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || 'Correspondant';
    const initiales   = this.initiales(nom);
    const enLigne     = this.estEnLigne(u?.lastLoginAt);
    const experience  = this.calculeExperience(cor.createdAt);
    const nbAbonnes   = await this.countAbonnes(id);

    /* 5. Localisation lisible */
    const localisation = [cor.depotCommune, cor.depotVille].filter(Boolean).join(', ')
      || cor.zone || 'Conakry, Guinée';

    return {
      /* Identité */
      id:           cor.id,
      nom,
      initiales,
      type:         cor.typeCorrespondant as CorrTypeDto,
      typeLabel:    TYPE_LABEL[cor.typeCorrespondant] ?? 'Correspondant',
      localisation,
      enLigne,
      membreDepuis: this.membreDepuis(cor.createdAt),
      abonnes:      nbAbonnes,
      badges:       this.buildBadges(cor),
      bio:          this.buildBio(cor.bio),

      /* KPI */
      missions:     cor.totalMissions ?? 0,
      missionsMois: 0,                                  // TODO : compteur mensuel (table missions)
      note:         Number(cor.averageRating ?? 0),
      nbAvis:       0,                                  // TODO : table avis correspondant
      fiabilite:    cor.totalMissions > 0 ? 98 : 0,     // TODO : calcul réel (missions OK / total)
      experience,
      zonesCount:   Array.isArray(cor.zonesActives) ? cor.zonesActives.length : 0,
      delaiMoyen:   '< 2h',                             // TODO : moyenne réelle des délais

      /* Onglet Infos */
      aboutTags:      this.buildTags(cor),
      infosPratiques: this.buildInfosPratiques(cor, u),
      horaires,

      /* Contacts sidebar */
      contacts: [
        { icone: 'fa-phone',        label: 'Téléphone principal', valeur: cor.depotPhone || u?.phone || '—' },
        { icone: 'fa-envelope',     label: 'Email',               valeur: u?.email || '—' },
        { icone: 'fa-location-dot', label: 'Adresse dépôt',       valeur: cor.depotAdresse || '—' },
      ],

      suivi,
    };
  }

  // ════════════════════════════════════════════════════════════
  // HELPERS PRIVÉS
  // ════════════════════════════════════════════════════════════

  /* Initiales depuis le nom complet */
  private initiales(nom: string): string {
    const p = nom.trim().split(/\s+/);
    return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || 'CO';
  }

  /* En ligne si lastLoginAt < 15 min */
  private estEnLigne(lastLoginAt?: Date | null): boolean {
    if (!lastLoginAt) return false;
    return (Date.now() - new Date(lastLoginAt).getTime()) < ONLINE_DELAY_MS;
  }

  /* Expérience en années depuis la création */
  private calculeExperience(createdAt?: Date): string {
    if (!createdAt) return '—';
    const ans = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / (365 * 24 * 3600 * 1000)));
    return `${ans} an${ans > 1 ? 's' : ''}`;
  }

  /* "Partenaire depuis jan. 2021" */
  private membreDepuis(createdAt?: Date): string {
    if (!createdAt) return 'Partenaire Shopi';
    const d = new Date(createdAt);
    const mois = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
    return `Partenaire depuis ${mois}. ${d.getFullYear()}`;
  }

  /* Bio → tableau de paragraphes (découpe sur les sauts de ligne) */
  private buildBio(bio: string | null): string[] {
    if (!bio) return ['Correspondant Shopi vérifié, au service de la communauté.'];
    return bio.split(/\n+/).map(s => s.trim()).filter(Boolean);
  }

  /* Badges selon l'état de vérification / statut */
  private buildBadges(cor: Correspondent): BadgeDto[] {
    const badges: BadgeDto[] = [];
    if (cor.verificationStatus === 'verified') badges.push({ label: 'Identité vérifiée', type: 'verif' });
    if (cor.documentAssurance)                 badges.push({ label: 'Assuré Shopi',      type: 'assur' });
    if ((cor.averageRating ?? 0) >= 4.8 && (cor.totalMissions ?? 0) >= 1000)
      badges.push({ label: 'Top Correspondant', type: 'top' });
    /* Premium si certif active — placeholder simple */
    if (cor.status === CorrespondantStatus.ACTIVE) badges.push({ label: 'Partenaire Premium', type: 'premium' });
    return badges;
  }

  /* Tags "à propos" — dérivés des types de colis acceptés (placeholder si absent) */
  private buildTags(cor: Correspondent): string[] {
    /* Si une vraie liste de spécialités existe un jour, la mapper ici */
    return ['Électronique', 'Prêt-à-porter', 'Colis import', 'Stockage sécurisé'];
  }

  /* Grille d'infos pratiques à partir des champs dépôt */
  private buildInfosPratiques(cor: Correspondent, u: any): InfoPratiqueDto[] {
    return [
      { icone: 'fa-location-dot', label: 'Adresse du dépôt',     valeur: cor.depotAdresse || '—', sub: [cor.depotCommune, cor.depotVille].filter(Boolean).join(', ') },
      { icone: 'fa-box',          label: 'Capacité de stockage', valeur: cor.depotCapacite || '—', sub: cor.depotAcces || 'Stockage sécurisé' },
      { icone: 'fa-phone',        label: 'Contact direct',       valeur: cor.depotPhone || u?.phone || '—', sub: 'Disponible aux heures d\'ouverture' },
      { icone: 'fa-language',     label: 'Langues parlées',      valeur: cor.langues || 'Français', sub: '' },
      { icone: 'fa-truck',        label: 'Type de local',        valeur: cor.depotTypeLocal || '—', sub: cor.depotRepere || '' },
      { icone: 'fa-clock',        label: 'Délai de conservation',valeur: `${cor.colisDelaiMax} jours`, sub: 'Avant retour automatique' },
    ];
  }

  /* Construit les 7 lignes d'horaires (complète les jours manquants) */
  private buildHoraires(rows: CorrespondantHoraire[]): HoraireDto[] {
    const todayEnum = JS_DAY_TO_ENUM[new Date().getDay()];
    const byJour = new Map(rows.map(r => [r.jour as string, r]));

    return JOURS_ORDER.map(jourEnum => {
      const r = byJour.get(jourEnum);
      const aujourdhui = jourEnum === todayEnum;

      if (!r || !r.actif) {
        return {
          jour: JOUR_LABEL[jourEnum], heures: 'Fermé',
          statut: 'closed' as const, statutLabel: 'Fermé', aujourdhui,
        };
      }
      return {
        jour:        JOUR_LABEL[jourEnum],
        heures:      `${r.ouverture} – ${r.fermeture}`,
        statut:      'open' as const,
        statutLabel: 'Ouvert',
        aujourdhui,
      };
    });
  }

  /* Compte les abonnés actifs du correspondant */
  private async countAbonnes(correspondantId: string): Promise<number> {
    return this.followRepo.count({
      where: {
        targetType:   TargetActorType.CORRESPONDENT,
        targetId:     correspondantId,
        isSubscribed: true,
        status:       FollowStatus.ACTIVE,
      },
    });
  }

  /* L'utilisateur courant suit-il ce correspondant ? */
  private async isSuivi(correspondantId: string, userId?: string): Promise<boolean> {
    if (!userId) return false;

    /* Trouver le profil client de l'utilisateur (le follower) */
    const client = await this.clientRepo.findOne({ where: { userId } });
    if (!client) return false;

    const follow = await this.followRepo.findOne({
      where: {
        followerType: FollowerActorType.CLIENT,
        followerId:   client.id,
        targetType:   TargetActorType.CORRESPONDENT,
        targetId:     correspondantId,
        isSubscribed: true,
        status:       FollowStatus.ACTIVE,
      },
    });
    return !!follow;
  }
}