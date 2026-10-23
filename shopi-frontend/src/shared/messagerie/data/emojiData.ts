/**
 * src/shared/messagerie/data/emojiData.ts
 * Emojis, autocollants et réactions de la messagerie (mêmes listes que
 * l'application : shopi-mobile/src/features/messagerie/emoji-data.ts).
 *
 *   QUICK_REACTIONS : la barre de réactions d'un message (appui long)
 *   EMOJI_CATEGORIES : le panneau 😊 de la zone de saisie (insère dans le texte)
 *   STICKERS : onglet « Autocollants » — envoyés tout de suite, en GRAND
 *   isJumboEmoji() : un message fait seulement de 1 à 3 emojis s'affiche en
 *     grand, sans bulle (comme WhatsApp) — c'est ainsi qu'apparaît un autocollant.
 */

export const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

export interface EmojiCategory { key: string; label: string; icon: string; emojis: string[] }

const split = (s: string) => s.split(' ').filter(Boolean);

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: 'smileys', label: 'Smileys', icon: '😀',
    emojis: split('😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 ☺️ 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 🤡 👻 👽 🤖 💩'),
  },
  {
    key: 'coeurs', label: 'Cœurs', icon: '❤️',
    emojis: split('❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❤️‍🩹 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💌 💋 😻 💑 💏 🌹 🥀 💐'),
  },
  {
    key: 'gestes', label: 'Gestes', icon: '👍',
    emojis: split('👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💪 🦾 🫶 🫡 🙋 🙆 🙅 🤷 🤦 💁 🙇 🧎 🏃 💃 🕺 👀 👁️ 👂 👃 🧠'),
  },
  {
    key: 'animaux', label: 'Animaux et nature', icon: '🐶',
    emojis: split('🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🐙 🐠 🐬 🐳 🦈 🐊 🐘 🦒 🐪 🐫 🦓 🐐 🐑 🌳 🌴 🌵 🌿 🍀 🌻 🌺 🌸 🌼 🌷 🌞 🌙 ⭐ 🌟 ✨ ⚡ 🔥 🌈 ☀️ ⛅ 🌧️ ⛈️ ❄️ 💧 🌊'),
  },
  {
    key: 'nourriture', label: 'Nourriture', icon: '🍔',
    emojis: split('🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥔 🥕 🌽 🌶️ 🥒 🥬 🧅 🧄 🍞 🥖 🥐 🧀 🥚 🍳 🥞 🍗 🍖 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍛 🍚 🍙 🍤 🍰 🎂 🧁 🍩 🍪 🍫 🍬 🍭 🍯 🥛 ☕ 🍵 🧃 🥤 🧋 🍹 🧊'),
  },
  {
    key: 'activites', label: 'Fêtes et activités', icon: '🎉',
    emojis: split('🎉 🎊 🎈 🎁 🎀 🪅 🎆 🎇 🧨 🎄 🎃 🏆 🥇 🥈 🥉 🏅 🎖️ ⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🥊 🥋 🎯 🎮 🕹️ 🎲 🧩 🎨 🎬 🎤 🎧 🎼 🎵 🎶 🥁 🎸 🎹 🎺 🎻 📚 🎓'),
  },
  {
    key: 'voyages', label: 'Voyages et lieux', icon: '🚗',
    emojis: split('🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🛵 🏍️ 🚲 🛴 ✈️ 🚀 🛸 🚁 ⛵ 🚤 🚢 ⚓ 🚦 🗺️ 🏠 🏡 🏢 🏬 🏪 🏫 🏥 🏦 🏨 🕌 ⛪ 🏟️ 🏖️ 🏝️ ⛰️ 🗻 🌍 🌎 🌏 📍 🧭'),
  },
  {
    key: 'objets', label: 'Objets', icon: '📦',
    emojis: split('📱 💻 ⌨️ 🖥️ 🖨️ 📷 📸 📹 🎥 📺 📻 ⌚ ⏰ ⏳ 💡 🔦 🔋 🔌 💰 💵 💶 💳 💎 🛒 🛍️ 📦 📫 ✉️ 📝 📄 📅 📌 📎 ✂️ 🔒 🔑 🔨 🛠️ 🔧 🧰 🧲 💊 🩺 🧴 🧼 🧹 👕 👖 👗 👟 👠 👜 🎒 👓 🕶️ 💍 👑'),
  },
  {
    key: 'symboles', label: 'Symboles', icon: '✅',
    emojis: split('✅ ☑️ ✔️ ❌ ❎ ⭕ 🛑 ⛔ 🚫 ❗ ❕ ❓ ❔ ‼️ ⁉️ 💯 🔞 ♻️ ⚠️ 🔔 🔕 📣 📢 💬 💭 🗨️ 🆗 🆕 🆓 🆒 🔝 🔜 ➕ ➖ ➗ ✖️ 🟢 🟡 🔴 🔵 🟣 ⚫ ⚪ 🟠 ⬆️ ⬇️ ⬅️ ➡️ 🔄 🔁 ▶️ ⏸️ ⏹️'),
  },
];

