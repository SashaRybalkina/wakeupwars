import React from 'react';
import {
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { Button } from 'tamagui';

type Props = {
  navigation: NavigationProp<any>;
};

const Profile: React.FC<Props> = ({ navigation }) => {
  const goToChallenges = () => navigation.navigate('Challenges');
  const goToGroups = () => navigation.navigate('Groups');
  const goToMessages = () => navigation.navigate('Messages');

  return (
    <ImageBackground
      source={require('../images/cgpt.png')}
      style={styles.background}
      resizeMode="cover"
    >
      {/* Profile Section */}
      <View style={styles.profileContainer}>
        <Image source={require('../images/game.jpeg')} style={styles.avatar} />
        <Text style={styles.profileName}>User's Name</Text>
        <Text style={styles.profileLink}>View My Profile {'>'}</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.stat}>
              Problem Solving <Text style={styles.statValue}>4.1 Points</Text>
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.stat}>
              Puzzle <Text style={styles.statValue}>1.3 Points</Text>
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.stat}>
              Physical <Text style={styles.statValue}>3.3 Points</Text>
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.stat}>
              Memory/Pattern <Text style={styles.statValue}>0.5 Points</Text>
            </Text>
          </View>
        </View>
        <View style={styles.profileButtons}>
          <TouchableOpacity style={styles.profileButton}>
            <Ionicons name="people" size={40} color={'#4075C5'} />
            <Text style={styles.profileButtonText}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('PersChall1')}
          >
            <Ionicons name="trophy" size={40} color={'#8D4C94'} />
            <Text style={[styles.profileButtonText, { color: '#8D4C94' }]}>
              Challenges
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>My Skills {'>'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Leaderboard {'>'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Alarms {'>'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Support {'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Bar */}
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
  profileContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  avatar: {
    width: 120,
    height: 120,
    marginTop: 30,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#8D4C94',
  },
  profileName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 10,
  },
  profileLink: {
    color: '#295699',
    fontSize: 16,
    marginBottom: 10,
    fontWeight: '600',
  },
  statsContainer: {
    marginTop: 7.5,
    width: '100%',
  },
  statCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 25,
    paddingVertical: 7.5,
    marginVertical: 2.5,
    borderRadius: 10,
  },
  stat: {
    color: '#FFF',
    fontWeight: 600,
  },
  statValue: {
    fontWeight: 'bold',
    color: '#FFD700',
  },
  profileButtons: {
    flexDirection: 'row',
    marginTop: 20,
  },
  profileButton: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  profileButtonText: {
    color: '#0066FF',
    fontSize: 16,
    fontWeight: '700',
  },
  menu: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2.5,
    width: '85%',
    marginTop: 20,
  },
  menuItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
  },
  menuText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
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

export default Profile;
