import React from 'react';
import {
  Alert,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import * as Font from 'expo-font';
import { Button } from 'tamagui';

type Props = {
  navigation: NavigationProp<any>;
};

const Challenges: React.FC<Props> = ({ navigation }) => {
  const goToPersonalChall = () => {
    //navigation.navigate('ChallPers');
  };

  const goToGroupChall = () => {
    //navigation.navigate('ChallGroup');
  };

  const goToGroups = () => {
    navigation.navigate('Groups');
  };

  const goToMessages = () => {
    navigation.navigate('Messages');
  };

  const goToProfile = () => {
    navigation.navigate('Profile');
  };

  return (
    <ImageBackground
      source={require('../images/cgpt.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Text style={styles.title}>My Challenges</Text>
        <TouchableOpacity style={styles.navToChall}>
          <Text style={styles.navToChallText}>Personal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navToChall}>
          <Text style={styles.navToChallText}>Group</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttons}>
        <Button style={styles.button}>
          <Ionicons name="star" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button} onPress={goToGroups}>
          <Ionicons name="people-outline" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button} onPress={goToMessages}>
          <Ionicons name="mail-outline" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button} onPress={goToProfile}>
          <Ionicons name="person-outline" size={40} color={'#FFF5CD'} />
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
    flex: 1,
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
    marginVertical: 100,
  },
  navToChall: {
    width: '100%',
    height: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 15,
    marginVertical: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navToChallText: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '900',
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

export default Challenges;
