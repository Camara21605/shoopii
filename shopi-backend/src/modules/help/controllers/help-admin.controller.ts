import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Request,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard }    from '../../../common/guards/auth.guard';
import { RolesGuard }      from '../../../common/guards/roles.guard';
import { Roles }           from '../../../common/decorators/roles.decorator';
import { UserRole }        from '../../../common/enums/user-role.enum';
import { HelpCategoryService } from '../services/help-category.service';
import { HelpArticleService }  from '../services/help-article.service';
import { HelpFaqService }      from '../services/help-faq.service';
import {
  CreateHelpCategoryDto, UpdateHelpCategoryDto,
  CreateHelpArticleDto, UpdateHelpArticleDto,
  CreateFaqItemDto, UpdateFaqItemDto,
} from '../dto/help.dto';

@Controller('admin/help')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class HelpAdminController {

  constructor(
    private readonly categories: HelpCategoryService,
    private readonly articles:   HelpArticleService,
    private readonly faq:        HelpFaqService,
  ) {}

  /* ── Analytics ── */

  @Get('analytics')
  getAnalytics() {
    return this.articles.getAnalytics();
  }

  /* ── Catégories ── */

  @Get('categories')
  getCategories() {
    return this.categories.findAllAdmin();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateHelpCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateHelpCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Param('id') id: string) {
    await this.categories.deactivate(id);
  }

  /* ── Articles ── */

  @Get('articles')
  getArticles(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.articles.findAllAdmin(
      parseInt(page ?? '1', 10),
      parseInt(limit ?? '30', 10),
    );
  }

  @Post('articles')
  createArticle(@Body() dto: CreateHelpArticleDto, @Request() req: any) {
    return this.articles.create(dto, req.user.id);
  }

  @Patch('articles/:id')
  updateArticle(@Param('id') id: string, @Body() dto: UpdateHelpArticleDto) {
    return this.articles.update(id, dto);
  }

  @Patch('articles/:id/publish')
  publishArticle(@Param('id') id: string) {
    return this.articles.publish(id);
  }

  @Patch('articles/:id/archive')
  archiveArticle(@Param('id') id: string) {
    return this.articles.archive(id);
  }

  @Delete('articles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteArticle(@Param('id') id: string, @Request() req: any) {
    await this.articles.remove(id, req.user.id);
  }

  /* ── FAQ ── */

  @Get('faq')
  getFaqAdmin() {
    return this.faq.findAllAdmin();
  }

  @Post('faq')
  createFaq(@Body() dto: CreateFaqItemDto) {
    return this.faq.create(dto);
  }

  @Patch('faq/:id')
  updateFaq(@Param('id') id: string, @Body() dto: UpdateFaqItemDto) {
    return this.faq.update(id, dto);
  }

  @Delete('faq/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFaq(@Param('id') id: string) {
    await this.faq.remove(id);
  }
}
