import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { Button } from 'tamagui';
import UserProfileCard from '../Components/UserProfileCard';
import { endpoints } from '../../api';

type Props = {
  navigation: NavigationProp<any>;
};

const Friends3: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  // groupId will be null if we're not navigating here to add this friend to a group
  const { friendId, groupId } = route.params as { friendId: number; groupId?: number };

  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        console.log(friendId);
        const response = await fetch(endpoints.profile(friendId));
        const data = await response.json();
        console.log(data);
        setProfileData(data);
        console.log(profileData);
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    };
  
    fetchProfile();
  }, [friendId]);

  const goToChallenges = () => navigation.navigate('Challenges');
  const goToGroups = () => navigation.navigate('Groups');
  const goToMessages = () => navigation.navigate('Messages');
  const goToProfile = () => {
    navigation.navigate('Profile');
  };
  
  return (
    <ImageBackground
      source={require('../../images/tertiary.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={30} color="#FFF" />
        </TouchableOpacity>
      </View>
      {/* Profile Section */}
      {profileData && (
        <UserProfileCard
          name={profileData.name}
          skillLevels={profileData.skill_levels}
        />
      )}

      {groupId && (
        <TouchableOpacity
          style={styles.add}
          onPress={async () => {
            const payload = {
              friend_id: friendId,
            };
            console.log(payload);
            fetch(endpoints.addGroupMember(groupId), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            })              
            .then((res) => {
              if (!res.ok) {
                return res.json().then((error) => {
                  console.error('Error from server:', error); // This will log the error response
                  throw new Error(error.message || 'Failed to add friend to group');
                });
              }
              return res.json();
            })
            .then((data) => {
              console.log('Friend added to group', data);
              Alert.alert('Friend added to group');
              // navigation.navigate('Challenges');
            })
            .catch((err) => {
              Alert.alert('Error', err.message);
            });
          }}
        >
          <Text style={styles.addText}>Add to Group</Text>
        </TouchableOpacity>
      )}


      {/* Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton}onPress={goToChallenges}>
          <Ionicons name="star" size={28} color="#FFF" />
          <Text style={styles.navText}>Challenges</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToGroups}>
          <Ionicons name="people-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Groups</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToMessages}>
          <Ionicons name="mail-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToProfile}>
          <Ionicons name="person-outline" size={28} color="#FFD700" />
          <Text style={styles.activeNavText}>Profile</Text>
        </TouchableOpacity>
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
    borderColor: '#FFD700',
  },
  profileName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 10,
    marginBottom: 20,
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
  add: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // translucent black
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: 250,
    height: 65,
    marginTop: 225,
    borderWidth: 1,
    borderColor: '#FFF', // optional, gives it a subtle border
  },  
  addText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 25,
    textAlign: 'center',
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
  navBar: {
    backgroundColor: "#211F26",
    flexDirection: "row",
    height: 80,
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 15,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  navButton: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  navText: {
    color: "#999",
    fontSize: 12,
    marginTop: 4,
  },
  activeNavText: {
    color: "#FFD700",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
});

export default Friends3;
