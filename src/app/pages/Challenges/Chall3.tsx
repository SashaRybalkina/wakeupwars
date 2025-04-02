import React from 'react';
import {
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';

const Chall3 = ({ navigation }) => {
  const route = useRoute();
  const { onGameSelected } = route.params || {};

  const selectGame = (game: String) => {
    if (onGameSelected) {
      navigation.navigate('Chall4', { game, onGameSelected });
    }
  };

  const gameList = ['Game 1', 'Game 2', 'Game 3', 'Game 4']; // Example list of games

  return (
    <ImageBackground
      source={require('../../images/tertiary.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <Text style={styles.title}>Select a Game</Text>
      <ScrollView contentContainerStyle={styles.scrollViewContainer}>
        {gameList.map((game, index) => (
          <TouchableOpacity
            key={index}
            style={styles.gameButton}
            onPress={() => selectGame(game)}
          >
            <Text style={styles.gameButtonText}>{game}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollViewContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    marginTop: 180,
    fontSize: 35,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 50,
  },
  gameButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 20,
    marginVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: 250,
    height: 75,
  },
  gameButtonText: {
    fontSize: 30,
    color: '#fff',
    fontWeight: '500',
  },
});

export default Chall3;
