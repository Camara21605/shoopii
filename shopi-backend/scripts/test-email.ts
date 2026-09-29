/* ============================================================
 * FICHIER : scripts/test-email.ts
 *
 * RÔLE : Vérifier en une seule commande que l'envoi d'email
 *        fonctionne, sans démarrer toute l'application Nest.
 *
 * USAGE :
 *   npm run test:email -- destinataire@x.com
 *   npm run test:email                    → envoie à SMTP_FROM (soi-même)
 *
 * Ce script utilise EXACTEMENT la même config que MailService
 * (src/modules/email/email.service.ts) — API HTTP Brevo avec
 * BREVO_API_KEY + SMTP_FROM — pour que "ça marche ici" garantisse
 * "ça marche dans l'app".
 *
 * SORTIE :
 *   - Étape 1 : vérifie la clé API (GET /v3/account)
 *   - Étape 2 : envoie un email de test réel (POST /v3/smtp/email)
 *   - Affiche le statut HTTP et la réponse exacte de Brevo en cas
 *     d'échec — jamais un catch silencieux.
 * ============================================================ */

import { config as loadEnv } from 'dotenv';
loadEnv({ quiet: true } as any); // quiet: supprime le bandeau promo de dotenv v17+

const BREVO_ACCOUNT_URL = 'https://api.brevo.com/v3/account';
const BREVO_SEND_URL    = 'https://api.brevo.com/v3/smtp/email';

async function main() {
  const apiKey = (process.env.BREVO_API_KEY ?? '').trim();
  const from   = process.env.SMTP_FROM ?? 'noreply@shoneya.com';
  const to     = process.argv[2] ?? from;

  console.log('════════════════════════════════════════════════════════');
  console.log(' Shopi — Test d\'envoi d\'email (API Brevo)');
  console.log('════════════════════════════════════════════════════════');
  console.log(` API KEY : ${apiKey ? `${apiKey.length} caractères` : '❌ NON CONFIGURÉE'}`);
  console.log(` FROM    : ${from}`);
  console.log(` TO      : ${to}`);
  console.log('────────────────────────────────────────────────────────');

  if (!apiKey) {
    console.error('❌ BREVO_API_KEY absente du .env — impossible de continuer.');
    process.exit(1);
  }

  const headers = {
    accept:         'application/json',
    'content-type': 'application/json',
    'api-key':      apiKey,
  };

  // ── Étape 1 : vérification de la clé API ──
  console.log('\n[1/2] Vérification de la clé API Brevo…');
  const accountRes = await fetch(BREVO_ACCOUNT_URL, { headers });
  if (!accountRes.ok) {
    console.error(`❌ Clé API refusée (HTTP ${accountRes.status}).`);
    console.error(`   réponse : ${await accountRes.text()}`);
    console.error('\n   Causes fréquentes :');
    console.error('   - Clé révoquée ou mal copiée (format attendu : xkeysib-...)');
    console.error('   - Clé SMTP fournie à la place d\'une clé API');
    console.error('   - IP non autorisée (Brevo → Security → Authorised IPs)');
    process.exit(1);
  }
  console.log('✅ Clé API valide.');

  // ── Étape 2 : envoi réel d'un email de test ──
  console.log('\n[2/2] Envoi d\'un email de test…');
  const sendRes = await fetch(BREVO_SEND_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sender:      { name: 'Shoneya (test)', email: from },
      to:          [{ email: to }],
      subject:     `Shopi — Email de test (${new Date().toLocaleString('fr-FR')})`,
      htmlContent: `<p>Ceci est un email de test envoyé via <code>scripts/test-email.ts</code>.</p><p>Si vous le recevez, le système d'envoi d'email de Shopi fonctionne correctement.</p>`,
      textContent: 'Ceci est un email de test envoyé via scripts/test-email.ts. Si vous le recevez, le système d\'envoi d\'email de Shopi fonctionne correctement.',
    }),
  });
  const body = await sendRes.text();
  if (!sendRes.ok) {
    console.error(`❌ Envoi ÉCHOUÉ (HTTP ${sendRes.status}).`);
    console.error(`   réponse : ${body}`);
    console.error('   → Vérifiez que SMTP_FROM est un expéditeur validé dans Brevo (Senders & IP).');
    process.exit(1);
  }
  console.log('✅ Email envoyé avec succès.');
  console.log(`   réponse : ${body}`);
  console.log('\n   → Vérifiez la boîte de réception (et le dossier spam) de ' + to);

  console.log('════════════════════════════════════════════════════════');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erreur inattendue :', err);
  process.exit(1);
});
