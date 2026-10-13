/**
 * Briques des écrans « Paramètres » du livreur : celles du kit commun
 * (features/settings-kit), avec un cadre d'écran qui charge par défaut la
 * fiche livreur complète.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { SettingsShell as KitShell } from '@/features/settings-kit/ui';

import { useLivreurSettings } from '../hooks';

export { Badge, confirmAction, FormCard, Hint, Input, SaveButton, Sheet, toast, toastError, ToggleRow, TONE, useUnsavedGuard, type IconName, type Tone } from '@/features/settings-kit/ui';

type ShellProps<T> = Omit<ComponentProps<typeof KitShell<T>>, 'query'> & { query?: UseQueryResult<T> };

/** Sans `query` : la fiche livreur (qk.livreur.settings), chargée seulement dans ce cas. */
export function SettingsShell<T>({ query, ...props }: ShellProps<T>) {
  const settings = useLivreurSettings(!query);
  return <KitShell<T> {...props} query={(query ?? settings) as UseQueryResult<T>} />;
}
