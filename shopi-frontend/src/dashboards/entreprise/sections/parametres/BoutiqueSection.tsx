/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/BoutiqueSection.tsx
 *
 * CONNECTÉ À L'API — Sections 1 + 2 des paramètres entreprise.
 * ✅ Images logo et cover corrigées avec classes CSS dédiées
 * ✅ Plus de styles inline sur les images
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import FormCard from '../../components/parametres/FormCard';
import BoutiqueCategoriesCard from './BoutiqueCategoriesCard';
import { typeName } from '../../../../shared/utils/catalogueCase';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';
import type { ToastType } from '../../types';
import { apiFetch } from '../../../../shared/services/apiFetch';

/* BUG CORRIGÉ — le <select> "Type d'entreprise" n'offrait jamais que
 * l'option vide + (si déjà défini) le type ACTUEL de l'entreprise : il
 * n'y avait donc aucun moyen réel de choisir/corriger un type, en
 * particulier pour une entreprise dont companyTypeId est resté NULL
 * (créée avant validation, ou jamais renseigné). Liste réelle chargée
 * depuis GET /company-types (même endpoint public que la page
 * /types/:id — voir TypeEntrepriseSection.tsx). */
interface CompanyTypeOption { id: string; nom: string; icone: string | null; actif: boolean; nature?: 'products' | 'services' | 'neutral' }

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────

