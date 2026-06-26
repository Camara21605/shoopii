/* ================================================================
 * FICHIER : profil-correspondant/hooks/useCorrespondantProfil.ts
 *
 * RÔLE : Charge le profil correspondant et gère le suivi (optimistic).
 *
 * ✅ RÉEL (API GET /client/correspondants/:id) :
 *    identité, KPI, badges, bio, infos pratiques, horaires, contacts, suivi.
 * 🟡 MOCK (pas encore de tables backend) :
 *    services, zones, tarifs, avis, galerie, vérifications, similaires.
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import { fetchCorrespondantProfil, toggleSuiviCorrespondant } from '../services/correspondantProfil.api';
import {
  CORR_MOCK, ABOUT_TAGS, INFOS_PRATIQUES, SCHEDULE, SERVICES, ZONES,
  PAYS_PARTENAIRES, TARIFS, AVIS_SCORE, AVIS, GALERIE, CONTACTS,
  STATS_SIDEBAR, VERIFICATIONS, SIMILAIRES,
} from '../data/correspondantMock';
import type { CorrProfil, InfoPratique, ScheduleRow, ContactRow } from '../data/types';

export function useCorrespondantProfil(id: string | undefined) {
  const [profil,  setProfil]  = useState<CorrProfil>(CORR_MOCK);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [suivi,   setSuivi]   = useState(false);

  /* Détails issus de l'API (avec fallback mock) */
  const [infosPratiques, setInfosPratiques] = useState<InfoPratique[]>(INFOS_PRATIQUES);
  const [schedule,       setSchedule]       = useState<ScheduleRow[]>(SCHEDULE);
  const [aboutTags,      setAboutTags]      = useState<string[]>(ABOUT_TAGS);
  const [contacts,       setContacts]       = useState<ContactRow[]>(CONTACTS);

  const load = useCallback(() => {
    if (!id) { setProfil(CORR_MOCK); setLoading(false); return; }
    setLoading(true);
    setError(null);

    fetchCorrespondantProfil(id)
      .then(api => {
        /* Identité + KPI réels */
        setProfil({
          ...CORR_MOCK,                       // garde missionsMois/zonesCount par défaut si 0
          id:           api.id,
          nom:          api.nom,
          initiales:    api.initiales,
          type:         api.type,
          typeLabel:    api.typeLabel,
          localisation: api.localisation,
          enLigne:      api.enLigne,
          membreDepuis: api.membreDepuis,
          abonnes:      api.abonnes,
          badges:       api.badges?.length ? api.badges : CORR_MOCK.badges,
          bio:          api.bio?.length ? api.bio : CORR_MOCK.bio,
          missions:     api.missions,
          missionsMois: api.missionsMois || CORR_MOCK.missionsMois,
          note:         api.note,
          nbAvis:       api.nbAvis || CORR_MOCK.nbAvis,
          fiabilite:    api.fiabilite,
          experience:   api.experience,
          zonesCount:   api.zonesCount || CORR_MOCK.zonesCount,
          delaiMoyen:   api.delaiMoyen || CORR_MOCK.delaiMoyen,
        });

        /* Détails réels (avec repli mock si l'API renvoie vide) */
        setInfosPratiques(api.infosPratiques?.length ? api.infosPratiques : INFOS_PRATIQUES);
        setSchedule(api.horaires?.length ? api.horaires : SCHEDULE);
        setAboutTags(api.aboutTags?.length ? api.aboutTags : ABOUT_TAGS);
        setContacts(api.contacts?.length ? api.contacts : CONTACTS);

        setSuivi(!!api.suivi);
      })
      .catch(e => {
        /* 404 ou réseau → on garde le mock pour ne pas casser l'affichage */
        setError(e?.message ?? 'Profil indisponible — données de démonstration.');
        setProfil(CORR_MOCK);
        setInfosPratiques(INFOS_PRATIQUES);
        setSchedule(SCHEDULE);
        setAboutTags(ABOUT_TAGS);
        setContacts(CONTACTS);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  /* Suivi optimiste + rollback */
  const toggleSuivi = useCallback(async () => {
    if (!id) return;
    setSuivi(s => !s);
    try {
      const { isSuivi } = await toggleSuiviCorrespondant(id);
      setSuivi(isSuivi);
    } catch {
      setSuivi(s => !s);
    }
  }, [id]);

  return {
    profil, loading, error, suivi, toggleSuivi, reload: load,
    /* Réel (API) */
    aboutTags, infosPratiques, schedule, contacts,
    /* Mock (en attendant les tables) */
    services: SERVICES, zones: ZONES, paysPartenaires: PAYS_PARTENAIRES,
    tarifs: TARIFS, avisScore: AVIS_SCORE, avis: AVIS, galerie: GALERIE,
    statsSidebar: STATS_SIDEBAR, verifications: VERIFICATIONS, similaires: SIMILAIRES,
  };
}