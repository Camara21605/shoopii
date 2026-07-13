import { apiFetch } from '../../../shared/services/apiFetch';

export interface HelpCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  displayOrder: number;
  articleCount: number;
  isActive: boolean;
}

export interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content?: string;
  viewCount: number;
  publishedAt: string;
  categoryId: string | null;
  category?: { name: string; slug: string; icon: string } | null;
  helpfulCount?: number;
  notHelpfulCount?: number;
}

export interface HelpFaqItem {
  id: string;
  categorySlug: string;
  question: string;
  answer: string;
  displayOrder: number;
}

export interface SearchResult {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  viewCount: number;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  rank: number;
}

export const helpApi = {
  /* Catégories */
  getCategories:    (audience?: string) =>
    apiFetch<HelpCategory[]>(`/help/categories${audience ? `?audience=${audience}` : ''}`),
  getCategoryBySlug:(slug: string) =>
    apiFetch<HelpCategory & { articles: HelpArticle[] }>(`/help/categories/${slug}`),

  /* Articles */
  getArticles: (page = 1, limit = 20) =>
    apiFetch<{ data: HelpArticle[]; total: number; pages: number }>(`/help/articles?page=${page}&limit=${limit}`),
  getArticleBySlug:(slug: string) =>
    apiFetch<HelpArticle>(`/help/articles/${slug}`),
  getPopular: (limit = 8) =>
    apiFetch<HelpArticle[]>(`/help/popular?limit=${limit}`),
  submitFeedback: (slug: string, helpful: boolean) =>
    apiFetch(`/help/articles/${slug}/feedback`, { method: 'POST', body: JSON.stringify({ helpful }) }),

  /* Recherche */
  search: (q: string, page = 1, limit = 20) =>
    apiFetch<{ data: SearchResult[]; total: number; pages: number }>(`/help/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),

  /* FAQ */
  getFaq:            ()           => apiFetch<{ slug: string; faqs: HelpFaqItem[] }[]>('/help/faq'),
  getFaqByCategory:  (slug: string) => apiFetch<HelpFaqItem[]>(`/help/faq/${slug}`),
};
