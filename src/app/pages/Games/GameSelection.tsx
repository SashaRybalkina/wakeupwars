// all
// GroupChallCollab2
// perschall2copy
// createchallengeforfriend

// some
// createpublicchall2

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { endpoints } from '../../api';
import { getAccessToken } from '../../auth';
import { getGameMeta } from './NewGamesManagement';
import { useUser } from '../../context/UserContext';

type Props = {
  navigation: NavigationProp<any>;
};

type Game = {
  id: number;
  name: string;
  route: string;
  isMultiplayer: boolean | null;
};

type Category = {
  id: number;
  categoryName: string;
  games: Game[];
};


const STATIC_CATEGORIES: Category[] = [
  {
    id: 12,
    categoryName: "Math",
    games: [
      { id: 9,  name: "Singleplayer Sudoku", route: "Sudoku", isMultiplayer: false },
      { id: 10, name: "Group Sudoku", route: "Sudoku", isMultiplayer: true },
      { id: 43, name: "Sudoku", route: "Sudoku", isMultiplayer: null },
    ],
  },
  {
    id: 14,
    categoryName: "Memory",
    games: [
      { id: 11, name: "Singleplayer Pattern Memorization", route: "PatternGame", isMultiplayer: false },
      { id: 12, name: "Group Pattern Memorization", route: "PatternGame", isMultiplayer: true },
      { id: 44, name: "Pattern Memorization", route: "PatternGame", isMultiplayer: null },
    ],
  },
  {
    id: 16,
    categoryName: "Misc",
    games: [
      { id: 46, name: "Singleplayer Typing Race", route: "TypingRace", isMultiplayer: false },
      { id: 47, name: "Group Typing Race", route: "TypingRace", isMultiplayer: true },
      { id: 48, name: "Typing Race", route: "TypingRace", isMultiplayer: null },
    ],
  },
  {
    id: 17,
    categoryName: "Word",
    games: [
      { id: 30, name: "Group Wordle", route: "Wordle", isMultiplayer: true },
      { id: 32, name: "Singleplayer Wordle", route: "Wordle", isMultiplayer: false },
      { id: 45, name: "Wordle", route: "Wordle", isMultiplayer: null },
    ],
  },
];


const GameSelection: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { categories, onGameSelected, onGameSelected2, singOrMult } = route.params as {
    onGameSelected: ((game: { id: number; name: string }) => void) | null;
    onGameSelected2: ((game: { id: number; name: string }, categoryId: number) => void) | null;
    categories: { id: number; name: string }[] | null;
    singOrMult: string;
  };


const filteredCats = STATIC_CATEGORIES
  // Step 1: Filter categories if specified
  .filter(cat =>
    !categories || categories.some(c => c.id === cat.id)
  )
  // Step 2: Filter games based on singOrMult
  .map(cat => ({
    ...cat,
    games: cat.games.filter(game => {
      if (singOrMult === "Singleplayer") return game.isMultiplayer === false;
      if (singOrMult === "Multiplayer") return game.isMultiplayer === true;
      if (singOrMult === "Neither") return game.isMultiplayer === null;
      return true; // fallback if something unexpected is passed in
    }),
  }))
  // Step 3: Only keep categories that still have games
  .filter(cat => cat.games.length > 0);



  const { logout } = useUser();
  const [cats, setCats] = useState<Category[]>(filteredCats);
  const [selectedCat, setSelectedCat] = useState<number>(filteredCats[0]?.id ?? 0);

  const [loading, setLoading] = useState(false);

  const [modalGame, setModalGame] = useState<Game | null>(null);


  // useEffect(() => {
  //   const fetchCats = async () => {
  //     try {
  //       const accessToken = await getAccessToken();
  //       if (!accessToken) {
  //                               await logout();
  //                     navigation.reset({
  //                       index: 0,
  //                       routes: [{ name: "Login" }],
  //                     });
  //       }

  //       const response = await fetch(
  //         endpoints.someCats(categories ? categories.map(c => c.id) : [], singOrMult),
  //         { headers: { Authorization: `Bearer ${accessToken}` } }
  //       );
  //       const data: Category[] = await response.json();
  //       setCats(data);
  //       // Select first category by default
  //       if (data.length > 0) setSelectedCat(data[0].id);
  //     } catch (err) {
  //       console.error("Failed to fetch categories:", err);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };
  //   fetchCats();
  // }, []);


  const handleSelect = (id: number, name: string, categoryId: number) => {
    if (onGameSelected) {
      onGameSelected({ id, name });
    }
    else if (onGameSelected2) {
      onGameSelected2({id, name}, categoryId)
    }
    
    navigation.goBack();
  };


  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#FFF" />
      </View>
    );
  }

  const selectedCategory = cats.find(c => c.id === selectedCat);

  return (
<ImageBackground
  source={require('../../images/tertiary.png')}
  style={styles.background}
  resizeMode="cover"
>
        <View style={styles.container}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.pageTitle}>Select Game</Text>
{/* Tabs */}
<View style={[styles.tabsWrapper, { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }]}>
  {cats.map((cat) => (
    <TouchableOpacity
      key={cat.id}
      style={[
        styles.choiceButton,
        selectedCat === cat.id && styles.choiceButtonSelected,
      ]}
      onPress={() => setSelectedCat(cat.id)}
    >
      <Text
        style={[
          styles.tabButtonText,
          selectedCat === cat.id && styles.tabButtonTextActive,
        ]}
      >
        {cat.categoryName}
      </Text>
    </TouchableOpacity>
  ))}