interface Props {
  data:         ParametresData | null;
  saving:       boolean;
  onDirty:      () => void;
  onToast:      (m: string, t?: ToastType) => void;
  saveBoutique: (body: Partial<ParametresData>) => Promise<void>;
  saveContact:  (body: Partial<ParametresData>) => Promise<void>;
  uploadLogo:   (file: File) => Promise<void>;
  uploadCover:  (file: File) => Promise<void>;
  deleteLogo:   () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT
// ─────────────────────────────────────────────────────────────

export default function BoutiqueSection({
  data, saving,
  onDirty, onToast,
  saveBoutique, saveContact,
  uploadLogo, uploadCover, deleteLogo,
}: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // ── État formulaire boutique (section 1) ─────────────────
  const [nomBoutique,   setNomBoutique]   = useState('');
  const [description,   setDescription]  = useState('');
  const [slogan,        setSlogan]        = useState('');
  const [website,       setWebsite]       = useState('');
  const [tags,          setTags]          = useState('');
  /* Visibilité : « visible » (active) ou « en pause » (suspended) — seulement si
   * le compte est validé et non suspendu (voir canToggleVisibility). */
  const [visible,       setVisible]       = useState(true);
  const [companyTypeId, setCompanyTypeId] = useState('');
  const [types,         setTypes]         = useState<CompanyTypeOption[]>([]);

  useEffect(() => {
    apiFetch<CompanyTypeOption[]>('/company-types', { public: true })
      .then(list => setTypes((list ?? []).filter(ty => ty.actif)))
      .catch(() => setTypes([]));
  }, []);

  // ── État formulaire contact (section 2) ──────────────────
  /* L'ADRESSE (ville, commune, quartier, rue, repère) ne se modifie plus ici :
   * un seul endroit, « Voir ma boutique › Localisation », qui enregistre
   * l'adresse ET la position sur la carte ensemble. Modifiée ici, l'adresse
   * pouvait changer de ville sans que le repère 🏪 ne bouge (distances
   * clients fausses). Ici : résumé + lien « Modifier sur la carte ». */
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [whatsapp,      setWhatsapp]      = useState('');

  // ── Refs inputs file cachés ───────────────────────────────
  const logoInputRef  = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // ── Pré-remplir depuis l'API ──────────────────────────────
  /* BUG CORRIGÉ — « je choisis, ça revient » : ce pré-remplissage réécrivait
   * TOUS les champs à chaque changement des données (ex. après l'enregistrement
   * de la carte Contact, ou d'une autre section) : un choix pas encore
   * enregistré sur l'autre carte (« En pause », description…) était effacé.
   * Chaque carte ne reprend les valeurs du serveur que si l'on n'était pas en
   * train de la modifier (formulaire identique aux données précédentes). */
  const prevDataRef = useRef<ParametresData | null>(null);
  useEffect(() => {
    if (!data) return;
    const prev = prevDataRef.current;
    prevDataRef.current = data;
    const boutiqueEnCours = !!prev && (
      nomBoutique !== (prev.companyName ?? '') || description !== (prev.description ?? '') ||
      slogan !== (prev.slogan ?? '') || website !== (prev.website ?? '') || tags !== (prev.tags ?? '') ||
      visible !== (prev.status === 'active') || companyTypeId !== (prev.companyTypeId ?? ''));
    if (!boutiqueEnCours) {
      setNomBoutique(data.companyName    ?? '');
      setDescription(data.description    ?? '');
      setSlogan(data.slogan               ?? '');
      setWebsite(data.website             ?? '');
      setTags(data.tags                   ?? '');
      setVisible(data.status === 'active');
      setCompanyTypeId(data.companyTypeId ?? '');
    }
    const contactEnCours = !!prev && (
      businessPhone !== (prev.businessPhone ?? '') || businessEmail !== (prev.businessEmail ?? '') || whatsapp !== (prev.whatsapp ?? ''));
    if (!contactEnCours) {
      setBusinessPhone(data.businessPhone ?? '');
      setBusinessEmail(data.businessEmail ?? '');
      setWhatsapp(data.whatsapp           ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const pct = calculerCompletion(data);

  /* Type choisi à l'inscription : définitif (le serveur refuse aussi tout changement). */
  const typeLocked = !!data?.companyTypeId;
  /* Le propriétaire règle la visibilité seulement si l'administration a validé
   * son compte et ne l'a pas suspendu. */
  const canToggleVisibility = data?.ownerStatus === 'active';
  const adresseResume = [data?.quartier, data?.commune, data?.ville].filter(Boolean).join(' · ');

  // ─────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────

  async function handleSaveBoutique() {
    try {
      const wantStatus = visible ? 'active' : 'suspended';
      await saveBoutique({
        companyName:   nomBoutique,
        description,
        slogan,
        website,
        tags,
        /* Envoyés seulement quand ils sont réellement modifiables et modifiés */
        ...(canToggleVisibility && wantStatus !== data?.status ? { status: wantStatus as ParametresData['status'] } : {}),
        ...(!typeLocked && companyTypeId ? { companyTypeId } : {}),
      });
      onToast(t('parametres.boutique.savedToast'), 's');
    } catch {
      onToast(t('parametres.boutique.errorToast'), 'e');
    }
  }

  async function handleSaveContact() {
    try {
      await saveContact({ businessPhone, businessEmail, whatsapp });
      onToast(t('parametres.boutique.contactSavedToast'), 's');
    } catch {
      onToast(t('parametres.boutique.errorToast'), 'e');
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { onToast(t('parametres.boutique.logoTropLourd'), 'e'); return; }
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      onToast(t('parametres.boutique.formatInvalide'), 'e'); return;
    }
    try {
      onToast(t('parametres.boutique.uploadEnCours'), 'i');
      await uploadLogo(file);
      onToast(t('parametres.boutique.logoMisAJour'), 's');
    } catch {
      onToast(t('parametres.boutique.echecUploadLogo'), 'e');
    }
    e.target.value = ''; // reset pour permettre re-sélection du même fichier
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { onToast(t('parametres.boutique.imageTropLourde'), 'e'); return; }
    try {
      onToast(t('parametres.boutique.uploadEnCours'), 'i');
      await uploadCover(file);
      onToast(t('parametres.boutique.coverMiseAJour'), 's');
    } catch {
      onToast(t('parametres.boutique.echecUploadCover'), 'e');
    }
    e.target.value = '';
  }

  async function handleDeleteLogo() {
    if (!data?.logo) return;
    try {
      await deleteLogo();
      onToast(t('parametres.boutique.logoSupprime'), 'w');
    } catch {
      onToast(t('parametres.boutique.logoSuppressionImpossible'), 'e');
    }
  }

  // ─────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────

  return (
    <>
      {/* ── En-tête ── */}
      <div className={s.sectionHd}>
        <h1><i className="fas fa-store" /> {t('parametres.boutique.title')}</h1>
        <p>{t('parametres.boutique.subtitle')}</p>
      </div>

      {/* ── Barre de complétion ── */}
      <div className={s.completionBar}>
        <div className={s.completionBg} />
        <div className={s.completionInner}>
          <div className={s.completionRing}>
            <div className={s.completionPct}>{pct}%</div>
            <div className={s.completionLbl}>{t('parametres.boutique.profilLbl')}</div>
          </div>
          <div className={s.completionInfo}>
            <div className={s.completionTitle}>
              {t('parametres.boutique.completedAt', { pct })}
              {pct < 100 && ` ${t('parametres.boutique.elementsManquants')}`}
            </div>
            <div className={s.completionBarBg}>
              <div className={s.completionBarFill} style={{ width:`${pct}%` }} />
            </div>
            <div className={s.completionSteps}>
              {getStepsDone(data, t).map(l => (
                <span key={l} className={`${s.completionStep} ${s.done}`}>
                  <i className="fas fa-check-circle" /> {l}
                </span>
              ))}
              {getStepsMissing(data, t).map(l => (
                <span key={l} className={`${s.completionStep} ${s.miss}`}>
                  <i className="fas fa-circle" /> {l}
                </span>
              ))}
            </div>
          </div>
          <div className={s.completionHint}>
            {t('parametres.boutique.profilCompletPart1')} <strong>{t('parametres.boutique.profilCompletBold')}</strong> {t('parametres.boutique.profilCompletPart2')}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
       * LOGO & COUVERTURE
       * ══════════════════════════════════════════════════════ */}
      <FormCard
        title={t('parametres.boutique.logoCoverTitle')}
        icon="fa-image"
        subtitle={t('parametres.boutique.logoCoverSubtitle')}
      >
        <div style={{ display:'flex', alignItems:'flex-start', gap:22, flexWrap:'wrap' }}>

          {/* ── Logo ─────────────────────────────────────── */}
          <div style={{ textAlign:'center', flexShrink:0 }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>
              {t('parametres.boutique.logoBoutique')}
            </div>

            {/*
             * ✅ CORRIGÉ : .logoWrap gère border-radius + overflow:hidden
             * L'image utilise .logoImg → object-fit:cover sur toute la surface
             * Plus de styles inline qui cassaient l'affichage
             */}
            <div
              className={s.logoWrap}
              onClick={() => logoInputRef.current?.click()}
              title={t('parametres.boutique.cliquerChangerLogo')}
            >
              {data?.logo
                ? <img src={data.logo} alt="Logo boutique" className={s.logoImg} />
                : <span className={s.logoEmoji}>🏪</span>
              }
            </div>

            {/* Input file caché */}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display:'none' }}
              onChange={handleLogoChange}
            />

            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={saving}
              style={{
                background:'rgba(0,0,0,.06)', color:'var(--t2)',
                border:'1px solid var(--bdr2)', borderRadius:'var(--pill)',
                padding:'6px 14px', fontSize:11, fontWeight:700,
                display:'block', width:'100%', cursor:'pointer',
                marginTop:10, opacity:saving ? 0.5 : 1,
                fontFamily:'var(--fb)',
              }}
            >
              {saving ? <><i className="fas fa-spinner fa-spin" /> </> : null}
              {t('parametres.boutique.changer')}
            </button>

            {data?.logo && (
              <button
                onClick={handleDeleteLogo}
                disabled={saving}
                style={{
                  background:'none', border:'none',
                  color:'var(--t3)', fontSize:11, marginTop:6,
                  cursor:'pointer', display:'block', width:'100%',
                }}
              >
                {t('parametres.boutique.supprimer')}
              </button>
            )}
          </div>

          {/* ── Cover ────────────────────────────────────── */}
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>
              {t('parametres.boutique.imageCouverture')}
            </div>

            {/* Input file caché */}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display:'none' }}
              onChange={handleCoverChange}
            />

            {/*
             * ✅ CORRIGÉ : .coverWrap → position:relative + aspect-ratio:3/1 + overflow:hidden
             * .coverImg  → position:absolute + inset:0 + object-fit:cover (image prend tout l'espace)
             * .coverOverlay → overlay sombre au hover avec icône caméra
             * .coverPlaceholder → contenu quand pas d'image
             */}
            <div
              className={s.coverWrap}
              onClick={() => coverInputRef.current?.click()}
            >
              {data?.coverImage && (
                <img
                  src={data.coverImage}
                  alt="Image de couverture"
                  className={s.coverImg}
                />
              )}

              {/* Overlay hover — visible uniquement quand image présente */}
              <div className={s.coverOverlay}>
                <i className="fas fa-camera" style={{ fontSize:22 }} />
                <span style={{ fontSize:12, fontWeight:700 }}>{t('parametres.boutique.changerCouverture')}</span>
              </div>

              {/* Placeholder — visible quand pas d'image */}
              {!data?.coverImage && (
                <div className={s.coverPlaceholder}>
                  <i className="fas fa-panorama" />
                  <strong>{t('parametres.boutique.couvertureBoutique')}</strong>
                  <span>{t('parametres.boutique.couvertureDims')}</span>
                </div>
              )}
            </div>

            {/* Lien discret pour changer la cover quand elle existe */}
            {data?.coverImage && (
              <button
                onClick={() => coverInputRef.current?.click()}
                style={{
                  background:'none', border:'none',
                  color:'var(--t3)', fontSize:11, marginTop:7,
                  cursor:'pointer', display:'flex', alignItems:'center', gap:5,
                }}
              >
                <i className="fas fa-arrows-rotate" style={{ fontSize:10 }} />
                {t('parametres.boutique.changerImageCouverture')}
              </button>
            )}
          </div>

        </div>
      </FormCard>

      {/* ══════════════════════════════════════════════════════
       * INFORMATIONS DE LA BOUTIQUE
       * ══════════════════════════════════════════════════════ */}
      <FormCard
        title={t('parametres.boutique.infosTitle')}
        icon="fa-id-badge"
        subtitle={t('parametres.boutique.infosSubtitle')}
      >
        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.boutique.nomBoutique')} <span className={s.flOpt}>*</span></div>
          <div className={s.fw}>
            <i className={`fas fa-store ${s.fi}`} />
            <input className={s.fin} value={nomBoutique}
              onChange={e => { setNomBoutique(e.target.value); onDirty(); }}
              placeholder={t('parametres.boutique.nomBoutiquePlaceholder')} />
          </div>
          <div className={s.hint}>
            <i className="fas fa-circle-info" /> {t('parametres.boutique.nomBoutiqueHint')}
          </div>
        </div>

        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.boutique.description')} <span className={s.flOpt}>{t('parametres.boutique.descriptionVisiblePublique')}</span></div>
          <div className={s.fw}>
            <i className={`fas fa-pen-to-square ${s.fi}`} style={{ top:13, bottom:'auto' }} />
            <textarea
              className={`${s.fin} ${s.finTextarea}`}
              style={{ paddingLeft:38 }}
              value={description}
              onChange={e => { setDescription(e.target.value); onDirty(); }}
              placeholder={t('parametres.boutique.descriptionPlaceholder')}
              maxLength={1000}
            />
          </div>
          <div className={s.hint}><i className="fas fa-circle-info" /> {t('parametres.boutique.descriptionHint')}</div>
        </div>

        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.typeEntreprise')}</div>
            {typeLocked ? (
              /* Choisi à l'inscription : affiché, non modifiable */
              <>
                <div className={s.fw}>
                  <i className={`fas fa-tag ${s.fi}`} />
                  <input className={s.fin} readOnly
                    value={data?.companyType ? `${data.companyType.icone ? `${data.companyType.icone} ` : ''}${typeName(data.companyType.nom)}` : '—'}
                    style={{ background:'var(--g100)', cursor:'not-allowed', color:'var(--t2)', paddingRight:36 }} />
                  <i className="fas fa-lock" style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', color:'var(--t3)', fontSize:12 }} />
                </div>
                <div className={s.hint}><i className="fas fa-circle-info" /> {t('parametres.boutique.typeVerrouilleHint')}</div>
              </>
            ) : (
              /* Aucun type encore (ancien compte) : choix possible UNE fois */
              <>
                <div className={s.fw}>
                  <i className={`fas fa-tag ${s.fi}`} />
                  <select className={`${s.fin} ${s.finSelect}`}
                    value={companyTypeId}
                    onChange={e => { setCompanyTypeId(e.target.value); onDirty(); }}>
                    <option value="">{t('parametres.boutique.selectionnerType')}</option>
                    {/* Seulement les types compatibles avec le modèle (produits / services) — même règle qu'à l'inscription */}
                    {types
                      .filter(ty => !data?.businessModel || !ty.nature || ty.nature === 'neutral' || ty.nature === data.businessModel)
                      .map(ty => (
                        <option key={ty.id} value={ty.id}>{ty.icone ? `${ty.icone} ` : ''}{typeName(ty.nom)}</option>
                      ))}
                  </select>
                </div>
                <div className={s.hint}><i className="fas fa-triangle-exclamation" /> {t('parametres.boutique.typeDefinitifHint')}</div>
              </>
            )}
          </div>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.visibilite')}</div>
            {canToggleVisibility ? (
              <>
                <div role="radiogroup" aria-label={t('parametres.boutique.visibilite')}
                  style={{ display:'flex', background:'var(--g100)', borderRadius:12, padding:3, gap:3 }}>
                  {([['visible', true, 'fa-eye'], ['pause', false, 'fa-pause']] as const).map(([k, val, icon]) => (
                    <button key={k} type="button" role="radio" aria-checked={visible === val}
                      onClick={() => { setVisible(val); onDirty(); }}
                      style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, height:38, border:'none', borderRadius:9, cursor:'pointer',
                        fontSize:12.5, fontWeight:700, fontFamily:'var(--fb)',
                        background: visible === val ? 'var(--white)' : 'transparent',
                        color: visible === val ? (val ? 'var(--emerald)' : 'var(--amber)') : 'var(--t3)',
                        boxShadow: visible === val ? '0 1px 4px rgba(0,0,0,.10)' : 'none' }}>
                      <i className={`fas ${icon}`} /> {val ? t('parametres.boutique.visible') : t('parametres.boutique.enPause')}
                    </button>
                  ))}
                </div>
                <div className={s.hint}><i className="fas fa-circle-info" /> {visible ? t('parametres.boutique.visibleHint') : t('parametres.boutique.pauseHint')}</div>
                {data?.suspendedUntil && data.status !== 'active' && (
                  <div className={s.hint}><i className="fas fa-clock" /> {t('parametres.boutique.reactivationAuto', { date: new Date(data.suspendedUntil).toLocaleDateString(i18n.language) })}</div>
                )}
              </>
            ) : (
              /* Validation / suspension : décidées par l'administration, affichées en lecture seule */
              <>
                <div style={{ display:'flex', alignItems:'center', gap:8, height:44, padding:'0 14px', borderRadius:12, fontSize:13, fontWeight:700,
                  background: data?.ownerStatus === 'pending' ? 'var(--am-bg, rgba(180,83,9,.09))' : 'rgba(220,38,38,.08)',
                  color: data?.ownerStatus === 'pending' ? 'var(--amber)' : 'var(--red)' }}>
                  <i className={`fas ${data?.ownerStatus === 'pending' ? 'fa-hourglass-half' : 'fa-ban'}`} />
                  {data?.ownerStatus === 'pending' ? t('parametres.boutique.attenteValidation') : t('parametres.boutique.suspendueAdmin')}
                </div>
                <div className={s.hint}><i className="fas fa-circle-info" /> {data?.ownerStatus === 'pending' ? t('parametres.boutique.attenteValidationHint') : t('parametres.boutique.suspendueAdminHint')}</div>
              </>
            )}
          </div>
        </div>

        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.slogan')} <span className={s.flOpt}>{t('parametres.boutique.optionnel')}</span></div>
            <div className={s.fw}>
              <i className={`fas fa-quote-left ${s.fi}`} />
              <input className={s.fin} value={slogan}
                onChange={e => { setSlogan(e.target.value); onDirty(); }}
                placeholder={t('parametres.boutique.sloganPlaceholder')} />
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.siteWeb')}</div>
            <div className={s.fw}>
              <i className={`fas fa-globe ${s.fi}`} />
              <input className={s.fin} type="url" value={website}
                onChange={e => { setWebsite(e.target.value); onDirty(); }}
                placeholder={t('parametres.boutique.siteWebPlaceholder')} />
            </div>
          </div>
        </div>

        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.boutique.tagsMotsCles')}</div>
          <div className={s.fw}>
            <i className={`fas fa-hashtag ${s.fi}`} />
            <input className={s.fin} value={tags}
              onChange={e => { setTags(e.target.value); onDirty(); }}
              placeholder={t('parametres.boutique.tagsPlaceholder')} />
          </div>
          <div className={s.hint}><i className="fas fa-circle-info" /> {t('parametres.boutique.tagsHint')}</div>
        </div>

