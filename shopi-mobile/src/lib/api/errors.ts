/** Erreur HTTP renvoyée par l'API (statut + message lisible par l'utilisateur). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isRateLimited() { return this.status === 429; }
  get isServerError() { return this.status >= 500; }
}

/** Pas de réponse : hors-ligne, DNS, serveur injoignable ou délai dépassé. */
export class NetworkError extends Error {
  constructor(message = 'Connexion impossible. Vérifiez votre réseau et réessayez.') {
    super(message);
    this.name = 'NetworkError';
  }
}

/** Message affichable pour n'importe quelle erreur, sans jamais fuiter de détail technique. */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof NetworkError) return error.message;
  return 'Une erreur inattendue est survenue. Réessayez.';
}
