/*
 * FICHIER : src/modules/home/components/panier/sections/AdresseSection.tsx
 * Connectée au profil client réel et aux adresses enregistrées.
 * Formulaire entièrement contrôlé — remonte les données via onAdresseChange.
 *
 * VILLES / COMMUNES : le VRAI référentiel géographique géré par les
 * administrateurs (GET /geo/villes?indicatif=+224 puis
 * /geo/items?niveau=commune&parentId=…), et non plus une liste figée de
 * 6 villes. BUG CORRIGÉ — `ville`/`commune` contenaient des codes
 * (« nzerekore », « kindia ») : le tarif de zone (recherche par NOM) et les
 * zones desservies par les boutiques (noms de communes) ne correspondaient
 * pas. Ils contiennent maintenant les NOMS du référentiel. Repli sur la
 * liste statique de la Guinée si le référentiel ne répond pas ou est vide.
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProfilData, AdresseItem } from '../../settings/api/settings.api';
import { apiFetch } from '../../../../../shared/services/apiFetch';
import { VILLES_SORTED, getCommunesByVille } from '../../../../../shared/location/data/geo-guinee';
import styles from '../styles/AdresseSection.module.css';

export interface AdresseFormData {
  prenom:         string;
  nom:            string;
  telephone:      string;
  /** Nom de la ville (préfecture) — ex. « Kindia » */
  ville:          string;
  /** Nom de la commune — ex. « Kaloum » */
  commune:        string;
  adressePrecise: string;
  instructions:   string;
}

interface GeoOption { id: string; nom: string }

/** Comparaison de noms sans accents ni casse (« Nzérékoré » = « nzerekore »). */
const same = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()
             === b.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

/* Repli : liste statique complète de la Guinée (shared/location/data/geo-guinee.ts) */
const VILLES_REPLI: GeoOption[] = VILLES_SORTED.map(v => ({ id: `repli:${v.nom}`, nom: v.nom }));
const communesRepli = (villeId: string): GeoOption[] => {
  const ville = villeId.replace('repli:', '');
  const rows  = getCommunesByVille(ville).map(c => ({ id: `repli:${ville}:${c.nom}`, nom: c.nom }));
  return rows.length ? rows : [{ id: villeId, nom: ville }];
};

async function chargerCommunes(ville: GeoOption): Promise<GeoOption[]> {
  if (ville.id.startsWith('repli:')) return communesRepli(ville.id);
  try {
    const rows = await apiFetch<GeoOption[]>(`/geo/items?niveau=commune&parentId=${ville.id}`, { public: true });
    return rows?.length ? rows : [{ id: `ville:${ville.id}`, nom: ville.nom }];
  } catch {
    return [{ id: `ville:${ville.id}`, nom: ville.nom }];
  }
}

interface Props {
  clientProfil:    ProfilData | null;
  savedAddresses:  AdresseItem[];
  loadingClient:   boolean;
  onVilleChange:   (v: string) => void;
  onAdresseChange: (addr: AdresseFormData) => void;
  onToast:         (m: string) => void;
}

const EMPTY: AdresseFormData = {
  prenom:'', nom:'', telephone:'', ville:'',
  commune:'', adressePrecise:'', instructions:'',
};

/** « Commune, Ville » — sans répéter quand la commune porte le nom de la ville. */
export function lieuLivraison(ville?: string, commune?: string): string {
  if (!commune || same(commune, ville)) return ville ?? '';
  return ville ? `${commune}, ${ville}` : commune;
}

const etaDest = (form: AdresseFormData) => lieuLivraison(form.ville, form.commune);