/** Autocollants : envoyés tout de suite et affichés en grand. */
export const STICKERS: string[] = split(
  '❤️ 😍 🥰 😘 😂 🤣 😭 😱 😡 🥺 😎 🤩 🥳 😴 🤔 🙄 😇 🤗 🤭 🫡 👍 👏 🙌 🙏 💪 👋 🤝 🫶 ✌️ 👌 🔥 💯 🎉 🎁 🌹 💐 ⭐ ✨ ☀️ 🌙 🍀 🎂 ☕ 🍕 🛵 📦 🛍️ 💰 🏆 🚀',
);

/* Pictogrammes : paires de substitution (emojis U+1F000…) et symboles U+2600–27BF ;
 * joints (ZWJ), sélecteurs de variante et espaces sont tolérés. Pas de \p{…} :
 * certains moteurs JavaScript mobiles ne le gèrent pas. */
const ONLY_EMOJI = /^(?:[\uD83C-\uDBFF][\uDC00-\uDFFF]|[←-⇿⌀-⏿①-➿⤴⤵⬅-⭕〰〽㊗㊙©®‼⁉™ℹ]|‍|️|\s)+$/;
const PICTO = /[\uD83C-\uDBFF][\uDC00-\uDFFF]|[←-⇿⌀-⏿①-➿⤴⤵⬅-⭕〰〽㊗㊙©®‼⁉™ℹ]/g;
/* Modificateurs de couleur de peau (U+1F3FB–1F3FF) : ne comptent pas comme un emoji de plus */
const SKIN = /\uD83C[\uDFFB-\uDFFF]/g;
/* Indicateurs régionaux (drapeaux) : 2 caractères pour 1 drapeau */
const FLAG = /\uD83C[\uDDE6-\uDDFF]/g;

/** Nombre d'emojis d'un texte fait UNIQUEMENT d'emojis (0 sinon). */
export function emojiOnlyCount(text: string | null | undefined): number {
  const t = (text ?? '').trim();
  if (!t || t.length > 40 || !ONLY_EMOJI.test(t)) return 0;
  const pictos = (t.match(PICTO) ?? []).length;
  const skins = (t.match(SKIN) ?? []).length;
  const flags = (t.match(FLAG) ?? []).length;
  const joins = (t.match(/‍/g) ?? []).length;
  return Math.max(1, pictos - skins - Math.floor(flags / 2) - joins);
}

/** 1 à 3 emojis seuls : affichage en grand, sans bulle. */
export const isJumboEmoji = (text: string | null | undefined) => {
  const n = emojiOnlyCount(text);
  return n >= 1 && n <= 3;
};

/** Résumé des réactions pour l'affichage : [{ emoji, count, mine }] trié par nombre. */
export function summarizeReactions(reactions: Record<string, string[]> | null | undefined, myUserId: string | undefined) {
  return Object.entries(reactions ?? {})
    .filter(([, ids]) => Array.isArray(ids) && ids.length > 0)
    .map(([emoji, ids]) => ({ emoji, count: ids.length, mine: !!myUserId && ids.includes(myUserId) }))
    .sort((a, b) => b.count - a.count);
}

/** Bascule MA réaction sur un emoji (mise à jour immédiate, avant la réponse du serveur). */
export function toggleLocalReaction(reactions: Record<string, string[]> | null | undefined, emoji: string, myUserId: string): Record<string, string[]> {
  const next: Record<string, string[]> = { ...(reactions ?? {}) };
  const ids = next[emoji] ?? [];
  next[emoji] = ids.includes(myUserId) ? ids.filter((i) => i !== myUserId) : [...ids, myUserId];
  if (next[emoji].length === 0) delete next[emoji];
  return next;
}
