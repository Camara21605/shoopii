import { useState, useEffect, useRef } from 'react';
import { helpApi } from '../services/help.api';
import type { SearchResult } from '../services/help.api';

export function useHelpSearch(initialQ = '') {
  const [query,   setQuery]   = useState(initialQ);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      helpApi.search(query, page)
        .then(res => {
          setResults(res.data);
          setTotal(res.total);
          setPages(res.pages);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, page]);

  return { query, setQuery, results, total, pages, page, setPage, loading };
}