export default function AdresseSection({
  clientProfil, savedAddresses, loadingClient,
  onVilleChange, onAdresseChange, onToast,
}: Props) {
  const { t } = useTranslation();
  const [activeAddr, setActiveAddr] = useState('');
  const [form, setForm]             = useState<AdresseFormData>(EMPTY);
  const [villes,   setVilles]       = useState<GeoOption[]>([]);
  const [communes, setCommunes]     = useState<GeoOption[]>([]);
  const didInit = useRef(false);
  /* Dernière ville demandée : ignore la réponse d'une ville quittée entre-temps */
  const villeDemandee = useRef('');

  /* ── Villes du référentiel (Guinée) — repli sur l'ancienne liste ── */
  useEffect(() => {
    apiFetch<GeoOption[]>(`/geo/villes?indicatif=${encodeURIComponent('+224')}`, { public: true })
      .then(rows => setVilles(rows?.length ? rows : VILLES_REPLI))
      .catch(() => setVilles(VILLES_REPLI));
  }, []);

  const trouverVille = (nom?: string | null) =>
    villes.find(v => same(v.nom, nom)) ?? villes.find(v => same(v.nom, 'Conakry')) ?? villes[0] ?? null;

  /** Applique ville + commune (communes chargées pour cette ville) puis remonte le formulaire. */
  async function appliquer(base: AdresseFormData, villeNom?: string | null, communeNom?: string | null) {
    const ville = trouverVille(villeNom);
    if (!ville) return;
    villeDemandee.current = ville.id;
    const liste = await chargerCommunes(ville);
    if (villeDemandee.current !== ville.id) return;
    const commune = liste.find(c => same(c.nom, communeNom)) ?? liste[0] ?? null;
    const next = { ...base, ville: ville.nom, commune: commune?.nom ?? '' };
    setCommunes(liste);
    setForm(next);
    onAdresseChange(next);
    onVilleChange(etaDest(next));
  }

  /* ── Pré-remplissage initial quand les données client et les villes arrivent ── */
  useEffect(() => {
    if (didInit.current || !clientProfil || !villes.length) return;
    didInit.current = true;

    const def      = savedAddresses.find(a => a.isDefault) ?? savedAddresses[0] ?? null;
    const rawPhone = (def?.phone || clientProfil.phone || '').replace(/^\+?224\s*/, '').trim();

    setActiveAddr(def?.id ?? 'new');
    void appliquer({
      ...EMPTY,
      prenom:         clientProfil.firstName,
      nom:            clientProfil.lastName,
      telephone:      rawPhone,
      adressePrecise: def?.adresse ?? '',
    }, def?.ville, def?.commune);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientProfil, savedAddresses, villes]);

  /* ── Mise à jour d'un ou plusieurs champs ── */
  function update(patch: Partial<AdresseFormData>) {
    const next = { ...form, ...patch };
    /* Nouvelle ville : ses communes se chargent, la première est choisie */
    if (patch.ville && patch.ville !== form.ville) {
      void appliquer(next, patch.ville, null);
      return;
    }
    setForm(next);
    onAdresseChange(next);
    if ('commune' in patch) onVilleChange(etaDest(next));
  }

  /* ── Sélection d'une adresse enregistrée ── */
  function selectAddr(a: AdresseItem) {
    setActiveAddr(a.id);
    void appliquer({ ...form, adressePrecise: a.adresse ?? '', instructions: '' }, a.ville, a.commune);
    onToast(t('panierCommande.adresseSection.adresseSelectionneeToast', { nom: a.nom }));
  }

  /* ── Nouvelle adresse : même ville, champs d'adresse vidés ── */
  function newAddr() {
    const next: AdresseFormData = { ...form, adressePrecise: '', instructions: '' };
    setForm(next);
    setActiveAddr('new');
    onAdresseChange(next);
  }

  return (
    <div className={`${styles.sc} ${styles.lit}`}>

      {/* ── En-tête ── */}
      <div className={styles.scHd}>
        <div className={styles.scNum}>2</div>
        <div>
          <div className={styles.scTitre}>{t('panierCommande.adresseSection.titre')}</div>
          <div className={styles.scSub}>{t('panierCommande.adresseSection.sub')}</div>
        </div>
      </div>

      <div className={styles.scBody}>

        {/* ── Chips adresses enregistrées ── */}
        {loadingClient ? (
          <div style={{ height:52, display:'flex', alignItems:'center', gap:8, color:'var(--t3)', fontSize:13 }}>
            <i className="fas fa-spinner fa-spin" /> {t('panierCommande.adresseSection.chargementAdresses')}
          </div>
        ) : (
          <div className={styles.addrChips}>
            {savedAddresses.map(a => (
              <div
                key={a.id}
                className={`${styles.addrChip} ${activeAddr === a.id ? styles.addrChipSel : ''}`}
                onClick={() => selectAddr(a)}
              >
                <div className={styles.chipLabel}>
                  <i className={`fas ${a.isDefault ? 'fa-house' : 'fa-briefcase'}`} /> {a.nom}
                </div>
                {/* Nom tel que dans le référentiel (« kindia » saisi → « Kindia ») */}
                <div className={styles.chipVille}>
                  {lieuLivraison(villes.find(v => same(v.nom, a.ville))?.nom ?? a.ville, a.commune)}
                </div>
                <div className={styles.chipDetail}>
                  {a.adresse?.length > 32 ? a.adresse.substring(0, 32) + '…' : (a.adresse ?? '')}
                </div>
              </div>
            ))}
            <div
              className={`${styles.addrNew} ${activeAddr === 'new' ? styles.addrChipSel : ''}`}
              onClick={newAddr}
            >
              <i className="fas fa-plus" /> {t('panierCommande.adresseSection.nouvelle')}
            </div>
          </div>
        )}

        {/* ── Prénom + Nom ── */}
        <div className={styles.fr}>
          <div className={styles.fg}>
            <div className={styles.fl}>{t('panierCommande.adresseSection.prenom')} <span>*</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-user ${styles.fi}`} />
              <input
                className={`${styles.fin} ${form.prenom ? styles.finOk : ''}`}
                type="text" value={form.prenom} placeholder={t('panierCommande.adresseSection.prenomPlaceholder')}
                onChange={e => update({ prenom: e.target.value })}
              />
            </div>
          </div>
          <div className={styles.fg}>
            <div className={styles.fl}>{t('panierCommande.adresseSection.nom')} <span>*</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-user ${styles.fi}`} />
              <input
                className={`${styles.fin} ${form.nom ? styles.finOk : ''}`}
                type="text" value={form.nom} placeholder={t('panierCommande.adresseSection.nomPlaceholder')}
                onChange={e => update({ nom: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* ── Téléphone ── */}
        <div className={`${styles.fr} ${styles.frFull}`}>
          <div className={styles.fg}>
            <div className={styles.fl}>{t('panierCommande.adresseSection.telephone')} <span>*</span></div>
            <div className={styles.fw}>
              <div className={styles.dialCode}>🇬🇳 +224</div>
              <input
                className={`${styles.fin} ${styles.finTel} ${form.telephone ? styles.finOk : ''}`}
                type="tel" value={form.telephone} placeholder="6XX XXX XXX"
                onChange={e => update({ telephone: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* ── Ville + Commune ── */}
        <div className={styles.fr}>
          <div className={styles.fg}>
            <div className={styles.fl}>{t('panierCommande.adresseSection.villeLabel')} <span>*</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-city ${styles.fi}`} />
              <select
                className={styles.fin}
                value={form.ville}
                disabled={!villes.length}
                onChange={e => update({ ville: e.target.value })}
              >
                {!form.ville && <option value="">…</option>}
                {villes.map(v => <option key={v.id} value={v.nom}>{v.nom}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.fg}>
            <div className={styles.fl}>{t('panierCommande.adresseSection.commune')} <span>*</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-map-pin ${styles.fi}`} />
              <select
                className={styles.fin}
                value={form.commune}
                disabled={!communes.length}
                onChange={e => update({ commune: e.target.value })}
              >
                {!form.commune && <option value="">…</option>}
                {communes.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Adresse précise ── */}
        <div className={`${styles.fr} ${styles.frFull}`}>
          <div className={styles.fg}>
            <div className={styles.fl}>{t('panierCommande.adresseSection.adressePrecise')} <span className={styles.flOpt}>{t('panierCommande.adresseSection.adressePreciseOpt')}</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-location-dot ${styles.fi}`} />
              <input
                className={`${styles.fin} ${form.adressePrecise ? styles.finOk : ''}`}
                type="text" value={form.adressePrecise} placeholder={t('panierCommande.adresseSection.adressePrecisePlaceholder')}
                onChange={e => update({ adressePrecise: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* ── Instructions optionnelles ── */}
        <div className={`${styles.fr} ${styles.frFull}`}>
          <div className={styles.fg}>
            <div className={styles.fl}>
              {t('panierCommande.adresseSection.instructions')}
              <span className={styles.flOpt}>{t('panierCommande.adresseSection.optionnel')}</span>
            </div>
            <div className={styles.fw}>
              <i className={`fas fa-comment ${styles.fi}`} />
              <input
                className={styles.fin}
                type="text" value={form.instructions} placeholder={t('panierCommande.adresseSection.instructionsPlaceholder')}
                onChange={e => update({ instructions: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
