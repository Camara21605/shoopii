/* ============================================================
 * FICHIER : returns/services/returns.service.ts
 *
 * RÔLE : Logique métier complète des demandes de retour.
 *        Opérations côté entreprise (accept/refuse/refund).
 * ============================================================ */

import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';

import { ReturnRequest, ReturnStatus, ReturnType, ReturnPriority }
  from 'src/database/entities/returns/return-request.entity';
import { ReturnEvidence, EvidenceType }
  from 'src/database/entities/returns/return-evidence.entity';
import { ReturnHistory }
  from 'src/database/entities/returns/return-history.entity';
import { Company }
  from 'src/database/entities/profiles/entreprise-profile.entity';
import { Client }
  from 'src/database/entities/profiles/client-profile.entity';
import { Commande }
  from 'src/database/entities/commande/commande.entity';
import { User }
  from 'src/database/entities/user.entity';
import { UploadService, UPLOAD_FOLDERS }
  from 'src/modules/upload/upload.service';

import {
  AcceptReturnDto, RefuseReturnDto, RefundReturnDto,
  AddReturnNoteDto, FilterReturnsDto, CreateReturnDto,
  UpdateReturnPriorityDto,
} from '../dto/returns.dto';

/* ── Counter for reference generation ── */
const REF_PAD = 5;
function padRef(n: number) { return String(n).padStart(REF_PAD, '0'); }

