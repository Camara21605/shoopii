/* ================================================================
 * hooks/useDirty.ts
 * Gère l'état "modifications non sauvegardées"
 *
 * Usage :
 *   const { isDirty, dirty, save, discard } = useDirty(onSave);
 *
 *   dirty()           → marque comme modifié (affiche SaveFloat)
 *   save()            → sauvegarde + remet à zéro
 *   discard()         → annule + remet à zéro
 * ================================================================ */

import { useState, useCallback } from 'react';
import { pop } from '../components/Toast';

export function useDirty(onSave?: () => Promise<void>) {
  const [isDirty, setIsDirty] = useState(false);
  const [saving,  setSaving]  = useState(false);

  /** Appeler à chaque modification d'un champ */
  const dirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  /** Sauvegarder toutes les modifications */
  const save = useCallback(async () => {
    setSaving(true);
    try {
      if (onSave) await onSave();
      setIsDirty(false);
      pop('✅ Toutes les modifications sauvegardées', 's');
    } catch (e: any) {
      pop(`❌ Erreur : ${e.message ?? 'Sauvegarde échouée'}`, 'e');
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  /** Annuler les modifications */
  const discard = useCallback(() => {
    setIsDirty(false);
    pop('↩️ Modifications annulées', 'w');
  }, []);

  return { isDirty, saving, dirty, save, discard };
}