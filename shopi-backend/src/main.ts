import { NestFactory }    from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter }      from '@nestjs/platform-socket.io';

import { AppModule } from './app.module';

/*
|--------------------------------------------------------------------------
| FONCTION PRINCIPALE DE DÉMARRAGE
|--------------------------------------------------------------------------
|
| Cette fonction démarre toute l'application NestJS.
| Elle configure :
|
| - les validations globales DTO
| - le CORS
| - le préfixe API
| - le port du serveur
|
*/

async function bootstrap() {

  /*
  |--------------------------------------------------------------------------
  | CRÉATION DE L'APPLICATION NESTJS
  |--------------------------------------------------------------------------
  |
  | AppModule est le module racine de toute l'application.
  |
  */

  const app = await NestFactory.create(AppModule);



  /*
  |--------------------------------------------------------------------------
  | VALIDATION GLOBALE DES DONNÉES
  |--------------------------------------------------------------------------
  |
  | ValidationPipe permet de :
  |
  | - valider automatiquement les DTO
  | - supprimer les champs inconnus
  | - transformer les types automatiquement
  | - bloquer les données non autorisées
  |
  | Exemple :
  |
  | Avant :
  | {
  |   email: "test@gmail.com",
  |   age: "25"
  | }
  |
  | Après transform :
  | {
  |   email: "test@gmail.com",
  |   age: 25
  | }
  |
  */

  app.useGlobalPipes(
    new ValidationPipe({

      // Supprime automatiquement
      // les champs non définis dans les DTO
      whitelist: true,

      // Transforme automatiquement les types
      transform: true,

      // Bloque les champs inconnus
      forbidNonWhitelisted: true,

    }),
  );



  /*
  |--------------------------------------------------------------------------
  | CONFIGURATION CORS
  |--------------------------------------------------------------------------
  |
  | Permet au frontend React/Vite
  | de communiquer avec le backend NestJS.
  |
  | Sans CORS :
  | le navigateur bloque les requêtes frontend.
  |
  */

  /* Socket.IO a besoin de son propre adaptateur pour gérer CORS
     correctement sur les WebSockets (upgrade HTTP → WS). */
  app.useWebSocketAdapter(new IoAdapter(app));

  app.enableCors({
    /* Autorise localhost:5173 (Vite) et localhost:5174 (second onglet Vite) */
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
    ],
    credentials: true,
  });



  /*
  |--------------------------------------------------------------------------
  | PRÉFIXE GLOBAL API
  |--------------------------------------------------------------------------
  |
  | Toutes les routes commenceront par :
  |
  | /api
  |
  | Exemple :
  |
  | /auth/login
  | devient :
  |
  | /api/auth/login
  |
  */

  app.setGlobalPrefix('api');



  /*
  |--------------------------------------------------------------------------
  | PORT DU SERVEUR
  |--------------------------------------------------------------------------
  |
  | Utilise :
  |
  | - le port défini dans .env
  | - sinon 3001 par défaut
  |
  */

  const port = process.env.PORT || 3001;



  /*
  |--------------------------------------------------------------------------
  | DÉMARRAGE DU SERVEUR
  |--------------------------------------------------------------------------
  */

  await app.listen(port);



  /*
  |--------------------------------------------------------------------------
  | MESSAGE DE CONFIRMATION
  |--------------------------------------------------------------------------
  |
  | Affiche un message dans le terminal
  | quand le serveur démarre correctement.
  |
  */

  console.log(`🚀 Backend running on http://localhost:${port}`);

}

/*
|--------------------------------------------------------------------------
| LANCEMENT DE L'APPLICATION
|--------------------------------------------------------------------------
*/

bootstrap();