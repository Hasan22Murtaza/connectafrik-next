export type ReactionType = 'like' | 'love' | 'laugh' | 'angry' | 'sad' | 'wow' | 'care'

const EMOJI_TO_REACTION: Record<string, ReactionType> = {
  '\u{1F44D}': 'like',      // 👍 thumbs up
  '\u2764\uFE0F': 'love',   // ❤️ heart
  '\u{1F602}': 'laugh',     // 😂 laughing
  '\u{1F62E}': 'wow',       // 😮 surprised
  '\u{1F622}': 'sad',       // 😢 crying
  '\u{1F621}': 'angry',     // 😡 angry
  '\u{1F525}': 'love',      // 🔥 fire (love)
  '\u{1F44F}': 'like',      // 👏 clapping (like)
  '\u{1F64C}': 'like',      // 🙌 raising hands (like)
  '\u{1F389}': 'wow',       // 🎉 party (wow)
  '\u{1F4AF}': 'wow',       // 💯 100 (wow)
  '\u{1F60E}': 'wow',       // 😎 cool (wow)
  '\u{1F973}': 'laugh',     // 🥳 party face (laugh)
  '\u{1F929}': 'wow',       // 🤩 star-struck (wow)
  '\u{1F606}': 'laugh',     // 😆 laughing (laugh)
  '\u{1F60F}': 'wow',       // 😏 smirking (wow)
  '\u{1F607}': 'wow',       // 😇 halo (wow)
  '\u{1F61C}': 'laugh',     // 😜 winking (laugh)
  '\u{1F914}': 'wow',       // 🤔 thinking (wow)
  '\u{1F631}': 'wow',       // 😱 screaming (wow)
  '\u{1F624}': 'angry',     // 😤 huffing (angry)
  '\u{1F605}': 'laugh',     // 😅 nervous laugh (laugh)
  '\u{1F60B}': 'laugh',     // 😋 yummy (laugh)
  '\u{1F62C}': 'laugh',     // 😬 grimacing (laugh)
  '\u{1F603}': 'laugh',     // 😃 grinning (laugh)
}

/**
 * Maps an emoji character to a post reaction type (like, love, laugh, etc.).
 * Used for post_reactions and PostCard emoji picker.
 */
export function getReactionTypeFromEmoji(emoji: string): ReactionType {
  return EMOJI_TO_REACTION[emoji] ?? 'like'
}
