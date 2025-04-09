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

const PersChall1: React.FC<Props> = ({ navigation }) => {
  //   const route = useRoute();
  //   const { whichChall } = route.params as {
  //     whichChall: string;
  //   };

  const [challs, setChalls] = useState<string[][]>([
    ['NameA', 'fnucwncjkwnl'],
    ['NameB', 'nfenvoencklk'],
    ['NameC', 'cneoenclknck'],
    ['NameD', 'qowfpwhnljnv'],
  ]);

  const goToNext = () => {
    navigation.navigate('PersChall2');
  };

  const goToChallenges = () => navigation.navigate('Challenges');
  const goToGroups = () => navigation.navigate('Groups');
  const goToMessages = () => navigation.navigate('Messages');

  const Challenge: React.FC<{ name: string; text: string; index: number }> = ({
    name,
    text,
    index,
  }) => (
    <TouchableOpacity
      style={styles.navToChall}
      onPress={() => {
        setChalls((prevChall) => prevChall.filter((_, i) => i !== index));
      }}
    >
      <Text style={styles.navToChallName}>{name}</Text>
      <Text style={styles.navToChallText}>{text}</Text>
    </TouchableOpacity>
  );

  return (
    <ImageBackground
      source={require('../../images/secondary.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={30} color="#FFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.container}>
        <Text style={styles.title}>My Personal Challenges</Text>
        <ScrollView style={styles.scrollViewContainer}>
          {challs.map((challenge, index) => (
            <Challenge
              key={index}
              name={challenge[0] + ''}
              text={challenge[1] + ''}
              index={index}
            />
          ))}
        </ScrollView>

        <Button
          style={styles.addButton}
          onPress={() => {
            setChalls((prevChall) => [
              ...prevChall,
              ['test', 'befpvblwebvwbjvda'],
            ]);
            goToNext();
          }}
        >
          <Ionicons name="add-circle-outline" size={35} color={'#FFF'} />
          <Text style={styles.addText}>Add New</Text>
        </Button>
      </View>

      <View style={styles.buttons}>
        <Button style={styles.button} onPress={goToChallenges}>
          <Ionicons name="star-outline" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button} onPress={goToGroups}>
          <Ionicons name="people-outline" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button} onPress={goToMessages}>
          <Ionicons name="mail-outline" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button}>
          <Ionicons name="person" size={40} color={'#FFF5CD'} />
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
  backButtonContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
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
  navToChall: {
    width: '100%',
    height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 15,
    marginVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navToChallName: {
    color: '#fff',
    fontSize: 22.5,
    fontWeight: '600',
    marginLeft: 5,
    marginBottom: 10,
  },
  navToChallText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 20,
  },
  scrollViewContainer: {
    width: '100%',
    height: '50%',
    marginBottom: 20,
    marginTop: -10,
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

export default PersChall1;
