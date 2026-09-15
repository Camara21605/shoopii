/*
 * ============================================================
 * FICHIER : src/dashboards/entreprise/pages/AjouterServicePage.tsx
 *
 * Miroir de AjouterPage.tsx pour les prestations de service — sans
 * sélecteur de mode (détaillé/gros/rapide), sans stock/dimensions/
 * livraison/vente en gros/variantes/stories : remplacés par ce qui a
 * du sens pour un service (tarification, durée, mode de prestation,
 * réservation/annulation, garanties). Voir service.entity.ts pour la
 * liste des champs et le "hors scope MVP".
 *
 * ✅ MODE CRÉATION : serviceId absent → formulaire vide
 * ✅ MODE ÉDITION  : serviceId fourni → données chargées depuis l'API
 *                    → bouton "Mettre à jour" → PATCH /prestations/:id
 * ============================================================
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../shared/context/ToastContext';
import type { EntreprisePage } from '../types';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface AjouterServicePageProps {
  onNavigate: (page: EntreprisePage, serviceId?: string) => void;
  serviceId?: string; // ✅ Si défini → mode ÉDITION, sinon mode CRÉATION
}

interface CategorieApi {
  id:            string;
  nom:           string;
  subCategories: { id: string; nom: string }[];
}

interface MediaUploaded {
  url:     string;
  ordre:   number;
  alt:     string | null;
  preview: string;
  type:    'image' | 'video';
}

/* Quota médias d'une fiche service : 4 images + 1 vidéo max (5 au total) — voir prestations.service.ts */
const MAX_MEDIA_TOTAL  = 5;
const MAX_MEDIA_IMAGES = 4;
const MAX_MEDIA_VIDEOS = 1;

interface Spec { cle: string; valeur: string; }

interface FormErrors {
  nom?:         string;
  prix?:        string;
  categorieId?: string;
  general?:     string;
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

function getToken(): string {
  return localStorage.getItem('shopi_access_token') ?? '';
}

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError &&
    (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed'));
}

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANTS
// ─────────────────────────────────────────────────────────────

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div style={{
      background: 'var(--rs-bg)', border: '1.5px solid rgba(220,38,38,.3)',
      borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: 20,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>❌</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)', marginBottom: 3 }}>
          {t('ajouterService.actions.fixErrorsTitle')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--red)', opacity: 0.85, lineHeight: 1.5 }}>
          {message}
        </div>
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16, padding: 0, flexShrink: 0 }}>
        <i className="fas fa-xmark" />
      </button>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--red)', fontSize: 11.5, marginTop: 5, fontWeight: 600 }}>
      <i className="fas fa-circle-exclamation" style={{ fontSize: 11 }} />
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VALEUR INITIALE DU FORMULAIRE
// ─────────────────────────────────────────────────────────────

