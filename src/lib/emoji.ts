// Tiny curated emoji catalog for the `:` picker. Heavy emoji libraries cost
// 200+KB and most chat use-cases hit the same ~80 glyphs — we ship those
// inline. Extending later is a one-line addition per glyph.

export interface EmojiEntry {
  /** Display glyph. */
  emoji: string;
  /** Short slug + searchable terms. */
  name: string;
  /** Alternate keywords ("happy", "lol"). */
  keywords?: string[];
}

export const EMOJI_LIST: EmojiEntry[] = [
  // smileys
  { emoji: "😀", name: "grinning", keywords: ["happy", "smile"] },
  { emoji: "😄", name: "smile", keywords: ["happy"] },
  { emoji: "😁", name: "beaming", keywords: ["grin"] },
  { emoji: "😆", name: "laughing", keywords: ["lol", "haha"] },
  { emoji: "😂", name: "joy", keywords: ["lol", "haha", "tears"] },
  { emoji: "🤣", name: "rofl", keywords: ["lol", "haha"] },
  { emoji: "😊", name: "blush", keywords: ["happy", "smile"] },
  { emoji: "🙂", name: "slight_smile" },
  { emoji: "😉", name: "wink" },
  { emoji: "😍", name: "heart_eyes", keywords: ["love"] },
  { emoji: "🥰", name: "smiling_with_hearts", keywords: ["love"] },
  { emoji: "😘", name: "kiss" },
  { emoji: "😎", name: "sunglasses", keywords: ["cool"] },
  { emoji: "🤩", name: "star_struck" },
  { emoji: "🥳", name: "party", keywords: ["birthday", "celebrate"] },
  { emoji: "😋", name: "yum" },
  { emoji: "🤔", name: "thinking" },
  { emoji: "🤨", name: "raised_brow" },
  { emoji: "😐", name: "neutral" },
  { emoji: "😑", name: "expressionless" },
  { emoji: "😶", name: "no_mouth" },
  { emoji: "😏", name: "smirk" },
  { emoji: "😒", name: "unamused" },
  { emoji: "🙄", name: "rolling_eyes" },
  { emoji: "😬", name: "grimace" },
  { emoji: "🥺", name: "pleading" },
  { emoji: "😢", name: "cry", keywords: ["sad"] },
  { emoji: "😭", name: "sob", keywords: ["sad", "cry"] },
  { emoji: "😡", name: "angry", keywords: ["mad"] },
  { emoji: "🤬", name: "cursing" },
  { emoji: "🥲", name: "smile_tear" },
  { emoji: "😴", name: "sleeping" },
  { emoji: "🤯", name: "mind_blown" },
  // hands / people
  { emoji: "👍", name: "thumbs_up", keywords: ["yes", "ok"] },
  { emoji: "👎", name: "thumbs_down", keywords: ["no"] },
  { emoji: "👌", name: "ok_hand" },
  { emoji: "🤌", name: "pinched_fingers" },
  { emoji: "🤏", name: "pinch" },
  { emoji: "✌️", name: "peace" },
  { emoji: "🤞", name: "crossed_fingers", keywords: ["luck"] },
  { emoji: "🤝", name: "handshake" },
  { emoji: "🙏", name: "pray", keywords: ["thanks"] },
  { emoji: "👏", name: "clap" },
  { emoji: "💪", name: "muscle" },
  { emoji: "🫡", name: "salute" },
  { emoji: "👋", name: "wave", keywords: ["hi", "hello"] },
  { emoji: "🫶", name: "heart_hands" },
  // hearts
  { emoji: "❤️", name: "heart", keywords: ["love"] },
  { emoji: "🧡", name: "orange_heart" },
  { emoji: "💛", name: "yellow_heart" },
  { emoji: "💚", name: "green_heart" },
  { emoji: "💙", name: "blue_heart" },
  { emoji: "💜", name: "purple_heart" },
  { emoji: "🖤", name: "black_heart" },
  { emoji: "🤍", name: "white_heart" },
  { emoji: "🤎", name: "brown_heart" },
  { emoji: "💔", name: "broken_heart" },
  { emoji: "❣️", name: "heart_exclamation" },
  { emoji: "💖", name: "sparkling_heart" },
  { emoji: "💕", name: "two_hearts" },
  { emoji: "💞", name: "revolving_hearts" },
  // signals
  { emoji: "🔥", name: "fire", keywords: ["lit"] },
  { emoji: "✨", name: "sparkles" },
  { emoji: "💫", name: "dizzy" },
  { emoji: "⭐", name: "star" },
  { emoji: "🌟", name: "glowing_star" },
  { emoji: "🎉", name: "tada", keywords: ["party", "celebrate"] },
  { emoji: "🎊", name: "confetti" },
  { emoji: "🚀", name: "rocket", keywords: ["ship", "launch"] },
  { emoji: "✅", name: "check", keywords: ["ok", "done"] },
  { emoji: "❌", name: "cross", keywords: ["no"] },
  { emoji: "❓", name: "question" },
  { emoji: "❗", name: "exclamation" },
  // food / drink
  { emoji: "☕", name: "coffee" },
  { emoji: "🍵", name: "tea" },
  { emoji: "🍺", name: "beer" },
  { emoji: "🍷", name: "wine" },
  { emoji: "🍕", name: "pizza" },
  { emoji: "🍔", name: "burger" },
  { emoji: "🍣", name: "sushi" },
  { emoji: "🍩", name: "donut" },
  { emoji: "🍪", name: "cookie" },
  // tech
  { emoji: "💻", name: "laptop", keywords: ["computer"] },
  { emoji: "📱", name: "phone" },
  { emoji: "🤖", name: "robot", keywords: ["silicon", "ai"] },
  { emoji: "🧠", name: "brain" },
];

/** Match an entry by name or keyword. */
export function searchEmoji(q: string, limit = 40): EmojiEntry[] {
  const s = q.trim().toLowerCase();
  if (!s) return EMOJI_LIST.slice(0, limit);
  return EMOJI_LIST.filter((e) => {
    if (e.name.includes(s)) return true;
    if (e.keywords?.some((k) => k.includes(s))) return true;
    return false;
  }).slice(0, limit);
}
