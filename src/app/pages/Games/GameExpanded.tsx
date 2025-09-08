import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';

type Props = {
  navigation: NavigationProp<any>;
};

/****************** 
 * ----- UPDATE NEW GAME----
 * 
 * Defines the standard, internal keys we'll use to represent each unique game type.
 * This ensures type safety and consistency 
 * ***************/
type GameKey = 'sudoku' | 'pattern';

/**
 * This is the single source of truth for all game-specific display information.
 * Each canonical key maps to its corresponding image and description text.
 * If you need to update an image or text, you only have to change it here.
 */
const GAME_META: Record<GameKey, { image: any; desc: string }> = {
  sudoku: {
    image: require('../../images/sudoku.png'),
    desc: 'A logic-based, combinatorial number-placement puzzle.',
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
const GAME_ID_TO_KEY: Record<number, GameKey> = {
  9: 'sudoku',  // Personal Sudoku (if it exists)
  10: 'sudoku',  // Group Sudoku
  11: 'pattern', // Personal Pattern
  12: 'pattern', // Group Pattern
};

/**
 * Maps different possible display names to our canonical key.
 * This makes the matching robust against variations in capitalization or wording from the backend.
 */
const GAME_NAME_ALIAS: Record<string, GameKey> = {
  'sudoku': 'sudoku',
  'group sudoku': 'sudoku',
  'pattern memorization': 'pattern',
  'group pattern memorization': 'pattern',
};
//   ----- UPDATE NEW GAME----

/**
 * A fallback object to ensure the component always has something to display,
 * even if a game isn't found in our maps. This prevents the app from crashing.
 */
const DEFAULT_META = {
  image: require('../../images/secondary.png'),
  desc: '[Error]  The game description is unavailable. Please select another game.',
};

/**
 * A small helper function to clean up game name strings before matching.
 * This ensures that 'Sudoku ', 'sudoku', and 'SUDOKU' are all treated the same.
 */
const normalize = (s?: string) => (s ?? '').trim().toLowerCase();

/**
 * The main function that determines which metadata to show.
 * It first tries to find a match using `gameId`, as it's more reliable.
 * If that fails, it falls back to using the `gameName`.
 * It returns the correct meta object or the default one if no match is found.
 * @param gameId - The game's ID from the backend.
 * @param gameName - The game's name from the backend.
 * @returns An object with the `image` and `desc` to display.
 */
function getGameMeta(gameId?: number, gameName?: string) {
  const keyFromId = gameId != null ? GAME_ID_TO_KEY[gameId] : undefined;
  const keyFromName = GAME_NAME_ALIAS[normalize(gameName)];
  // Prioritize the key found via ID, but use the name-based key if necessary.
  const key = keyFromId ?? keyFromName;

  // If we couldn't find a key, return the default metadata.
  if (!key) return DEFAULT_META;

  // Return the metadata for our found key, or the default if the key is somehow invalid.
  return GAME_META[key] ?? DEFAULT_META;
}

const GameExpanded: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  console.log("Route params:", route.params);
  const { catType, gameId, gameName, groupId, groupMembers, onGameSelected } = route.params as {
    catType: string;
    gameId: number;
    gameName: string;
    groupId: number;
    groupMembers: { id: number; name: string }[];
    onGameSelected: (game: { id: number; name: string }) => void;
  };

  // Here we use our new mapping system to get the correct image and description.
  const meta = getGameMeta(gameId, gameName);

  const selectPressed = () => {
    if (onGameSelected) {
      onGameSelected({ id: gameId, name: gameName });
    }
    if (catType == 'Personal') navigation.navigate('PersChall2');
    else navigation.navigate('GroupChall2', { groupId, groupMembers });
  };

  return (
    <ImageBackground
      source={require('../../images/secondary.png')}
      style={styles.background}
      resizeMode="cover"
    >
      {/* Decorative elements */}
      <View style={[styles.decorativeStar, { top: '15%', left: '15%' }]} />
      <View style={[styles.decorativeStar, { top: '30%', right: '15%' }]} />
      <View style={[styles.decorativeDot, { top: '5%', right: '15%' }]} />
      <View style={[styles.decorativeDot, { bottom: '25%', right: '20%' }]} />
      <View style={[styles.decorativeDot, { bottom: '15%', left: '10%' }]} />
      <View style={[styles.decorativeDot, { top: '45%', left: '5%' }]} />
      
      <View style={styles.backButtonContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={30} color="#FFF" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.container}>
        <Text style={styles.title}>{gameName}</Text>
        <ImageBackground
          source={meta.image}
          style={styles.gameImg}
          imageStyle={styles.gameImgStyle}
        />
        <Text style={styles.desc}>{meta.desc}</Text>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={selectPressed}
        >
          <Text style={styles.selectButtonText}>Select Game</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
    // Gradient is handled by the background image
  },
  backButtonContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
    paddingTop: 120,
    paddingHorizontal: 20,
  },
  title: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 40,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  gameImg: {
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  gameImgStyle: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  desc: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 40,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 28,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  selectButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Decorative elements
  decorativeStar: {
    position: 'absolute',
    width: 24,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 12,
    transform: [{ rotate: '45deg' }],
  },
  decorativeDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 6,
  },
});

export default GameExpanded;