</View>



{/* Game list */}
<View style={styles.gameListContainer}>
  {selectedCategory?.games.map((game) => {
    const meta = getGameMeta(game.id, game.name);

    return (
      <View key={game.id} style={styles.gameItemContainer}>
        {/* Pressable container to open modal */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setModalGame(game)}
          style={styles.gameContainer}
        >
<View style={styles.imageWrapper}>
  <ImageBackground
    source={meta.image}
    style={styles.gameImg}
    imageStyle={styles.gameImgStyle}
    resizeMode="contain"
  />
</View>

          <Text style={styles.gameName}>{game.name}</Text>
        </TouchableOpacity>

        {/* Select button stays independent */}
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => handleSelect(game.id, game.name, selectedCategory.id)}
        >
          <Text style={styles.selectButtonText}>Select</Text>
        </TouchableOpacity>
      </View>
    );
  })}


{/* Single modal for all games */}
<Modal
  visible={modalGame !== null}
  transparent
  animationType="fade"
  onRequestClose={() => setModalGame(null)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      {modalGame && (
        <>
          <Text style={styles.modalTitle}>{modalGame.name}</Text>
          <Text style={styles.modalDesc}>
            {getGameMeta(modalGame.id, modalGame.name).desc}
          </Text>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setModalGame(null)}
          >
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  </View>
</Modal>
  </View>
  </View>
</ImageBackground>

  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
  },
gameItemContainer: {
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  marginBottom: 16,
},

gameContainer: {
  width: "100%",
  alignItems: "center",  // ✅ centers the image horizontally
  borderRadius: 12,
  overflow: "hidden",
  marginBottom: 8,
},

gameImg: {
  width: '90%',          // already good
  aspectRatio: 16 / 9,
  alignSelf: 'center',   // ✅ this ensures it's centered within its container
  justifyContent: 'flex-end',
  marginVertical: 10,
  marginLeft: 33
},



gameImgStyle: {
  borderRadius: 12,
},

gameName: {
  marginTop: 10,
  fontSize: 18,
  fontWeight: '600',
  color: 'white',
},

  tabsWrapper: {
  height: 60,
  marginTop: 10,
},

  selectButton: {
    backgroundColor: "#FFD700",
    paddingVertical: 8,
    borderRadius: 6,
    width: "60%",
    alignItems: "center",
  },
  selectButtonText: {
    fontWeight: "bold",
    color: "#000",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalDesc: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  modalCloseButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalCloseButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  choiceButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  choiceButtonSelected: { backgroundColor: "rgba(255, 215, 0, 0.3)", borderColor: "#FFD700" },
tabButtonText: {
  color: '#fff',
  fontWeight: '600',
  fontSize: 14,
},
tabButtonTextActive: {
  fontWeight: '700',
},
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 20,
  },
  backButtonContainer: {
    position: 'absolute',
    top: 40, // slightly higher for better spacing
    left: 15,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    paddingTop: 80, // reduced from 120 to move content up
    paddingHorizontal: 15,
  },
  title: {
    color: '#fff',
    fontSize: 36, // slightly smaller
    fontWeight: '700',
    marginBottom: 20, // reduce spacing
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  // Tabs ScrollView
tabsContainer: {
  flexDirection: 'row',
  height: 50,
  paddingHorizontal: 10,
  marginTop: 10,
},
categoriesScroll: { paddingVertical: 5 },
  gameItem: {
    marginBottom: 12,
    backgroundColor: 'rgba(80,90,140,0.5)',
    padding: 12,
    borderRadius: 10,
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
gameListContainer: {
  flex: 1,
  paddingHorizontal: 15,
  marginTop: 30, // pushes list further down from category tabs
},
imageWrapper: {
  width: '100%',
  alignItems: 'center',
},

});


export default GameSelection;