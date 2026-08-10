"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)({ quiet: true });
const nodemailer = __importStar(require("nodemailer"));
async function main() {
    const host = process.env.SMTP_HOST ?? 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
    const secure = port === 465;
    const user = process.env.SMTP_USER ?? '';
    const rawPass = process.env.SMTP_PASS ?? '';
    const pass = rawPass.replace(/\s/g, '');
    const from = process.env.SMTP_FROM ?? user;
    const to = process.argv[2] ?? user;
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
    });
    console.log('\n[1/2] Vérification de la connexion SMTP…');
    try {
        await transporter.verify();
        console.log('✅ Connexion + authentification SMTP réussies.');
    }
    catch (err) {
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
    console.log('\n[2/2] Envoi d\'un email de test…');
    try {
        const info = await transporter.sendMail({
            from: `"Shopi Africa (test)" <${from}>`,
            to,
            subject: `Shopi — Email de test (${new Date().toLocaleString('fr-FR')})`,
            text: 'Ceci est un email de test envoyé via scripts/test-email.ts. Si vous le recevez, le système d\'envoi d\'email de Shopi fonctionne correctement.',
            html: `<p>Ceci est un email de test envoyé via <code>scripts/test-email.ts</code>.</p><p>Si vous le recevez, le système d'envoi d'email de Shopi fonctionne correctement.</p>`,
        });
        console.log('✅ Email envoyé avec succès.');
        console.log(`   messageId : ${info.messageId}`);
        console.log(`   response  : ${info.response}`);
        console.log(`   accepted  : ${JSON.stringify(info.accepted)}`);
        console.log(`   rejected  : ${JSON.stringify(info.rejected)}`);
        console.log('\n   → Vérifiez la boîte de réception (et le dossier spam) de ' + to);
    }
    catch (err) {
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
//# sourceMappingURL=test-email.js.map