const FORM_INITIAL = {
  nom: '', description: '', tags: '',
  categorieId: '', categorie: '', sousCatId: '', sousCat: '',
  visibilite: 'public', langue: 'fr',
  pricingType: 'fixe' as 'fixe' | 'horaire' | 'sur_devis',
  prix: '', prixAncien: '',
  dureeMinMinutes: '', dureeMaxMinutes: '', capaciteMax: '',
  surPlaceEntreprise: true, aDomicile: false, aDistance: false,
  zoneCouverture: '', fraisDeplacement: '',
  reservationRequise: true,
  delaiReponse: '24h' as 'immediate' | '24h' | '48h' | '7j',
  politiqueAnnulation: 'moderee' as 'flexible' | 'moderee' | 'stricte' | 'non_remboursable',
  garantiePaiement: true, garantieSatisfaction: true,
  titreSeo: '', descriptionSeo: '', urlSlug: '',
};

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function AjouterServicePage({ onNavigate, serviceId }: AjouterServicePageProps) {
  const { t } = useTranslation();
  const { pop } = useToast();

  const isEditMode = !!serviceId;

  const [errors,      setErrors]      = useState<FormErrors>({});
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [loadingSvc,  setLoadingSvc]  = useState(false);

  const [commissionPct, setCommissionPct] = useState<number>(3);

  const [categoriesApi,  setCategoriesApi]  = useState<CategorieApi[]>([]);
  const [chargementCats, setChargementCats] = useState(true);
  const [erreurCats,     setErreurCats]     = useState<string | null>(null);

  const [form,  setForm]  = useState({ ...FORM_INITIAL });
  const [media, setMedia] = useState<MediaUploaded[]>([]);
  const [specs, setSpecs] = useState<Spec[]>([
    { cle: t('ajouterService.specs.defaultInclus1'), valeur: '' },
    { cle: t('ajouterService.specs.defaultInclus2'), valeur: '' },
  ]);

  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [enChargement,  setEnChargement]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Taux de commission plateforme ──────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/dashboard/entreprise/commission-rate`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { percentage: number } | null) => {
        if (data?.percentage != null) setCommissionPct(data.percentage);
      })
      .catch(() => {});
  }, []);

  // ── Publication automatique (Paramètres > Catalogue) — création uniquement ──
  useEffect(() => {
    if (isEditMode) return;
    fetch(`${API}/dashboard/entreprise/parametres`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { autoPublish?: boolean } | null) => {
        if (!data) return;
        setForm(f => ({ ...f, visibilite: data.autoPublish === false ? 'draft' : f.visibilite }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Catégories ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/prestations/categories`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => {
        if (!r.ok) {
          if (r.status === 401) throw new Error(t('ajouterService.toasts.sessionExpiredReconnect'));
          throw new Error(t('ajouterService.toasts.categoriesServerError', { status: r.status }));
        }
        return r.json();
      })
      .then((data: CategorieApi[]) => {
        if (!Array.isArray(data)) throw new Error(t('ajouterService.toasts.unexpectedFormat'));
        setCategoriesApi(data);
        if (!isEditMode && data.length > 0) {
          setForm(prev => ({ ...prev, categorieId: data[0].id, categorie: data[0].nom }));
        }
      })
      .catch(err => {
        const msg = isNetworkError(err) ? t('ajouterService.toasts.networkErrorBackend') : err.message;
        setErreurCats(msg);
        pop(`⚠️ ${msg}`, 'e');
      })
      .finally(() => setChargementCats(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mode édition : charge le service existant ───────────────────────────
  useEffect(() => {
    if (!serviceId) {
      setForm({ ...FORM_INITIAL });
      setMedia([]);
      setSpecs([
        { cle: t('ajouterService.specs.defaultInclus1'), valeur: '' },
        { cle: t('ajouterService.specs.defaultInclus2'), valeur: '' },
      ]);
      return;
    }

    setLoadingSvc(true);
    fetch(`${API}/prestations/${serviceId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(t('ajouterService.toasts.serviceLoadServerError', { status: r.status }));
        return r.json();
      })
      .then(s => {
        setForm({
          nom:          s.nom              ?? '',
          description:  s.description      ?? '',
          tags:         s.tags             ?? '',
          categorieId:  s.category?.id     ?? '',
          categorie:    s.category?.nom    ?? '',
          sousCatId:    s.subCategory?.id  ?? '',
          sousCat:      s.subCategory?.nom ?? '',
          visibilite:   s.visibilite       ?? 'draft',
          langue:       s.langue           ?? 'fr',
          pricingType:  s.pricingType      ?? 'fixe',
          prix:         s.prix != null ? String(s.prix) : '',
          prixAncien:   s.prixAncien != null ? String(s.prixAncien) : '',
          dureeMinMinutes: s.dureeMinMinutes != null ? String(s.dureeMinMinutes) : '',
          dureeMaxMinutes: s.dureeMaxMinutes != null ? String(s.dureeMaxMinutes) : '',
          capaciteMax:     s.capaciteMax     != null ? String(s.capaciteMax)     : '',
          surPlaceEntreprise: s.surPlaceEntreprise ?? true,
          aDomicile:          s.aDomicile          ?? false,
          aDistance:          s.aDistance          ?? false,
          zoneCouverture:      s.zoneCouverture      ?? '',
          fraisDeplacement:    s.fraisDeplacement != null ? String(s.fraisDeplacement) : '',
          reservationRequise:  s.reservationRequise  ?? true,
          delaiReponse:        s.delaiReponse        ?? '24h',
          politiqueAnnulation: s.politiqueAnnulation ?? 'moderee',
          garantiePaiement:     s.garantiePaiement     ?? true,
          garantieSatisfaction: s.garantieSatisfaction ?? true,
          titreSeo:       s.titreSeo       ?? '',
          descriptionSeo: s.descriptionSeo ?? '',
          urlSlug:        s.urlSlug        ?? '',
        });

        if (s.media?.length) {
          setMedia(s.media.map((m: any) => ({
            url: m.url, ordre: m.ordre, alt: m.alt ?? null, preview: m.url,
            type: m.type === 'video' ? 'video' : 'image',
          })));
        }
        if (s.specs?.length) {
          setSpecs(s.specs.map((sp: any) => ({ cle: sp.cle, valeur: sp.valeur })));
        }

        pop(t('ajouterService.toasts.serviceDataLoaded'), 'i');
      })
      .catch(err => {
        pop(t('ajouterService.toasts.serviceLoadError', { message: err.message }), 'e');
        setErrorBanner(err.message);
      })
      .finally(() => setLoadingSvc(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key in errors) {
      setErrors(prev => { const n = { ...prev }; delete n[key as keyof FormErrors]; return n; });
    }
  }

  function handleChangerCategorie(categorieId: string) {
    const cat = categoriesApi.find(c => c.id === categorieId);
    setForm(prev => ({ ...prev, categorieId, categorie: cat?.nom ?? '', sousCatId: '', sousCat: '' }));
    setErrors(prev => { const n = { ...prev }; delete n.categorieId; return n; });
  }

  function handleChangerSousCat(sousCatId: string) {
    const cat    = categoriesApi.find(c => c.id === form.categorieId);
    const subCat = cat?.subCategories.find(s => s.id === sousCatId);
    setForm(prev => ({ ...prev, sousCatId, sousCat: subCat?.nom ?? '' }));
  }

  function validateForm(): boolean {
    const e: FormErrors = {};
    if (!form.nom.trim())                    e.nom = t('ajouterService.validation.nomRequired');
    else if (form.nom.trim().length < 3)     e.nom = t('ajouterService.validation.nomMinLength');
    if (form.pricingType !== 'sur_devis') {
      if (!form.prix.trim())                                               e.prix = t('ajouterService.validation.prixRequired');
      else if (isNaN(parseFloat(form.prix)) || parseFloat(form.prix) <= 0) e.prix = t('ajouterService.validation.prixPositive');
    }
    if (!form.categorieId) e.categorieId = t('ajouterService.validation.categorieRequired');
    setErrors(e);
    if (Object.keys(e).length > 0) {
      pop(t('ajouterService.validation.fixErrors'), 'w');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // UPLOAD MÉDIAS — réutilise /upload/image/product et /upload/video
  // (dossiers Cloudinary génériques, aucun endpoint dédié service).
  // ─────────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    let videoCount = media.filter(m => m.type === 'video').length;
    let imageCount = media.length - videoCount;
    const placesRestantes = MAX_MEDIA_TOTAL - media.length;
    if (placesRestantes <= 0) { pop(t('ajouterService.toasts.maxMedia', { count: MAX_MEDIA_TOTAL }), 'w'); return; }

    const aUploader: File[] = [];
    for (const file of files) {
      if (aUploader.length >= placesRestantes) { pop(t('ajouterService.toasts.maxMediaRestIgnored', { count: MAX_MEDIA_TOTAL }), 'w'); break; }
      const estVideo = file.type.startsWith('video/');
      if (estVideo) {
        if (videoCount >= MAX_MEDIA_VIDEOS) { pop(t('ajouterService.toasts.maxVideo', { count: MAX_MEDIA_VIDEOS, name: file.name }), 'w'); continue; }
        videoCount++;
      } else {
        if (imageCount >= MAX_MEDIA_IMAGES) { pop(t('ajouterService.toasts.maxImages', { count: MAX_MEDIA_IMAGES, name: file.name }), 'w'); continue; }
        imageCount++;
      }
      aUploader.push(file);
    }
    if (!aUploader.length) return;

    setUploadEnCours(true);
    try {
      const nouveaux: MediaUploaded[] = [];
      for (const file of aUploader) {
        const estVideo = file.type.startsWith('video/');
        const maxSize  = estVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > maxSize) {
          pop(t('ajouterService.toasts.fileTooLarge', { name: file.name, max: estVideo ? '50 MB' : '5 MB' }), 'w');
          continue;
        }
        const preview  = URL.createObjectURL(file);
        const formData = new FormData();
        formData.append('file', file);
        let res: Response;
        try {
          res = await fetch(`${API}/upload/${estVideo ? 'video' : 'image/product'}`, {
            method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: formData,
          });
        } catch { throw new Error(t('ajouterService.toasts.networkError')); }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(res.status === 401 ? t('ajouterService.toasts.sessionExpired') : errData.message ?? `Erreur ${res.status}`);
        }
        const data: { url: string } = await res.json();
        nouveaux.push({ url: data.url, ordre: media.length + nouveaux.length, alt: null, preview, type: estVideo ? 'video' : 'image' });
      }
      if (nouveaux.length) {
        setMedia(prev => [...prev, ...nouveaux]);
        pop(t('ajouterService.toasts.mediaUploaded', { count: nouveaux.length }), 's');
      }
    } catch (err: any) {
      setErrorBanner(err.message);
      pop(`❌ ${err.message}`, 'e');
    } finally {
      setUploadEnCours(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function supprimerMedia(index: number) {
    setMedia(prev => {
      if (prev[index].preview.startsWith('blob:')) URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index).map((m, i) => ({ ...m, ordre: i }));
    });
  }

  function addSpec()    { setSpecs(prev => [...prev, { cle: '', valeur: '' }]); }
  function removeSpec(i: number) { setSpecs(prev => prev.filter((_, idx) => idx !== i)); }
  function updateSpec(i: number, k: keyof Spec, v: string) { setSpecs(prev => prev.map((x, idx) => idx === i ? { ...x, [k]: v } : x)); }

  // ─────────────────────────────────────────────────────────────
  // SCORE SEO
  // ─────────────────────────────────────────────────────────────

  const seoScore = useMemo(() => {
    const criteres = [
      { label: t('ajouterService.seo.criteres.nom'),           ok: form.nom.trim().length > 5 },
      { label: t('ajouterService.seo.criteres.description'),   ok: form.description.trim().length > 100 },
      { label: t('ajouterService.seo.criteres.titreSeo'),      ok: form.titreSeo.trim().length > 0 },
      { label: t('ajouterService.seo.criteres.descriptionSeo'), ok: form.descriptionSeo.trim().length > 0 },
      { label: t('ajouterService.seo.criteres.urlSlug'),       ok: form.urlSlug.trim().length > 0 },
      { label: t('ajouterService.seo.criteres.tags'),          ok: form.tags.trim().length > 0 },
      { label: t('ajouterService.seo.criteres.image'),         ok: media.length > 0 },
      { label: t('ajouterService.seo.criteres.prix'),          ok: form.pricingType === 'sur_devis' || form.prix.trim().length > 0 },
    ];
    return { score: Math.round((criteres.filter(c => c.ok).length / criteres.length) * 100), criteres };
  }, [form, media, t]);

  // ─────────────────────────────────────────────────────────────
  // SOUMISSION
  // ─────────────────────────────────────────────────────────────

  async function handlePublish(draft = false) {
    if (!validateForm()) return;
    setEnChargement(true);
    setErrorBanner(null);

    try {
      const dto = {
        nom:         form.nom.trim(),
        description: form.description.trim() || undefined,
        tags:        form.tags.trim()         || undefined,
        categoryId:    form.categorieId,
        subCategoryId: form.sousCatId || undefined,
        pricingType: form.pricingType,
        prix:       form.pricingType !== 'sur_devis' ? parseFloat(form.prix) : undefined,
        prixAncien: form.prixAncien ? parseFloat(form.prixAncien) : undefined,
        dureeMinMinutes: form.dureeMinMinutes ? parseInt(form.dureeMinMinutes) : undefined,
        dureeMaxMinutes: form.dureeMaxMinutes ? parseInt(form.dureeMaxMinutes) : undefined,
        capaciteMax:     form.capaciteMax     ? parseInt(form.capaciteMax)     : undefined,
        surPlaceEntreprise: form.surPlaceEntreprise,
        aDomicile:          form.aDomicile,
        aDistance:          form.aDistance,
        zoneCouverture:   form.aDomicile && form.zoneCouverture.trim() ? form.zoneCouverture.trim() : undefined,
        fraisDeplacement: form.aDomicile && form.fraisDeplacement ? parseInt(form.fraisDeplacement) : undefined,
        reservationRequise:  form.reservationRequise,
        delaiReponse:        form.delaiReponse,
        politiqueAnnulation: form.politiqueAnnulation,
        garantiePaiement:     form.garantiePaiement,
        garantieSatisfaction: form.garantieSatisfaction,
        visibilite: draft ? 'draft' : form.visibilite,
        langue:     form.langue,
        titreSeo:       form.titreSeo.trim()       || undefined,
        descriptionSeo: form.descriptionSeo.trim() || undefined,
        urlSlug:        form.urlSlug.trim()         || undefined,
        media: media.map(m => ({ url: m.url, ordre: m.ordre, alt: m.alt, type: m.type })),
        specs: specs.filter(s => s.cle.trim() && s.valeur.trim()).map((s, idx) => ({ ...s, ordre: idx })),
      };

      let res: Response;
      try {
        res = await fetch(
          isEditMode ? `${API}/prestations/${serviceId}` : `${API}/prestations`,
          {
            method:  isEditMode ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify(dto),
          },
        );
      } catch {
        throw new Error(t('ajouterService.toasts.networkErrorNest'));
      }

      if (!res.ok) {
        let errorMessage = t('ajouterService.toasts.serverErrorGeneric', { status: res.status });
        try {
          const errData = await res.json();
          if      (res.status === 401) errorMessage = t('ajouterService.toasts.sessionExpiredFull');
          else if (res.status === 403) errorMessage = t('ajouterService.toasts.forbidden');
          else if (res.status === 400) {
            errorMessage = Array.isArray(errData.message)
              ? '• ' + errData.message.join('\n• ')
              : errData.message ?? errorMessage;
          }
          else if (res.status === 409) errorMessage = errData.message ?? t('ajouterService.toasts.slugTaken');
          else if (res.status === 500) errorMessage = t('ajouterService.toasts.serverError500');
          else                         errorMessage = errData.message ?? errorMessage;
        } catch { /* body non JSON */ }
        throw new Error(errorMessage);
      }

      setErrorBanner(null);
      setErrors({});
      pop(
        isEditMode
          ? t('ajouterService.toasts.updateSuccess')
          : (draft ? t('ajouterService.toasts.draftSaved') : t('ajouterService.toasts.publishSuccess')),
        's',
      );
      setTimeout(() => onNavigate('services'), 800);

    } catch (err: any) {
      const message = err.message ?? t('ajouterService.toasts.unexpectedError');
      setErrorBanner(message);
      setErrors(prev => ({ ...prev, general: message }));
      pop(t('ajouterService.toasts.publishFailed'), 'e');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnChargement(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DÉRIVÉS
  // ─────────────────────────────────────────────────────────────

  const sousCatsOptions = categoriesApi.find(c => c.id === form.categorieId)?.subCategories ?? [];
  const prixNum = form.pricingType !== 'sur_devis' ? parseInt(form.prix || '0') : 0;

  // ─────────────────────────────────────────────────────────────
  // RENDU — chargement en mode édition
  // ─────────────────────────────────────────────────────────────

  if (loadingSvc) {
    return (
      <div className="page on" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, flexDirection: 'column', gap: 16 }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--t2)' }} />
        <div style={{ fontSize: 14, color: 'var(--t3)' }}>{t('ajouterService.loadingService')}</div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDU PRINCIPAL
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="page on" id="p-ajouter-service">

      {/* ── En-tête ── */}
      <div className="aj-header">
        <div>
          <div className="aj-title">
            <i className={`fas ${isEditMode ? 'fa-pen' : 'fa-plus-circle'}`}></i>
            {isEditMode ? t('ajouterService.header.editTitle') : t('ajouterService.header.createTitle')}
          </div>
          <div className="aj-sub">
            {isEditMode ? t('ajouterService.header.editSubtitle') : t('ajouterService.header.createSubtitle')}
          </div>
        </div>
        <div className="pf-actions">
          <button className="btn-draft" onClick={() => onNavigate('services')} disabled={enChargement}>
            <i className="fas fa-arrow-left"></i> {t('ajouterService.header.cancel')}
          </button>
          {!isEditMode && (
            <button className="btn-draft" onClick={() => handlePublish(true)} disabled={enChargement}>
              <i className="fas fa-save"></i> {enChargement ? t('ajouterService.header.saving') : t('ajouterService.header.draft')}
            </button>
          )}
          <button className="btn-pub" onClick={() => handlePublish(false)} disabled={enChargement}>
            <i className={`fas ${isEditMode ? 'fa-check' : 'fa-cloud-arrow-up'}`}></i>
            {enChargement
              ? (isEditMode ? t('ajouterService.header.updating') : t('ajouterService.header.publishing'))
              : (isEditMode ? t('ajouterService.header.update') : t('ajouterService.header.publish'))}
          </button>
        </div>
      </div>

      {isEditMode && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--g100)', border: '1px solid var(--bdr2)',
          borderRadius: 'var(--pill)', padding: '6px 14px',
          fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 16,
        }}>
          <i className="fas fa-pen-to-square" />
          {t('ajouterService.header.editModeBadge')}
        </div>
      )}

      {errorBanner && <ErrorBanner message={errorBanner} onClose={() => setErrorBanner(null)} />}

      <div className="g3r" style={{ alignItems: 'flex-start' }}>

        {/* ════════ COLONNE GAUCHE ════════ */}
        <div>

          {/* Médias */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-image"></i> {t('ajouterService.medias.title')}</div>
              <span className="ch-badge">{media.length}/{MAX_MEDIA_TOTAL}</span>
            </div>
            <div className="cb">
              <div
                className={`pf-drop ${uploadEnCours ? 'pf-drop--loading' : ''}`}
                onClick={() => !uploadEnCours && fileInputRef.current?.click()}
                style={{ cursor: uploadEnCours ? 'wait' : 'pointer' }}
              >
                {uploadEnCours ? (
                  <><i className="fas fa-spinner fa-spin"></i><p><strong>{t('ajouterService.medias.loading')}</strong></p></>
                ) : (
                  <>
                    <i className="fas fa-cloud-arrow-up"></i>
                    <p><strong>{t('ajouterService.medias.dropTitle')}</strong><br />{t('ajouterService.medias.dropSub')}</p>
                    <p style={{ fontSize: 11, marginTop: 6, color: 'var(--t4)' }}>
                      {t('ajouterService.medias.quota', { images: MAX_MEDIA_IMAGES, videos: MAX_MEDIA_VIDEOS })}
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              {media.length > 0 && (
                <div className="aj-img-grid">
                  {media.map((m, i) => (
                    <div key={i} className="aj-img-thumb">
                      {m.type === 'video' ? (
                        <video src={m.preview} muted style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                      ) : (
                        <img src={m.preview} alt={m.alt ?? `Média ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                      )}
                      {m.type === 'video' && (
                        <div className="aj-img-main" style={{ left: 6, right: 'auto' }}>
                          <i className="fas fa-video"></i>
                        </div>
                      )}
                      <button className="aj-img-del" onClick={() => supprimerMedia(i)}>
                        <i className="fas fa-xmark"></i>
                      </button>
                      {i === 0 && <div className="aj-img-main">{t('ajouterService.medias.principale')}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Organisation */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-tags"></i> {t('ajouterService.organisation.title')}</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="pf-lbl">{t('ajouterService.organisation.categorie')}</label>
                {erreurCats ? (
                  <div style={{ padding: '10px 12px', background: 'rgba(128,128,128,.06)', border: '1.5px solid rgba(128,128,128,.25)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fas fa-triangle-exclamation" />
                    {erreurCats}
                    <button onClick={() => { setErreurCats(null); setChargementCats(true); window.location.reload(); }} style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--t2)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'var(--t2)', cursor: 'pointer' }}>
                      {t('ajouterService.organisation.retry')}
                    </button>
                  </div>
                ) : (
                  <select
                    className="pf-in"
                    value={form.categorieId}
                    disabled={chargementCats}
                    onChange={e => handleChangerCategorie(e.target.value)}
                    style={{ borderColor: errors.categorieId ? 'var(--red)' : undefined }}
                  >
                    {chargementCats ? (
                      <option>{t('ajouterService.organisation.loadingCats')}</option>
                    ) : categoriesApi.length === 0 ? (
                      <option value="">{t('ajouterService.organisation.noCategorie')}</option>
                    ) : (
                      categoriesApi.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)
                    )}
                  </select>
                )}
                <FieldError message={errors.categorieId} />
              </div>

              <div>
                <label className="pf-lbl">{t('ajouterService.organisation.sousCategorie')}</label>
                <select className="pf-in" value={form.sousCatId} onChange={e => handleChangerSousCat(e.target.value)}>
                  <option value="">{t('ajouterService.organisation.choisir')}</option>
                  {sousCatsOptions.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>

              <div><label className="pf-lbl">{t('ajouterService.organisation.tagsSeo')}</label><input className="pf-in" placeholder={t('ajouterService.organisation.tagsPlaceholder')} value={form.tags} onChange={e => update('tags', e.target.value)} /></div>

              <div>
                <label className="pf-lbl">{t('ajouterService.organisation.langue')}</label>
                <select className="pf-in" value={form.langue} onChange={e => update('langue', e.target.value)}>
                  <option value="fr">{t('ajouterService.organisation.langueFr')}</option>
                  <option value="en">{t('ajouterService.organisation.langueEn')}</option>
                  <option value="ar">{t('ajouterService.organisation.langueAr')}</option>
                </select>
              </div>
              <div>
                <label className="pf-lbl">{t('ajouterService.organisation.visibilite')}</label>
                <select className="pf-in" value={form.visibilite} onChange={e => update('visibilite', e.target.value)}>
                  <option value="public">{t('ajouterService.organisation.optPublic')}</option>
                  <option value="draft">{t('ajouterService.organisation.optDraft')}</option>
                  <option value="private">{t('ajouterService.organisation.optPrivate')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mode de prestation */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-location-dot"></i> {t('ajouterService.modePrestation.title')}</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {([
                { key: 'surPlaceEntreprise' as const, icon: '🏠', label: t('ajouterService.modePrestation.surPlace'), sub: t('ajouterService.modePrestation.surPlaceSub') },
                { key: 'aDomicile'          as const, icon: '🚗', label: t('ajouterService.modePrestation.domicile'), sub: t('ajouterService.modePrestation.domicileSub') },
                { key: 'aDistance'          as const, icon: '💻', label: t('ajouterService.modePrestation.distance'), sub: t('ajouterService.modePrestation.distanceSub') },
              ]).map(item => (
                <label key={item.key} className="aj-toggle-row">
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)' }}>{item.icon} {item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{item.sub}</div>
                  </div>
                  <label className="aj-toggle">
                    <input type="checkbox" checked={form[item.key]} onChange={e => update(item.key, e.target.checked)} />
                    <span className="aj-toggle-slider"></span>
                  </label>
                </label>
              ))}
              {form.aDomicile && (
                <>
                  <div><label className="pf-lbl">{t('ajouterService.modePrestation.zoneCouverture')}</label><input className="pf-in" placeholder={t('ajouterService.modePrestation.zoneCouverturePlaceholder')} value={form.zoneCouverture} onChange={e => update('zoneCouverture', e.target.value)} /></div>
                  <div><label className="pf-lbl">{t('ajouterService.modePrestation.fraisDeplacement')}</label><input className="pf-in" type="number" placeholder={t('ajouterService.modePrestation.fraisDeplacementPlaceholder')} value={form.fraisDeplacement} onChange={e => update('fraisDeplacement', e.target.value)} /></div>
                </>
              )}
            </div>
          </div>

          {/* Réservation & annulation */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-calendar-check"></i> {t('ajouterService.reservation.title')}</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label className="aj-toggle-row">
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)' }}>{t('ajouterService.reservation.reservationRequise')}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{t('ajouterService.reservation.reservationRequiseSub')}</div>
                </div>
                <label className="aj-toggle">
                  <input type="checkbox" checked={form.reservationRequise} onChange={e => update('reservationRequise', e.target.checked)} />
                  <span className="aj-toggle-slider"></span>
                </label>
              </label>
              <div>
                <label className="pf-lbl">{t('ajouterService.reservation.delaiReponse')}</label>
                <select className="pf-in" value={form.delaiReponse} onChange={e => update('delaiReponse', e.target.value as any)}>
                  <option value="immediate">{t('ajouterService.reservation.delaiOptions.immediate')}</option>
                  <option value="24h">{t('ajouterService.reservation.delaiOptions.24h')}</option>
                  <option value="48h">{t('ajouterService.reservation.delaiOptions.48h')}</option>
                  <option value="7j">{t('ajouterService.reservation.delaiOptions.7j')}</option>
                </select>
              </div>
              <div>
                <label className="pf-lbl">{t('ajouterService.reservation.politiqueAnnulation')}</label>
                <select className="pf-in" value={form.politiqueAnnulation} onChange={e => update('politiqueAnnulation', e.target.value as any)}>
                  <option value="flexible">{t('ajouterService.reservation.politiqueOptions.flexible')}</option>
                  <option value="moderee">{t('ajouterService.reservation.politiqueOptions.moderee')}</option>
                  <option value="stricte">{t('ajouterService.reservation.politiqueOptions.stricte')}</option>
                  <option value="non_remboursable">{t('ajouterService.reservation.politiqueOptions.non_remboursable')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Garanties */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-shield-check"></i> {t('ajouterService.garanties.title')}</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { key: 'garantiePaiement'     as const, icon: '🔒', label: t('ajouterService.garanties.paiement'),     sub: t('ajouterService.garanties.paiementSub') },
                { key: 'garantieSatisfaction' as const, icon: '✅', label: t('ajouterService.garanties.satisfaction'), sub: t('ajouterService.garanties.satisfactionSub') },
              ]).map(g => (
                <label key={g.key} className="aj-toggle-row" style={{ padding: '10px 12px', background: 'var(--g50)', borderRadius: 'var(--r-md)', border: '1px solid var(--bdr)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{g.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{g.label}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>{g.sub}</div>
                    </div>
                  </div>
                  <label className="aj-toggle">
                    <input type="checkbox" checked={form[g.key]} onChange={e => update(g.key, e.target.checked)} />
                    <span className="aj-toggle-slider"></span>
                  </label>
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* ════════ COLONNE DROITE ════════ */}
        <div>

          {/* Informations générales */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-file-alt"></i> {t('ajouterService.infosBase.title')}</div></div>
            <div className="cb">
              <div className="pf-grid">
                <div className="pf-full">
                  <label className="pf-lbl">{t('ajouterService.infosBase.nom')}</label>
                  <input className="pf-in" placeholder={t('ajouterService.infosBase.nomPlaceholder')} value={form.nom} onChange={e => update('nom', e.target.value)} style={{ borderColor: errors.nom ? 'var(--red)' : undefined }} />
                  <FieldError message={errors.nom} />
                </div>
                <div className="pf-full">
                  <label className="pf-lbl">{t('ajouterService.infosBase.description')}</label>
                  <textarea className="pf-in" rows={4} placeholder={t('ajouterService.infosBase.descriptionPlaceholder')} value={form.description} onChange={e => update('description', e.target.value)} style={{ resize: 'vertical' }} />
                  <p style={{ fontSize: 10.5, color: form.description.length > 100 ? 'var(--emerald)' : 'var(--t4)', marginTop: 3, textAlign: 'right' }}>
                    {t('ajouterService.infosBase.descCounter', { count: form.description.length, status: form.description.length < 100 ? t('ajouterService.infosBase.descMinRecommande') : '✓' })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tarification */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-coins"></i> {t('ajouterService.tarification.title')}</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="pf-lbl">{t('ajouterService.tarification.pricingType')}</label>
                <select className="pf-in" value={form.pricingType} onChange={e => update('pricingType', e.target.value as any)}>
                  <option value="fixe">{t('ajouterService.tarification.pricingFixe')}</option>
                  <option value="horaire">{t('ajouterService.tarification.pricingHoraire')}</option>
                  <option value="sur_devis">{t('ajouterService.tarification.pricingDevis')}</option>
                </select>
              </div>
              {form.pricingType !== 'sur_devis' && (
                <>
                  <div>
                    <label className="pf-lbl">{t('ajouterService.tarification.prix')}{form.pricingType === 'horaire' ? ` (${t('ajouterService.tarification.prixHint')})` : ''}</label>
                    <input className="pf-in" type="number" placeholder={t('ajouterService.tarification.prixPlaceholder')} value={form.prix} onChange={e => update('prix', e.target.value)} style={{ borderColor: errors.prix ? 'var(--red)' : undefined }} />
                    <FieldError message={errors.prix} />
                  </div>
                  <div>
                    <label className="pf-lbl">{t('ajouterService.tarification.prixAncien')}</label>
                    <input className="pf-in" type="number" placeholder={t('ajouterService.tarification.prixAncienPlaceholder')} value={form.prixAncien} onChange={e => update('prixAncien', e.target.value)} />
                    {form.prixAncien && form.prix && parseInt(form.prixAncien) > parseInt(form.prix) && (
                      <p style={{ fontSize: 10.5, color: 'var(--t2)', marginTop: 3 }}>
                        {t('ajouterService.tarification.reduction', { pct: Math.round((1 - parseInt(form.prix) / parseInt(form.prixAncien)) * 100) })}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Durée & capacité */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-clock"></i> {t('ajouterService.duree.title')}</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="gridR3" style={{ gap: 8 }}>
                <div>
                  <label className="pf-lbl">{t('ajouterService.duree.dureeMin')}</label>
                  <input className="pf-in" type="number" placeholder="30" value={form.dureeMinMinutes} onChange={e => update('dureeMinMinutes', e.target.value)} />
                </div>
                <div>
                  <label className="pf-lbl">{t('ajouterService.duree.dureeMax')}</label>
                  <input className="pf-in" type="number" placeholder="60" value={form.dureeMaxMinutes} onChange={e => update('dureeMaxMinutes', e.target.value)} />
                </div>
                <div>
                  <label className="pf-lbl">{t('ajouterService.duree.capaciteMax')}</label>
                  <input className="pf-in" type="number" placeholder={t('ajouterService.duree.capaciteMaxPlaceholder')} value={form.capaciteMax} onChange={e => update('capaciteMax', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Ce qui est inclus */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-list-check"></i> {t('ajouterService.specs.title')}</div>
              <span className="ch-badge">{t('ajouterService.specs.critereCount', { count: specs.length })}</span>
            </div>
            <div className="cb">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {specs.map((spec, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ flex: '0 0 160px' }}>
                      <label className="pf-lbl">{t('ajouterService.specs.critere')}</label>
                      <input className="pf-in" placeholder={t('ajouterService.specs.criterePlaceholder')} value={spec.cle} onChange={e => updateSpec(i, 'cle', e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="pf-lbl">{t('ajouterService.specs.valeur')}</label>
                      <input className="pf-in" placeholder={t('ajouterService.specs.valeurPlaceholder')} value={spec.valeur} onChange={e => updateSpec(i, 'valeur', e.target.value)} />
                    </div>
                    {specs.length > 1 && (
                      <button onClick={() => removeSpec(i)} style={{ background: 'var(--g100)', border: '1px solid rgba(128,128,128,.2)', borderRadius: 'var(--r-md)', width: 36, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t2)', cursor: 'pointer', flexShrink: 0 }}>
                        <i className="fas fa-trash" style={{ fontSize: 11 }}></i>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addSpec} style={{ background: 'var(--g100)', border: '1px solid var(--bdr2)', borderRadius: 'var(--pill)', padding: '7px 16px', fontSize: 12, fontWeight: 700, color: 'var(--t2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-plus"></i> {t('ajouterService.specs.add')}
              </button>
            </div>
          </div>

          {/* SEO */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-magnifying-glass-chart"></i> {t('ajouterService.seo.title')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="aj-seo-ring" style={{ background: `conic-gradient(var(--t2) 0% ${seoScore.score}%, var(--g200) ${seoScore.score}% 100%)` }}>
                  <span>{seoScore.score}</span>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--t2)' }}>{t('ajouterService.seo.score')}</span>
              </div>
            </div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="pf-lbl">{t('ajouterService.seo.titreSeo')}</label>
                <input className="pf-in" placeholder={t('ajouterService.seo.titrePlaceholder')} value={form.titreSeo} onChange={e => update('titreSeo', e.target.value)} maxLength={70} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <p style={{ fontSize: 10, color: 'var(--t3)' }}>{t('ajouterService.seo.titreIdeal')}</p>
                  <p style={{ fontSize: 10, color: form.titreSeo.length > 50 && form.titreSeo.length <= 70 ? 'var(--emerald)' : 'var(--t3)' }}>{form.titreSeo.length}/70</p>
                </div>
              </div>
              <div>
                <label className="pf-lbl">{t('ajouterService.seo.descriptionSeo')}</label>
                <textarea className="pf-in" rows={3} placeholder={t('ajouterService.seo.descriptionPlaceholder')} value={form.descriptionSeo} onChange={e => update('descriptionSeo', e.target.value)} maxLength={160} style={{ resize: 'vertical' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <p style={{ fontSize: 10, color: 'var(--t3)' }}>{t('ajouterService.seo.descriptionIdeal')}</p>
                  <p style={{ fontSize: 10, color: form.descriptionSeo.length >= 120 && form.descriptionSeo.length <= 160 ? 'var(--emerald)' : 'var(--t3)' }}>{form.descriptionSeo.length}/160</p>
                </div>
              </div>
              <div>
                <label className="pf-lbl">{t('ajouterService.seo.urlSlug')}</label>
                <div style={{ display: 'flex', border: '1.5px solid var(--bdr2)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--g50)' }}>
                  <span style={{ padding: '10px 10px 10px 13px', fontSize: 12, color: 'var(--t3)', borderRight: '1px solid var(--bdr2)', whiteSpace: 'nowrap', background: 'var(--g100)' }}>shopi.gn/s/</span>
                  <input style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '10px 13px', fontSize: 13, color: 'var(--t1)' }} placeholder="coupe-brushing-salon-x" value={form.urlSlug} onChange={e => update('urlSlug', e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))} />
                </div>
              </div>
              <div style={{ background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 'var(--r-md)', padding: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>{t('ajouterService.seo.qualite')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {seoScore.criteres.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--t2)' }}>
                      <i className={`fas ${c.ok ? 'fa-circle-check' : 'fa-circle-xmark'}`} style={{ fontSize: 13, color: c.ok ? 'var(--emerald)' : 'var(--t4)', width: 14 }}></i>
                      {c.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Aperçu revenus */}
          {form.pricingType !== 'sur_devis' && form.prix && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="ch"><div className="ch-t"><i className="fas fa-calculator"></i> {t('ajouterService.revenus.title')}</div></div>
              <div className="cb">
                <div className="gridR3" style={{ gap: 10 }}>
                  {[
                    { l: t('ajouterService.revenus.prixVente'), v: `${prixNum.toLocaleString('fr-FR')} GNF`, c: 'var(--navy)' },
                    { l: t('ajouterService.revenus.commission', { pct: commissionPct }), v: `-${Math.round(prixNum * commissionPct / 100).toLocaleString('fr-FR')} GNF`, c: 'var(--t2)' },
                    { l: t('ajouterService.revenus.revenuNet'), v: `${Math.round(prixNum * (1 - commissionPct / 100)).toLocaleString('fr-FR')} GNF`, c: 'var(--t2)' },
                  ].map((s, i) => (
                    <div key={i} style={{ padding: '12px 14px', background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>{s.l}</div>
                      <div style={{ fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 800, color: s.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions bas de page */}
          <div className="card" style={{ background: 'var(--g50)', border: '1.5px solid var(--bdr)' }}>
            <div className="cb">
              {Object.keys(errors).filter(k => k !== 'general').length > 0 && (
                <div style={{ marginBottom: 14, padding: '12px 14px', background: 'rgba(128,128,128,.06)', border: '1.5px solid rgba(128,128,128,.25)', borderRadius: 'var(--r-md)' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>
                    <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />
                    {t('ajouterService.actions.fixErrorsTitle')}
                  </div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: 'var(--t2)', lineHeight: 1.8 }}>
                    {errors.nom         && <li>{errors.nom}</li>}
                    {errors.prix        && <li>{errors.prix}</li>}
                    {errors.categorieId && <li>{errors.categorieId}</li>}
                  </ul>
                </div>
              )}
              <div className="pf-actions">
                <button className="btn-draft" onClick={() => onNavigate('services')} disabled={enChargement}>
                  <i className="fas fa-arrow-left"></i> {t('ajouterService.actions.retour')}
                </button>
                {!isEditMode && (
                  <button className="btn-draft" onClick={() => handlePublish(true)} disabled={enChargement}>
                    <i className="fas fa-save"></i> {enChargement ? t('ajouterService.header.saving') : t('ajouterService.header.draft')}
                  </button>
                )}
                <button className="btn-pub" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handlePublish(false)} disabled={enChargement}>
                  <i className={`fas ${isEditMode ? 'fa-check' : 'fa-cloud-arrow-up'}`}></i>
                  {enChargement
                    ? (isEditMode ? t('ajouterService.header.updating') : t('ajouterService.header.publishing'))
                    : (isEditMode ? t('ajouterService.header.update') : t('ajouterService.header.publish'))}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
