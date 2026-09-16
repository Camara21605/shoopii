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
import { NotificationEventService }
  from 'src/modules/notifications/events/notification-event.service';

import {
  AcceptReturnDto, RefuseReturnDto, RefundReturnDto,
  AddReturnNoteDto, FilterReturnsDto, CreateReturnDto,
  UpdateReturnPriorityDto,
} from '../dto/returns.dto';

/* ── Counter for reference generation ── */
const REF_PAD = 5;
function padRef(n: number) { return String(n).padStart(REF_PAD, '0'); }

/* Délai (en jours) après livraison pendant lequel un client peut encore
 * demander un retour — au-delà, la commande est considérée close côté
 * après-vente (le client garde toujours la messagerie SAV pour un litige). */
const RETURN_WINDOW_DAYS = 15;

/* Actions d'historique purement internes (jamais montrées au client —
 * peuvent contenir des notes privées de l'équipe, voir addNote()). */
const INTERNAL_ONLY_HISTORY_ACTIONS = new Set(['note_added']);

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
    private readonly notifEventSvc: NotificationEventService,
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
   * CRÉER — côté client (appelé depuis ClientReturnsController)
   *
   * ROBUSTESSE — tout ce qui identifie l'article et son prix est
   * DÉRIVÉ SERVEUR depuis le CommandeItem réel, jamais accepté tel quel
   * depuis le client (voir CreateReturnDto — productName/montantDemande
   * ont été retirés des champs acceptés) :
   *   1. la commande doit appartenir au client ET être livrée
   *   2. la fenêtre de retour (RETURN_WINDOW_DAYS) ne doit pas être dépassée
   *   3. l'article (productId) doit réellement faire partie de la commande
   *   4. la quantité ne peut pas dépasser la quantité commandée, ni la
   *      quantité déjà couverte par une demande antérieure non refusée
   *      (empêche de réclamer deux fois le remboursement du même article)
   *   5. montantDemande = prixUnitaire × quantity (snapshot commande),
   *      jamais une valeur fournie par le client
   ══════════════════════════════════════════════════════════ */
  async createByClient(clientUserId: string, dto: CreateReturnDto) {
    const client = await this.clientRepo.findOne({ where: { userId: clientUserId } });
    if (!client) throw new NotFoundException('Profil client introuvable.');

    const commande = await this.commandeRepo.findOne({
      where:     { id: dto.commandeId, clientId: client.id },
      relations: ['items'],
    });
    if (!commande) throw new NotFoundException('Commande introuvable.');

    const RETURNABLE = ['delivered', 'auto_delivered'];
    if (!RETURNABLE.includes(commande.status)) {
      throw new BadRequestException('Cette commande ne peut pas faire l\'objet d\'un retour.');
    }

    const deliveredAt = commande.dateLivraisonEffective ?? commande.updatedAt;
    const deadline = new Date(deliveredAt);
    deadline.setDate(deadline.getDate() + RETURN_WINDOW_DAYS);
    if (new Date() > deadline) {
      throw new BadRequestException(
        `Le délai de retour de ${RETURN_WINDOW_DAYS} jours après livraison est dépassé.`,
      );
    }

    const item = (commande.items ?? []).find(i => i.productId === dto.productId);
    if (!item) {
      throw new NotFoundException('Cet article ne fait pas partie de cette commande.');
    }

    if (dto.quantity > item.quantite) {
      throw new BadRequestException(
        `Quantité invalide — vous avez commandé ${item.quantite} exemplaire(s) de cet article.`,
      );
    }

    /* Empêche de réclamer deux fois le même article : on comptabilise la
     * quantité déjà couverte par une demande non refusée (un retour refusé
     * ne consomme pas la quantité — le client peut retenter). */
    const existing = await this.returnRepo.find({
      where:  { commandeId: commande.id, productId: dto.productId },
      select: ['quantity', 'status'],
    });
    const dejaReclame = existing
      .filter(r => r.status !== ReturnStatus.REFUSED)
      .reduce((sum, r) => sum + r.quantity, 0);
    if (dejaReclame + dto.quantity > item.quantite) {
      throw new BadRequestException(
        'Une demande de retour existe déjà pour la quantité maximale de cet article.',
      );
    }

    const montantDemande = Math.round(Number(item.prixUnitaire) * dto.quantity);
    const reference = await this.generateReference('RET');

    const ret = this.returnRepo.create({
      reference,
      commandeId:     commande.id,
      clientId:       client.id,
      companyId:      commande.companyId,
      productId:      item.productId,
      productName:    item.nomProduit,
      productImage:   item.imageProduit,
      productVariant: item.varianteChoisie,
      quantity:       dto.quantity,
      montantDemande,
      reason:         dto.reason,
      description:    dto.description,
      returnType:     dto.returnType ?? ReturnType.REFUND,
      status:         ReturnStatus.PENDING,
      priority:       ReturnPriority.NORMAL,
    });

    const saved = await this.returnRepo.save(ret);

    /* Audit trail */
    await this.addHistory(saved.id, 'created', {}, clientUserId, 'client');

    /* Notifie l'entreprise — alimente le badge "Retours" de sa sidebar
     * (voir useSidebarBadges.ts côté frontend). Fire-and-forget : un échec
     * d'envoi ne doit jamais faire échouer la création du retour lui-même
     * (même principe que notifyProductLiked ailleurs dans le code). */
    void this.notifEventSvc.notifyReturnRequested({
      companyId:   commande.companyId,
      returnId:    saved.id,
      reference,
      productName: item.nomProduit,
      clientId:    client.id,
    });

    this.logger.log(`[RETURN] Créé ${reference} — clientId=${client.id}`);
    return saved;
  }

  /* ══════════════════════════════════════════════════════════
   * LISTE PAGINÉE — côté client (ses propres demandes uniquement)
   ══════════════════════════════════════════════════════════ */
  async findAllByClient(clientUserId: string, filters: FilterReturnsDto) {
    const client = await this.clientRepo.findOne({ where: { userId: clientUserId } });
    if (!client) throw new NotFoundException('Profil client introuvable.');

    const { page = 1, limit = 20, status, sortBy = 'createdAt', sortOrder = 'DESC' } = filters;

    const qb = this.returnRepo
      .createQueryBuilder('r')
      .where('r.clientId = :clientId', { clientId: client.id })
      .orderBy(`r.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('r.status = :status', { status });

    const [data, total] = await qb.getManyAndCount();

    return {
      data: data.map(r => this.toClientSummary(r)),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /* ══════════════════════════════════════════════════════════
   * DÉTAIL — côté client
   *
   * SÉCURITÉ VIE PRIVÉE : ne renvoie JAMAIS noteInterne, ni les entrées
   * d'historique internes (voir INTERNAL_ONLY_HISTORY_ACTIONS) — ce sont
   * des annotations privées de l'équipe entreprise, jamais destinées au
   * client (contrairement à noteClient, qui lui est adressé).
   ══════════════════════════════════════════════════════════ */
  async findOneByClient(clientUserId: string, returnId: string) {
    const client = await this.clientRepo.findOne({ where: { userId: clientUserId } });
    if (!client) throw new NotFoundException('Profil client introuvable.');

    const ret = await this.returnRepo.findOne({
      where:     { id: returnId, clientId: client.id },
      relations: ['evidences', 'history'],
    });
    if (!ret) throw new NotFoundException('Demande de retour introuvable.');

    const history = [...(ret.history ?? [])]
      .filter(h => !INTERNAL_ONLY_HISTORY_ACTIONS.has(h.action))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(h => ({ action: h.action, actorRole: h.actorRole, createdAt: h.createdAt }));

    return {
      ...this.toClientSummary(ret),
      description: ret.description,
      history,
      evidences: ret.evidences ?? [],
    };
  }

  /* ══════════════════════════════════════════════════════════
   * UPLOAD PREUVE — côté client
   *
   * Restreint au statut PENDING : une fois que l'entreprise a statué,
   * la preuve ne peut plus influencer une décision déjà prise (elle
   * reste disponible via la messagerie SAV pour un litige).
   ══════════════════════════════════════════════════════════ */
  async uploadEvidenceByClient(
    clientUserId: string, returnId: string,
    file: Express.Multer.File,
    type: 'image' | 'video' | 'document',
  ) {
    const client = await this.clientRepo.findOne({ where: { userId: clientUserId } });
    if (!client) throw new NotFoundException('Profil client introuvable.');

    const ret = await this.returnRepo.findOne({ where: { id: returnId, clientId: client.id } });
    if (!ret) throw new NotFoundException('Demande de retour introuvable.');

    if (ret.status !== ReturnStatus.PENDING) {
      throw new BadRequestException(
        'Impossible d\'ajouter une preuve — cette demande est déjà en cours de traitement.',
      );
    }

    const uploadResult = await this.doUpload(file, type);

    const evidence = this.evidenceRepo.create({
      returnRequestId: ret.id,
      url:        uploadResult.url,
      publicId:   uploadResult.publicId,
      type:       type as EvidenceType,
      filename:   file.originalname,
      size:       uploadResult.size,
      uploadedBy: 'client',
    });
    const saved = await this.evidenceRepo.save(evidence);

    await this.addHistory(ret.id, 'evidence_uploaded', { type }, clientUserId, 'client');

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

    if (ret.clientId) {
      void this.notifEventSvc.notifyReturnStatusChanged({
        clientId:    ret.clientId,
        companyId:   ret.companyId,
        returnId:    ret.id,
        reference:   ret.reference,
        productName: ret.productName,
        title:       'Retour accepté ✅',
        body:        `${ret.reference} — "${ret.productName}" : votre demande a été acceptée.`,
      });
    }

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

    if (ret.clientId) {
      void this.notifEventSvc.notifyReturnStatusChanged({
        clientId:    ret.clientId,
        companyId:   ret.companyId,
        returnId:    ret.id,
        reference:   ret.reference,
        productName: ret.productName,
        title:       'Retour refusé',
        body:        `${ret.reference} — "${ret.productName}" : votre demande a été refusée.`,
      });
    }

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

    if (ret.clientId) {
      void this.notifEventSvc.notifyReturnStatusChanged({
        clientId:    ret.clientId,
        companyId:   ret.companyId,
        returnId:    ret.id,
        reference:   ret.reference,
        productName: ret.productName,
        title:       'Retour remboursé 💸',
        body:        `${ret.reference} — "${ret.productName}" : ${Number(ret.montantAccorde ?? 0).toLocaleString('fr-FR')} GNF remboursés.`,
      });
    }

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

    const uploadResult = await this.doUpload(file, type);

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

  /* BUG CORRIGÉ — le "FIX m4" précédent confondait un companyId FOURNI
   * PAR LE CLIENT (falsifiable → risque cross-tenant réel) avec l'actorId
   * signé serveur dans le JWT (req.user.actorId ?? req.user.id, jamais
   * falsifiable). Pour un compte COMPANY, actorId EST le Company.id — ce
   * lookup strict par `userId` ne matchait donc quasiment jamais pour une
   * vraie entreprise (404 systématique), sauf collision accidentelle avec
   * une fiche fantôme (voir boutique-parametres.service.ts), auquel cas
   * cette page affichait silencieusement les données de la MAUVAISE
   * fiche. `id` (cas normal) est désormais tenté en priorité, `userId`
   * en repli. */
  private async resolveCompany(userId: string): Promise<Company> {
    let company = await this.companyRepo.findOne({ where: { id: userId }, select: ['id', 'companyName'] });
    if (!company) company = await this.companyRepo.findOne({ where: { userId }, select: ['id', 'companyName'] });
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

  private async doUpload(
    file: Express.Multer.File,
    type: 'image' | 'video' | 'document',
  ): Promise<{ url: string; publicId: string; size: number }> {
    if (type === 'image') return this.uploadService.uploadImage(file, UPLOAD_FOLDERS.DOCUMENT);
    if (type === 'video') return this.uploadService.uploadVideo(file, UPLOAD_FOLDERS.DOCUMENT);
    return this.uploadService.uploadDocument(file, UPLOAD_FOLDERS.DOCUMENT);
  }

  private async generateReference(prefix: 'RET' | 'SAV'): Promise<string> {
    /* FIX M2 — Remplace le COUNT() non atomique par un UUID partiel + timestamp.
     * Avant : deux requêtes concurrentes lisaient le même count → même référence.
     * Après : timestamp ms + 6 chars aléatoires garantit l'unicité sans séquence SQL. */
    const year = new Date().getFullYear();
    const ts   = Date.now().toString(36).toUpperCase();          // ex: "LRNJZQK4"
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase(); // ex: "A3F2"
    return `${prefix}-${year}-${ts}-${rand}`;
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

  /* Vue client — exclut délibérément noteInterne, priority et assigneeId
   * (détails internes de traitement, jamais destinés au client). */
  private toClientSummary(r: ReturnRequest) {
    return {
      id:             r.id,
      reference:      r.reference,
      commandeId:     r.commandeId,
      productId:      r.productId,
      productName:    r.productName,
      productImage:   r.productImage,
      productVariant: r.productVariant,
      quantity:       r.quantity,
      reason:         r.reason,
      returnType:     r.returnType,
      status:         r.status,
      montantDemande: Number(r.montantDemande),
      montantAccorde: r.montantAccorde !== null ? Number(r.montantAccorde) : null,
      noteClient:     r.noteClient,
      createdAt:      r.createdAt,
      updatedAt:      r.updatedAt,
    };
  }
}
