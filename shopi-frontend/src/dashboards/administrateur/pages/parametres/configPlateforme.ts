/* ================================================================
 * FICHIER : pages/parametres/configPlateforme.ts
 * Lecture seule des sections de configuration commune (voir
 * ConfigPlateformeBandeau.tsx) : le <fieldset disabled> neutralise les
 * champs et boutons ; pointer-events coupe aussi les interrupteurs
 * dessinés en <div onClick>.
 * ================================================================ */

import type { CSSProperties } from 'react';

export function fieldsetStyle(lectureSeule: boolean): CSSProperties {
  return lectureSeule
    ? { border: 0, margin: 0, padding: 0, minWidth: 0, pointerEvents: 'none' }
    : { border: 0, margin: 0, padding: 0, minWidth: 0 };
}
