/**
 * `npm run preview` — aperçu de l'app dans un navigateur (ou l'onglet
 * « Simple Browser » de VS Code) sur http://localhost:8082, branché sur le
 * VRAI serveur de production via le relais local (scripts/preview-relay.js,
 * qui contourne le blocage CORS des pages web SANS assouplir le serveur).
 * Lance le relais puis `expo start --web` ; Ctrl+C arrête les deux.
 */
const { spawn } = require('child_process');
const path = require('path');

const relay = spawn(process.execPath, [path.join(__dirname, 'preview-relay.js')], { stdio: 'inherit' });
const expo = spawn('npx', ['expo', 'start', '--web', '--port', '8082'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EXPO_PUBLIC_API_URL: 'http://localhost:3002/api' },
});

const stop = () => {
  relay.kill();
  expo.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
expo.on('exit', stop);
