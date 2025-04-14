import React, { useEffect, useState } from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { Int32 } from 'react-native/Libraries/Types/CodegenTypes';
import { Button, ScrollView } from 'tamagui';

type Props = {
  navigation: NavigationProp<any>;
};

const Friends1: React.FC<Props> = ({ navigation }) => {
  const [friends, setFriends] = useState<string[]>([
    'friend 1',
    'friend 2',
    'friend 3',
    'friend 4',
  ]);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const response = await fetch(
          'https://6735-136-38-171-186.ngrok-free.app/api/friends/',
        );
        const data = await response.json();
        const friendNames = data.map(
          (friend: { id: number; name: string }) => friend.name,
        );
        setFriends(friendNames);
      } catch (error) {
        console.error('Failed to fetch friends:', error);
      }
    };

    fetchFriends();
  }, []);

  const goToChallenges = () => {
    navigation.navigate('Challenges');
  };

  const goToMessages = () => {
    navigation.navigate('Messages');
  };

  const goToGroups = () => {
    navigation.navigate('Groups');
  };

  const Friend = (name: String, index: Int32) => {
    return (
      <TouchableOpacity
        style={styles.navToFriend}
        onPress={() => {
          navigation.navigate('Friends3', { friendName: name });
        }}
      >
        <View style={styles.profile}></View>
        <Text style={styles.navToFriendText}>{name}</Text>
      </TouchableOpacity>
    );
  };

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
        <Button
          style={styles.addButton}
          onPress={() => navigation.navigate('Friends2')}
        >
          <Ionicons name="add-circle-outline" size={45} color={'#fff'} />
        </Button>
        <Text style={styles.title}>My Friends</Text>
        <ScrollView style={styles.scrollViewContainer}>
          {friends.map((friend, index) => {
            return Friend(friends[index] + '', index);
          })}
        </ScrollView>
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
    justifyContent: 'center',
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
    marginVertical: 60,
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    width: 100,
    height: 100,
    marginTop: 75,
    marginLeft: 300,
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 50,
  },
  scrollViewContainer: {
    width: '100%',
    height: '100%',
    marginBottom: 20,
  },
  navToFriend: {
    width: '100%',
    height: 80,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 15,
    marginVertical: 10,
    alignItems: 'center',
  },
  profile: {
    width: 60,
    height: 60,
    borderRadius: 100,
    backgroundColor: 'purple',
    marginHorizontal: 20,
  },
  navToFriendText: {
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

export default Friends1;
