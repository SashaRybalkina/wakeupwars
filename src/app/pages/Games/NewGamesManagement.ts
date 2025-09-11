/****************** 
 * ----- UPDATE NEW GAME----
 * 
 * Defines the standard, internal keys we'll use to represent each unique game type.
 * This ensures type safety and consistency 
 * ***************/
export type GameKey = 'sudoku' | 'wordle' | 'pattern';

/**
 * This is the single source of truth for all game-specific display information.
 * Each canonical key maps to its corresponding image and description text.
 * If you need to update an image or text, you only have to change it here.
 */
export const GAME_META: Record<GameKey, { image: any; desc: string }> = {
  sudoku: {
    image: require('../../images/sudoku.png'),
    desc: 'A logic-based, combinatorial number-placement puzzle.',
  },
  wordle: {
    image: require('../../images/wordle.png'),
    desc: 'A combinatorial word-guessing puzzle where players deduce a hidden five-letter word using limited attempts and feedback.',
  },
  pattern: {
    image: require('../../images/patternGame.png'),
    desc: 'Watch the color sequence, remember it, and repeat!',
  },
};

/**
 * Maps the specific `gameId` from the backend to our internal canonical key.
 * This handles cases where multiple IDs refer to the same game (e.g., group vs. personal modes).
 */
export const GAME_ID_TO_KEY: Record<number, GameKey> = {
  9: 'sudoku',  // Personal Sudoku (if it exists)
  10: 'sudoku',  // Group Sudoku
  11: 'pattern', // Personal Pattern
  12: 'pattern', // Group Pattern
  13: 'wordle', // Personal Wordle
  14: 'wordle' // Group Wordle
};

/**
 * Maps different possible display names to our canonical key.
 * This makes the matching robust against variations in capitalization or wording from the backend.
 */
export const GAME_NAME_ALIAS: Record<string, GameKey> = {
  'sudoku': 'sudoku',
  'group sudoku': 'sudoku',
  'pattern memorization': 'pattern',
  'group pattern memorization': 'pattern',
  'wordle': 'wordle',
  'group wordle': 'wordle',
};


/**
 * A fallback object to ensure the component always has something to display,
 * even if a game isn't found in our maps. This prevents the app from crashing.
 */
export const DEFAULT_META = {
  image: require('../../images/secondary.png'),
  desc: '[Error]  The game description is unavailable. Please select another game.',
};
//   ----- UPDATE NEW GAME----

/**
 * A small helper function to clean up game name strings before matching.
 * This ensures that 'Sudoku ', 'sudoku', and 'SUDOKU' are all treated the same.
 */
const normalize = (s?: string) => (s ?? '').trim().toLowerCase();

//-----where to use it: GameExpanded--------
/**
 * The main function that determines which metadata to show.
 * It first tries to find a match using `gameId`, as it's more reliable.
 * If that fails, it falls back to using the `gameName`.
 * It returns the correct meta object or the default one if no match is found.
 * @param gameId - The game's ID from the backend.
 * @param gameName - The game's name from the backend.
 * @returns An object with the `image` and `desc` to display.
 */
export function getGameMeta(gameId?: number, gameName?: string) {
  const keyFromId = gameId != null ? GAME_ID_TO_KEY[gameId] : undefined;
  const keyFromName = GAME_NAME_ALIAS[normalize(gameName)];
  // Prioritize the key found via ID, but use the name-based key if necessary.
  const key = keyFromId ?? keyFromName;

  // If we couldn't find a key, return the default metadata.
  if (!key) return DEFAULT_META;

  // Return the metadata for our found key, or the default if the key is somehow invalid.
  return GAME_META[key] ?? DEFAULT_META;
}


//---------- Where to use it: GroupChall2-----------------
export function getMetaFromTuple(tuple?: [string, string]) {
  const id = parseInt(tuple?.[0] ?? '', 10);
  const name = tuple?.[1];
  return getGameMeta(Number.isFinite(id) ? id : undefined, name);
}