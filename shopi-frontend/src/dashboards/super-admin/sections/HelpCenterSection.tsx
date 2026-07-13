/* ============================================================
 * FICHIER : src/dashboards/super-admin/sections/HelpCenterSection.tsx
 *
 * RÔLE :
 *   Interface d'administration complète du Centre d'aide Shopi.
 *   Permet aux super-admins de gérer :
 *
 *   ① Articles  — créer, modifier, publier, archiver, supprimer
 *   ② Catégories — créer, modifier, désactiver
 *   ③ FAQ        — créer, modifier, supprimer
 *   ④ Analytiques — articles les plus consultés + requêtes sans résultat
 *
 * API utilisées (toutes : GET/POST/PATCH/DELETE /admin/help/*) :
 *   - /admin/help/categories
 *   - /admin/help/articles
 *   - /admin/help/faq
 *   - /admin/help/analytics
 *
 * THÈME :
 *   Variables CSS de super-admin.css (--surface, --raised, etc.)
 * ============================================================ */

import React, {
  useEffect, useState, useCallback, useRef,
} from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';
import s from './HelpCenterSection.module.css';

// ─────────────────────────────────────────────────────────────
// 1. Types (miroir des entités backend)
// ─────────────────────────────────────────────────────────────

type ArticleStatus = 'draft' | 'published' | 'archived';

interface HelpCategory {
  id:           string;
  slug:         string;
  name:         string;
  icon:         string | null;
  displayOrder: number;
  articleCount: number;
  isActive:     boolean;
}

interface HelpArticle {
  id:          string;
  slug:        string;
  title:       string;
  excerpt:     string | null;
  status:      ArticleStatus;
  viewCount:   number;
  categoryId:  string | null;
  publishedAt: string | null;
  createdAt:   string;
}

interface HelpFaqItem {
  id:           string;
  categorySlug: string;
  question:     string;
  isPublished:  boolean;
  displayOrder: number;
}

interface Analytics {
  topArticles:    { id: string; title: string; viewCount: number }[];
  zeroResultQueries: { query: string; count: number }[];
}

// ─────────────────────────────────────────────────────────────
// 2. Types d'onglets
// ─────────────────────────────────────────────────────────────

type Tab = 'articles' | 'categories' | 'faq' | 'analytics';

// ─────────────────────────────────────────────────────────────
// 3. Composant Modal générique (éditeur)
// ─────────────────────────────────────────────────────────────

interface ModalProps {
  title:    string;
  onClose:  () => void;
  onSave:   () => void;
  saving:   boolean;
  children: React.ReactNode;
}

