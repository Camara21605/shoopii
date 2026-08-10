/* ============================================================
 * FICHIER : scripts/test-email.ts
 *
 * RÔLE : Vérifier en une seule commande que l'envoi d'email
 *        fonctionne, sans démarrer toute l'application Nest.
 *
 * USAGE :
 *   npm run test:email                    → envoie à SMTP_USER (soi-même)
 *   npm run test:email -- destinataire@x.com
 *
 * Ce script utilise EXACTEMENT la même config que MailService
 * (src/modules/email/email.service.ts) — SMTP_HOST/PORT/USER/PASS/FROM
 * — pour que "ça marche ici" garantisse "ça marche dans l'app".
 *
 * SORTIE :
 *   - Étape 1 : vérifie la connexion SMTP (transporter.verify())
 *   - Étape 2 : envoie un email de test réel
 *   - Affiche le code d'erreur exact (err.code, err.responseCode,
 *     err.response) en cas d'échec — jamais un catch silencieux.
 * ============================================================ */

import { config as loadEnv } from 'dotenv';
loadEnv({ quiet: true } as any); // quiet: supprime le bandeau promo de dotenv v17+

import * as nodemailer from 'nodemailer';

async function main() {
  const host   = process.env.SMTP_HOST ?? 'smtp.gmail.com';
  const port   = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const secure = port === 465;
  const user   = process.env.SMTP_USER ?? '';
  const rawPass = process.env.SMTP_PASS ?? '';
  const pass   = rawPass.replace(/\s/g, '');
  const from   = process.env.SMTP_FROM ?? user;
  const to     = process.argv[2] ?? user;

  console.log('════════════════════════════════════════════════════════');
  console.log(' Shopi — Test d\'envoi d\'email');
  console.log('════════════════════════════════════════════════════════');
  console.log(` HOST : ${host}`);
  console.log(` PORT : ${port} (secure=${secure})`);
  console.log(` USER : ${user || '❌ NON CONFIGURÉ'}`);
  console.log(` PASS : ${pass ? `${pass.length} caractères` : '❌ NON CONFIGURÉ'}`);
  console.log(` FROM : ${from}`);
  console.log(` TO   : ${to || '❌ AUCUN DESTINATAIRE (ni argument, ni SMTP_USER)'}`);
  console.log('────────────────────────────────────────────────────────');

  if (!user || !pass) {
    console.error('❌ SMTP_USER ou SMTP_PASS absent du .env — impossible de continuer.');
    process.exit(1);
  }
  if (!to) {
    console.error('❌ Aucun destinataire (fournissez-en un en argument ou définissez SMTP_USER).');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  } as any);

  // ── Étape 1 : vérification de la connexion/authentification SMTP ──
  console.log('\n[1/2] Vérification de la connexion SMTP…');
  try {
    await transporter.verify();
    console.log('✅ Connexion + authentification SMTP réussies.');
  } catch (err: any) {
    console.error('❌ Connexion SMTP ÉCHOUÉE.');
    console.error(`   code           : ${err.code ?? 'N/A'}`);
    console.error(`   responseCode   : ${err.responseCode ?? 'N/A'}`);
    console.error(`   response       : ${err.response ?? 'N/A'}`);
    console.error(`   message        : ${err.message}`);
    console.error('\n   Causes fréquentes :');
    console.error('   - Gmail : App Password expiré/révoqué → régénérez-en un sur');
    console.error('     https://myaccount.google.com/apppasswords');
    console.error('   - "Less secure app access" désactivé (obligatoire d\'utiliser un App Password, pas le mot de passe du compte)');
    console.error('   - Blocage réseau sortant sur le port SMTP (fréquent sur certains hébergeurs)');
    process.exit(1);
  }

  // ── Étape 2 : envoi réel d'un email de test ──
  console.log('\n[2/2] Envoi d\'un email de test…');
  try {
    const info = await transporter.sendMail({
      from:    `"Shopi Africa (test)" <${from}>`,
      to,
      subject: `Shopi — Email de test (${new Date().toLocaleString('fr-FR')})`,
      text:    'Ceci est un email de test envoyé via scripts/test-email.ts. Si vous le recevez, le système d\'envoi d\'email de Shopi fonctionne correctement.',
      html:    `<p>Ceci est un email de test envoyé via <code>scripts/test-email.ts</code>.</p><p>Si vous le recevez, le système d'envoi d'email de Shopi fonctionne correctement.</p>`,
    });
    console.log('✅ Email envoyé avec succès.');
    console.log(`   messageId : ${info.messageId}`);
    console.log(`   response  : ${info.response}`);
    console.log(`   accepted  : ${JSON.stringify(info.accepted)}`);
    console.log(`   rejected  : ${JSON.stringify(info.rejected)}`);
    console.log('\n   → Vérifiez la boîte de réception (et le dossier spam) de ' + to);
  } catch (err: any) {
    console.error('❌ Envoi ÉCHOUÉ.');
    console.error(`   code           : ${err.code ?? 'N/A'}`);
    console.error(`   responseCode   : ${err.responseCode ?? 'N/A'}`);
    console.error(`   response       : ${err.response ?? 'N/A'}`);
    console.error(`   message        : ${err.message}`);
    process.exit(1);
  }

  console.log('════════════════════════════════════════════════════════');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erreur inattendue :', err);
  process.exit(1);
});
