/* ============================================================
 * FICHIER : services/visibilite-partenaire.service.ts
 *
 * RÔLE : Ce que les autres voient du partenaire — piloté par Paramètres > Confidentialité.
 *
 *   GET /partenaire-recruteur              (entreprise, livreur, correspondant)
 *       → carte « Votre partenaire » : nom si « Profil partenaire public »,
 *         téléphone si en plus « Afficher mon téléphone ».
 *   GET /dashboard/partenaire/classement   (partenaire)
 *       → classement des partenaires de la zone par acteurs recrutés : le nom d'un
 *         partenaire n'y figure que s'il a activé « Apparaître dans le classement ».
 *
 * BUG CORRIGÉ (audit 2026-09) — ces trois réglages étaient enregistrés mais n'avaient
 * aucun effet : aucun écran ne montrait le partenaire à ses acteurs recrutés, et aucun
 * classement n'existait côté partenaires.
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { Partner, PartnerStatus } from 'src/database/entities/profiles/partenaire-profile.entity';
import { Company }       from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent } from 'src/database/entities/profiles/correspondant-profile.entity';
import { UserRole }      from 'src/common/enums/user-role.enum';
import { lireVisibilitePartenaire } from './notifs-partenaire.service';

export interface PartenaireRecruteurVue {
  nom:       string;
  zone:      string | null;
  /** null si le partenaire a masqué son téléphone (ou n'en a pas renseigné) */
  telephone: string | null;
}

export interface ClassementPartenaires {
  /** Rang du partenaire connecté (null s'il n'est pas encore actif) */
  rang:                 number | null;
  total:                number;
  recrues:              number;
  apparaitreClassement: boolean;
  top: Array<{ rang: number; nom: string; recrues: number; moi: boolean }>;
}

export const NOM_PARTENAIRE_ANONYME = 'Partenaire anonyme';
const TAILLE_TOP = 10;

@Injectable()
export class VisibilitePartenaireService {

  constructor(
    @InjectRepository(Partner)       private readonly partnerRepo:  Repository<Partner>,
    @InjectRepository(Company)       private readonly companyRepo:  Repository<Company>,
    @InjectRepository(Delivery)      private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Correspondent) private readonly corrRepo:     Repository<Correspondent>,
  ) {}

  /** Partenaire qui a recruté l'acteur connecté — null s'il n'y en a pas ou s'il reste privé. */
  async getPartenaireRecruteur(userId: string, role: UserRole): Promise<{ partenaire: PartenaireRecruteurVue | null }> {
    const partnerId = await this.partnerIdDe(userId, role);
    if (!partnerId) return { partenaire: null };

    const p = await this.partnerRepo.findOne({
      where:  { id: partnerId },
      select: ['id', 'name', 'zone', 'commune', 'phone', 'status', 'suspendedUntil', 'privacySettings'],
    });
    /* Suspendu, en pause ou supprimé (Zone sensible) : plus présenté comme contact */
    if (!p || p.status !== PartnerStatus.ACTIVE || p.suspendedUntil) return { partenaire: null };

    const visibilite = lireVisibilitePartenaire(p.privacySettings);
    if (!visibilite.profilPublic) return { partenaire: null };

    return {
      partenaire: {
        nom:       p.name,
        zone:      p.zone ?? p.commune ?? null,
        telephone: visibilite.afficherTelephone ? (p.phone ?? null) : null,
      },
    };
  }

  /** Classement des partenaires de la même zone (même administrateur). */
  async getClassement(userId: string): Promise<ClassementPartenaires> {
    const moi = await this.partnerRepo.findOne({
      where:  { userId },
      select: ['id', 'adminId', 'privacySettings'],
    });
    if (!moi) throw new NotFoundException('Profil partenaire introuvable.');

    const partenaires = await this.partnerRepo.find({
      where:  { adminId: moi.adminId ?? IsNull() },
      select: ['id', 'name', 'status', 'suspendedUntil', 'privacySettings',
               'totalCompanies', 'totalDeliveries', 'totalCorrespondants'],
      take:   500,
    });

    const lignes = partenaires
      /* Seuls les partenaires actifs (ni en pause ni supprimés) sont classés */
      .filter(p => p.status === PartnerStatus.ACTIVE && !p.suspendedUntil)
      .map(p => ({
        id:      p.id,
        nom:     p.name,
        recrues: (p.totalCompanies ?? 0) + (p.totalDeliveries ?? 0) + (p.totalCorrespondants ?? 0),
        visible: lireVisibilitePartenaire(p.privacySettings).apparaitreClassement,
      }))
      .sort((a, b) => b.recrues - a.recrues || a.id.localeCompare(b.id));

    const index = lignes.findIndex(l => l.id === moi.id);

    return {
      rang:                 index >= 0 ? index + 1 : null,
      total:                lignes.length,
      recrues:              index >= 0 ? lignes[index].recrues : 0,
      apparaitreClassement: lireVisibilitePartenaire(moi.privacySettings).apparaitreClassement,
      top: lignes.slice(0, TAILLE_TOP).map((l, i) => ({
        rang:    i + 1,
        /* Le partenaire connecté voit toujours son propre nom */
        nom:     l.id === moi.id || l.visible ? l.nom : NOM_PARTENAIRE_ANONYME,
        recrues: l.recrues,
        moi:     l.id === moi.id,
      })),
    };
  }

  private async partnerIdDe(userId: string, role: UserRole): Promise<string | null> {
    const select = ['id', 'partnerId'] as const;
    switch (role) {
      case UserRole.COMPANY:
        return (await this.companyRepo.findOne({ where: { userId }, select: [...select] }))?.partnerId ?? null;
      case UserRole.DELIVERY:
        return (await this.deliveryRepo.findOne({ where: { userId }, select: [...select] }))?.partnerId ?? null;
      case UserRole.CORRESPONDENT:
        return (await this.corrRepo.findOne({ where: { userId }, select: [...select] }))?.partnerId ?? null;
      default:
        return null;
    }
  }
}