function Modal({ title, onClose, onSave, saving, children }: ModalProps) {
  /* Fermeture au clic sur le backdrop */
  const backdropRef = useRef<HTMLDivElement>(null);
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };
  return (
    <div className={s.modalBackdrop} ref={backdropRef} onClick={handleBackdrop}>
      <div className={s.modal}>
        <div className={s.modalHeader}>
          <div className={s.modalTitle}>{title}</div>
          <button className={s.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={s.modalBody}>{children}</div>
        <div className={s.modalFooter}>
          <button className={s.btnSecondary} onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button className={s.btnPrimary} onClick={onSave} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Composant Articles
// ─────────────────────────────────────────────────────────────

interface ArticlesTabProps {
  categories: HelpCategory[];
  toast:      (msg: string, type?: 'ok' | 'err') => void;
}

function ArticlesTab({ categories, toast }: ArticlesTabProps) {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [statusF,  setStatusF]  = useState('');

  /* État du modal d'édition — null = fermé */
  const [editing, setEditing] = useState<Partial<HelpArticle & {
    content:   string;
    answer:    string;
    audience:  string;
  }> | null>(null);
  const [saving, setSaving] = useState(false);

  /* Formulaire du modal */
  const [form, setForm] = useState({
    slug:       '',
    title:      '',
    excerpt:    '',
    content:    '',
    categoryId: '',
    audience:   '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: HelpArticle[]; total: number }>(
        '/admin/help/articles?page=1&limit=100'
      );
      setArticles(res.data ?? []);
    } catch {
      toast('Erreur lors du chargement des articles', 'err');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  /* Ouvrir le modal pour créer */
  const openCreate = () => {
    setForm({ slug: '', title: '', excerpt: '', content: '', categoryId: '', audience: '' });
    setEditing({});
  };

  /* Ouvrir le modal pour modifier */
  const openEdit = async (article: HelpArticle) => {
    try {
      /* Charger le contenu complet de l'article (excerpt + content non renvoyés en liste) */
      const full = await apiFetch<HelpArticle & { content: string }>(`/help/articles/${article.slug}`);
      setForm({
        slug:       full.slug,
        title:      full.title,
        excerpt:    full.excerpt ?? '',
        content:    full.content ?? '',
        categoryId: full.categoryId ?? '',
        audience:   '',
      });
      setEditing(article);
    } catch {
      toast('Impossible de charger cet article', 'err');
    }
  };

  /* Sauvegarder (créer ou modifier) */
  const handleSave = async () => {
    if (!form.title || !form.slug || !form.content) {
      toast('Titre, slug et contenu sont obligatoires', 'err');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug:       form.slug,
        title:      form.title,
        excerpt:    form.excerpt || undefined,
        content:    form.content,
        categoryId: form.categoryId || undefined,
        audience:   form.audience ? form.audience.split(',').map(a => a.trim()) : undefined,
      };

      if (editing?.id) {
        await apiFetch(`/admin/help/articles/${editing.id}`, {
          method: 'PATCH', body: payload,
        });
        toast('Article modifié ✓');
      } else {
        await apiFetch('/admin/help/articles', {
          method: 'POST', body: payload,
        });
        toast('Article créé ✓');
      }
      setEditing(null);
      load();
    } catch (err: any) {
      toast(err?.message ?? 'Erreur lors de la sauvegarde', 'err');
    } finally {
      setSaving(false);
    }
  };

  /* Publier un article */
  const publish = async (id: string) => {
    try {
      await apiFetch(`/admin/help/articles/${id}/publish`, { method: 'PATCH' });
      toast('Article publié ✓');
      load();
    } catch { toast('Erreur lors de la publication', 'err'); }
  };

  /* Archiver un article */
  const archive = async (id: string) => {
    if (!confirm('Archiver cet article ?')) return;
    try {
      await apiFetch(`/admin/help/articles/${id}/archive`, { method: 'PATCH' });
      toast('Article archivé');
      load();
    } catch { toast('Erreur lors de l\'archivage', 'err'); }
  };

  /* Supprimer un article */
  const remove = async (id: string, title: string) => {
    if (!confirm(`Supprimer "${title}" définitivement ?`)) return;
    try {
      await apiFetch(`/admin/help/articles/${id}`, { method: 'DELETE' });
      toast('Article supprimé');
      load();
    } catch { toast('Erreur lors de la suppression', 'err'); }
  };

  /* Filtrage local */
  const filtered = articles.filter(a => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusF || a.status === statusF;
    return matchSearch && matchStatus;
  });

  /* Libellé de statut */
  const statusLabel: Record<ArticleStatus, string> = {
    draft:     'Brouillon',
    published: 'Publié',
    archived:  'Archivé',
  };

  const badgeCls: Record<ArticleStatus, string> = {
    draft:     s.badgeDraft,
    published: s.badgePublished,
    archived:  s.badgeArchived,
  };

  return (
    <>
      {/* ── Barre d'outils ── */}
      <div className={s.toolbar}>
        <input
          className={s.search}
          placeholder="Rechercher un article…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={s.filterSelect} value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          <option value="draft">Brouillons</option>
          <option value="published">Publiés</option>
          <option value="archived">Archivés</option>
        </select>
        <select className={s.filterSelect} defaultValue="">
          <option value="">Toutes catégories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className={s.btnPrimary} onClick={openCreate}>+ Nouvel article</button>
      </div>

      {/* ── Liste ── */}
      {loading && <div className={s.loading}>Chargement…</div>}
      {!loading && filtered.length === 0 && (
        <div className={s.empty}>Aucun article trouvé</div>
      )}
      <div className={s.grid}>
        {filtered.map(a => (
          <div key={a.id} className={s.row}>
            <div className={s.rowLeft}>
              <div className={s.rowTitle}>{a.title}</div>
              <div className={s.rowMeta}>
                <span className={`${s.badge} ${badgeCls[a.status]}`}>
                  {statusLabel[a.status]}
                </span>
                <span>👁 {a.viewCount}</span>
                <span>{a.slug}</span>
                {a.publishedAt && (
                  <span>Publié le {new Date(a.publishedAt).toLocaleDateString('fr-FR')}</span>
                )}
              </div>
            </div>
            <div className={s.rowActions}>
              {/* Modifier */}
              <button className={s.iconBtn} title="Modifier" onClick={() => openEdit(a)}>✏️</button>
              {/* Publier (si brouillon) */}
              {a.status === 'draft' && (
                <button
                  className={`${s.iconBtn} ${s.iconBtnGreen}`}
                  title="Publier"
                  onClick={() => publish(a.id)}
                >✅</button>
              )}
              {/* Archiver (si publié) */}
              {a.status === 'published' && (
                <button
                  className={`${s.iconBtn} ${s.iconBtnDanger}`}
                  title="Archiver"
                  onClick={() => archive(a.id)}
                >📦</button>
              )}
              {/* Supprimer */}
              <button
                className={`${s.iconBtn} ${s.iconBtnDanger}`}
                title="Supprimer"
                onClick={() => remove(a.id, a.title)}
              >🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modal édition article ── */}
      {editing !== null && (
        <Modal
          title={editing.id ? 'Modifier l\'article' : 'Nouvel article'}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          saving={saving}
        >
          <div className={s.field}>
            <label className={s.label}>Titre *</label>
            <input
              className={s.input}
              placeholder="Titre de l'article"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className={s.field}>
            <label className={s.label}>Slug * (URL)</label>
            <input
              className={s.input}
              placeholder="comment-creer-un-compte"
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
            />
          </div>
          <div className={s.field}>
            <label className={s.label}>Catégorie</label>
            <select
              className={s.select}
              value={form.categoryId}
              onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">— Aucune catégorie —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className={s.field}>
            <label className={s.label}>Résumé (excerpt)</label>
            <input
              className={s.input}
              placeholder="Courte description affichée dans les listes"
              value={form.excerpt}
              onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
            />
          </div>
          <div className={s.field}>
            <label className={s.label}>Contenu (Markdown) *</label>
            <textarea
              className={s.textarea}
              placeholder="# Titre&#10;&#10;Contenu en Markdown…"
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            />
          </div>
          <div className={s.field}>
            <label className={s.label}>Audience (séparée par virgules)</label>
            <input
              className={s.input}
              placeholder="client, company, delivery"
              value={form.audience}
              onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
            />
          </div>
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. Composant Catégories
// ─────────────────────────────────────────────────────────────

interface CategoriesTabProps {
  categories: HelpCategory[];
  onReload:   () => void;
  toast:      (msg: string, type?: 'ok' | 'err') => void;
}

function CategoriesTab({ categories, onReload, toast }: CategoriesTabProps) {
  const [editing, setEditing] = useState<HelpCategory | null | 'new'>(null);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState({
    slug: '', name: '', description: '', icon: '', displayOrder: '0',
  });

  const openCreate = () => {
    setForm({ slug: '', name: '', description: '', icon: '', displayOrder: '0' });
    setEditing('new');
  };

  const openEdit = (cat: HelpCategory) => {
    setForm({
      slug:         cat.slug,
      name:         cat.name,
      description:  '',
      icon:         cat.icon ?? '',
      displayOrder: String(cat.displayOrder),
    });
    setEditing(cat);
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) { toast('Nom et slug obligatoires', 'err'); return; }
    setSaving(true);
    try {
      const payload = {
        slug:         form.slug,
        name:         form.name,
        description:  form.description || undefined,
        icon:         form.icon || undefined,
        displayOrder: parseInt(form.displayOrder, 10) || 0,
      };
      if (editing === 'new') {
        await apiFetch('/admin/help/categories', { method: 'POST', body: payload });
        toast('Catégorie créée ✓');
      } else if (editing) {
        await apiFetch(`/admin/help/categories/${editing.id}`, {
          method: 'PATCH', body: payload,
        });
        toast('Catégorie modifiée ✓');
      }
      setEditing(null);
      onReload();
    } catch (err: any) {
      toast(err?.message ?? 'Erreur', 'err');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (cat: HelpCategory) => {
    if (!confirm(`Désactiver "${cat.name}" ?`)) return;
    try {
      await apiFetch(`/admin/help/categories/${cat.id}`, { method: 'DELETE' });
      toast('Catégorie désactivée');
      onReload();
    } catch { toast('Erreur lors de la désactivation', 'err'); }
  };

  return (
    <>
      <div className={s.toolbar}>
        <button className={s.btnPrimary} onClick={openCreate}>+ Nouvelle catégorie</button>
      </div>

      <div className={s.grid}>
        {categories.length === 0 && <div className={s.empty}>Aucune catégorie</div>}
        {categories.map(cat => (
          <div key={cat.id} className={s.row}>
            <div className={s.rowLeft}>
              <div className={s.rowTitle}>
                {cat.icon && <span style={{ marginRight: 8 }}>{cat.icon}</span>}
                {cat.name}
              </div>
              <div className={s.rowMeta}>
                <span className={`${s.badge} ${cat.isActive ? s.badgeActive : s.badgeInactive}`}>
                  {cat.isActive ? 'Active' : 'Inactive'}
                </span>
                <span>{cat.articleCount} article{cat.articleCount > 1 ? 's' : ''}</span>
                <span>{cat.slug}</span>
                <span>Ordre : {cat.displayOrder}</span>
              </div>
            </div>
            <div className={s.rowActions}>
              <button className={s.iconBtn} title="Modifier" onClick={() => openEdit(cat)}>✏️</button>
              <button
                className={`${s.iconBtn} ${s.iconBtnDanger}`}
                title="Désactiver"
                onClick={() => deactivate(cat)}
              >🚫</button>
            </div>
          </div>
        ))}
      </div>

      {editing !== null && (
        <Modal
          title={editing === 'new' ? 'Nouvelle catégorie' : 'Modifier la catégorie'}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          saving={saving}
        >
          <div className={s.field}>
            <label className={s.label}>Slug * (URL)</label>
            <input className={s.input} placeholder="aide-commandes" value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Nom *</label>
            <input className={s.input} placeholder="Commandes et paiements" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Description</label>
            <input className={s.input} placeholder="Description courte" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Icône (emoji)</label>
            <input className={s.input} placeholder="📦" value={form.icon}
              onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Ordre d'affichage</label>
            <input className={s.input} type="number" min="0" value={form.displayOrder}
              onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} />
          </div>
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. Composant FAQ
// ─────────────────────────────────────────────────────────────

interface FaqTabProps {
  categories: HelpCategory[];
  toast:      (msg: string, type?: 'ok' | 'err') => void;
}

function FaqTab({ categories, toast }: FaqTabProps) {
  const [faqItems, setFaqItems] = useState<HelpFaqItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState<HelpFaqItem | null | 'new'>(null);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({
    categorySlug: '', question: '', answer: '', displayOrder: '0',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<HelpFaqItem[]>('/admin/help/faq');
      setFaqItems(data ?? []);
    } catch { toast('Erreur chargement FAQ', 'err'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ categorySlug: '', question: '', answer: '', displayOrder: '0' });
    setEditing('new');
  };

  const openEdit = (item: HelpFaqItem) => {
    setForm({
      categorySlug: item.categorySlug,
      question:     item.question,
      answer:       '',
      displayOrder: String(item.displayOrder),
    });
    setEditing(item);
  };

  const handleSave = async () => {
    if (!form.question || !form.categorySlug) {
      toast('Question et catégorie obligatoires', 'err'); return;
    }
    setSaving(true);
    try {
      const payload = {
        categorySlug: form.categorySlug,
        question:     form.question,
        answer:       form.answer || '(à compléter)',
        displayOrder: parseInt(form.displayOrder, 10) || 0,
      };
      if (editing === 'new') {
        await apiFetch('/admin/help/faq', { method: 'POST', body: payload });
        toast('FAQ créée ✓');
      } else if (editing) {
        await apiFetch(`/admin/help/faq/${editing.id}`, {
          method: 'PATCH', body: payload,
        });
        toast('FAQ modifiée ✓');
      }
      setEditing(null);
      load();
    } catch (err: any) {
      toast(err?.message ?? 'Erreur', 'err');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, question: string) => {
    if (!confirm(`Supprimer "${question.slice(0, 60)}…" ?`)) return;
    try {
      await apiFetch(`/admin/help/faq/${id}`, { method: 'DELETE' });
      toast('FAQ supprimée');
      load();
    } catch { toast('Erreur lors de la suppression', 'err'); }
  };

  return (
    <>
      <div className={s.toolbar}>
        <button className={s.btnPrimary} onClick={openCreate}>+ Nouvelle FAQ</button>
      </div>

      {loading && <div className={s.loading}>Chargement…</div>}
      {!loading && faqItems.length === 0 && <div className={s.empty}>Aucune FAQ</div>}

      <div className={s.grid}>
        {faqItems.map(item => (
          <div key={item.id} className={s.row}>
            <div className={s.rowLeft}>
              <div className={s.rowTitle}>{item.question}</div>
              <div className={s.rowMeta}>
                <span className={`${s.badge} ${item.isPublished ? s.badgePublished : s.badgeDraft}`}>
                  {item.isPublished ? 'Publiée' : 'Brouillon'}
                </span>
                <span>{item.categorySlug}</span>
                <span>Ordre : {item.displayOrder}</span>
              </div>
            </div>
            <div className={s.rowActions}>
              <button className={s.iconBtn} title="Modifier" onClick={() => openEdit(item)}>✏️</button>
              <button
                className={`${s.iconBtn} ${s.iconBtnDanger}`}
                title="Supprimer"
                onClick={() => remove(item.id, item.question)}
              >🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {editing !== null && (
        <Modal
          title={editing === 'new' ? 'Nouvelle question FAQ' : 'Modifier la FAQ'}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          saving={saving}
        >
          <div className={s.field}>
            <label className={s.label}>Catégorie *</label>
            <select className={s.select} value={form.categorySlug}
              onChange={e => setForm(f => ({ ...f, categorySlug: e.target.value }))}>
              <option value="">— Choisir une catégorie —</option>
              {categories.map(c => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className={s.field}>
            <label className={s.label}>Question *</label>
            <input className={s.input} placeholder="Comment…?" value={form.question}
              onChange={e => setForm(f => ({ ...f, question: e.target.value }))} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Réponse</label>
            <textarea className={s.textarea} placeholder="Réponse complète…" value={form.answer}
              onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Ordre d'affichage</label>
            <input className={s.input} type="number" min="0" value={form.displayOrder}
              onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} />
          </div>
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. Composant Analytiques
// ─────────────────────────────────────────────────────────────

function AnalyticsTab({ toast }: { toast: (msg: string, type?: 'ok' | 'err') => void }) {
  const [data,    setData]    = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Analytics>('/admin/help/analytics')
      .then(setData)
      .catch(() => toast('Erreur chargement analytiques', 'err'))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <div className={s.loading}>Chargement…</div>;
  if (!data)   return <div className={s.error}>Erreur de chargement</div>;

  return (
    <div className={s.analyticsGrid}>
      {/* ── Top articles consultés ── */}
      <div className={s.analyticsCard}>
        <div className={s.analyticsCardTitle}>🔥 Articles les plus consultés</div>
        {data.topArticles.length === 0 && <div className={s.empty}>Aucune donnée</div>}
        {data.topArticles.map((a, i) => (
          <div key={a.id} className={s.analyticsRow}>
            <span style={{ color: 'var(--txt-3)', marginRight: 10, fontWeight: 700 }}>
              #{i + 1}
            </span>
            <span className={s.analyticsRowTitle}>{a.title}</span>
            <span className={s.analyticsRowVal}>👁 {a.viewCount}</span>
          </div>
        ))}
      </div>

      {/* ── Requêtes sans résultat (content gaps) ── */}
      <div className={s.analyticsCard}>
        <div className={s.analyticsCardTitle}>🔍 Requêtes sans résultat</div>
        <div style={{ fontSize: 12, color: 'var(--txt-3)', marginBottom: 12 }}>
          Ces recherches n'ont trouvé aucun article — créez du contenu pour les couvrir.
        </div>
        {data.zeroResultQueries.length === 0 && (
          <div className={s.empty}>Aucune lacune détectée 🎉</div>
        )}
        {data.zeroResultQueries.map((q, i) => (
          <div key={i} className={s.analyticsRow}>
            <span className={`${s.analyticsRowTitle} ${s.zeroQuery}`}>"{q.query}"</span>
            <span className={s.analyticsRowVal}>{q.count}×</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 8. Composant principal
// ─────────────────────────────────────────────────────────────

interface Props {
  /** Contrôle la visibilité — pattern .section + .active */
  isActive: boolean;
}

export default function HelpCenterSection({ isActive }: Props) {
  const [tab,        setTab]        = useState<Tab>('articles');
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [toastMsg,   setToastMsg]   = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

  /* Système de toast léger interne */
  const toast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  /* Charger les catégories au montage et à chaque reload demandé */
  const loadCategories = useCallback(async () => {
    try {
      const data = await apiFetch<HelpCategory[]>('/admin/help/categories');
      setCategories(data ?? []);
    } catch {
      toast('Erreur chargement catégories', 'err');
    }
  }, [toast]);

  useEffect(() => {
    if (isActive) loadCategories();
  }, [isActive, loadCategories]);

  /* Comptages pour les badges d'onglets */
  const activeCats = categories.filter(c => c.isActive).length;

  const TAB_CFG: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'articles',   label: 'Articles',   icon: '📄' },
    { id: 'categories', label: 'Catégories', icon: '📂', badge: activeCats },
    { id: 'faq',        label: 'FAQ',        icon: '❓' },
    { id: 'analytics',  label: 'Analytiques',icon: '📊' },
  ];

  return (
    <section className={`${s.section}${isActive ? ` ${s.active}` : ''}`}>

      {/* ── En-tête ── */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.title}>📚 Centre d'aide</div>
          <div className={s.subtitle}>
            Gérez les articles, catégories et FAQ de l'aide publique
          </div>
        </div>
        {/* Lien vers l'aide publique */}
        <a
          href="/aide"
          target="_blank"
          rel="noopener noreferrer"
          className={s.btnPrimary}
          style={{ textDecoration: 'none' }}
        >
          👁 Voir l'aide publique
        </a>
      </div>

      {/* ── Onglets ── */}
      <div className={s.tabs}>
        {TAB_CFG.map(t => (
          <button
            key={t.id}
            className={`${s.tab}${tab === t.id ? ` ${s.tabActive}` : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className={s.tabBadge}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Corps ── */}
      <div className={s.body}>
        {tab === 'articles' && (
          <ArticlesTab categories={categories} toast={toast} />
        )}
        {tab === 'categories' && (
          <CategoriesTab categories={categories} onReload={loadCategories} toast={toast} />
        )}
        {tab === 'faq' && (
          <FaqTab categories={categories} toast={toast} />
        )}
        {tab === 'analytics' && (
          <AnalyticsTab toast={toast} />
        )}
      </div>

      {/* ── Toast interne ── */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
          borderRadius: 10,
          background: toastMsg.type === 'ok' ? 'var(--acid)' : 'var(--rose)',
          color: toastMsg.type === 'ok' ? '#000' : '#fff',
          fontWeight: 700,
          fontSize: 13,
          zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          {toastMsg.text}
        </div>
      )}

    </section>
  );
}
