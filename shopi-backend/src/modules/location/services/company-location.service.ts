/* ============================================================
 * FICHIER : src/modules/location/services/company-location.service.ts
 * RÔLE    : Gestion de la localisation d'une entreprise
 *           (siège + agences / succursales).
 * ============================================================ */

import {
  Injectable, Logger, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { Company }        from '../../../database/entities/profiles/entreprise-profile.entity';
import { CompanyBranch }  from '../../../database/entities/location/company-branch.entity';
import {
  UpdateCompanyLocationDto,
  CreateCompanyBranchDto,
  UpdateCompanyBranchDto,
} from '../dto/company-location.dto';
import { GeoService }     from './geo.service';
import { ProximityQueryDto } from '../dto/proximity.dto';
import type { IProximityResult } from '../interfaces/location.interfaces';

@Injectable()
export class CompanyLocationService {

  private readonly logger = new Logger(CompanyLocationService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(CompanyBranch)
    private readonly branchRepo: Repository<CompanyBranch>,

    private readonly geoService: GeoService,
  ) {}

  /* ── Localisation du siège ───────────────────────────────── */

  async getLocation(companyId: string): Promise<Partial<Company>> {
    const company = await this.companyRepo.findOne({
      where:  { id: companyId },
      select: [
        'id', 'companyName', 'adresse', 'commune', 'ville',
        'region', 'pays', 'codePostal', 'repere',
        'latitude', 'longitude',
      ] as any,
    });
    if (!company) throw new NotFoundException('Entreprise introuvable.');
    return company;
  }

  async updateLocation(
    companyId: string,
    userId:    string,
    dto:       UpdateCompanyLocationDto,
  ): Promise<Partial<Company>> {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company)            throw new NotFoundException('Entreprise introuvable.');
    if (company.userId !== userId) throw new ForbiddenException('Accès refusé.');

    Object.assign(company, {
      adresse:   dto.adresse   ?? company.adresse,
      commune:   dto.commune   ?? company.commune,
      ville:     dto.ville     ?? company.ville,
      region:    dto.region    ?? (company as any).region,
      pays:      dto.pays      ?? company.pays,
      codePostal: dto.codePostal ?? (company as any).codePostal,
      repere:    dto.repere    ?? company.repere,
      latitude:  dto.latitude  !== undefined ? dto.latitude  : (company as any).latitude,
      longitude: dto.longitude !== undefined ? dto.longitude : (company as any).longitude,
    });

    const saved = await this.companyRepo.save(company);
    this.logger.log(`[COMPANY LOC ✅] Mise à jour companyId=${companyId}`);
    return saved;
  }

  /* ── Agences ─────────────────────────────────────────────── */

  async getBranches(companyId: string): Promise<CompanyBranch[]> {
    return this.branchRepo.find({
      where: { companyId, actif: true },
      order: { estPrincipal: 'DESC', creeLe: 'ASC' },
    });
  }

  async createBranch(
    companyId: string,
    userId:    string,
    dto:       CreateCompanyBranchDto,
  ): Promise<CompanyBranch> {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company)            throw new NotFoundException('Entreprise introuvable.');
    if (company.userId !== userId) throw new ForbiddenException('Accès refusé.');

    // Si marquée principale → retirer le flag des autres
    if (dto.estPrincipal) {
      await this.branchRepo.update({ companyId, estPrincipal: true }, { estPrincipal: false });
    }

    const branch = this.branchRepo.create({ ...dto, companyId });
    const saved  = await this.branchRepo.save(branch);
    this.logger.log(`[BRANCH ✅] Créée companyId=${companyId} id=${saved.id}`);
    return saved;
  }

  async updateBranch(
    branchId:  string,
    companyId: string,
    userId:    string,
    dto:       UpdateCompanyBranchDto,
  ): Promise<CompanyBranch> {
    const branch  = await this.branchRepo.findOne({ where: { id: branchId, companyId } });
    if (!branch)  throw new NotFoundException('Agence introuvable.');

    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company || company.userId !== userId) throw new ForbiddenException('Accès refusé.');

    if (dto.estPrincipal) {
      await this.branchRepo.update({ companyId, estPrincipal: true }, { estPrincipal: false });
    }

    Object.assign(branch, dto);
    return this.branchRepo.save(branch);
  }

  async removeBranch(branchId: string, companyId: string, userId: string): Promise<void> {
    const branch  = await this.branchRepo.findOne({ where: { id: branchId, companyId } });
    if (!branch)  throw new NotFoundException('Agence introuvable.');

    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company || company.userId !== userId) throw new ForbiddenException('Accès refusé.');

    await this.branchRepo.remove(branch);
  }

  /* ── Entreprises proches ─────────────────────────────────── */

  async findNearby(query: ProximityQueryDto): Promise<IProximityResult[]> {
    const bbox = this.geoService.boundingBox(
      { latitude: query.latitude, longitude: query.longitude },
      query.rayonKm ?? 10,
    );

    const companies = await this.companyRepo
      .createQueryBuilder('c')
      .select(['c.id', 'c.companyName', 'c.latitude', 'c.longitude', 'c.ville', 'c.logo', 'c.adresse'])
      .where('c.latitude  BETWEEN :latMin AND :latMax', { latMin: bbox.latMin, latMax: bbox.latMax })
      .andWhere('c.longitude BETWEEN :lngMin AND :lngMax', { lngMin: bbox.lngMin, lngMax: bbox.lngMax })
      .andWhere('c.status = :status', { status: 'active' })
      .take(query.limit ?? 20)
      .getMany();

    return this.geoService
      .sortByProximity(
        companies.map(c => ({
          ...c,
          latitude:  Number((c as any).latitude),
          longitude: Number((c as any).longitude),
        })),
        { latitude: query.latitude, longitude: query.longitude },
        query.rayonKm ?? 10,
      )
      .map(c => ({
        id:         c.id,
        nom:        c.companyName,
        type:       'entreprise' as const,
        latitude:   c.latitude,
        longitude:  c.longitude,
        distanceKm: c.distanceKm,
        adresse:    c.adresse ?? undefined,
        ville:      c.ville ?? undefined,
        logo:       (c as any).logo ?? undefined,
        disponible: true,
      }));
  }
}
