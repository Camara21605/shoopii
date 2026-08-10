/* ================================================================
 * FICHIER : profil-correspondant/hooks/useCorrespondantProfil.ts
 *
 * RÔLE : Charge le profil public d'un correspondant via l'API.
 *
 * Source unique : GET /client/correspondants/:id
 *
 * Sections sans endpoint backend (services, zones, tarifs, avis,
 * galerie, similaires) → tableaux vides. Les composants affichent
 * un état "Bientôt disponible" lorsqu'ils reçoivent un tableau vide.
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchCorrespondantProfil } from '../services/correspondantProfil.api';
import type {
  CorrProfil, InfoPratique, ScheduleRow, ContactRow,
  Service, ZoneCard, PaysPartenaire, TarifRow,
  AvisScore, AvisItem, GalerieItem, VerifRow, SimilaireItem,
} from '../data/types';

const AVIS_SCORE_VIDE: AvisScore = {
  moyenne: 0, total: 0,
  repartition: [
    { etoiles: 5, count: 0, pct: 0 },
    { etoiles: 4, count: 0, pct: 0 },
    { etoiles: 3, count: 0, pct: 0 },
    { etoiles: 2, count: 0, pct: 0 },
    { etoiles: 1, count: 0, pct: 0 },
  ],
  keywords: [],
};

export function useCorrespondantProfil(id: string | undefined) {
  const { t } = useTranslation();
  const [profil,  setProfil]  = useState<CorrProfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [suivi,   setSuivi]   = useState(false);

  const [infosPratiques, setInfosPratiques] = useState<InfoPratique[]>([]);
  const [schedule,       setSchedule]       = useState<ScheduleRow[]>([]);
  const [aboutTags,      setAboutTags]      = useState<string[]>([]);
  const [contacts,       setContacts]       = useState<ContactRow[]>([]);

  const load = useCallback(() => {
    if (!id) {
      setError(t('profilCorrespondant.idMissingError'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    fetchCorrespondantProfil(id)
      .then(api => {
        setProfil({
          id:           api.id,
          nom:          api.nom,
          initiales:    api.initiales,
          type:         api.type,
          typeLabel:    api.typeLabel,
          localisation: api.localisation,
          enLigne:      api.enLigne,
          membreDepuis: api.membreDepuis,
          abonnes:      api.abonnes,
          badges:       api.badges ?? [],
          bio:          api.bio?.length ? api.bio : [],
          missions:     api.missions     ?? 0,
          missionsMois: api.missionsMois ?? 0,
          note:         api.note         ?? 0,
          nbAvis:       api.nbAvis       ?? 0,
          fiabilite:    api.fiabilite    ?? 0,
          experience:   api.experience   ?? '—',
          zonesCount:   api.zonesCount   ?? 0,
          delaiMoyen:   api.delaiMoyen   ?? '—',
        });
        setInfosPratiques(api.infosPratiques ?? []);
        setSchedule(api.horaires ?? []);
        setAboutTags(api.aboutTags ?? []);
        setContacts(api.contacts ?? []);
        setSuivi(!!api.suivi);
      })
      .catch(e => {
        setError(e?.message ?? t('profilCorrespondant.loadError'));
        setProfil(null);
        setInfosPratiques([]);
        setSchedule([]);
        setAboutTags([]);
        setContacts([]);
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => { load(); }, [load]);

  /* Synchronise suivi après une action de FollowButton (le composant
   * fait lui-même l'appel API désormais). */
  const updateFollowState = useCallback((next: { isSuivi: boolean }) => {
    setSuivi(next.isSuivi);
  }, []);

  /* Statistiques sidebar dérivées des données API réelles */
  const statsSidebar = profil ? [
    { v: profil.missions > 0 ? profil.missions.toLocaleString('fr-FR') : '—', l: t('profilCorrespondant.statsSidebar.missionsTotales')  },
    { v: profil.note     > 0 ? `${profil.note.toFixed(1)}★`            : '—', l: t('profilCorrespondant.statsSidebar.noteMoyenne')      },
    { v: profil.fiabilite > 0 ? `${profil.fiabilite}%`                 : '—', l: t('profilCorrespondant.statsSidebar.tauxFiabilite')    },
    { v: profil.delaiMoyen !== '—' ? profil.delaiMoyen                 : '—', l: t('profilCorrespondant.statsSidebar.delaiRemise')      },
    { v: profil.missionsMois > 0 ? String(profil.missionsMois)         : '—', l: t('profilCorrespondant.statsSidebar.missionsCeMois')  },
    { v: '0',                                                                  l: t('profilCorrespondant.statsSidebar.litigesResolus')   },
  ] : [];

  /* Vérifications dérivées des badges API (pas de données fictives) */
  const verifications: VerifRow[] = (profil?.badges ?? []).map(b => ({
    label: b.label,
    sub:   t('profilCorrespondant.verifieParShopi'),
  }));

  return {
    profil, loading, error, suivi, updateFollowState, reload: load,
    /* Données réelles (API) */
    aboutTags, infosPratiques, schedule, contacts, statsSidebar, verifications,
    /* Sections sans endpoint backend → tableaux vides */
    services:        [] as Service[],
    zones:           [] as ZoneCard[],
    paysPartenaires: [] as PaysPartenaire[],
    tarifs:          [] as TarifRow[],
    avisScore:       AVIS_SCORE_VIDE,
    avis:            [] as AvisItem[],
    galerie:         [] as GalerieItem[],
    similaires:      [] as SimilaireItem[],
  };
}
