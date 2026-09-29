/**
 * src/shared/messagerie/utils/callTones.ts
 *
 * Sonneries d'appel jouées PAR L'APPLICATION (ouverte ou revenue au premier plan) :
 *   - « entrante » : sonnerie mélodique en boucle tant qu'un appel entrant n'est pas décroché ;
 *   - « sortante » : tonalité de retour d'appel (425 Hz, 1 s / 4 s — la norme européenne, utilisée
 *     en Guinée) tant que l'appelé ne répond pas.
 *
 * Avant : l'écran d'appel vibrait mais ne faisait AUCUN son. Les sons sont synthétisés (Web Audio) :
 * aucun fichier à télécharger, donc rien de plus au premier chargement.
 *
 * Une page web n'a pas accès à la sonnerie du téléphone ; application fermée, c'est la notification
 * d'appel (public/push-sw.js) qui prévient l'utilisateur.
 *
 * LECTURE AUTOMATIQUE : les navigateurs n'autorisent le son qu'après un geste de l'utilisateur sur la
 * page. installerDeverrouillageSon() prépare donc le moteur audio au premier toucher/clic — un appel
 * qui arrive plus tard peut alors sonner directement. Si aucun geste n'a encore eu lieu (application
 * tout juste ouverte), la sonnerie démarre au premier toucher de l'écran.
 */

export type TypeSonnerie = 'entrante' | 'sortante';

type FenetreAudio = Window & { webkitAudioContext?: typeof AudioContext };

let contexte: AudioContext | null = null;

function obtenirContexte(): AudioContext | null {
  if (contexte) return contexte;
  const Ctor = window.AudioContext ?? (window as FenetreAudio).webkitAudioContext;
  if (!Ctor) return null;
  try { contexte = new Ctor(); } catch { return null; }
  return contexte;
}

const GESTES = ['pointerdown', 'touchstart', 'keydown'] as const;

/** Prépare le moteur audio au premier geste de l'utilisateur (à appeler une fois, au démarrage). */
export function installerDeverrouillageSon(): void {
  const deverrouiller = () => {
    const ctx = obtenirContexte();
    if (!ctx) return;
    void ctx.resume().catch(() => { /* refusé : nouvel essai au prochain geste */ }).then(() => {
      if (ctx.state === 'running') GESTES.forEach((g) => window.removeEventListener(g, deverrouiller, true));
    });
  };
  GESTES.forEach((g) => window.addEventListener(g, deverrouiller, { capture: true, passive: true }));
}

/** Une note : attaque rapide puis extinction douce (timbre proche d'un xylophone). */
function note(ctx: AudioContext, sortie: AudioNode, freq: number, debut: number, duree: number, volume: number) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, debut);
  gain.gain.exponentialRampToValueAtTime(volume, debut + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
  osc.connect(gain).connect(sortie);
  osc.start(debut);
  osc.stop(debut + duree + 0.02);
}

/** Tonalité continue avec fondu (évite les « clics » au début et à la fin). */
function tonalite(ctx: AudioContext, sortie: AudioNode, freq: number, debut: number, duree: number, volume: number) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, debut);
  gain.gain.linearRampToValueAtTime(volume, debut + 0.02);
  gain.gain.setValueAtTime(volume, debut + duree - 0.02);
  gain.gain.linearRampToValueAtTime(0, debut + duree);
  osc.connect(gain).connect(sortie);
  osc.start(debut);
  osc.stop(debut + duree + 0.02);
}

/* Sonnerie entrante : deux arpèges montants (mi–sol–si–mi), puis silence ; cycle de 3 s. */
const MELODIE = [659.25, 783.99, 987.77, 1318.51];
const CYCLES: Record<TypeSonnerie, { periode: number; jouer: (ctx: AudioContext, sortie: AudioNode, t: number) => void }> = {
  entrante: {
    periode: 3,
    jouer: (ctx, sortie, t) => {
      [0, 0.75].forEach((decalage) => MELODIE.forEach((f, i) => note(ctx, sortie, f, t + decalage + i * 0.12, 0.35, 0.25)));
    },
  },
  sortante: {
    periode: 5,
    jouer: (ctx, sortie, t) => tonalite(ctx, sortie, 425, t, 1, 0.12),
  },
};

/**
 * Démarre une sonnerie en boucle et renvoie la fonction qui l'arrête.
 * Sans effet (et sans erreur) si le navigateur ne sait pas produire de son.
 */
export function demarrerSonnerie(type: TypeSonnerie): () => void {
  const ctx = obtenirContexte();
  if (!ctx) return () => { /* pas de Web Audio */ };

  const sortie = ctx.createGain();
  sortie.connect(ctx.destination);
  const { periode, jouer } = CYCLES[type];

  let arrete = false;
  let minuteur: ReturnType<typeof setInterval> | null = null;
  let prochain = 0;

  /* Programme les cycles à l'avance (1 s) : la boucle reste régulière même si le fil principal est chargé. */
  const programmer = () => {
    if (arrete || ctx.state !== 'running') return;
    if (prochain < ctx.currentTime) prochain = ctx.currentTime + 0.05;
    while (prochain < ctx.currentTime + 1) {
      jouer(ctx, sortie, prochain);
      prochain += periode;
    }
  };

  const lancer = () => {
    if (arrete || minuteur) return;
    programmer();
    minuteur = setInterval(programmer, 250);
  };

  /* Pas encore de geste sur la page : on sonnera au premier toucher. */
  const surGeste = () => { void ctx.resume().then(lancer).catch(() => { /* toujours bloqué */ }); };

  if (ctx.state === 'running') lancer();
  else {
    void ctx.resume().then(() => { if (ctx.state === 'running') lancer(); }).catch(() => { /* bloqué */ });
    GESTES.forEach((g) => window.addEventListener(g, surGeste, { capture: true, passive: true }));
  }

  return () => {
    if (arrete) return;
    arrete = true;
    if (minuteur) clearInterval(minuteur);
    GESTES.forEach((g) => window.removeEventListener(g, surGeste, true));
    /* Coupe net ce qui était déjà programmé (fondu très court pour éviter un clic). */
    try {
      sortie.gain.setValueAtTime(sortie.gain.value, ctx.currentTime);
      sortie.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
      setTimeout(() => sortie.disconnect(), 100);
    } catch { sortie.disconnect(); }
  };
}
