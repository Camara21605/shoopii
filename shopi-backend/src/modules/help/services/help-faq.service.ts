import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HelpFaqItem } from '../../../database/entities/help/help-faq-item.entity';
import { CreateFaqItemDto, UpdateFaqItemDto } from '../dto/help.dto';

@Injectable()
export class HelpFaqService {

  constructor(
    @InjectRepository(HelpFaqItem)
    private readonly faqRepo: Repository<HelpFaqItem>,
  ) {}

  async findAll(audience?: string) {
    const qb = this.faqRepo.createQueryBuilder('f')
      .where('f.isPublished = true')
      .orderBy('f.categorySlug', 'ASC')
      .addOrderBy('f.displayOrder', 'ASC');

    if (audience && audience !== 'all') {
      qb.andWhere(
        `(f.audience IS NULL OR f.audience LIKE :all OR f.audience LIKE :aud)`,
        { all: '%all%', aud: `%${audience}%` },
      );
    }

    const items = await qb.getMany();

    /* Grouper par catégorie */
    const groups: Record<string, HelpFaqItem[]> = {};
    for (const item of items) {
      if (!groups[item.categorySlug]) groups[item.categorySlug] = [];
      groups[item.categorySlug].push(item);
    }

    return Object.entries(groups).map(([slug, faqs]) => ({ slug, faqs }));
  }

  async findByCategory(categorySlug: string, audience?: string) {
    const qb = this.faqRepo.createQueryBuilder('f')
      .where('f.categorySlug = :slug', { slug: categorySlug })
      .andWhere('f.isPublished = true')
      .orderBy('f.displayOrder', 'ASC');

    if (audience && audience !== 'all') {
      qb.andWhere(
        `(f.audience IS NULL OR f.audience LIKE :all OR f.audience LIKE :aud)`,
        { all: '%all%', aud: `%${audience}%` },
      );
    }

    return qb.getMany();
  }

  /* ── Admin ── */

  async findAllAdmin() {
    return this.faqRepo.find({ order: { categorySlug: 'ASC', displayOrder: 'ASC' } });
  }

  async create(dto: CreateFaqItemDto) {
    const item = this.faqRepo.create({ ...dto, audience: dto.audience ?? null });
    return this.faqRepo.save(item);
  }

  async update(id: string, dto: UpdateFaqItemDto) {
    const item = await this.faqRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('FAQ introuvable.');
    Object.assign(item, dto);
    return this.faqRepo.save(item);
  }

  async remove(id: string) {
    const item = await this.faqRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('FAQ introuvable.');
    await this.faqRepo.remove(item);
  }
}
