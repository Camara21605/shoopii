/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/CatalogueSection.tsx
 * Section 4 — Catalogue & Règles de publication
 * PATCH /dashboard/entreprise/parametres/catalogue
 *
 * Chaque réglage est réellement appliqué ailleurs :
 *   - produits en rupture masqués     → pages publiques + recherche (public/explore)
 *   - publication automatique         → création de produit / service
 *   - prix barrés                     → boutique, fiche produit, produits similaires
 *   - avis clients                    → dépôt d'avis après commande
 *   - politique de retour             → fiche produit + page boutique
 * CORRIGÉ : la « devise d'affichage » (GNF/EUR/USD) était enregistrée mais
 * lue nulle part — les prix restaient en GNF quoi qu'on choisisse. Remplacée
 * par l'information réelle (GNF, devise de la plateforme), non modifiable.
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';
import type { ToastType } from '../../types';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: ToastType) => void;
  saveCatalogue: (b: Partial<ParametresData>) => Promise<void>;
}

/* Interrupteur réutilisable — vrai bouton (clavier + lecteurs d'écran) */
function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'12px 0', borderBottom:'1px solid var(--bdr)' }}>
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--navy)' }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{sub}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        style={{
          width:44, height:24, borderRadius:12, flexShrink:0, cursor:'pointer', border:'none', padding:0,
          background: value ? 'var(--t2)' : 'var(--g300)',
          position:'relative', transition:'background .2s',
        }}
      >
        <span style={{
          position:'absolute', top:3, width:18, height:18, borderRadius:'50%',
          background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)',
          left: value ? 22 : 3,
        }} />
      </button>
    </div>
  );
}

export default function CatalogueSection({ data, saving, onDirty, onToast, saveCatalogue }: Props) {
  const { t } = useTranslation();
  const [showOutOfStock,  setShowOutOfStock]  = useState(true);
  const [autoPublish,     setAutoPublish]     = useState(true);
  const [showStrikePrice, setShowStrikePrice] = useState(true);
  const [allowReviews,    setAllowReviews]    = useState(true);
  const [returnPolicy,    setReturnPolicy]    = useState('');

  /* Dernières valeurs CONFIRMÉES par le serveur (empreinte JSON).
   *
   * BUG CORRIGÉ — l'auto-save reposait sur un drapeau « ignorer le prochain
   * changement » armé à chaque rechargement des données. Quand les données
   * rechargées étaient identiques, aucun rendu ne le consommait : il restait
   * armé et avalait la modification SUIVANTE de l'utilisateur, jamais
   * enregistrée (un interrupteur, ou une partie du texte de la politique de
   * retour). Désormais : on enregistre dès que ce qui est à l'écran diffère de
   * ce que le serveur a confirmé — rien n'est jamais avalé, et un simple
   * rechargement n'envoie rien. */
  const serverSnapRef  = useRef<string | null>(null);
  /* Réponse d'un enregistrement arrivée APRÈS une nouvelle saisie : on garde
   * la saisie (elle partira au prochain enregistrement). */
  const editVersionRef = useRef(0);
  const sentVersionRef = useRef(0);

  const current = { showOutOfStock, autoPublish, showStrikePrice, allowReviews, returnPolicy };
  const currentSnap = JSON.stringify(current);

  useEffect(() => {
    if (!data) return;
    const server = {
      showOutOfStock:  data.showOutOfStock  ?? true,
      autoPublish:     data.autoPublish     ?? true,
      showStrikePrice: data.showStrikePrice ?? true,
      allowReviews:    data.allowReviews    ?? true,
      returnPolicy:    data.returnPolicy    ?? '',
    };
    serverSnapRef.current = JSON.stringify(server);
    if (editVersionRef.current !== sentVersionRef.current) return;
    setShowOutOfStock(server.showOutOfStock);
    setAutoPublish(server.autoPublish);
    setShowStrikePrice(server.showStrikePrice);
    setAllowReviews(server.allowReviews);
    setReturnPolicy(server.returnPolicy);
  }, [data]);

  function mark(fn: () => void) { editVersionRef.current += 1; fn(); onDirty(); }

  /* Sauvegarde automatique après une courte pause (800 ms) — seulement si
   * l'écran diffère de ce que le serveur a confirmé. */
  useEffect(() => {
    if (serverSnapRef.current === null || currentSnap === serverSnapRef.current) return;
    const timer = setTimeout(() => {
      sentVersionRef.current = editVersionRef.current;
      saveCatalogue(current)
        .then(() => onToast(t('parametres.catalogue.savedToast'), 's'))
        .catch(() => onToast(t('parametres.catalogue.errorToast'), 'e'));
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSnap]);

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-tags" /> {t('parametres.catalogue.title')}</h1>
        <p>{t('parametres.catalogue.subtitle')}</p>
      </div>

      <FormCard title={t('parametres.catalogue.reglesTitle')} icon="fa-eye" subtitle={t('parametres.catalogue.reglesSubtitle')}>
        <Toggle label={t('parametres.catalogue.afficherRupture')} sub={t('parametres.catalogue.afficherRuptureSub')} value={showOutOfStock} onChange={v => mark(() => setShowOutOfStock(v))} />
        <Toggle label={t('parametres.catalogue.publicationAuto')} sub={t('parametres.catalogue.publicationAutoSub')} value={autoPublish} onChange={v => mark(() => setAutoPublish(v))} />
        <Toggle label={t('parametres.catalogue.afficherPrixBarres')} sub={t('parametres.catalogue.afficherPrixBarresSub')} value={showStrikePrice} onChange={v => mark(() => setShowStrikePrice(v))} />
        <Toggle label={t('parametres.catalogue.autoriserAvis')} sub={t('parametres.catalogue.autoriserAvisSub')} value={allowReviews} onChange={v => mark(() => setAllowReviews(v))} />

        <div className={s.fg} style={{ marginTop:16 }}>
          <div className={s.fl}>{t('parametres.catalogue.deviseAffichage')}</div>
          <div className={s.fw}>
            <i className={`fas fa-coins ${s.fi}`} />
            <input className={s.fin} readOnly value={t('parametres.catalogue.deviseGnf')}
              style={{ background:'var(--g100)', cursor:'default', color:'var(--t2)' }} />
          </div>
          <div className={s.hint}><i className="fas fa-circle-info" /> {t('parametres.catalogue.deviseHint')}</div>
        </div>
      </FormCard>

      <FormCard title={t('parametres.catalogue.politiqueRetourTitle')} icon="fa-rotate-left" subtitle={t('parametres.catalogue.politiqueRetourSubtitle')}>
        <div className={s.fg}>
          <div className={s.fw}>
            <textarea
              className={`${s.fin} ${s.finTextarea}`}
              value={returnPolicy}
              onChange={e => mark(() => setReturnPolicy(e.target.value))}
              maxLength={2000}
              placeholder={t('parametres.catalogue.politiquePlaceholder')}
              style={{ paddingLeft:14 }}
            />
          </div>
          <div className={s.hint}><i className="fas fa-circle-info" /> {t('parametres.catalogue.politiqueHint')}</div>
        </div>

        {/* Plus de bouton — enregistrement automatique (voir l'effet
         * debounced ci-dessus). Indicateur discret pendant l'appel réseau. */}
        {saving && (
          <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:7, fontSize:12.5, color:'var(--t3)' }}>
            <i className="fas fa-spinner fa-spin" /> {t('parametres.catalogue.sauvegardeEnCours')}
          </div>
        )}
      </FormCard>
    </>
  );
}