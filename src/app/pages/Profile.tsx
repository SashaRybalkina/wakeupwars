import React, { useRef } from 'react';
import { useEffect, useState } from 'react';
import * as SecureStore from "expo-secure-store";
import { getAccessToken } from "../auth";
import {
  Alert,
  ImageBackground,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { NativeModules } from 'react-native';

import { scheduleAlarms } from '../Alarm';
import { BASE_URL, endpoints } from '../api';
import { useUser } from '../context/UserContext';
import UserProfileCard from './Components/UserProfileCard';
const { AlarmModule } = NativeModules;
import { scheduleAlarmsForUser } from '../alarmService';
import NavBar from './Components/NavBar';

type Props = {
  navigation: NavigationProp<any>;
};


type Memoji = {
  id: number;
  imageUrl: string;
}

type Badge = {
  id: number;
  imageUrl: string;
  earned: boolean;
  collected: boolean;
  name?: string;
  description?: string;
  progress?: {
    current: number;
    goal: number;
    percentage: number;
  };
};

const Profile: React.FC<Props> = ({ navigation }) => {
  //--------------------------
  //const goToPatternGame = () => navigation.navigate("PatternGame")
  //-------------

  const goToChallenges = () => navigation.navigate('Challenges');
  const goToGroups = () => navigation.navigate('Groups');
  const goToMessages = () => navigation.navigate('Messages');
  const goToProfile = () => {
    navigation.navigate('Profile');
  };
  const [profileData, setProfileData] = useState<any>(null);
  const [currentMemoji, setCurrentMemoji] = useState<Memoji | null>(null);
  const [numCoins, setNumCoins] = useState<number>(0);
  const [backgroundColor, setBackgroundColor] = useState<string>('#FFB3BA');
  const { user, setUser, setSkillLevels, logout } = useUser();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<null | any>(null);
  const [notifCount, setNotifCount] = useState(0);

const handleLogout = async () => {
  await logout();
  navigation.reset({
    index: 0,
    routes: [{ name: "Login" }],
  });
};


  useEffect(() => {
    if (!user?.id) return;

    const fetchNotificationsCount = async () => {
      try {
                const access = await getAccessToken();
                if (!access) {
                  await logout();
                  // 3. Reset navigation to login screen
                  navigation.reset({
                    index: 0,
                    routes: [{ name: "Login" }],
                  });

                  // await handleLogout();
                  // throw new Error("Not authenticated");
                }
        const res = await fetch(endpoints.notifications(Number(user.id)), {
          headers: { Authorization: `Bearer ${access}` },
        });
        const data = await res.json();
        setNotifCount(data);
      } catch (e) {
        console.error("Failed to fetch notification count:", e);
      }
    };

    fetchNotificationsCount();

    // // Optional: refresh count every 30s while on profile
    // const interval = setInterval(fetchNotificationsCount, 30000);
    // return () => clearInterval(interval);
  }, [user]);



  useFocusEffect(
    React.useCallback(() => {
      console.log("in profile")
      if (!user) return;
      let cancelled = false;

      (async () => {
        try {
                const access = await getAccessToken();
                if (!access) {
                  await logout();
                  navigation.reset({
                    index: 0,
                    routes: [{ name: "Login" }],
                  });
                  // await handleLogout();
                  // throw new Error("Not authenticated");
                }
        const res = await fetch(endpoints.userData(Number(user.id)), {
          headers: {
            Authorization: `Bearer ${access}`
          }
        });
          const data = await res.json();
          if (!cancelled) {
            setSkillLevels(data.skillLevels);
            setNumCoins(data.numCoins);
            setCurrentMemoji(data.currentMemoji);
            setBackgroundColor(data.backgroundColor);
            console.log(currentMemoji)
          }
        } catch (e) {
          console.error('refresh skills failed', e);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [user, setSkillLevels]),
  );

  const fetchBadges = async () => {
    if (!user) return;
                const access = await getAccessToken();
                if (!access) {
                  await logout();
                  navigation.reset({
                    index: 0,
                    routes: [{ name: "Login" }],
                  });
                  // await handleLogout();
                  // throw new Error("Not authenticated");
                }
    const res = await fetch(endpoints.badges(Number(user.id)), {
      headers: { Authorization: `Bearer ${access}` },
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2))
    setBadges(data);
  };


  useFocusEffect(
  React.useCallback(() => {
    (async () => {
      try {
        await fetchBadges();
      } catch (e) {
        console.error('Failed to fetch badges', e);
      }
    })();
  }, [user])
);



    const setUserAlarms = async() => {
      try {
        console.log("herein")
        await scheduleAlarmsForUser(212, 'PAlarm', 5, '');
      } catch (e) {
        console.warn('Failed to schedule alarms for new group challenge', e);
        Alert.alert('Error', 'Failed to schedule alarms');
      }
    }


const collectBadge = async (badgeId: number) => {
      const payload = {
        user_id: user?.id,
        badge_id: badgeId,
      }
  
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error("Not authenticated");
        }
  
        const response = await fetch(endpoints.collectBadge(), {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        })
  
        if (!response.ok) throw new Error(`Server error: ${response.status}`)
  
        Alert.alert("Success", "Badge Collected!")

        await fetchBadges();
      } catch (err) {
        console.error("Failed to collect badge:", err)
        Alert.alert("Error", "Failed to collect badge.")
      }
}




  return (
    <ImageBackground
      source={require('../images/cgpt.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.container}>

      <TouchableOpacity
        style={styles.notificationButton}
        onPress={() => navigation.navigate('Notifications')}
        activeOpacity={0.7}
      >
        <Ionicons name="notifications-outline" size={30} color="#FFD700" />
        {notifCount > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>
              {notifCount > 9 ? '9+' : notifCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ScrollView wraps all content except the bottom navigation */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <UserProfileCard
          name={user?.name ?? 'Loading…'}
          currentMemoji={currentMemoji}
          bgColor={backgroundColor}
          // skill_levels={null}
          numCoins={numCoins}
          badgesGiven={badges}
        />

        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={handleLogout}
          // onPress={logout}
        >
          <Ionicons
            name="log-out-outline"
            size={22}
            color="#FFF"
            style={styles.logoutIcon}
          />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        
        {/* <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate('Wordle', {
              challengeId: 211,   // multiplayer Challenge
              challName: 'Multiplayer Wordle Test',
              whichChall: 'wordle',
            })
          }
        >
          <Ionicons
            name="people"   
            size={22}
            color="#FFF"
            style={styles.logoutIcon}
          />
          <Text style={styles.logoutText}>Multiplayer Wordle</Text>
        </TouchableOpacity> */}

        {/* <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={() =>
            scheduleAlarms([
              {
                time: new Date(Date.now() + 10000),
                screen: 'Wordle',
                data: {
                  challengeId: 30,
                  challName: 'Test Challenge',
                  whichChall: 'wordle',
                },
              },
            ])
          }
        >
          <Ionicons
            name="alarm"
            size={22}
            color="#FFF"
            style={styles.logoutIcon}
          />
          <Text style={styles.logoutText}>Alarm</Text>
        </TouchableOpacity> */}

        
        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate('TypingRace', {
              challId: 477,  // Challenge ID for single player typing race
              challName: 'Typing Race Test',
            })
          }
        >
          <Ionicons
            name="car-sport"  
            color="#FFF"
            style={styles.logoutIcon}
          />
          <Text style={styles.logoutText}>Typing Race Test</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate('TypingRace', {
              challId: 485,  // Challenge ID for single player typing race
              challName: 'Group Typing Race Test',
            })
          }
        >
          <Ionicons
            name="car-sport"  
            color="#FFF"
            style={styles.logoutIcon}
          />
          <Text style={styles.logoutText}>Group Typing Race Test</Text>
        </TouchableOpacity>



        {/* Add padding at the bottom to ensure content isn't hidden behind the nav bar */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Navigation Bar stays fixed at the bottom
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton} onPress={goToChallenges}>
          <Ionicons name="star-outline" size={28} color="#FFF" />
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
          <Ionicons name="person" size={28} color="#FFD700" />
          <Text style={styles.activeNavText}>Profile</Text>
        </TouchableOpacity>
      </View> */}

      <NavBar
        goToPublicChallenges={() => navigation.navigate("PublicChallenges")}
        goToChallenges={() => navigation.navigate("Challenges")}
        goToGroups={() => navigation.navigate("Groups")}
        goToMessages={() => navigation.navigate("Messages")}
        goToProfile={() => navigation.navigate("Profile")}
        active="Profile"
      />

      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 50, 
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollViewContent: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
  },
  profileContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  coinEmoji: {
    fontSize: 18,
    marginLeft: 4,
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
  },
  profileLink: {
    color: '#EEE',
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
    fontWeight: '600',
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
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    marginTop: 2,
  },
  menu: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 16,
    width: '85%',
    marginTop: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 12,
  },
  menuText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  skillsSection: {
    width: '100%',
    marginTop: 10,
    alignItems: 'center',
  },
  skillsTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    alignSelf: 'flex-start',
    marginLeft: 30,
    marginBottom: 8,
  },
  skillsGrid: {
    width: '90%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  skillItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 18,
  },
  skillBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    backgroundColor: '#00B5D8',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: '#0A1015',
  },
  skillBadgeText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },
  skillLabel: {
    color: '#FFF',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 12,
    marginTop: 40,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
  bottomPadding: {
    height: 100, // Ensure content isn't hidden behind the nav bar
  },
  navBar: {
    backgroundColor: '#211F26',
    flexDirection: 'row',
    height: 80,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 15,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navButton: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  navText: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  activeNavText: {
    color: '#FFD700',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  iconShadowContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
  },
  iconWithShadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1.5,
  },
  notificationButton: {
    position: 'absolute',
    top: 60, // adjust for status bar
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  notificationBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'red',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },  
});

export default Profile;