        <div className={s.saveRow}>
          <button className={s.saveBtn} onClick={handleSaveBoutique} disabled={saving}>
            {saving
              ? <><i className="fas fa-spinner fa-spin" /> {t('parametres.boutique.sauvegardeEnCours')}</>
              : <><i className="fas fa-cloud-arrow-up" /> {t('parametres.boutique.sauvegarderBoutique')}</>
            }
          </button>
        </div>
      </FormCard>

      {/* ══════════════════════════════════════════════════════
       * CATÉGORIES DE MON ACTIVITÉ — les seules proposées pour les
       * produits / services (voir BoutiqueCategoriesCard).
       * ══════════════════════════════════════════════════════ */}
      <BoutiqueCategoriesCard companyTypeId={data?.companyTypeId} onToast={onToast} />

      {/* ══════════════════════════════════════════════════════
       * CONTACT & LOCALISATION
       * ══════════════════════════════════════════════════════ */}
      <FormCard
        title={t('parametres.boutique.contactTitle')}
        icon="fa-map-location-dot"
        subtitle={t('parametres.boutique.contactSubtitle')}
      >
        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.telephonePrincipal')}</div>
            <div className={s.fw}>
              <div className={s.phonePfx}>🇬🇳 +224</div>
              <input className={s.fin} type="tel" value={businessPhone}
                onChange={e => { setBusinessPhone(e.target.value); onDirty(); }}
                style={{ paddingLeft:90 }} placeholder="620 00 00 00" />
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.emailBoutique')}</div>
            <div className={s.fw}>
              <i className={`fas fa-envelope ${s.fi}`} />
              <input className={s.fin} type="email" value={businessEmail}
                onChange={e => { setBusinessEmail(e.target.value); onDirty(); }}
                placeholder="boutique@example.com" />
            </div>
          </div>
        </div>

        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.boutique.whatsappLabel')}</div>
          <div className={s.fw}>
            <i className={`fab fa-whatsapp ${s.fi}`} style={{ color:'var(--t2)' }} />
            <input className={s.fin} type="tel" value={whatsapp}
              onChange={e => { setWhatsapp(e.target.value); onDirty(); }}
              placeholder={t('parametres.boutique.whatsappPlaceholder')} />
          </div>
        </div>

