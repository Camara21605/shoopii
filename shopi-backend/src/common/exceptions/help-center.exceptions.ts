/* ============================================================
 * FICHIER  : src/common/exceptions/help-center.exceptions.ts
 * ROLE     : Exceptions métier du module Centre d'aide.
 *
 * RESPONSABILITES :
 *   - Centralise les erreurs liées aux articles, catégories, FAQ et recherche.
 *   - Messages rédigés en français côté admin ; en anglais machine côté API.
 *   - Utilisées dans ArticleService, CategoryService, FaqService, SearchService.
 *
 * DEPENDANCES :
 *   - @nestjs/common (HttpException, HttpStatus)
 * ============================================================ */

import { HttpException, HttpStatus } from '@nestjs/common';

/* ─── Articles ─────────────────────────────────────────────── */

export class ArticleNotFoundException extends HttpException {
  constructor(identifier: string) {
    super(
      `Article "${identifier}" introuvable.`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ArticleSlugConflictException extends HttpException {
  constructor(slug: string) {
    super(
      `Un article avec le slug "${slug}" existe déjà. Choisissez un slug unique.`,
      HttpStatus.CONFLICT,
    );
  }
}

export class ArticleNotPublishedException extends HttpException {
  constructor() {
    super(
      'Cet article n\'est pas encore publié.',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ArticleCannotPublishException extends HttpException {
  constructor(reason: string) {
    super(
      `Publication impossible : ${reason}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/* ─── Catégories ───────────────────────────────────────────── */

export class CategoryNotFoundException extends HttpException {
  constructor(identifier: string) {
    super(
      `Catégorie "${identifier}" introuvable.`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class CategorySlugConflictException extends HttpException {
  constructor(slug: string) {
    super(
      `Une catégorie avec le slug "${slug}" existe déjà.`,
      HttpStatus.CONFLICT,
    );
  }
}

export class CategoryNotEmptyException extends HttpException {
  constructor(slug: string, articleCount: number) {
    super(
      `La catégorie "${slug}" contient ${articleCount} article(s). ` +
      'Réaffectez ou supprimez les articles avant de supprimer la catégorie.',
      HttpStatus.CONFLICT,
    );
  }
}

/* ─── FAQ ──────────────────────────────────────────────────── */

export class FaqItemNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      `Question FAQ "${id}" introuvable.`,
      HttpStatus.NOT_FOUND,
    );
  }
}

/* ─── Recherche ────────────────────────────────────────────── */

export class SearchQueryTooShortException extends HttpException {
  constructor(minLength = 2) {
    super(
      `La requête de recherche doit contenir au moins ${minLength} caractères.`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SearchQueryTooLongException extends HttpException {
  constructor(maxLength = 200) {
    super(
      `La requête de recherche ne peut pas dépasser ${maxLength} caractères.`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/* ─── Feedback ─────────────────────────────────────────────── */

export class FeedbackAlreadySubmittedException extends HttpException {
  constructor() {
    super(
      'Vous avez déjà soumis un avis pour cet article.',
      HttpStatus.CONFLICT,
    );
  }
}
