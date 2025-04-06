import React, { useState } from 'react';
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

type Props = {
  navigation: NavigationProp<any>;
};

const Categories: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { catType, onGameSelected } = route.params as {
    catType: string;
    onGameSelected: (game: string, attr: string[]) => void;
  };

  const [cats, setCats] = useState<string[]>([
    'Math',
    'Typing',
    'Word Games',
    'Memory',
    'Physical',
  ]);

  const goToChallenges = () => navigation.navigate('Challenges');
  const goToGroups = () => navigation.navigate('Groups');
  const goToMessages = () => navigation.navigate('Messages');
  const goToProfile = () => navigation.navigate('Profile');

  const Category: React.FC<{ name: string; index: number }> = ({
    name,
    index,
  }) => (
    <TouchableOpacity
      style={styles.navToCat}
      onPress={() =>
        navigation.navigate('Games', { name, catType, onGameSelected })
      }
    >
      <Text style={styles.navToCatName}>{name}</Text>
    </TouchableOpacity>
  );

  return (
    <ImageBackground
      source={require('../../images/secondary.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Text style={styles.title}>Categories</Text>
        <ScrollView style={styles.scrollViewContainer}>
          {cats.map((cat, index) => (
            <Category key={index} name={cat + ''} index={index} />
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

export default Categories;