        {/* ── ADRESSE : résumé + « Modifier sur la carte » (seul endroit d'édition,
             qui enregistre l'adresse ET la position ensemble) ── */}
        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.boutique.adresseBoutique')}</div>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', padding:'12px 14px', borderRadius:12,
            border:'1.5px solid var(--bdr2)', background:'var(--g100)' }}>
            <i className="fas fa-location-dot" style={{ color:'var(--t2)', fontSize:15 }} />
            <div style={{ flex:1, minWidth:180 }}>
              <div style={{ fontSize:13.5, fontWeight:700, color: adresseResume ? 'var(--t1)' : 'var(--t3)' }}>
                {adresseResume || t('parametres.boutique.adresseNonRenseignee')}
              </div>
              {(data?.adresse || data?.repere) && (
                <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>
                  {[data?.adresse, data?.repere].filter(Boolean).join(' — ')}
                </div>
              )}
              <div style={{ fontSize:11.5, marginTop:4, color: data?.latitude != null ? 'var(--emerald)' : 'var(--amber)', fontWeight:600 }}>
                <i className={`fas ${data?.latitude != null ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />{' '}
                {data?.latitude != null ? t('parametres.boutique.positionCarteOk') : t('parametres.boutique.positionCarteManquante')}
              </div>
            </div>
            <button type="button" className={s.saveBtn} style={{ margin:0 }}
              onClick={() => navigate('/dashboard/entreprise/boutique-preview?tab=localisation')}>
              <i className="fas fa-map-location-dot" /> {t('parametres.boutique.modifierSurCarte')}
            </button>
          </div>
          <div className={s.hint}><i className="fas fa-circle-info" /> {t('parametres.boutique.adresseCarteHint')}</div>
        </div>

        <div className={s.saveRow}>
          <button className={s.saveBtn} onClick={handleSaveContact} disabled={saving}>
            {saving
              ? <><i className="fas fa-spinner fa-spin" /> {t('parametres.boutique.sauvegardeContactEnCours')}</>
              : <><i className="fas fa-cloud-arrow-up" /> {t('parametres.boutique.sauvegarderContact')}</>
            }
          </button>
        </div>
      </FormCard>

      {/* ══════════════════════════════════════════════════════
       * RESPONSABLE & PROPRIÉTAIRE
       * ══════════════════════════════════════════════════════ */}
      <FormCard
        title={t('parametres.boutique.responsableTitle')}
        icon="fa-user-tie"
        subtitle={t('parametres.boutique.responsableSubtitle')}
      >
        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.prenom')} <span className={s.flOpt}>*</span></div>
            <div className={s.fw}>
              <i className={`fas fa-user ${s.fi}`} />
              <input className={s.fin}
                value={data?.ownerFirstName ?? ''}
                placeholder={t('parametres.boutique.prenomPlaceholder')}
                readOnly
                style={{ background:'var(--g100)', cursor:'not-allowed', color:'var(--t3)' }}
              />
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.nom')} <span className={s.flOpt}>*</span></div>
            <div className={s.fw}>
              <i className={`fas fa-user ${s.fi}`} />
              <input className={s.fin}
                value={data?.ownerLastName ?? ''}
                placeholder={t('parametres.boutique.nomPlaceholder')}
                readOnly
                style={{ background:'var(--g100)', cursor:'not-allowed', color:'var(--t3)' }}
              />
            </div>
          </div>
        </div>
        <div className={s.hint}>
          <i className="fas fa-circle-info" /> {t('parametres.boutique.responsableHintPart1')} <strong>{t('parametres.boutique.responsableHintBold')}</strong>{t('parametres.boutique.responsableHintPart2')}
        </div>
      </FormCard>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS — calcul du % de complétion du profil
// ─────────────────────────────────────────────────────────────

function getStepsLabels(t: TFunction): Record<string, string> {
  return {
    logo:         t('parametres.boutique.steps.logo'),
    companyName:  t('parametres.boutique.steps.companyName'),
    contact:      t('parametres.boutique.steps.contact'),
    products:     t('parametres.boutique.steps.products'),
    coverImage:   t('parametres.boutique.steps.coverImage'),
    returnPolicy: t('parametres.boutique.steps.returnPolicy'),
  };
}

function getStepsDone(data: ParametresData | null, t: TFunction): string[] {
  if (!data) return [];
  const labels = getStepsLabels(t);
  const done: string[] = [];
  if (data.logo)                                    done.push(labels.logo);
  if (data.companyName)                             done.push(labels.companyName);
  if (data.businessPhone || data.businessEmail)     done.push(labels.contact);
  if ((data.productCount ?? 0) > 0)                 done.push(labels.products);
  return done;
}

function getStepsMissing(data: ParametresData | null, t: TFunction): string[] {
  if (!data) return [];
  const labels = getStepsLabels(t);
  const miss: string[] = [];
  if ((data.productCount ?? 0) === 0) miss.push(labels.products);
  if (!data.coverImage)   miss.push(labels.coverImage);
  if (!data.returnPolicy) miss.push(labels.returnPolicy);
  return miss;
}

function calculerCompletion(data: ParametresData | null): number {
  if (!data) return 0;
  const checks = [
    !!data.logo,
    !!data.companyName,
    !!(data.businessPhone || data.businessEmail),
    (data.productCount ?? 0) > 0,       // produits réellement publiés (et non plus les commandes)
    !!data.coverImage,
    !!data.returnPolicy,
  ];
  const score = checks.filter(Boolean).length;
  return Math.round((score / checks.length) * 100);
}