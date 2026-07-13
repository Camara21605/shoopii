import { useState, useEffect } from 'react';
import { helpApi } from '../services/help.api';
import type { HelpCategory, HelpArticle } from '../services/help.api';

export function useHelpHome() {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [popular,    setPopular]    = useState<HelpArticle[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([helpApi.getCategories(), helpApi.getPopular(8)])
      .then(([cats, pop]) => {
        if (cancelled) return;
        setCategories(cats);
        setPopular(pop);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger le centre d\'aide.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { categories, popular, loading, error };
}

export function useHelpCategory(slug: string) {
  const [data,    setData]    = useState<(HelpCategory & { articles: HelpArticle[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);

    helpApi.getCategoryBySlug(slug)
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError('Catégorie introuvable.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [slug]);

  return { data, loading, error };
}

export function useHelpArticle(slug: string) {
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'helpful' | 'not' | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);

    helpApi.getArticleBySlug(slug)
      .then(a => { if (!cancelled) setArticle(a); })
      .catch(() => { if (!cancelled) setError('Article introuvable.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [slug]);

  async function submitFeedback(helpful: boolean) {
    if (feedback || !slug) return;
    try {
      await helpApi.submitFeedback(slug, helpful);
      setFeedback(helpful ? 'helpful' : 'not');
    } catch { /* silencieux */ }
  }

  return { article, loading, error, feedback, submitFeedback };
}

export function useHelpFaq() {
  const [faq,     setFaq]     = useState<{ slug: string; faqs: any[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    helpApi.getFaq()
      .then(setFaq)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { faq, loading };
}
