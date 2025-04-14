import React, { useEffect, useState } from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { Button } from 'tamagui';
import { endpoints } from '../../api';

type Props = {
  navigation: NavigationProp<any>;
};

const Games: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { catType, catId, catName, onGameSelected } = route.params as {
    catType: string
    catId: number;
    catName: string;
    onGameSelected: (game: { id: number; name: string }) => void;
  };

  // const [games, setGames] = useState<string[]>([
  //   '2048',
  //   'Sudoku',
  //   'Times Tables',
  // ]);
  const [games, setGames] = useState<{ id: number; name: String }[]>([]);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        // fetch the games in whatever category was selected
        const response = await fetch(endpoints.games(catId));
        const data = await response.json();
        setGames(data); 
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
  
    fetchGames();
  }, []);

  const goToChallenges = () => navigation.navigate('Challenges');
  const goToGroups = () => navigation.navigate('Groups');
  const goToMessages = () => navigation.navigate('Messages');
  const goToProfile = () => navigation.navigate('Profile');

  // const Category: React.FC<{ name: string; index: number }> = ({
  //   name,
  //   index,
  // }) => (
  //   <TouchableOpacity
  //     style={styles.navToCat}
  //     onPress={() =>
  //       navigation.navigate('GameExpanded', { name, catType, onGameSelected })
  //     }
  //   >
  //     <Text style={styles.navToCatName}>{name}</Text>
  //   </TouchableOpacity>
  // );

  return (
    <ImageBackground
      source={require('../../images/tertiary.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Text style={styles.title}>{catName} Games</Text>
        <ScrollView style={styles.scrollViewContainer}>
          {games.map((game, index) => (
            <TouchableOpacity
              key={game.id}
              style={styles.navToCat}
              onPress={() => navigation.navigate('GameExpanded', { catType, gameId: game.id, gameName: game.name, onGameSelected })}
            >
              <Text style={styles.navToCatName}>{game.name}</Text>
            </TouchableOpacity>
          ))}
          </ScrollView>
      </View>

      <View style={styles.buttons}>
        <Button style={styles.button} onPress={goToChallenges}>
          <Ionicons name="star-outline" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button} onPress={goToGroups}>
          <Ionicons
            name={catType == 'Group' ? 'people' : 'people-outline'}
            size={40}
            color={'#FFF5CD'}
          />
        </Button>
        <Button style={styles.button} onPress={goToMessages}>
          <Ionicons name="mail-outline" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button} onPress={goToProfile}>
          <Ionicons
            name={catType == 'Personal' ? 'person' : 'person-outline'}
            size={40}
            color={'#FFF5CD'}
          />
        </Button>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
  },
  container: {
    alignItems: 'center',
    maxWidth: 400,
    width: '80%',
    marginVertical: 80,
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 50,
    marginTop: 40,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    width: 280,
    height: 40,
    borderRadius: 5,
    marginBottom: 30,
  },
  selection: {
    color: '#fff',
    fontSize: 22.5,
    fontWeight: '700',
    marginHorizontal: 25,
    marginBottom: 20,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  navToCat: {
    width: '100%',
    height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 15,
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navToCatName: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '600',
  },
  scrollViewContainer: {
    width: '100%',
    height: '75%',
    marginBottom: 20,
    marginTop: -15,
  },
  addButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    width: '100%',
    height: '10%',
    borderRadius: 15,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginLeft: 20,
  },
  buttons: {
    backgroundColor: '#211F26',
    flexDirection: 'row',
    height: 100,
    justifyContent: 'space-around',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    marginBottom: 15,
  },
});

export default Games;
