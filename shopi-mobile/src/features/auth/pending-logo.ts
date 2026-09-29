/**
 * Logo choisi à l'inscription d'une entreprise, en attente d'envoi.
 * L'envoi exige d'être connecté (comme sur le site) : il part juste après
 * l'inscription — ou après la vérification de l'email si la plateforme
 * l'exige (écran verify-email). Mémoire seulement (pas de stockage disque).
 */
import { uploadCompanyLogo } from '@/features/auth/api';

let pending: { uri: string; mimeType: string } | null = null;

export const setPendingLogo = (logo: { uri: string; mimeType: string } | null) => {
  pending = logo;
};

/** Envoie le logo en attente (une fois connecté). Un échec n'empêche jamais l'accès au compte. */
export async function flushPendingLogo(): Promise<boolean> {
  if (!pending) return true;
  const logo = pending;
  pending = null;
  try {
    await uploadCompanyLogo(logo.uri, logo.mimeType);
    return true;
  } catch {
    return false;
  }
}
