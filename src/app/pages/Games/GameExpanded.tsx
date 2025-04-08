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

const GameExpanded: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { name, catType, onGameSelected } = route.params as {
    name: string;
    catType: string;
    onGameSelected: (game: string, attr: string[]) => void;
  };

  const goToChallenges = () => navigation.navigate('Challenges');
  const goToGroups = () => navigation.navigate('Groups');
  const goToMessages = () => navigation.navigate('Messages');
  const goToProfile = () => navigation.navigate('Profile');

  const selectPressed = () => {
    if (onGameSelected) {
      // Ensure that digitValue and minuteValue are numbers, not strings
      onGameSelected(name, ['', '']);
    }
    if (catType == 'Personal') navigation.navigate('PersChall2');
    else navigation.navigate('GroupChall2');
  };

  return (
    <ImageBackground
      source={require('../../images/secondary.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Text style={styles.title}>{name}</Text>
        <ImageBackground
          source={require('../../images/sudoku.png')}
          style={styles.gameImg}
        ></ImageBackground>
        <Text style={styles.desc}>Insert description here</Text>
        <Text style={styles.selectButton} onPress={selectPressed}>
          Select Game
        </Text>
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
  desc: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 25,
    marginTop: 40,
    textAlign: 'center',
  },
  gameImg: {
    width: 300,
    height: 300,
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
  scrollViewContainer: {
    width: '100%',
    height: '75%',
    marginBottom: 20,
    marginTop: -15,
  },
  selectButton: {
    textAlign: 'center',
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 10,
    paddingVertical: 12.5,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    width: 200,
    height: 50,
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

export default GameExpanded;
