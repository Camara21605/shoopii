/**
 * Complète app.json (lu automatiquement et reçu ici dans `config`).
 *
 * Firebase (push des appels entrants, application fermée) : le fichier
 * google-services.json se télécharge depuis la console Firebase (projet →
 * application Android com.shoneya.app). Il n'est branché que s'il existe :
 * sans lui l'application se compile quand même, et les appels sonnent
 * seulement quand l'application est ouverte.
 *   - en local : déposer le fichier à la racine de shopi-mobile ;
 *   - sur EAS : variable de type fichier GOOGLE_SERVICES_JSON
 *     (eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json).
 */
const { existsSync } = require('fs');

module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ?? (existsSync('./google-services.json') ? './google-services.json' : undefined);

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