@Injectable()
export class ReturnsService {

  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    @InjectRepository(ReturnRequest) private readonly returnRepo:   Repository<ReturnRequest>,
    @InjectRepository(ReturnEvidence) private readonly evidenceRepo: Repository<ReturnEvidence>,
    @InjectRepository(ReturnHistory)  private readonly historyRepo:  Repository<ReturnHistory>,
    @InjectRepository(Company)        private readonly companyRepo:  Repository<Company>,
    @InjectRepository(Client)         private readonly clientRepo:   Repository<Client>,
    @InjectRepository(Commande)       private readonly commandeRepo: Repository<Commande>,
    @InjectRepository(User)           private readonly userRepo:     Repository<User>,
    private readonly uploadService: UploadService,
    private readonly dataSource:    DataSource,
  ) {}

  /* ══════════════════════════════════════════════════════════
   * LISTE PAGINÉE — côté entreprise
   ══════════════════════════════════════════════════════════ */
  async findAll(userId: string, filters: FilterReturnsDto) {
    const company = await this.resolveCompany(userId);

    const {
      page = 1, limit = 20, status, reason, priority,
      search, dateFrom, dateTo,
      sortBy = 'createdAt', sortOrder = 'DESC',
    } = filters;

    const qb = this.returnRepo
      .createQueryBuilder('r')
      .where('r.companyId = :companyId', { companyId: company.id })
      .leftJoinAndSelect('r.evidences', 'evidences')
      .orderBy(`r.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    if (status)   qb.andWhere('r.status = :status', { status });
    if (reason)   qb.andWhere('r.reason = :reason', { reason });
    if (priority) qb.andWhere('r.priority = :priority', { priority });

    if (search?.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(r.reference) LIKE :q OR LOWER(r.productName) LIKE :q)',
        { q },
      );
    }

    if (dateFrom) qb.andWhere('r.createdAt >= :from', { from: new Date(dateFrom) });
    if (dateTo)   qb.andWhere('r.createdAt <= :to',   { to:   new Date(dateTo)   });

    const [data, total] = await qb.getManyAndCount();

    /* Enrichir avec le nom du client en parallèle */
    const clientIds = [...new Set(data.map(r => r.clientId).filter(Boolean))];
    const clients   = clientIds.length > 0
      ? await this.userRepo.find({
          where: { id: In(clientIds) },
          select: ['id', 'firstName', 'lastName', 'profilePicture'],
        })
      : [];
    const clientMap = new Map(clients.map(u => [u.id, u]));

    const enriched = await Promise.all(
      data.map(async r => {
        /* Résoudre userId depuis clientId */
        let clientUser: User | undefined;
        if (r.clientId) {
          const client = await this.clientRepo.findOne({
            where: { id: r.clientId }, select: ['userId'],
          });
          if (client?.userId) clientUser = clientMap.get(client.userId);
        }
        return {
          ...this.toSummary(r),
          clientName: clientUser
            ? `${clientUser.firstName ?? ''} ${clientUser.lastName ?? ''}`.trim()
            : 'Client',
          clientAvatar: clientUser?.profilePicture ?? null,
        };
      }),
    );

    return {
      data: enriched,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /* ══════════════════════════════════════════════════════════
   * DÉTAIL D'UN RETOUR
   ══════════════════════════════════════════════════════════ */
  async findOne(userId: string, returnId: string) {
    const company = await this.resolveCompany(userId);
    const ret = await this.returnRepo.findOne({
      where: { id: returnId, companyId: company.id },
      relations: ['evidences', 'history'],
    });
    if (!ret) throw new NotFoundException('Demande de retour introuvable.');

    /* Enrichir : client + commande */
    const [client, commande] = await Promise.all([
      ret.clientId
        ? this.clientRepo.findOne({ where: { id: ret.clientId }, select: ['userId'] })
        : null,
      ret.commandeId
        ? this.commandeRepo.findOne({ where: { id: ret.commandeId }, select: ['id', 'numero', 'total', 'createdAt'] })
        : null,
    ]);

    let clientName = 'Client';
    let clientAvatar: string | null = null;
    if (client?.userId) {
      const user = await this.userRepo.findOne({
        where: { id: client.userId },
        select: ['id', 'firstName', 'lastName', 'email', 'profilePicture'],
      });
      if (user) {
        clientName   = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
        clientAvatar = user.profilePicture ?? null;
      }
    }

    /* Trier l'historique par date asc */
    const history = [...(ret.history ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return {
      ...ret,
      clientName,
      clientAvatar,
      commande: commande ? {
        id:        commande.id,
        numero:    commande.numero,
        total:     Number(commande.total),
        createdAt: commande.createdAt,
      } : null,
      history,
      evidences: ret.evidences ?? [],
    };
  }

  /* ══════════════════════════════════════════════════════════
   * CRÉER — côté client (appelé depuis client controller)
   ══════════════════════════════════════════════════════════ */
  async createByClient(clientUserId: string, dto: CreateReturnDto) {
    /* Vérifier que le client existe */
    const client = await this.clientRepo.findOne({ where: { userId: clientUserId } });
    if (!client) throw new NotFoundException('Profil client introuvable.');

    /* Vérifier que la commande appartient au client */
    const commande = await this.commandeRepo.findOne({
      where: { id: dto.commandeId, clientId: client.id },
      select: ['id', 'companyId', 'status', 'total'],
    });
    if (!commande) throw new NotFoundException('Commande introuvable.');

    /* Vérifier que la commande est dans un état retournable */
    const RETURNABLE = ['delivered', 'auto_delivered'];
    if (!RETURNABLE.includes(commande.status)) {
      throw new BadRequestException('Cette commande ne peut pas faire l\'objet d\'un retour.');
    }

    /* Générer la référence */
    const reference = await this.generateReference('RET');

    const ret = this.returnRepo.create({
      reference,
      commandeId:     commande.id,
      clientId:       client.id,
      companyId:      commande.companyId,
      productId:      dto.productId ?? null,
      productName:    dto.productName,
      productVariant: dto.productVariant ?? null,
      quantity:       dto.quantity,
      montantDemande: dto.montantDemande,
      reason:         dto.reason,
      description:    dto.description,
      returnType:     dto.returnType ?? ReturnType.REFUND,
      status:         ReturnStatus.PENDING,
      priority:       ReturnPriority.NORMAL,
    });

    const saved = await this.returnRepo.save(ret);

    /* Audit trail */
    await this.addHistory(saved.id, 'created', {}, clientUserId, 'client');

    this.logger.log(`[RETURN] Créé ${reference} — clientId=${client.id}`);
    return saved;
  }

  /* ══════════════════════════════════════════════════════════
   * ACCEPTER
   ══════════════════════════════════════════════════════════ */
  async accept(userId: string, returnId: string, dto: AcceptReturnDto) {
    const { ret } = await this.resolveReturn(userId, returnId);

    if (ret.status !== ReturnStatus.PENDING) {
      throw new BadRequestException(`Impossible d'accepter un retour au statut "${ret.status}".`);
    }

    const user = await this.resolveUser(userId);

    await this.dataSource.transaction(async em => {
      ret.status        = ReturnStatus.ACCEPTED;
      ret.montantAccorde = dto.montantAccorde;
      ret.noteClient    = dto.noteClient    ?? ret.noteClient;
      ret.noteInterne   = dto.noteInterne   ?? ret.noteInterne;
      ret.acceptedAt    = new Date();
      await em.save(ret);

      await em.save(this.historyRepo.create({
        returnRequestId: ret.id,
        action:    'accepted',
        metadata:  { montantAccorde: dto.montantAccorde },
        actorId:   user.id,
        actorName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        actorRole: 'enterprise',
      }));
    });

    this.logger.log(`[RETURN] Accepté ${ret.reference} — userId=${userId}`);
    return this.findOne(userId, returnId);
  }

  /* ══════════════════════════════════════════════════════════
   * REFUSER
   ══════════════════════════════════════════════════════════ */
  async refuse(userId: string, returnId: string, dto: RefuseReturnDto) {
    const { ret } = await this.resolveReturn(userId, returnId);

    if (ret.status !== ReturnStatus.PENDING) {
      throw new BadRequestException(`Impossible de refuser un retour au statut "${ret.status}".`);
    }

    const user = await this.resolveUser(userId);

    await this.dataSource.transaction(async em => {
      ret.status      = ReturnStatus.REFUSED;
      ret.noteClient  = dto.noteClient  ?? ret.noteClient;
      ret.noteInterne = dto.noteInterne ?? ret.noteInterne;
      ret.refusedAt   = new Date();
      await em.save(ret);

      await em.save(this.historyRepo.create({
        returnRequestId: ret.id,
        action:   'refused',
        metadata: { noteClient: dto.noteClient },
        actorId:  user.id,
        actorName:`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        actorRole:'enterprise',
      }));
    });

    this.logger.log(`[RETURN] Refusé ${ret.reference} — userId=${userId}`);
    return this.findOne(userId, returnId);
  }

  /* ══════════════════════════════════════════════════════════
   * MARQUER REÇU
   ══════════════════════════════════════════════════════════ */
  async markReceived(userId: string, returnId: string) {
    const { ret } = await this.resolveReturn(userId, returnId);
    if (ret.status !== ReturnStatus.IN_TRANSIT) {
      throw new BadRequestException('Le retour n\'est pas en transit.');
    }
    const user = await this.resolveUser(userId);

    await this.dataSource.transaction(async em => {
      ret.status     = ReturnStatus.RECEIVED;
      ret.receivedAt = new Date();
      await em.save(ret);
      await em.save(this.historyRepo.create({
        returnRequestId: ret.id,
        action: 'received', metadata: {},
        actorId: user.id, actorName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        actorRole: 'enterprise',
      }));
    });

    return this.findOne(userId, returnId);
  }

  /* ══════════════════════════════════════════════════════════
   * REMBOURSER
   ══════════════════════════════════════════════════════════ */
  async refund(userId: string, returnId: string, dto: RefundReturnDto) {
    const { ret } = await this.resolveReturn(userId, returnId);

    const REFUNDABLE = [ReturnStatus.ACCEPTED, ReturnStatus.RECEIVED];
    if (!REFUNDABLE.includes(ret.status)) {
      throw new BadRequestException(`Impossible de rembourser un retour au statut "${ret.status}".`);
    }

    const user = await this.resolveUser(userId);

    await this.dataSource.transaction(async em => {
      if (dto.montantAccorde !== undefined) ret.montantAccorde = dto.montantAccorde;
      ret.status      = ReturnStatus.REFUNDED;
      ret.noteInterne = dto.noteInterne ?? ret.noteInterne;
      ret.refundedAt  = new Date();
      await em.save(ret);

      await em.save(this.historyRepo.create({
        returnRequestId: ret.id,
        action:   'refunded',
        metadata: { montant: ret.montantAccorde },
        actorId:  user.id,
        actorName:`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        actorRole:'enterprise',
      }));
    });

    this.logger.log(`[RETURN] Remboursé ${ret.reference} — userId=${userId}`);
    return this.findOne(userId, returnId);
  }

  /* ══════════════════════════════════════════════════════════
   * AJOUTER NOTE INTERNE
   ══════════════════════════════════════════════════════════ */
  async addNote(userId: string, returnId: string, dto: AddReturnNoteDto) {
    const { ret } = await this.resolveReturn(userId, returnId);
    const user     = await this.resolveUser(userId);

    ret.noteInterne = dto.content;
    await this.returnRepo.save(ret);

    const history = this.historyRepo.create({
      returnRequestId: ret.id,
      action:   'note_added',
      metadata: { content: dto.content },
      actorId:  user.id,
      actorName:`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      actorRole:'enterprise',
    });
    await this.historyRepo.save(history);

    return history;
  }

  /* ══════════════════════════════════════════════════════════
   * CHANGER PRIORITÉ
   ══════════════════════════════════════════════════════════ */
  async updatePriority(userId: string, returnId: string, dto: UpdateReturnPriorityDto) {
    const { ret } = await this.resolveReturn(userId, returnId);
    const user     = await this.resolveUser(userId);

    const oldPriority = ret.priority;
    ret.priority = dto.priority;
    await this.returnRepo.save(ret);

    await this.addHistory(ret.id, 'priority_changed', { from: oldPriority, to: dto.priority }, user.id, 'enterprise', `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim());

    return { priority: ret.priority };
  }

  /* ══════════════════════════════════════════════════════════
   * UPLOAD PREUVE
   ══════════════════════════════════════════════════════════ */
  async uploadEvidence(
    userId: string, returnId: string,
    file: Express.Multer.File,
    type: 'image' | 'video' | 'document',
  ) {
    const { ret } = await this.resolveReturn(userId, returnId);

    let uploadResult: { url: string; publicId: string; size: number };
    if (type === 'image') {
      uploadResult = await this.uploadService.uploadImage(file, UPLOAD_FOLDERS.DOCUMENT);
    } else if (type === 'video') {
      uploadResult = await this.uploadService.uploadVideo(file, UPLOAD_FOLDERS.DOCUMENT);
    } else {
      uploadResult = await this.uploadService.uploadDocument(file, UPLOAD_FOLDERS.DOCUMENT);
    }

    const evidence = this.evidenceRepo.create({
      returnRequestId: ret.id,
      url:        uploadResult.url,
      publicId:   uploadResult.publicId,
      type:       type as EvidenceType,
      filename:   file.originalname,
      size:       uploadResult.size,
      uploadedBy: 'enterprise',
    });
    const saved = await this.evidenceRepo.save(evidence);

    await this.addHistory(ret.id, 'evidence_uploaded', { type, url: uploadResult.url }, userId, 'enterprise');

    return saved;
  }

  /* ══════════════════════════════════════════════════════════
   * HELPERS PRIVÉS
   ══════════════════════════════════════════════════════════ */

  private async resolveCompany(userId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({
      where: { userId },
      select: ['id', 'companyName'],
    });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }

  private async resolveUser(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where:  { id: userId },
      select: ['id', 'firstName', 'lastName'],
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return user;
  }

  private async resolveReturn(userId: string, returnId: string) {
    const company = await this.resolveCompany(userId);
    const ret = await this.returnRepo.findOne({
      where: { id: returnId, companyId: company.id },
    });
    if (!ret) throw new NotFoundException('Demande de retour introuvable.');
    return { ret, company };
  }

  private async generateReference(prefix: 'RET' | 'SAV'): Promise<string> {
    const year  = new Date().getFullYear();
    const count = await this.returnRepo.count();
    return `${prefix}-${year}-${padRef(count + 1)}`;
  }

  private async addHistory(
    returnRequestId: string,
    action: string,
    metadata: Record<string, unknown>,
    actorId?: string,
    actorRole = 'enterprise',
    actorName?: string,
  ) {
    const history = this.historyRepo.create({
      returnRequestId,
      action,
      metadata,
      actorId: actorId ?? null,
      actorName: actorName ?? null,
      actorRole,
    });
    return this.historyRepo.save(history);
  }

  private toSummary(r: ReturnRequest) {
    return {
      id:             r.id,
      reference:      r.reference,
      productName:    r.productName,
      productImage:   r.productImage,
      productVariant: r.productVariant,
      quantity:       r.quantity,
      reason:         r.reason,
      returnType:     r.returnType,
      status:         r.status,
      priority:       r.priority,
      montantDemande: Number(r.montantDemande),
      montantAccorde: r.montantAccorde !== null ? Number(r.montantAccorde) : null,
      evidenceCount:  (r.evidences ?? []).length,
      createdAt:      r.createdAt,
      updatedAt:      r.updatedAt,
    };
  }
}
