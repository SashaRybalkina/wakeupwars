/**
 * @file Games.tsx
 * @description Displays all games that are in the category that the user selected,
 * as well as the mode the user has selected (Singleplayer or Multiplayer).
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  ImageBackground,
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
import { useUser } from '../../context/UserContext';

type Props = {
  navigation: NavigationProp<any>;
};

const Games: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { catType, singOrMult, catId, catName, categories, groupId, groupMembers, onGameSelected, challName, friendId, alarmSchedule } = route.params as {
    catType: string;
    singOrMult: string;
    catId: number;
    catName: string;
    categories: { id: number; name: string }[];
    groupId: number;
    groupMembers: { id: number; name: string }[];
    onGameSelected: (game: { id: number; name: string }) => void;
    challName: string;
    friendId?: number;
    alarmSchedule: { dayOfWeek: number; time: string }[],
  };

  console.log("Games route params:", route.params);

  // catType, singOrMult possibilities
  // Personal, Singleplayer
  // Friend, Singeplayer
  // Group, Neither
  // Public, Singpleplayer,
  // Public, Multiplayer

  const { logout } = useUser();
  const [games, setGames] = useState<{ id: number; name: String }[]>([]);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          Alert.alert(
            "Session expired",
            "Your login session has expired. Please log in again.",
            [
              {
                text: "OK",
                onPress: async () => {
                  await logout();
                  navigation.reset({
                    index: 0,
                    routes: [{ name: "Login" }],
                  });
                },
              },
            ],
            { cancelable: false }
          );

          return;
        }
        // fetch the games in whatever category was selected
        const response = await fetch(endpoints.games(catId, singOrMult), {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        const data = await response.json();
        setGames(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };

    fetchGames();
  }, []);

  return (
    <ImageBackground
      source={require('../../images/cgpt4.png')}
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
        <Text style={styles.title}>{catName} Games</Text>
        <ScrollView
          style={styles.scrollViewContainer}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          {games.map((game) => (
            <TouchableOpacity
              key={game.id}
              style={styles.gameButton}
              onPress={() => navigation.navigate('GameExpanded', {
                catType,
                categories: categories,
                singOrMult: singOrMult,
                gameId: game.id,
                gameName: game.name,
                groupId,
                groupMembers,
                onGameSelected,
                ...(catType === 'Friend' && { friendId }),
                challName,
                alarmSchedule
              })}
            >
              <Text style={styles.gameButtonText}>{game.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
  scrollViewContainer: {
    width: '100%',
    maxWidth: 400,
  },
  scrollViewContent: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  gameButton: {
    width: '100%',
    height: 80,
    backgroundColor: 'rgba(80, 90, 140, 0.5)',
    borderRadius: 20,
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  gameButtonText: {
    color: '#fff',
    fontSize: 28,
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

export default Games;